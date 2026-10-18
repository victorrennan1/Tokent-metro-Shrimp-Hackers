import { describe, expect, it } from "vitest";
import { applyRepositoryPrivacy, canonicalizeGithubRemote, createIdempotencyKey, normalizeUsage, type RawUsage } from "./core";

const raw: RawUsage = { agent: "codex", model: "gpt-test", sessionId: "session-1", occurredAt: "2026-01-02T12:00:00.000Z", input: 100, cachedInput: 60, output: 20, sourceVersion: "fixture" };

describe("collector core", () => {
  it.each([["git@github.com:acme/app.git", "acme/app"], ["https://github.com/acme/app.git", "acme/app"], ["https://gitlab.com/acme/app", null]])("canonicalizes %s", (value, expected) => expect(canonicalizeGithubRemote(value)).toBe(expected));
  it("produces stable idempotency keys", () => expect(createIdempotencyKey("salt", raw)).toBe(createIdempotencyKey("salt", raw)));
  it("anonymizes a private repository", () => {
    const result = applyRepositoryPrivacy(normalizeUsage(raw, "salt"), "acme/private", "private", "anonymize-private", "salt");
    expect(result?.repository.type).toBe("anonymous");
    expect(JSON.stringify(result)).not.toContain("acme/private");
  });
});

