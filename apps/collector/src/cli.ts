#!/usr/bin/env node
import { Command } from "commander";
import { confirm, input, select } from "@inquirer/prompts";
import Conf from "conf";
import chalk from "chalk";
import ora from "ora";
import { assertNoForbiddenData, ingestResponseSchema, type IngestResponse } from "@tokentometro/contracts";
import { createDeviceSecret, discover, makeBatch, prepareUsageRecord, type PrivacyPolicy } from "./core";

type Settings = {
  apiUrl?: string;
  deviceToken?: string;
  deviceSalt?: string;
  policy?: PrivacyPolicy;
  cursors?: Record<string, string>;
};

const config = new Conf<Settings>({ projectName: "tokentometro" });
const program = new Command();
program.name("tokentometro").description("Telemetria privada de tokens para builders").version("0.1.0");

program.command("setup")
  .description("Vincula este computador à sua conta")
  .option("--api-url <url>", "URL do dashboard")
  .option("--pairing-code <code>", "Código de pareamento")
  .option("--name <name>", "Nome deste computador")
  .option("--policy <policy>", "Política: public-only, anonymize-private ou ignore-unknown")
  .action(async (options: { apiUrl?: string; pairingCode?: string; name?: string; policy?: string }) => {
  const apiUrl = options.apiUrl ?? await input({ message: "URL do dashboard", default: process.env.TOKENTOMETRO_API_URL ?? "http://localhost:3000" });
  const pairingCode = options.pairingCode ?? await input({ message: "Código de pareamento" });
  const name = options.name ?? await input({ message: "Nome deste computador", default: process.env.COMPUTERNAME ?? "Meu computador" });
  const response = await fetch(`${apiUrl}/api/v1/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairingCode, name, platform: process.platform })
  });
  if (!response.ok) throw new Error(`Pareamento recusado (${response.status}). Gere um novo código no dashboard.`);
  const data = await response.json() as { deviceToken: string; mode?: string; persisted?: boolean };
  const allowedPolicies: PrivacyPolicy[] = ["public-only", "anonymize-private", "ignore-unknown"];
  if (options.policy && !allowedPolicies.includes(options.policy as PrivacyPolicy)) {
    throw new Error("Política inválida. Use public-only, anonymize-private ou ignore-unknown.");
  }
  const policy = options.policy as PrivacyPolicy | undefined ?? await select<PrivacyPolicy>({ message: "Política para repositórios", choices: [
    { name: "Mostrar públicos e ocultar privados", value: "public-only" },
    { name: "Mostrar públicos e anonimizar privados", value: "anonymize-private" },
    { name: "Ignorar repositórios não identificados", value: "ignore-unknown" }
  ] });
  config.set({ apiUrl, deviceToken: data.deviceToken, deviceSalt: createDeviceSecret(), policy, cursors: {} });
  if (data.mode === "demo" || data.persisted === false) {
    console.log(chalk.yellow("Modo demonstração: a credencial é local e o dispositivo não foi persistido."));
  } else {
    console.log(chalk.green("✓ Computador vinculado. A credencial foi salva no armazenamento local do usuário."));
  }
});

program.command("scan").description("Mostra uma prévia sem enviar dados").action(async () => {
  const spinner = ora("Procurando fontes locais em modo somente leitura…").start();
  const sources = await discover();
  spinner.stop();
  const records = sources.flatMap((source) => source.records);
  console.log(chalk.bold("\nPrévia da coleta"));
  for (const source of sources) {
    console.log(`${source.detected ? "●" : "○"} ${source.adapter.name}: ${source.records.length} registro(s)${source.error ? ` — ${source.error}` : ""}`);
  }
  console.log(`\nPeríodo: ${records.length ? records.map((record) => record.occurredAt).sort()[0] : "sem dados"} → ${records.length ? records.map((record) => record.occurredAt).sort().at(-1) : "sem dados"}`);
  console.log(`Política: ${config.get("policy") ?? "ainda não definida"}`);
  console.log("Campos enviados: agente, modelo, horário, hash da sessão, contagens de tokens, Custo equivalente estimado, repositório filtrado e versões.");
  console.log(chalk.dim("Nunca enviados: prompts, respostas, código, conteúdo de arquivos, credenciais ou caminhos absolutos."));
});

async function sendBatch(apiUrl: string, token: string, batch: ReturnType<typeof makeBatch>): Promise<IngestResponse> {
  assertNoForbiddenData(batch);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${apiUrl}/api/v1/ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-collector-version": "0.1.0",
        "x-schema-version": "1",
        "x-batch-id": batch.batchId
      },
      body: JSON.stringify(batch)
    });
    const body = await response.json().catch(() => ({ error: "invalid_server_response" })) as { error?: string };
    if (response.ok) return ingestResponseSchema.parse(body);
    if (response.status === 403 && body.error === "device_revoked") {
      throw new Error("Este computador foi revogado. Execute `tokentometro logout` e faça um novo pareamento.");
    }
    if (response.status === 409 && body.error === "demo_mode_does_not_persist") {
      throw new Error("O dashboard está em modo demonstração e não persiste sincronizações.");
    }
    const retryable = response.status === 409 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) {
      throw new Error(`A sincronização falhou (${body.error ?? `HTTP ${response.status}`}). O mesmo lote pode ser reenviado com segurança.`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  throw new Error("A sincronização falhou após novas tentativas seguras.");
}

program.command("sync").description("Sincroniza novos metadados após confirmação").option("-y, --yes", "Confirma o envio sem prompt interativo").action(async (options: { yes?: boolean }) => {
  const token = config.get("deviceToken");
  const apiUrl = config.get("apiUrl");
  const salt = config.get("deviceSalt");
  if (!token || !apiUrl || !salt) throw new Error("Execute `tokentometro setup` primeiro.");

  const policy = config.get("policy") ?? "public-only";
  const cursors = config.get("cursors") ?? {};
  const sources = await discover();
  const freshBySource = sources.map((source) => ({
    ...source,
    records: source.records.filter((record) => !cursors[source.adapter.name] || record.occurredAt > cursors[source.adapter.name]!)
  }));
  const records = freshBySource.flatMap((source) => source.records
    .map((record) => prepareUsageRecord(record, policy, salt))
    .filter((record): record is NonNullable<typeof record> => record !== null));
  if (!records.length) return console.log(chalk.yellow("Nenhum registro novo permitido pela política para sincronizar."));

  console.log(`${records.length} registro(s) preparados. Apenas metadados permitidos serão enviados.`);
  if (!options.yes && !await confirm({ message: "Confirmar sincronização?", default: false })) return;

  let inserted = 0;
  let updated = 0;
  let ignored = 0;
  let rejected = 0;
  for (let index = 0; index < records.length; index += 500) {
    const result = await sendBatch(apiUrl, token, makeBatch(records.slice(index, index + 500)));
    if (result.rejected > 0) {
      throw new Error("A API rejeitou registros do lote. Os cursores locais não foram alterados; corrija a causa e repita a sincronização.");
    }
    inserted += result.inserted;
    updated += result.updated;
    ignored += result.ignored;
    rejected += result.rejected;
  }

  const nextCursors = { ...cursors };
  for (const source of freshBySource) {
    const newest = source.records.map((record) => record.occurredAt).sort().at(-1);
    if (newest) nextCursors[source.adapter.name] = newest;
  }
  config.set("cursors", nextCursors);
  console.log(chalk.green(`✓ Concluído: ${inserted} inseridos, ${updated} atualizados, ${ignored} ignorados, ${rejected} rejeitados.`));
});

program.command("status").description("Exibe o estado local sem mostrar segredos").action(() => console.table({
  vinculado: Boolean(config.get("deviceToken")),
  api: config.get("apiUrl") ?? "não configurada",
  politica: config.get("policy") ?? "não configurada",
  fontesComCursor: Object.keys(config.get("cursors") ?? {}).length
}));

program.command("logout").description("Remove a credencial local deste computador").action(() => {
  config.clear();
  console.log(chalk.green("✓ Credencial e preferências locais removidas."));
});

program.parseAsync().catch((error: unknown) => {
  console.error(chalk.red(error instanceof Error ? error.message : "Erro inesperado"));
  process.exitCode = 1;
});
