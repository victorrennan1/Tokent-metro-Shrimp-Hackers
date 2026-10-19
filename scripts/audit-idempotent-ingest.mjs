import { createHash, randomUUID } from "node:crypto";
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
const deviceToken = config.get("deviceToken");
const apiUrl = config.get("apiUrl");
if (typeof deviceToken !== "string" || typeof apiUrl !== "string") throw new Error("collector_not_configured");

const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tokenHash = createHash("sha256").update(deviceToken).digest("hex");
const { data: device, error: deviceError } = await admin.from("devices")
  .select("id,profile_id,revoked_at")
  .eq("token_hash", tokenHash)
  .maybeSingle();
if (deviceError || !device) throw new Error("paired_device_not_found");
if (device.revoked_at) throw new Error("paired_device_revoked");

const fields = "idempotency_key,agent,model,repository_snapshot,source_session_hash,occurred_at,input_tokens,cached_input_tokens,cache_creation_tokens,output_tokens,reasoning_tokens,total_tokens,estimated_cost_usd,pricing_version,source_version";
const { data: event, error: eventError } = await admin.from("usage_events")
  .select(fields)
  .eq("profile_id", device.profile_id)
  .eq("device_id", device.id)
  .order("occurred_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (eventError || !event) throw new Error("usage_event_not_found");

async function snapshot() {
  const { data, error } = await admin.from("usage_events")
    .select("total_tokens")
    .eq("profile_id", device.profile_id)
    .eq("device_id", device.id);
  if (error) throw new Error("usage_snapshot_failed");
  return { count: data.length, total: data.reduce((sum, row) => sum + Number(row.total_tokens), 0) };
}

const batchId = randomUUID();
const payload = {
  schemaVersion: 1,
  batchId,
  records: [{
    idempotencyKey: event.idempotency_key,
    agent: event.agent,
    model: event.model,
    repository: event.repository_snapshot,
    sourceSessionHash: event.source_session_hash,
    occurredAt: event.occurred_at,
    tokens: {
      input: event.input_tokens == null ? null : Number(event.input_tokens),
      cachedInput: event.cached_input_tokens == null ? null : Number(event.cached_input_tokens),
      cacheCreation: event.cache_creation_tokens == null ? null : Number(event.cache_creation_tokens),
      output: event.output_tokens == null ? null : Number(event.output_tokens),
      reasoning: event.reasoning_tokens == null ? null : Number(event.reasoning_tokens),
      total: Number(event.total_tokens)
    },
    estimatedCostUsd: event.estimated_cost_usd == null ? null : Number(event.estimated_cost_usd),
    pricingVersion: event.pricing_version,
    sourceVersion: event.source_version
  }]
};

async function send() {
  const response = await fetch(`${apiUrl}/api/v1/ingest`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${deviceToken}`,
      "content-type": "application/json",
      "x-collector-version": "0.1.0-audit",
      "x-schema-version": "1",
      "x-batch-id": batchId
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(`ingest_audit_failed_http_${response.status}`);
  return { inserted: body.inserted, updated: body.updated, ignored: body.ignored, rejected: body.rejected };
}

const before = await snapshot();
const first = await send();
const retry = await send();
const after = await snapshot();
console.log(JSON.stringify({ first, retry, eventCountUnchanged: before.count === after.count, totalTokensUnchanged: before.total === after.total }));
