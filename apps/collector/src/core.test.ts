import { describe, expect, it } from "vitest";
import { applyRepositoryPrivacy, canonicalizeGithubRemote, createIdempotencyKey, normalizeUsage, parseCcusageSessions, parseCodexSessionLog, prepareUsageRecord, sanitizedSourceError, type RawUsage } from "./core";

const raw: RawUsage = { agent: "codex", model: "gpt-test", sessionId: "session-1", occurredAt: "2026-01-02T12:00:00.000Z", input: 100, cachedInput: 60, output: 20, sourceVersion: "fixture" };
const profileKey = "a".repeat(64);
const anotherProfileKey = "b".repeat(64);

describe("collector core", () => {
  it.each([["git@github.com:acme/app.git", "acme/app"], ["https://github.com/acme/app.git", "acme/app"], ["https://gitlab.com/acme/app", null]])("canonicalizes %s", (value, expected) => expect(canonicalizeGithubRemote(value)).toBe(expected));
  it("produces stable profile-scoped idempotency keys", () => {
    expect(createIdempotencyKey(profileKey, raw)).toBe(createIdempotencyKey(profileKey, raw));
    expect(createIdempotencyKey(profileKey, raw)).not.toBe(createIdempotencyKey(anotherProfileKey, raw));
  });
  it("keeps the same idempotency key while an active session grows", () => {
    expect(createIdempotencyKey(profileKey, raw)).toBe(createIdempotencyKey(profileKey, {
      ...raw,
      occurredAt: "2026-01-02T12:30:00.000Z",
      total: 999
    }));
  });
  it("parses both supported ccusage session JSON shapes", () => {
    const current = parseCcusageSessions(JSON.stringify({ data: [{
      session: "session-current", models: ["claude-sonnet"], inputTokens: 10, cacheReadTokens: 3,
      cacheCreationTokens: 2, outputTokens: 4, totalTokens: 16, costUSD: 0.12,
      lastActivity: "2026-01-02T12:00:00.000Z"
    }] }));
    const legacy = parseCcusageSessions(JSON.stringify({ sessions: [{
      sessionId: "session-legacy", modelsUsed: ["claude-opus", "claude-haiku"], cacheReadInputTokens: 7,
      cacheCreationInputTokens: 1, totalCost: 0.34, firstActivity: "2026-01-01T10:00:00Z"
    }] }));
    expect(current[0]).toEqual(expect.objectContaining({ sessionId: "session-current", model: "claude-sonnet", cachedInput: 3, cost: 0.12 }));
    expect(legacy[0]).toEqual(expect.objectContaining({ sessionId: "session-legacy", model: "multiple-models", cachedInput: 7, cost: 0.34 }));
  });
  it("parses cumulative Codex metadata without double counting cache or reasoning", () => {
    const parsed = parseCodexSessionLog([
      JSON.stringify({ type: "session_meta", timestamp: "2026-01-02T12:00:00Z", payload: { session_id: "codex-session", cwd: "C:\\private\\repo", instructions: "do not collect" } }),
      JSON.stringify({ type: "response_item", payload: { type: "message", content: "private prompt and source code" } }),
      JSON.stringify({ type: "turn_context", timestamp: "2026-01-02T12:01:00Z", payload: { model: "gpt-test", cwd: "C:\\private\\repo" } }),
      JSON.stringify({ type: "token_usage_record", timestamp: "2026-01-02T12:02:00Z", payload: {
        session_id: "codex-session",
        thread_token_usage: { input_tokens: 100, cached_input_tokens: 60, cache_write_input_tokens: 5, output_tokens: 20, reasoning_output_tokens: 7, total_tokens: 120 }
      } })
    ].join("\n"));
    expect(parsed).toEqual(expect.objectContaining({
      agent: "codex", sessionId: "codex-session", model: "gpt-test", occurredAt: "2026-01-02T12:02:00.000Z",
      input: 100, cachedInput: 60, cacheCreation: 5, output: 20, reasoning: 7, total: 120,
      cost: null, sourceVersion: "codex-local-jsonl-v1"
    }));
    expect(JSON.stringify(parsed)).not.toContain("private");
    expect(normalizeUsage(parsed!, profileKey).tokens.total).toBe(120);
  });
  it("supports legacy Codex token_count events and multiple models", () => {
    const parsed = parseCodexSessionLog([
      JSON.stringify({ type: "session_meta", payload: { id: "legacy-session" } }),
      JSON.stringify({ type: "turn_context", payload: { model: "gpt-one" } }),
      JSON.stringify({ type: "turn_context", payload: { model: "gpt-two" } }),
      JSON.stringify({ type: "event_msg", timestamp: "2026-01-03T10:00:00Z", payload: { type: "token_count", info: {
        total_token_usage: { input_tokens: 40, cached_input_tokens: 10, cache_write_input_tokens: 0, output_tokens: 8, reasoning_output_tokens: 3, total_tokens: 48 }
      } } })
    ].join("\n"));
    expect(parsed).toEqual(expect.objectContaining({ sessionId: "legacy-session", model: "multiple-models", total: 48 }));
  });
  it("ignores malformed Codex lines and logs without structured usage", () => {
    expect(parseCodexSessionLog("not-json\n" + JSON.stringify({ type: "response_item", payload: { type: "message", content: "secret" } }))).toBeNull();
  });
  it("keeps the last valid cumulative Codex counter when a later counter regresses", () => {
    const parsed = parseCodexSessionLog([
      JSON.stringify({ type: "session_meta", payload: { id: "regressive-session" } }),
      JSON.stringify({ type: "event_msg", timestamp: "2026-01-03T10:00:00Z", payload: { type: "token_count", info: {
        total_token_usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, reasoning_output_tokens: 5, total_tokens: 120 }
      } } }),
      JSON.stringify({ type: "event_msg", timestamp: "2026-01-03T10:01:00Z", payload: { type: "token_count", info: {
        total_token_usage: { input_tokens: 90, cached_input_tokens: 30, output_tokens: 10, reasoning_output_tokens: 3, total_tokens: 100 }
      } } })
    ].join("\n"));
    expect(parsed).toEqual(expect.objectContaining({ occurredAt: "2026-01-03T10:00:00.000Z", input: 100, output: 20, total: 120 }));
  });
  it("rejects Codex usage when the reported cumulative total is unavailable", () => {
    expect(parseCodexSessionLog([
      JSON.stringify({ type: "session_meta", payload: { id: "missing-total" } }),
      JSON.stringify({ type: "event_msg", timestamp: "2026-01-03T10:00:00Z", payload: { type: "token_count", info: {
        total_token_usage: { input_tokens: 100, output_tokens: 20 }
      } } })
    ].join("\n"))).toBeNull();
  });
  it("anonymizes a private repository", () => {
    const result = applyRepositoryPrivacy(normalizeUsage(raw, profileKey), "acme/private", "private", "anonymize-private", profileKey);
    expect(result?.repository.type).toBe("anonymous");
    expect(JSON.stringify(result)).not.toContain("acme/private");
  });
  it("applies the unknown repository policy before the network boundary", () => {
    expect(prepareUsageRecord({ ...raw, projectPath: "C:\\private\\source" }, "ignore-unknown", profileKey)).toBeNull();
    const allowed = prepareUsageRecord({ ...raw, projectPath: "C:\\private\\source" }, "public-only", profileKey);
    expect(JSON.stringify(allowed)).not.toContain("private\\source");
  });
  it("uses a path-free source error", () => {
    expect(sanitizedSourceError()).not.toMatch(/[a-zA-Z]:\\|\\\\|\/(?:Users|home|tmp)\//);
  });
});

