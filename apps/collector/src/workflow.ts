import {
  assertNoForbiddenData,
  ingestResponseSchema,
  pairingResponseSchema,
  type IngestResponse,
  type UsageRecord,
} from "@tokentometro/contracts";
import {
  discover,
  makeBatch,
  prepareUsageRecord,
  type PrivacyPolicy,
} from "./core";
import { COLLECTOR_VERSION } from "./version";

export const PRODUCTION_API_URL = "https://web-beta-taupe-89.vercel.app";
export const PRIVACY_POLICIES: PrivacyPolicy[] = [
  "public-only",
  "anonymize-private",
  "ignore-unknown",
];

export type Settings = {
  apiUrl?: string;
  deviceToken?: string;
  profileHashKey?: string;
  policy?: PrivacyPolicy;
  cursors?: Record<string, string>;
};

export type SettingsStore = {
  get<Key extends keyof Settings>(key: Key): Settings[Key];
  set<Key extends keyof Settings>(key: Key, value: Settings[Key]): unknown;
  clear(): unknown;
};

export type DiscoveryResult = Awaited<ReturnType<typeof discover>>[number];
export type CollectionPlan = {
  sources: DiscoveryResult[];
  freshBySource: DiscoveryResult[];
  records: UsageRecord[];
  nextCursors: Record<string, string>;
};

export type SyncSummary = {
  inserted: number;
  updated: number;
  ignored: number;
  rejected: number;
};

type Fetch = typeof fetch;
type Discover = typeof discover;
type Sleep = (milliseconds: number) => Promise<void>;
type Log = (message: string) => void;

export type SetupOptions = {
  apiUrl?: string;
  pairingCode?: string;
  name?: string;
  policy?: string;
};

export type SetupDependencies = {
  store: SettingsStore;
  promptPairingCode(): Promise<string>;
  promptName(defaultName: string): Promise<string>;
  promptPolicy(): Promise<PrivacyPolicy>;
  confirmFirstSync(): Promise<boolean>;
  log: Log;
  fetch?: Fetch;
  discover?: Discover;
  sleep?: Sleep;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  defaultComputerName?: string;
};

export function resolveApiUrl(
  optionUrl?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidate = optionUrl ?? env.TOKENTOMETRO_API_URL ?? PRODUCTION_API_URL;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(
      "URL do dashboard inválida. Use uma origem HTTP ou HTTPS sem credenciais.",
    );
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error(
      "URL do dashboard inválida. Use uma origem HTTP ou HTTPS sem credenciais.",
    );
  }
  return parsed.origin;
}

export function parsePolicy(value?: string): PrivacyPolicy | undefined {
  if (value === undefined) return undefined;
  if (!PRIVACY_POLICIES.includes(value as PrivacyPolicy)) {
    throw new Error(
      "Política inválida. Use public-only, anonymize-private ou ignore-unknown.",
    );
  }
  return value as PrivacyPolicy;
}

export function validateDeviceName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 80 || !/^[\p{L}\p{N} _.-]+$/u.test(name)) {
    throw new Error(
      "Nome do computador inválido. Use até 80 letras, números, espaços, pontos, hífens ou sublinhados.",
    );
  }
  return name;
}

export async function prepareCollection(
  policy: PrivacyPolicy,
  profileHashKey: string,
  cursors: Record<string, string> = {},
  discoverSources: Discover = discover,
): Promise<CollectionPlan> {
  const sources = await discoverSources();
  const freshBySource = sources.map((source) => ({
    ...source,
    records: source.records.filter(
      (record) =>
        !cursors[source.adapter.name] ||
        record.occurredAt > cursors[source.adapter.name]!,
    ),
  }));
  const records = freshBySource.flatMap((source) =>
    source.records
      .map((record) => prepareUsageRecord(record, policy, profileHashKey))
      .filter((record): record is UsageRecord => record !== null),
  );
  const nextCursors = { ...cursors };
  for (const source of freshBySource) {
    const newest = source.records
      .map((record) => record.occurredAt)
      .sort()
      .at(-1);
    if (newest) nextCursors[source.adapter.name] = newest;
  }
  return { sources, freshBySource, records, nextCursors };
}

export function previewLines(
  plan: CollectionPlan,
  policy: PrivacyPolicy,
): string[] {
  const allRecords = plan.sources.flatMap((source) => source.records);
  const dates = allRecords.map((record) => record.occurredAt).sort();
  const lines = ["", "Prévia local da coleta"];
  for (const source of plan.sources) {
    const state = source.detected ? "detectada" : "não detectada";
    const detail = source.error ? ` — ${source.error}` : "";
    lines.push(
      `${source.adapter.name}: ${state}; ${source.records.length} sessão(ões)${detail}`,
    );
  }
  lines.push(
    `Período: ${dates.length ? `${dates[0]} → ${dates.at(-1)}` : "sem dados"}`,
  );
  lines.push(`Política aplicada: ${policy}`);
  lines.push(`Sessões permitidas após a política: ${plan.records.length}`);
  lines.push(
    "Campos permitidos: agente, modelo, horário, hash da sessão, contagens de tokens, Custo equivalente estimado, repositório filtrado e versões.",
  );
  lines.push(
    "Nunca enviados: prompts, respostas, mensagens, código, conteúdo de arquivos, comandos, saídas de ferramentas, credenciais, cookies, chaves ou caminhos absolutos.",
  );
  return lines;
}

function safeServerError(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9_]{1,64}$/.test(value)
    ? value
    : "server_error";
}

