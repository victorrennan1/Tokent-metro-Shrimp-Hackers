/* eslint-disable @typescript-eslint/no-explicit-any -- fluent Supabase test double mirrors dynamic query builders */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";

const mocks = vi.hoisted(() => ({ getAdmin: vi.fn(), sha256: vi.fn(async (value: string) => `hash:${value}`) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: mocks.getAdmin, sha256: mocks.sha256 }));
import { POST } from "./route";

type Run = { status: string; inserted_count: number; updated_count: number; ignored_count: number; rejected_count: number };

function createStore(revoked = false) {
  const runs = new Map<string, Run>();
  const events = new Map<string, Record<string, unknown>>();
  let currentBatch = "";
  const thenable = (result: unknown) => {
    const query: Record<string, unknown> & PromiseLike<unknown> = {
      eq: vi.fn((key: string, value: string) => { if (key === "batch_id") currentBatch = value; return query; }),
      is: vi.fn(() => query),
      select: vi.fn(() => query),
      maybeSingle: vi.fn(async () => runs.get(currentBatch) ?? null),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };
    return query;
  };
  const admin = {
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    from: vi.fn((table: string) => {
      if (table === "devices") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "device-1", profile_id: "profile-1", revoked_at: revoked ? new Date().toISOString() : null } }) }) }),
        update: () => ({ eq: async () => ({ error: null }) })
      };
      if (table === "sync_runs") return {
        select: () => {
          const query: any = { eq: (key: string, value: string) => { if (key === "batch_id") currentBatch = value; return query; }, maybeSingle: async () => ({ data: runs.get(currentBatch) ?? null }) };
          return query;
        },
        insert: async (row: any) => { currentBatch = row.batch_id; runs.set(row.batch_id, { status: "running", inserted_count: 0, updated_count: 0, ignored_count: 0, rejected_count: 0 }); return { error: null }; },
        update: (values: any) => {
          const result = thenable({ error: null }) as any;
          const originalEq = result.eq;
          result.eq = (key: string, value: string) => {
            originalEq(key, value);
            if (key === "device_id" && currentBatch) {
              const old = runs.get(currentBatch)!;
              runs.set(currentBatch, { ...old, ...values });
            }
            return result;
          };
          return result;
        }
      };
      if (table === "usage_events") return {
        select: () => {
          const query: any = {
            eq: () => query,
            in: async (_key: string, keys: string[]) => ({ data: keys.flatMap((key) => events.has(key) ? [events.get(key)] : []), error: null })
          };
          return query;
        },
        upsert: (rows: Array<Record<string, unknown> & { idempotency_key: string }>) => ({
          select: async () => {
            rows.forEach((row) => events.set(row.idempotency_key, row));
            return { data: rows, error: null };
          }
        })
      };
      throw new Error(`Unexpected table ${table}`);
    })
  };
  return { admin, runs, events };
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function batch(batchId: string, key = hash("event-1"), extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    batchId,
    records: [{
      idempotencyKey: key,
      agent: "codex",
      model: "fixture-model",
      repository: { type: "unknown" },
      sourceSessionHash: hash("session-1"),
      occurredAt: "2026-10-18T12:00:00.000Z",
      tokens: { input: 100, cachedInput: 20, cacheCreation: 0, output: 25, reasoning: null, total: 125 },
      estimatedCostUsd: null,
      pricingVersion: null,
      sourceVersion: "fixture",
      ...extra
    }]
  };
}
function request(payload: ReturnType<typeof batch>) {
  return new Request("http://localhost/api/v1/ingest", { method: "POST", headers: { authorization: "Bearer device-token", "content-type": "application/json", "x-schema-version": "1", "x-batch-id": payload.batchId }, body: JSON.stringify(payload) });
}

