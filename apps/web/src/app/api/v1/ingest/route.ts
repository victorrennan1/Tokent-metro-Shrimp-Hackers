import { NextResponse } from "next/server";
import { assertNoForbiddenData, ingestBatchSchema, type IngestResponse } from "@tokentometro/contracts";
import { getSupabaseAdmin, sha256 } from "@/lib/supabase-admin";

const attempts = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string) {
  const now = Date.now(), entry = attempts.get(key);
  if (!entry || entry.reset < now) { attempts.set(key, { count: 1, reset: now + 60_000 }); return false; }
  entry.count += 1; return entry.count > 30;
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return NextResponse.json({ error: "device_auth_required" }, { status: 401 });
  if (rateLimited(await sha256(token))) return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  const raw = await request.json().catch(() => null);
  try { assertNoForbiddenData(raw); } catch { return NextResponse.json({ error: "forbidden_data_detected" }, { status: 422 }); }
  const parsed = ingestBatchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_batch", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })) }, { status: 400 });
  if (request.headers.get("x-schema-version") !== "1" || request.headers.get("x-batch-id") !== parsed.data.batchId) return NextResponse.json({ error: "header_contract_mismatch" }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ batchId: parsed.data.batchId, inserted: parsed.data.records.length, updated: 0, ignored: 0, rejected: 0, errors: [], mode: "demo" } satisfies IngestResponse & { mode: string });

  const tokenHash = await sha256(token);
  const { data: device } = await admin.from("devices").select("id,profile_id,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (!device || device.revoked_at) return NextResponse.json({ error: "device_revoked_or_invalid" }, { status: 401 });
  const started = new Date().toISOString();
  const rows = parsed.data.records.map((record) => ({
    idempotency_key: record.idempotencyKey, profile_id: device.profile_id, device_id: device.id, agent: record.agent, model: record.model,
    source_session_hash: record.sourceSessionHash, occurred_at: record.occurredAt, input_tokens: record.tokens.input,
    cached_input_tokens: record.tokens.cachedInput, cache_creation_tokens: record.tokens.cacheCreation, output_tokens: record.tokens.output,
    reasoning_tokens: record.tokens.reasoning, total_tokens: record.tokens.total, estimated_cost_usd: record.estimatedCostUsd,
    pricing_version: record.pricingVersion, source_version: record.sourceVersion, schema_version: 1,
    repository_snapshot: record.repository
  }));
  const { error } = await admin.from("usage_events").upsert(rows, { onConflict: "idempotency_key" });
  const response: IngestResponse = { batchId: parsed.data.batchId, inserted: error ? 0 : rows.length, updated: 0, ignored: 0, rejected: error ? rows.length : 0, errors: error ? [{ index: 0, code: "database_error", message: "O lote pode ser reenviado com segurança." }] : [] };
  await admin.from("sync_runs").insert({ profile_id: device.profile_id, device_id: device.id, batch_id: parsed.data.batchId, started_at: started, finished_at: new Date().toISOString(), status: error ? "failed" : "completed", received_count: rows.length, inserted_count: response.inserted, updated_count: 0, ignored_count: 0, rejected_count: response.rejected, error_summary: error ? "database_error" : null });
  if (!error) await admin.from("devices").update({ last_seen_at: new Date().toISOString(), collector_version: request.headers.get("x-collector-version") }).eq("id", device.id);
  return NextResponse.json(response, { status: error ? 503 : 200 });
}
