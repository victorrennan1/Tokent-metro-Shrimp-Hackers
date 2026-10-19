import { NextResponse } from "next/server";
import { assertNoForbiddenData, ingestBatchSchema, type IngestResponse } from "@tokentometro/contracts";
import { getSupabaseAdmin, sha256 } from "@/lib/supabase-admin";

const attempts = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string) {
  const now = Date.now();
  if (attempts.size > 1000) {
    for (const [storedKey, stored] of attempts) if (stored.reset < now) attempts.delete(storedKey);
    if (attempts.size > 5000 && !attempts.has(key)) return true;
  }
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    attempts.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 30;
}

function completedRunResponse(batchId: string, run: { inserted_count: number; updated_count: number; ignored_count: number; rejected_count: number }): IngestResponse {
  return {
    batchId,
    inserted: run.inserted_count,
    updated: run.updated_count,
    ignored: run.ignored_count,
    rejected: run.rejected_count,
    errors: []
  };
}

type UsageEventRow = {
  idempotency_key: string;
  device_id: string;
  agent: string;
  model: string | null;
  source_session_hash: string;
  occurred_at: string;
  input_tokens: number | string | null;
  cached_input_tokens: number | string | null;
  cache_creation_tokens: number | string | null;
  output_tokens: number | string | null;
  reasoning_tokens: number | string | null;
  total_tokens: number | string;
  estimated_cost_usd: number | string | null;
  pricing_version: string | null;
  source_version: string;
  schema_version: number;
  repository_snapshot: unknown;
};

function sameNumber(left: number | string | null, right: number | null): boolean {
  return left == null ? right == null : right != null && Number(left) === right;
}

function repositorySignature(value: unknown): string {
  if (!value || typeof value !== "object") return "invalid";
  const repository = value as { type?: unknown; canonicalName?: unknown; anonymousHash?: unknown };
  return [repository.type, repository.canonicalName, repository.anonymousHash]
    .map((part) => typeof part === "string" ? part : "")
    .join("|");
}

function sameEvent(existing: UsageEventRow, next: UsageEventRow): boolean {
  return existing.agent === next.agent
    && existing.model === next.model
    && existing.source_session_hash === next.source_session_hash
    && Date.parse(existing.occurred_at) === Date.parse(next.occurred_at)
    && sameNumber(existing.input_tokens, next.input_tokens as number | null)
    && sameNumber(existing.cached_input_tokens, next.cached_input_tokens as number | null)
    && sameNumber(existing.cache_creation_tokens, next.cache_creation_tokens as number | null)
    && sameNumber(existing.output_tokens, next.output_tokens as number | null)
    && sameNumber(existing.reasoning_tokens, next.reasoning_tokens as number | null)
    && Number(existing.total_tokens) === Number(next.total_tokens)
    && sameNumber(existing.estimated_cost_usd, next.estimated_cost_usd as number | null)
    && existing.pricing_version === next.pricing_version
    && existing.source_version === next.source_version
    && existing.schema_version === next.schema_version
    && repositorySignature(existing.repository_snapshot) === repositorySignature(next.repository_snapshot);
}

function nonDecreasing(previous: number | string | null, next: number | null): boolean {
  if (previous == null) return true;
  return next != null && next >= Number(previous);
}

