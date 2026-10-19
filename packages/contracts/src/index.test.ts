import { describe, expect, it } from "vitest";
import { assertNoForbiddenData, calculateTotal, ingestBatchSchema, pairingResponseSchema } from "./index";

describe("contracts", () => {
  it("does not double count cached input", () => {
    expect(calculateTotal({ input: 100, cachedInput: 80, cacheCreation: 10, output: 20, reasoning: 5 })).toBe(130);
  });
  it("rejects forbidden keys", () => {
    expect(() => assertNoForbiddenData({ records: [{ prompt: "secret" }] })).toThrow("forbidden_field");
  });
  it.each([
    "C:\\Users\\example\\project",
    "D:/work/project",
    "\\\\server\\share\\project",
    "/tmp/project",
    "/opt/project"
  ])("rejects an absolute local path without echoing it: %s", (path) => {
    expect(() => assertNoForbiddenData({ records: [{ model: path }] })).toThrow("absolute_path_forbidden");
  });
  it("does not mistake an HTTPS URL for a local path", () => {
    expect(() => assertNoForbiddenData({ repository: { canonicalName: "owner/repository" }, sourceVersion: "https://example.test/v1" })).not.toThrow();
  });
  it("limits batch size", () => {
    expect(ingestBatchSchema.safeParse({ schemaVersion: 1, batchId: crypto.randomUUID(), records: [] }).success).toBe(false);
  });
  it("requires a profile-scoped hash key in pairing responses", () => {
    expect(pairingResponseSchema.safeParse({
      deviceToken: `ttm_${"a".repeat(43)}`,
      sessionHashKey: "b".repeat(64)
    }).success).toBe(true);
    expect(pairingResponseSchema.safeParse({
      deviceToken: `ttm_${"a".repeat(43)}`
    }).success).toBe(false);
  });
  it("rejects duplicate idempotency keys inside one batch", () => {
    const record = {
      idempotencyKey: "a".repeat(64), agent: "claude-code", model: null, repository: { type: "unknown" },
      sourceSessionHash: "b".repeat(64), occurredAt: "2026-01-01T00:00:00.000Z",
      tokens: { input: 1, cachedInput: 0, cacheCreation: 0, output: 1, reasoning: null, total: 2 },
      estimatedCostUsd: null, pricingVersion: null, sourceVersion: "fixture"
    };
    expect(ingestBatchSchema.safeParse({ schemaVersion: 1, batchId: crypto.randomUUID(), records: [record, record] }).success).toBe(false);
  });
});
