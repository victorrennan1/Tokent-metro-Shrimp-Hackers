import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) return [];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[match[1], value]];
  }));
}

const env = { ...parseEnvFile(resolve(".env.local")), ...parseEnvFile(resolve("apps/web/.env.local")), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("supabase_environment_incomplete");

const webRequire = createRequire(resolve("apps/web/package.json"));
const collectorRequire = createRequire(resolve("apps/collector/package.json"));
const { createClient } = await import(pathToFileURL(webRequire.resolve("@supabase/supabase-js")).href);
const { default: Conf } = await import(pathToFileURL(collectorRequire.resolve("conf")).href);
const config = new Conf({ projectName: "tokentometro" });
const pairedToken = config.get("deviceToken");
const apiUrl = config.get("apiUrl");
if (typeof pairedToken !== "string" || typeof apiUrl !== "string") throw new Error("collector_not_configured");

const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const pairedTokenHash = createHash("sha256").update(pairedToken).digest("hex");
const { data: pairedDevice, error: pairedError } = await admin.from("devices")
  .select("profile_id")
  .eq("token_hash", pairedTokenHash)
  .maybeSingle();
if (pairedError || !pairedDevice) throw new Error("paired_device_not_found");

const auditName = `Tokentometro revocation audit ${randomUUID()}`;
const auditToken = `ttm_${randomBytes(32).toString("base64url")}`;
const auditTokenHash = createHash("sha256").update(auditToken).digest("hex");
let auditDeviceId = null;
let cleanupSucceeded = false;

function batch() {
  return {
    schemaVersion: 1,
    batchId: randomUUID(),
    records: [{
      idempotencyKey: createHash("sha256").update(`${auditToken}|event`).digest("hex"),
      agent: "codex",
      model: "audit-fixture",
      repository: { type: "unknown" },
      sourceSessionHash: createHash("sha256").update(`${auditToken}|session`).digest("hex"),
      occurredAt: new Date().toISOString(),
      tokens: { input: 1, cachedInput: 0, cacheCreation: 0, output: 1, reasoning: 0, total: 2 },
      estimatedCostUsd: null,
      pricingVersion: null,
      sourceVersion: "revocation-audit-v1"
    }]
  };
}

async function send(payload) {
  const response = await fetch(`${apiUrl}/api/v1/ingest`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${auditToken}`,
      "content-type": "application/json",
      "x-collector-version": "0.1.0-audit",
      "x-schema-version": "1",
      "x-batch-id": payload.batchId
    },
    body: JSON.stringify(payload)
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

let beforeRevocation;
let afterRevocation;
try {
  const { data: auditDevice, error: insertError } = await admin.from("devices").insert({
    profile_id: pairedDevice.profile_id,
    name: auditName,
    token_hash: auditTokenHash,
    platform: "audit",
    collector_version: "0.1.0-audit"
  }).select("id").single();
  if (insertError || !auditDevice) throw new Error("audit_device_creation_failed");
  auditDeviceId = auditDevice.id;

  beforeRevocation = await send(batch());
  const { data: revoked, error: revokeError } = await admin.from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", auditDeviceId)
    .eq("profile_id", pairedDevice.profile_id)
    .eq("name", auditName)
    .select("id")
    .single();
  if (revokeError || !revoked) throw new Error("audit_device_revocation_failed");
  afterRevocation = await send(batch());
} finally {
  if (auditDeviceId) {
    const { error: cleanupError } = await admin.from("devices")
      .delete()
      .eq("id", auditDeviceId)
      .eq("profile_id", pairedDevice.profile_id)
      .eq("name", auditName);
    cleanupSucceeded = !cleanupError;
  }
}

console.log(JSON.stringify({
  acceptedBeforeRevocation: beforeRevocation?.status === 200 && beforeRevocation.body?.inserted === 1,
  refusedAfterRevocation: afterRevocation?.status === 403 && afterRevocation.body?.error === "device_revoked",
  cleanupSucceeded
}));
