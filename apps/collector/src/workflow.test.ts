import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RawUsage, UsageAdapter } from "./core";
import {
  PRODUCTION_API_URL,
  prepareCollection,
  previewLines,
  resolveApiUrl,
  runSetup,
  sendBatch,
  synchronizePrepared,
  type Settings,
  type SettingsStore,
} from "./workflow";
import { COLLECTOR_VERSION } from "./version";

class MemoryStore implements SettingsStore {
  readonly values: Settings;
  constructor(initial: Settings = {}) {
    this.values = { ...initial };
  }
  get<Key extends keyof Settings>(key: Key): Settings[Key] {
    return this.values[key];
  }
  set<Key extends keyof Settings>(key: Key, value: Settings[Key]): void {
    this.values[key] = value;
  }
  clear(): void {
    for (const key of Object.keys(this.values) as Array<keyof Settings>)
      delete this.values[key];
  }
}

const raw: RawUsage = {
  agent: "codex",
  model: "gpt-test",
  sessionId: "session-test",
  occurredAt: "2026-10-19T12:00:00.000Z",
  projectPath: "C:\\Users\\private\\source",
  input: 100,
  cachedInput: 50,
  output: 25,
  total: 125,
  sourceVersion: "fixture",
};

function source(records: RawUsage[] = [raw], detected = true) {
  const adapter: UsageAdapter = {
    name: "codex",
    detect: async () => detected,
    scan: async () => records,
  };
  return { adapter, detected, records };
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setupFetch(
  requests: Array<{ url: string; init?: RequestInit }>,
  failIngest = false,
): typeof fetch {
  return vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/api/v1/pair"))
      return response({ deviceToken: "ttm_test-device-token" });
    const batch = JSON.parse(String(init?.body)) as {
      batchId: string;
      records: unknown[];
    };
    if (failIngest) return response({ error: "database_error" }, 503);
    return response({
      batchId: batch.batchId,
      inserted: batch.records.length,
      updated: 0,
      ignored: 0,
      rejected: 0,
      errors: [],
    });
  }) as typeof fetch;
}

function setupDependencies(
  store: MemoryStore,
  fetchImpl: typeof fetch,
  logs: string[],
  sync: boolean,
  records: RawUsage[] = [raw],
) {
  return {
    store,
    promptPairingCode: async () => "PAIR-1234",
    promptName: async () => "Test computer",
    promptPolicy: async () => "public-only" as const,
    confirmFirstSync: async () => sync,
    log: (message: string) => logs.push(message),
    fetch: fetchImpl,
    discover: async () => [source(records)],
    sleep: async () => undefined,
    env: {} as NodeJS.ProcessEnv,
    platform: "win32" as const,
    createSecret: () => "ttm_test-salt",
  };
}

