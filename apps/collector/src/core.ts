import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
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
const require = createRequire(import.meta.url);

function ccusageCliPath(): string {
  return join(dirname(require.resolve("ccusage/package.json")), "src", "cli.js");
}

export function canonicalizeGithubRemote(remote: string): string | null {
  const clean = remote.trim().replace(/\.git$/, "");
  const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  return match?.[1] && match[2] ? `${match[1]}/${match[2]}` : null;
}

export function createIdempotencyKey(deviceSalt: string, raw: RawUsage): string {
  return sha256([deviceSalt, raw.agent, raw.sessionId].join("|"));
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

export function prepareUsageRecord(raw: RawUsage, policy: PrivacyPolicy, deviceSalt: string): UsageRecord | null {
  const normalized = normalizeUsage(raw, deviceSalt);
  // Raw local paths never cross this boundary. Repository discovery may supply a
  // canonical name in the future; until then the configured unknown policy wins.
  return applyRepositoryPrivacy(normalized, null, "unknown", policy, deviceSalt);
}

export class CcusageAdapter implements UsageAdapter {
  readonly name: UsageRecord["agent"];
  private readonly marker: string;
  constructor(name: UsageRecord["agent"], marker: string) { this.name = name; this.marker = marker; }
  async detect(): Promise<boolean> { return existsSync(join(homedir(), this.marker)); }
  async scan(since?: string): Promise<RawUsage[]> {
    if (this.name !== "claude-code") return [];
    const args = ["claude", "session", "--json", "--offline"];
    if (since) args.push("--since", since.slice(0, 10));
    const result = await execa(process.execPath, [ccusageCliPath(), ...args], { reject: false });
    if (result.exitCode !== 0) throw new Error("A fonte foi detectada, mas o ccusage não conseguiu processá-la.");
    return parseCcusageSessions(result.stdout, this.name);
  }
}

type CodexTokenUsage = {
  input: number | null;
  cachedInput: number | null;
  cacheCreation: number | null;
  output: number | null;
  reasoning: number | null;
  total: number;
};

type CodexSessionAccumulator = {
  sessionId: string | null;
  occurredAt: string | null;
  models: Set<string>;
  usage: CodexTokenUsage | null;
};

function usageIsNonRegressive(previous: CodexTokenUsage, next: CodexTokenUsage): boolean {
  if (next.total < previous.total) return false;
  const fields: Array<keyof Omit<CodexTokenUsage, "total">> = ["input", "cachedInput", "cacheCreation", "output", "reasoning"];
  return fields.every((field) => previous[field] == null || next[field] == null || next[field]! >= previous[field]!);
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function nonNegativeIntegerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function parseCodexTokenUsage(value: unknown): CodexTokenUsage | null {
  const usage = objectOrNull(value);
  if (!usage) return null;
  const total = nonNegativeIntegerOrNull(usage.total_tokens);
  if (total == null) return null;
  return {
    input: nonNegativeIntegerOrNull(usage.input_tokens),
    cachedInput: nonNegativeIntegerOrNull(usage.cached_input_tokens),
    cacheCreation: nonNegativeIntegerOrNull(usage.cache_write_input_tokens),
    output: nonNegativeIntegerOrNull(usage.output_tokens),
    reasoning: nonNegativeIntegerOrNull(usage.reasoning_output_tokens),
    total
  };
}

function isCodexMetadataLine(line: string): boolean {
  if (!/"type"\s*:\s*"(?:session_meta|turn_context|token_usage_record|event_msg)"/.test(line)) return false;
  return !/"type"\s*:\s*"event_msg"/.test(line) || /"type"\s*:\s*"token_count"/.test(line);
}

function applyCodexMetadataLine(accumulator: CodexSessionAccumulator, line: string): void {
  if (!isCodexMetadataLine(line)) return;
  let candidate: unknown;
  try {
    candidate = JSON.parse(line);
  } catch {
    return;
  }
  const row = objectOrNull(candidate);
  const payload = objectOrNull(row?.payload);
  if (!row || !payload) return;

  if (row.type === "session_meta") {
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : typeof payload.id === "string" ? payload.id : null;
    if (sessionId) accumulator.sessionId = sessionId;
    return;
  }

  if (row.type === "turn_context") {
    if (typeof payload.model === "string" && payload.model.length > 0) accumulator.models.add(payload.model);
    return;
  }

  let usage: CodexTokenUsage | null = null;
  if (row.type === "token_usage_record") {
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : typeof payload.thread_id === "string" ? payload.thread_id : null;
    if (sessionId) accumulator.sessionId = sessionId;
    usage = parseCodexTokenUsage(payload.thread_token_usage) ?? parseCodexTokenUsage(payload.usage);
  } else if (row.type === "event_msg" && payload.type === "token_count") {
    usage = parseCodexTokenUsage(objectOrNull(payload.info)?.total_token_usage);
  }
  if (!usage) return;

  const occurredAt = isoDateOrNull(row.timestamp);
  if (!occurredAt) return;
  if ((!accumulator.occurredAt || occurredAt >= accumulator.occurredAt)
    && (!accumulator.usage || usageIsNonRegressive(accumulator.usage, usage))) {
    accumulator.occurredAt = occurredAt;
    accumulator.usage = usage;
  }
}

function codexAccumulator(): CodexSessionAccumulator {
  return { sessionId: null, occurredAt: null, models: new Set<string>(), usage: null };
}

function codexRawUsage(accumulator: CodexSessionAccumulator): RawUsage | null {
  if (!accumulator.sessionId || !accumulator.occurredAt || !accumulator.usage) return null;
  const models = [...accumulator.models];
  return {
    agent: "codex",
    model: models.length === 1 ? models[0]! : models.length > 1 ? "multiple-models" : null,
    sessionId: accumulator.sessionId,
    occurredAt: accumulator.occurredAt,
    ...accumulator.usage,
    cost: null,
    sourceVersion: "codex-local-jsonl-v1"
  };
}

export function parseCodexSessionLog(content: string): RawUsage | null {
  const accumulator = codexAccumulator();
  for (const line of content.split(/\r?\n/)) applyCodexMetadataLine(accumulator, line);
  return codexRawUsage(accumulator);
}

async function codexJsonlFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await codexJsonlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
  }
  return files;
}

