import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { calculateTotal, type IngestBatch, type UsageRecord } from "@tokentometro/contracts";

export type PrivacyPolicy = "public-only" | "anonymize-private" | "ignore-unknown";
export type RawUsage = {
  agent: UsageRecord["agent"];
  model: string | null;
  sessionId: string;
  occurredAt: string;
  projectPath?: string;
  input?: number | null;
  cachedInput?: number | null;
  cacheCreation?: number | null;
  output?: number | null;
  reasoning?: number | null;
  total?: number | null;
  cost?: number | null;
  sourceVersion: string;
};

export interface UsageAdapter {
  readonly name: UsageRecord["agent"];
  detect(): Promise<boolean>;
  scan(since?: string): Promise<RawUsage[]>;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function canonicalizeGithubRemote(remote: string): string | null {
  const clean = remote.trim().replace(/\.git$/, "");
  const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  return match?.[1] && match[2] ? `${match[1]}/${match[2]}` : null;
}

export function createIdempotencyKey(deviceSalt: string, raw: RawUsage): string {
  return sha256([deviceSalt, raw.agent, raw.sessionId, raw.occurredAt, raw.model ?? "unknown"].join("|"));
}

export function normalizeUsage(raw: RawUsage, deviceSalt: string): UsageRecord {
  const pieces = {
    input: raw.input ?? null,
    cachedInput: raw.cachedInput ?? null,
    cacheCreation: raw.cacheCreation ?? null,
    output: raw.output ?? null,
    reasoning: raw.reasoning ?? null
  };
  return {
    idempotencyKey: createIdempotencyKey(deviceSalt, raw),
    agent: raw.agent,
    model: raw.model,
    repository: { type: "unknown" },
    sourceSessionHash: sha256(`${deviceSalt}|${raw.sessionId}`),
    occurredAt: new Date(raw.occurredAt).toISOString(),
    tokens: { ...pieces, total: calculateTotal(pieces, raw.total) },
    estimatedCostUsd: raw.cost ?? null,
    pricingVersion: raw.cost == null ? null : "ccusage-20.0.36",
    sourceVersion: raw.sourceVersion
  };
}

export function applyRepositoryPrivacy(
  record: UsageRecord,
  canonicalName: string | null,
  visibility: "public" | "private" | "unknown",
  policy: PrivacyPolicy,
  salt: string
): UsageRecord | null {
  if (!canonicalName || visibility === "unknown") return policy === "ignore-unknown" ? null : record;
  if (visibility === "public") return { ...record, repository: { type: "public", canonicalName } };
  if (policy === "anonymize-private") {
    return { ...record, repository: { type: "anonymous", anonymousHash: sha256(`${salt}|${canonicalName}`) } };
  }
  return { ...record, repository: { type: "unknown" } };
}

export class CcusageAdapter implements UsageAdapter {
  readonly name: UsageRecord["agent"];
  private readonly marker: string;
  constructor(name: UsageRecord["agent"], marker: string) { this.name = name; this.marker = marker; }
  async detect(): Promise<boolean> { return existsSync(join(homedir(), this.marker)); }
  async scan(): Promise<RawUsage[]> {
    if (this.name !== "claude-code") return [];
    const result = await execa("ccusage", ["daily", "--json"], { reject: false });
    if (result.exitCode !== 0) throw new Error("A fonte foi detectada, mas o ccusage não conseguiu processá-la.");
    const parsed = JSON.parse(result.stdout) as { daily?: Array<Record<string, unknown>> };
    return (parsed.daily ?? []).map((row, index) => ({
      agent: this.name,
      model: typeof row.model === "string" ? row.model : null,
      sessionId: `daily-${String(row.date ?? index)}`,
      occurredAt: new Date(String(row.date ?? Date.now())).toISOString(),
      input: numberOrNull(row.inputTokens),
      cachedInput: numberOrNull(row.cacheReadInputTokens),
      cacheCreation: numberOrNull(row.cacheCreationInputTokens),
      output: numberOrNull(row.outputTokens),
      total: numberOrNull(row.totalTokens),
      cost: numberOrNull(row.totalCost),
      sourceVersion: "ccusage-20.0.36"
    }));
  }
}

function numberOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }

export const adapters: UsageAdapter[] = [
  new CcusageAdapter("claude-code", ".claude"),
  new CcusageAdapter("codex", ".codex"),
  new CcusageAdapter("antigravity", ".antigravity")
];

export async function discover(): Promise<Array<{ adapter: UsageAdapter; detected: boolean; records: RawUsage[]; error?: string }>> {
  return Promise.all(adapters.map(async (adapter) => {
    const detected = await adapter.detect();
    if (!detected) return { adapter, detected, records: [] };
    try { return { adapter, detected, records: await adapter.scan() }; }
    catch (error) { return { adapter, detected, records: [], error: error instanceof Error ? error.message : "Falha desconhecida" }; }
  }));
}

export function makeBatch(records: UsageRecord[]): IngestBatch {
  return { schemaVersion: 1, batchId: randomUUID(), records };
}

export const createDeviceSecret = () => `ttm_${randomBytes(32).toString("base64url")}`;

