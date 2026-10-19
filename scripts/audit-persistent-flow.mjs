import { createHash } from "node:crypto";
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

const env = {
  ...parseEnvFile(resolve(".env.local")),
  ...parseEnvFile(resolve("apps/web/.env.local")),
  ...process.env
};
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("supabase_environment_incomplete");

const webRequire = createRequire(resolve("apps/web/package.json"));
const collectorRequire = createRequire(resolve("apps/collector/package.json"));
const { createClient } = await import(pathToFileURL(webRequire.resolve("@supabase/supabase-js")).href);
const { default: Conf } = await import(pathToFileURL(collectorRequire.resolve("conf")).href);
const config = new Conf({ projectName: "tokentometro" });
const deviceToken = config.get("deviceToken");
if (typeof deviceToken !== "string" || !deviceToken) throw new Error("collector_device_not_paired");

const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tokenHash = createHash("sha256").update(deviceToken).digest("hex");
const { data: device, error: deviceError } = await admin.from("devices")
  .select("id,profile_id,revoked_at")
  .eq("token_hash", tokenHash)
  .maybeSingle();
if (deviceError) throw new Error("device_query_failed");
if (!device) throw new Error("paired_device_not_found");

const eventFields = "agent,model,repository_snapshot,occurred_at,input_tokens,cached_input_tokens,cache_creation_tokens,output_tokens,reasoning_tokens,total_tokens,estimated_cost_usd,pricing_version,source_version,schema_version";
const [{ data: events, error: eventError }, { data: runs, error: runError }] = await Promise.all([
  admin.from("usage_events").select(eventFields).eq("profile_id", device.profile_id).eq("device_id", device.id),
  admin.from("sync_runs")
    .select("status,received_count,inserted_count,updated_count,ignored_count,rejected_count,finished_at")
    .eq("profile_id", device.profile_id)
    .eq("device_id", device.id)
    .order("started_at", { ascending: false })
    .limit(1)
]);
if (eventError) throw new Error("usage_event_query_failed");
if (runError) throw new Error("sync_run_query_failed");

const serialized = JSON.stringify(events ?? []);
const forbiddenKey = /"(?:prompt|response|message|content|code|credential|cookie|api.?key|auth.?token|local.?path|file.?path|command|tool.?output)"\s*:/i;
const absolutePath = /(?:^|[\s"'(`])(?:[a-zA-Z]:[\\/]|\\\\|\/(?!\/))[^\s]*/;
const agentCounts = Object.fromEntries(["claude-code", "codex", "antigravity"].map((agent) => [agent, (events ?? []).filter((event) => event.agent === agent).length]));
const latestRun = runs?.[0] ?? null;

console.log(JSON.stringify({
  deviceActive: !device.revoked_at,
  eventCount: events?.length ?? 0,
  totalTokens: (events ?? []).reduce((sum, event) => sum + Number(event.total_tokens), 0),
  agentCounts,
  latestRun: latestRun ? {
    status: latestRun.status,
    received: latestRun.received_count,
    inserted: latestRun.inserted_count,
    updated: latestRun.updated_count,
    ignored: latestRun.ignored_count,
    rejected: latestRun.rejected_count
  } : null,
  forbiddenFieldDetected: forbiddenKey.test(serialized),
  absolutePathDetected: absolutePath.test(serialized)
}));
