import { describe, expect, it } from "vitest";
import { assertNoForbiddenData, calculateTotal, ingestBatchSchema } from "./index";

describe("contracts", () => {
  it("does not double count cached input", () => {
    expect(calculateTotal({ input: 100, cachedInput: 80, cacheCreation: 10, output: 20, reasoning: 5 })).toBe(135);
  });
  it("rejects forbidden keys", () => {
    expect(() => assertNoForbiddenData({ records: [{ prompt: "secret" }] })).toThrow("forbidden_field");
  });
  it("limits batch size", () => {
    expect(ingestBatchSchema.safeParse({ schemaVersion: 1, batchId: crypto.randomUUID(), records: [] }).success).toBe(false);
  });
});