async function parseCodexSessionFile(path: string): Promise<RawUsage | null> {
  const accumulator = codexAccumulator();
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) applyCodexMetadataLine(accumulator, line);
  return codexRawUsage(accumulator);
}

export class CodexAdapter implements UsageAdapter {
  readonly name = "codex" as const;
  private readonly sessionDirectory = join(homedir(), ".codex", "sessions");

  async detect(): Promise<boolean> { return existsSync(join(homedir(), ".codex")); }

  async scan(since?: string): Promise<RawUsage[]> {
    if (!existsSync(this.sessionDirectory)) return [];
    const records = (await Promise.all((await codexJsonlFiles(this.sessionDirectory)).map(parseCodexSessionFile)))
      .filter((record): record is RawUsage => record !== null)
      .filter((record) => !since || record.occurredAt > since);
    const bySession = new Map<string, RawUsage>();
    for (const record of records) {
      const previous = bySession.get(record.sessionId);
      const total = record.total ?? 0;
      const previousTotal = previous?.total ?? 0;
      if (!previous || total > previousTotal || (total === previousTotal && record.occurredAt > previous.occurredAt)) {
        bySession.set(record.sessionId, record);
      }
    }
    return [...bySession.values()].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  }
}

function numberOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

export function parseCcusageSessions(output: string, agent: UsageRecord["agent"] = "claude-code"): RawUsage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("O ccusage retornou JSON inválido.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("O formato de sessões do ccusage não foi reconhecido.");
  const payload = parsed as Record<string, unknown>;
  const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.sessions) ? payload.sessions : null;
  if (!rows) throw new Error("O formato de sessões do ccusage não foi reconhecido.");

  return rows.map((candidate) => {
    if (!candidate || typeof candidate !== "object") throw new Error("O ccusage retornou uma sessão inválida.");
    const row = candidate as Record<string, unknown>;
    const sessionId = typeof row.session === "string" ? row.session : typeof row.sessionId === "string" ? row.sessionId : null;
    const activity = typeof row.lastActivity === "string" ? row.lastActivity : typeof row.firstActivity === "string" ? row.firstActivity : null;
    if (!sessionId || !activity || Number.isNaN(Date.parse(activity))) throw new Error("O ccusage retornou uma sessão incompleta.");
    const primaryModels = stringArray(row.models);
    const models = primaryModels.length > 0 ? primaryModels : stringArray(row.modelsUsed);

    return {
      agent,
      model: models.length === 1 ? models[0]! : models.length > 1 ? "multiple-models" : null,
      sessionId,
      occurredAt: new Date(activity).toISOString(),
      input: numberOrNull(row.inputTokens),
      cachedInput: numberOrNull(row.cacheReadTokens) ?? numberOrNull(row.cacheReadInputTokens),
      cacheCreation: numberOrNull(row.cacheCreationTokens) ?? numberOrNull(row.cacheCreationInputTokens),
      output: numberOrNull(row.outputTokens),
      total: numberOrNull(row.totalTokens),
      cost: numberOrNull(row.costUSD) ?? numberOrNull(row.totalCost),
      sourceVersion: "ccusage-20.0.36"
    };
  });
}

export const adapters: UsageAdapter[] = [
  new CcusageAdapter("claude-code", ".claude"),
  new CodexAdapter(),
  new CcusageAdapter("antigravity", ".antigravity")
];

export function sanitizedSourceError(): string {
  return "A fonte foi detectada, mas não pôde ser processada com segurança.";
}

export async function discover(): Promise<Array<{ adapter: UsageAdapter; detected: boolean; records: RawUsage[]; error?: string }>> {
  return Promise.all(adapters.map(async (adapter) => {
    const detected = await adapter.detect();
    if (!detected) return { adapter, detected, records: [] };
    try { return { adapter, detected, records: await adapter.scan() }; }
    catch { return { adapter, detected, records: [], error: sanitizedSourceError() }; }
  }));
}

export function makeBatch(records: UsageRecord[]): IngestBatch {
  return { schemaVersion: 1, batchId: randomUUID(), records };
}

export const createDeviceSecret = () => `ttm_${randomBytes(32).toString("base64url")}`;