export async function pairDevice(
  apiUrl: string,
  pairingCode: string,
  name: string,
  platform: NodeJS.Platform,
  fetchImpl: Fetch = fetch,
): Promise<ReturnType<typeof pairingResponseSchema.parse>> {
  const response = await fetchImpl(`${apiUrl}/api/v1/pair`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-collector-version": COLLECTOR_VERSION,
    },
    body: JSON.stringify({
      pairingCode: pairingCode.trim(),
      name: validateDeviceName(name),
      platform,
      collectorVersion: COLLECTOR_VERSION,
      sessionHashVersion: 1,
    }),
  });
  const body = await response.json().catch(() => null);
  const parsed = pairingResponseSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    const reason = safeServerError(
      body && typeof body === "object" && "error" in body
        ? (body as { error?: unknown }).error
        : undefined,
    );
    throw new Error(
      `Pareamento recusado (${response.status}; ${reason}). Gere um novo código no dashboard.`,
    );
  }
  return parsed.data;
}

export async function sendBatch(
  apiUrl: string,
  token: string,
  batch: ReturnType<typeof makeBatch>,
  fetchImpl: Fetch = fetch,
  sleep: Sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<IngestResponse> {
  assertNoForbiddenData(batch);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetchImpl(`${apiUrl}/api/v1/ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-collector-version": COLLECTOR_VERSION,
        "x-schema-version": "1",
        "x-batch-id": batch.batchId,
      },
      body: JSON.stringify(batch),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (response.ok) return ingestResponseSchema.parse(body);
    if (response.status === 403 && body?.error === "device_revoked") {
      throw new Error(
        "Este computador foi revogado. Execute `tokentometro logout` e faça um novo pareamento.",
      );
    }
    if (
      response.status === 409 &&
      body?.error === "demo_mode_does_not_persist"
    ) {
      throw new Error(
        "O dashboard está em modo demonstração e não persiste sincronizações.",
      );
    }
    const retryable =
      response.status === 409 ||
      response.status === 429 ||
      response.status >= 500;
    if (!retryable || attempt === 3) {
      throw new Error(
        `A sincronização falhou (${safeServerError(body?.error)}). O mesmo lote pode ser reenviado com segurança.`,
      );
    }
    await sleep(attempt * 250);
  }
  throw new Error("A sincronização falhou após novas tentativas seguras.");
}

export async function synchronizePrepared(
  plan: CollectionPlan,
  apiUrl: string,
  token: string,
  store: SettingsStore,
  fetchImpl: Fetch = fetch,
  sleep?: Sleep,
): Promise<SyncSummary | null> {
  if (!plan.records.length) return null;
  const summary: SyncSummary = {
    inserted: 0,
    updated: 0,
    ignored: 0,
    rejected: 0,
  };
  for (let index = 0; index < plan.records.length; index += 500) {
    const batch = makeBatch(plan.records.slice(index, index + 500));
    const result = await sendBatch(apiUrl, token, batch, fetchImpl, sleep);
    if (result.rejected > 0) {
      throw new Error(
        "A API rejeitou registros do lote. Os cursores locais não foram alterados; corrija a causa e repita a sincronização.",
      );
    }
    summary.inserted += result.inserted;
    summary.updated += result.updated;
    summary.ignored += result.ignored;
    summary.rejected += result.rejected;
  }
  store.set("cursors", plan.nextCursors);
  return summary;
}

export async function runSetup(
  options: SetupOptions,
  dependencies: SetupDependencies,
): Promise<void> {
  const env = dependencies.env ?? process.env;
  const apiUrl = resolveApiUrl(options.apiUrl, env);
  const pairingCode =
    options.pairingCode ?? (await dependencies.promptPairingCode());
  const defaultName =
    dependencies.defaultComputerName ?? env.COMPUTERNAME ?? "Meu computador";
  const name = validateDeviceName(
    options.name ?? (await dependencies.promptName(defaultName)),
  );
  const policy =
    parsePolicy(options.policy) ?? (await dependencies.promptPolicy());
  const pairing = await pairDevice(
    apiUrl,
    pairingCode,
    name,
    dependencies.platform ?? process.platform,
    dependencies.fetch,
  );

  dependencies.store.set("apiUrl", apiUrl);
  dependencies.store.set("deviceToken", pairing.deviceToken);
  dependencies.store.set("profileHashKey", pairing.sessionHashKey);
  dependencies.store.set("policy", policy);
  dependencies.store.set("cursors", {});

  if (pairing.mode === "demo" || pairing.persisted === false) {
    dependencies.log(
      "Modo demonstração: a credencial é apenas local e o dispositivo não foi persistido.",
    );
  } else {
    dependencies.log(
      "✓ Computador vinculado. A credencial foi salva no armazenamento local do usuário.",
    );
  }

  const plan = await prepareCollection(
    policy,
    pairing.sessionHashKey,
    {},
    dependencies.discover,
  );
  previewLines(plan, policy).forEach((line) => dependencies.log(line));
  const shouldSync = await dependencies.confirmFirstSync();
  if (!shouldSync) {
    dependencies.log(
      "Primeira sincronização cancelada. Nenhum evento foi enviado e os cursores permanecem inalterados.",
    );
  } else {
    const summary = await synchronizePrepared(
      plan,
      apiUrl,
      pairing.deviceToken,
      dependencies.store,
      dependencies.fetch,
      dependencies.sleep,
    );
    if (!summary)
      dependencies.log(
        "Nenhuma sessão permitida pela política para sincronizar.",
      );
    else
      dependencies.log(
        `✓ Sincronização concluída: ${summary.inserted} inseridos, ${summary.updated} atualizados, ${summary.ignored} ignorados, ${summary.rejected} rejeitados.`,
      );
  }
  dependencies.log(`Dashboard: ${apiUrl}`);
}
