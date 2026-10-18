import { z } from "zod";

export const AGENTS = ["claude-code", "codex", "antigravity"] as const;
export const SCHEMA_VERSION = 1 as const;
export const MAX_BATCH_SIZE = 500;

const safeText = z.string().trim().min(1).max(160);
const tokenCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();

export const repositorySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("public"), canonicalName: z.string().regex(/^[\w.-]+\/[\w.-]+$/) }).strict(),
  z.object({ type: z.literal("anonymous"), anonymousHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ type: z.literal("unknown") }).strict()
]);

export const usageRecordSchema = z.object({
  idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/),
  agent: z.enum(AGENTS),
  model: safeText.nullable(),
  repository: repositorySchema,
  sourceSessionHash: z.string().regex(/^[a-f0-9]{64}$/),
  occurredAt: z.string().datetime({ offset: true }),
  tokens: z.object({
    input: tokenCount,
    cachedInput: tokenCount,
    cacheCreation: tokenCount,
    output: tokenCount,
    reasoning: tokenCount,
    total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict(),
  estimatedCostUsd: z.number().nonnegative().finite().nullable(),
  pricingVersion: z.string().max(64).nullable().default(null),
  sourceVersion: z.string().min(1).max(64)
}).strict();

export const ingestBatchSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  batchId: z.string().uuid(),
  records: z.array(usageRecordSchema).min(1).max(MAX_BATCH_SIZE)
}).strict();

export const ingestResponseSchema = z.object({
  batchId: z.string().uuid(),
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  ignored: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  errors: z.array(z.object({ index: z.number().int().nonnegative(), code: z.string(), message: z.string() }))
});

export type UsageRecord = z.infer<typeof usageRecordSchema>;
export type IngestBatch = z.infer<typeof ingestBatchSchema>;
export type IngestResponse = z.infer<typeof ingestResponseSchema>;

const forbiddenKey = /(prompt|response|message|content|code|credential|cookie|api.?key|auth.?token|local.?path|file.?path|command|tool.?output)/i;
const absolutePath = /(?:[a-zA-Z]:\\|\\\\|\/(?:Users|home|root|var|etc)\/)/;

export function assertNoForbiddenData(value: unknown): void {
  const visit = (node: unknown, path: string): void => {
    if (typeof node === "string" && absolutePath.test(node)) throw new Error(`absolute_path_forbidden:${path}`);
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (forbiddenKey.test(key)) throw new Error(`forbidden_field:${path}.${key}`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(value, "$payload");
}

export function calculateTotal(tokens: Omit<UsageRecord["tokens"], "total">, reported?: number | null): number {
  if (reported != null) return reported;
  return (tokens.input ?? 0) + (tokens.cacheCreation ?? 0) + (tokens.output ?? 0) + (tokens.reasoning ?? 0);
}