describe("collector workflow", () => {
  it("resolves --api-url before the environment and the production default", () => {
    expect(
      resolveApiUrl("http://localhost:4000", {
        TOKENTOMETRO_API_URL: "http://localhost:5000",
      }),
    ).toBe("http://localhost:4000");
    expect(
      resolveApiUrl(undefined, {
        TOKENTOMETRO_API_URL: "http://localhost:5000",
      }),
    ).toBe("http://localhost:5000");
    expect(resolveApiUrl(undefined, {})).toBe(PRODUCTION_API_URL);
    expect(() => resolveApiUrl("https://user:password@example.test")).toThrow(
      "URL do dashboard inválida",
    );
  });

  it("runs valid pairing, local preview and an accepted first synchronization", async () => {
    const store = new MemoryStore();
    const logs: string[] = [];
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const dependencies = setupDependencies(
      store,
      setupFetch(requests),
      logs,
      true,
    );
    const logger = vi.fn((message: string) => logs.push(message));
    dependencies.log = logger;
    await runSetup({}, dependencies);

    expect(requests.map(({ url }) => url)).toEqual([
      `${PRODUCTION_API_URL}/api/v1/pair`,
      `${PRODUCTION_API_URL}/api/v1/ingest`,
    ]);
    expect(store.values.cursors).toEqual({ codex: raw.occurredAt });
    expect(logs.join("\n")).toContain("Prévia local da coleta");
    expect(logs.join("\n")).toContain(`Dashboard: ${PRODUCTION_API_URL}`);
    expect(logger.mock.calls.every((call) => call.length === 1)).toBe(true);
    expect(requests[0]?.init?.headers).toEqual(
      expect.objectContaining({ "x-collector-version": COLLECTOR_VERSION }),
    );
    expect(requests[1]?.init?.headers).toEqual(
      expect.objectContaining({ "x-collector-version": COLLECTOR_VERSION }),
    );
  });

  it("keeps the device paired but sends nothing and advances no cursor when first sync is declined", async () => {
    const store = new MemoryStore();
    const logs: string[] = [];
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    await runSetup(
      {},
      setupDependencies(store, setupFetch(requests), logs, false),
    );

    expect(store.values.deviceToken).toBe("ttm_test-device-token");
    expect(store.values.cursors).toEqual({});
    expect(requests).toHaveLength(1);
    expect(logs.join("\n")).toContain("Nenhum evento foi enviado");
  });

  it("handles no sessions and a detected source without events", async () => {
    const store = new MemoryStore();
    const logs: string[] = [];
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    await runSetup(
      {},
      setupDependencies(store, setupFetch(requests), logs, true, []),
    );

    expect(requests).toHaveLength(1);
    expect(store.values.cursors).toEqual({});
    expect(logs.join("\n")).toContain("codex: detectada; 0 sessão(ões)");
    expect(logs.join("\n")).toContain("Período: sem dados");
    expect(logs.join("\n")).toContain("Nenhuma sessão permitida pela política");
  });

  it("does not advance cursors after ingestion failure", async () => {
    const store = new MemoryStore({
      cursors: { codex: "2026-10-18T00:00:00.000Z" },
    });
    const plan = await prepareCollection(
      "public-only",
      "ttm_test-salt",
      store.values.cursors,
      async () => [source()],
    );
    const requests: Array<{ url: string; init?: RequestInit }> = [];

    await expect(
      synchronizePrepared(
        plan,
        PRODUCTION_API_URL,
        "ttm_token",
        store,
        setupFetch(requests, true),
        async () => undefined,
      ),
    ).rejects.toThrow("mesmo lote");
    expect(store.values.cursors).toEqual({ codex: "2026-10-18T00:00:00.000Z" });
    expect(requests).toHaveLength(3);
    expect(
      new Set(
        requests.map(
          ({ init }) => (init?.headers as Record<string, string>)["x-batch-id"],
        ),
      ).size,
    ).toBe(1);
  });

  it("retries the identical batch and advances the cursor only after confirmation", async () => {
    const store = new MemoryStore({ cursors: {} });
    const plan = await prepareCollection(
      "public-only",
      "ttm_test-salt",
      {},
      async () => [source()],
    );
    const batchIds: string[] = [];
    let attempt = 0;
    const fetchImpl = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { batchId: string };
        batchIds.push(body.batchId);
        attempt += 1;
        return attempt === 1
          ? response({ error: "temporary_failure" }, 503)
          : response({
              batchId: body.batchId,
              inserted: 1,
              updated: 0,
              ignored: 0,
              rejected: 0,
              errors: [],
            });
      },
    ) as typeof fetch;

    await synchronizePrepared(
      plan,
      PRODUCTION_API_URL,
      "ttm_token",
      store,
      fetchImpl,
      async () => undefined,
    );
    expect(batchIds[0]).toBe(batchIds[1]);
    expect(store.values.cursors).toEqual({ codex: raw.occurredAt });
  });

  it("reports a revoked device without advancing state", async () => {
    const store = new MemoryStore({ cursors: {} });
    const plan = await prepareCollection(
      "public-only",
      "ttm_test-salt",
      {},
      async () => [source()],
    );
    const fetchImpl = vi.fn(async () =>
      response({ error: "device_revoked" }, 403),
    ) as typeof fetch;
    await expect(
      synchronizePrepared(
        plan,
        PRODUCTION_API_URL,
        "ttm_token",
        store,
        fetchImpl,
      ),
    ).rejects.toThrow("revogado");
    expect(store.values.cursors).toEqual({});
  });

  it("keeps output free of pairing codes, device tokens, local paths and source content", async () => {
    const store = new MemoryStore();
    const logs: string[] = [];
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    await runSetup(
      {},
      setupDependencies(store, setupFetch(requests), logs, false),
    );
    const output = logs.join("\n");
    expect(output).not.toContain("PAIR-1234");
    expect(output).not.toContain("ttm_test-device-token");
    expect(output).not.toContain("C:\\Users\\private\\source");
    expect(output).not.toContain("session-test");
  });

  it("shows detected sources and sanitized policy fields in the preview", async () => {
    const plan = await prepareCollection(
      "public-only",
      "ttm_test-salt",
      {},
      async () => [source()],
    );
    const output = previewLines(plan, "public-only").join("\n");
    expect(output).toContain("codex: detectada; 1 sessão(ões)");
    expect(output).toContain("Custo equivalente estimado");
    expect(output).not.toContain(raw.projectPath);
  });

  it("preserves setup, scan, sync, status and logout as independent commands", () => {
    const cli = readFileSync(resolve(process.cwd(), "src/cli.ts"), "utf8");
    for (const command of ["setup", "scan", "sync", "status", "logout"]) {
      expect(cli).toMatch(new RegExp(`\\.command\\(\\s*[\"']${command}[\"']`));
    }
    expect(cli).not.toMatch(/\.command\(\s*["']start["']/);
    expect(cli).not.toContain("--pairing-code");
  });
});

describe("sendBatch privacy boundary", () => {
  it("rejects forbidden content before making a network request", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const unsafe = {
      schemaVersion: 1 as const,
      batchId: crypto.randomUUID(),
      records: [{ prompt: "do not send" }],
    } as never;
    await expect(
      sendBatch(PRODUCTION_API_URL, "ttm_token", unsafe, fetchImpl),
    ).rejects.toThrow("forbidden_field");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