describe("authenticated ingestion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists once and returns the stored result for the same batch retry", async () => {
    const store = createStore(); mocks.getAdmin.mockReturnValue(store.admin);
    const id = randomUUID();
    const first = await POST(request(batch(id)));
    const retry = await POST(request(batch(id)));
    expect(await first.json()).toEqual(expect.objectContaining({ inserted: 1, ignored: 0 }));
    expect(await retry.json()).toEqual(expect.objectContaining({ inserted: 1, ignored: 0 }));
    expect(store.events.size).toBe(1);
  });

  it("ignores an existing event sent in a new batch", async () => {
    const store = createStore(); mocks.getAdmin.mockReturnValue(store.admin);
    await POST(request(batch(randomUUID())));
    const response = await POST(request(batch(randomUUID())));
    expect(await response.json()).toEqual(expect.objectContaining({ inserted: 0, ignored: 1 }));
    expect(store.events.size).toBe(1);
  });

  it("updates a growing session without creating another event", async () => {
    const store = createStore(); mocks.getAdmin.mockReturnValue(store.admin);
    const key = hash("growing-session");
    await POST(request(batch(randomUUID(), key)));
    const response = await POST(request(batch(randomUUID(), key, {
      occurredAt: "2026-10-18T12:30:00.000Z",
      tokens: { input: 150, cachedInput: 30, cacheCreation: 0, output: 40, reasoning: null, total: 190 }
    })));
    expect(await response.json()).toEqual(expect.objectContaining({ inserted: 0, updated: 1, ignored: 0 }));
    expect(store.events.size).toBe(1);
    expect(store.events.get(key)?.total_tokens).toBe(190);
  });

  it("ignores a regressive counter without overwriting the stored session", async () => {
    const store = createStore(); mocks.getAdmin.mockReturnValue(store.admin);
    const key = hash("regressive-session");
    await POST(request(batch(randomUUID(), key)));
    const response = await POST(request(batch(randomUUID(), key, {
      occurredAt: "2026-10-18T12:30:00.000Z",
      tokens: { input: 90, cachedInput: 10, cacheCreation: 0, output: 20, reasoning: null, total: 110 }
    })));
    expect(await response.json()).toEqual(expect.objectContaining({ inserted: 0, updated: 0, ignored: 1 }));
    expect(store.events.get(key)?.total_tokens).toBe(125);
  });

  it("does not let an idempotency-key collision change the event identity", async () => {
    const store = createStore(); mocks.getAdmin.mockReturnValue(store.admin);
    const key = hash("identity-collision");
    await POST(request(batch(randomUUID(), key)));
    const response = await POST(request(batch(randomUUID(), key, {
      agent: "claude-code",
      sourceSessionHash: hash("different-session"),
      occurredAt: "2026-10-18T12:30:00.000Z",
      tokens: { input: 150, cachedInput: 30, cacheCreation: 0, output: 40, reasoning: null, total: 190 }
    })));
    expect(await response.json()).toEqual(expect.objectContaining({ updated: 0, ignored: 1 }));
    expect(store.events.get(key)).toEqual(expect.objectContaining({ agent: "codex", source_session_hash: hash("session-1") }));
  });

  it("rejects a revoked device", async () => {
    const store = createStore(true); mocks.getAdmin.mockReturnValue(store.admin);
    const response = await POST(request(batch(randomUUID())));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "device_revoked" });
  });

  it("enforces the persistent per-device rate limit", async () => {
    const store = createStore();
    store.admin.rpc.mockResolvedValue({ data: false, error: null });
    mocks.getAdmin.mockReturnValue(store.admin);
    const response = await POST(request(batch(randomUUID())));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limit_exceeded" });
  });

  it("rejects forbidden content without echoing it", async () => {
    const store = createStore(); mocks.getAdmin.mockReturnValue(store.admin);
    const value = batch(randomUUID(), hash("event-forbidden"), { prompt: "private fixture value" });
    const response = await POST(request(value));
    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).not.toContain("private fixture value");
  });
});