function canReplaceEvent(existing: UsageEventRow, next: UsageEventRow): boolean {
  return existing.agent === next.agent
    && existing.source_session_hash === next.source_session_hash
    && Date.parse(next.occurred_at) >= Date.parse(existing.occurred_at)
    && Number(next.total_tokens) >= Number(existing.total_tokens)
    && nonDecreasing(existing.input_tokens, next.input_tokens as number | null)
    && nonDecreasing(existing.cached_input_tokens, next.cached_input_tokens as number | null)
    && nonDecreasing(existing.cache_creation_tokens, next.cache_creation_tokens as number | null)
    && nonDecreasing(existing.output_tokens, next.output_tokens as number | null)
    && nonDecreasing(existing.reasoning_tokens, next.reasoning_tokens as number | null);
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return NextResponse.json({ error: "device_auth_required" }, { status: 401 });
  if (rateLimited(await sha256(token))) return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });

  const raw = await request.json().catch(() => null);
  try {
    assertNoForbiddenData(raw);
  } catch {
    return NextResponse.json({ error: "forbidden_data_detected" }, { status: 422 });
  }
  const parsed = ingestBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({
      error: "invalid_batch",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code }))
    }, { status: 400 });
  }
  if (request.headers.get("x-schema-version") !== "1" || request.headers.get("x-batch-id") !== parsed.data.batchId) {
    return NextResponse.json({ error: "header_contract_mismatch" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "demo_mode_does_not_persist", mode: "demo" }, { status: 409 });

  const tokenHash = await sha256(token);
  const { data: device } = await admin.from("devices").select("id,profile_id,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (!device) return NextResponse.json({ error: "device_invalid" }, { status: 401 });
  if (device.revoked_at) return NextResponse.json({ error: "device_revoked" }, { status: 403 });
  const { data: rateAllowed, error: rateError } = await admin.rpc("consume_device_ingest_rate_limit", {
    p_device_id: device.id,
    p_limit: 30
  });
  if (rateError) return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  if (!rateAllowed) return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });

  const { data: previousRun } = await admin.from("sync_runs")
    .select("status,inserted_count,updated_count,ignored_count,rejected_count")
    .eq("batch_id", parsed.data.batchId)
    .eq("device_id", device.id)
    .maybeSingle();
  if (previousRun?.status === "completed") return NextResponse.json(completedRunResponse(parsed.data.batchId, previousRun));
  if (previousRun?.status === "running") return NextResponse.json({ error: "batch_already_processing" }, { status: 409 });

  const startedAt = new Date().toISOString();
  if (previousRun) {
    const { error } = await admin.from("sync_runs").update({ status: "running", started_at: startedAt, finished_at: null, error_summary: null })
      .eq("batch_id", parsed.data.batchId).eq("device_id", device.id);
    if (error) return NextResponse.json({ error: "sync_run_update_failed" }, { status: 503 });
  } else {
    const { error } = await admin.from("sync_runs").insert({
      profile_id: device.profile_id,
      device_id: device.id,
      batch_id: parsed.data.batchId,
      started_at: startedAt,
      status: "running",
      received_count: parsed.data.records.length
    });
    if (error) return NextResponse.json({ error: "batch_already_processing" }, { status: 409 });
  }

  const rows = parsed.data.records.map((record) => ({
    idempotency_key: record.idempotencyKey,
    profile_id: device.profile_id,
    device_id: device.id,
    agent: record.agent,
    model: record.model,
    source_session_hash: record.sourceSessionHash,
    occurred_at: record.occurredAt,
    input_tokens: record.tokens.input,
    cached_input_tokens: record.tokens.cachedInput,
    cache_creation_tokens: record.tokens.cacheCreation,
    output_tokens: record.tokens.output,
    reasoning_tokens: record.tokens.reasoning,
    total_tokens: record.tokens.total,
    estimated_cost_usd: record.estimatedCostUsd,
    pricing_version: record.pricingVersion,
    source_version: record.sourceVersion,
    schema_version: 1,
    repository_snapshot: record.repository
  }));
  const { data: existingRows, error: lookupError } = await admin.from("usage_events")
    .select("idempotency_key,device_id,agent,model,source_session_hash,occurred_at,input_tokens,cached_input_tokens,cache_creation_tokens,output_tokens,reasoning_tokens,total_tokens,estimated_cost_usd,pricing_version,source_version,schema_version,repository_snapshot")
    .eq("profile_id", device.profile_id)
    .in("idempotency_key", rows.map((row) => row.idempotency_key));
  const existingByKey = new Map((existingRows as UsageEventRow[] | null)?.map((row) => [row.idempotency_key, row]) ?? []);
  const rowsToWrite = lookupError ? [] : rows.filter((row) => {
    const existing = existingByKey.get(row.idempotency_key);
    if (!existing) return true;
    const sameIdentity = existing.agent === row.agent
      && existing.source_session_hash === row.source_session_hash;
    const adoptedByCurrentDevice = sameIdentity
      && existing.device_id !== row.device_id
      && (sameEvent(existing, row) || canReplaceEvent(existing, row));
    return adoptedByCurrentDevice
      || (!sameEvent(existing, row) && canReplaceEvent(existing, row));
  });
  const writeResult = lookupError || rowsToWrite.length === 0
    ? { error: lookupError }
    : await admin.from("usage_events").upsert(rowsToWrite, { onConflict: "profile_id,idempotency_key" }).select("idempotency_key");
  const error = writeResult.error;
  const inserted = error ? 0 : rowsToWrite.filter((row) => !existingByKey.has(row.idempotency_key)).length;
  const updated = error ? 0 : rowsToWrite.length - inserted;
  const ignored = lookupError ? 0 : rows.length - rowsToWrite.length;
  const response: IngestResponse = {
    batchId: parsed.data.batchId,
    inserted,
    updated,
    ignored,
    rejected: error ? (lookupError ? rows.length : rowsToWrite.length) : 0,
    errors: error ? [{ index: 0, code: "database_error", message: "O lote pode ser reenviado com segurança." }] : []
  };
  await admin.from("sync_runs").update({
    finished_at: new Date().toISOString(),
    status: error ? "failed" : "completed",
    received_count: rows.length,
    inserted_count: response.inserted,
    updated_count: response.updated,
    ignored_count: response.ignored,
    rejected_count: response.rejected,
    error_summary: error ? "database_error" : null
  }).eq("batch_id", parsed.data.batchId).eq("device_id", device.id);

  if (!error) {
    await admin.from("devices").update({
      last_seen_at: new Date().toISOString(),
      collector_version: request.headers.get("x-collector-version")
    }).eq("id", device.id);
  }
  return NextResponse.json(response, { status: error ? 503 : 200 });
}
