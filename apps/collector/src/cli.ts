#!/usr/bin/env node
import { Command } from "commander";
import { confirm, input, select } from "@inquirer/prompts";
import Conf from "conf";
import chalk from "chalk";
import ora from "ora";
import { ingestResponseSchema } from "@tokentometro/contracts";
import { createDeviceSecret, discover, makeBatch, normalizeUsage, type PrivacyPolicy } from "./core";

type Settings = { apiUrl?: string; deviceToken?: string; deviceSalt?: string; policy?: PrivacyPolicy; lastSync?: string };
const config = new Conf<Settings>({ projectName: "tokentometro" });
const program = new Command();
program.name("tokentometro").description("Telemetria privada de tokens para builders").version("0.1.0");

program.command("setup").description("Vincula este computador à sua conta").action(async () => {
  const apiUrl = await input({ message: "URL do dashboard", default: process.env.TOKENTOMETRO_API_URL ?? "http://localhost:3000" });
  const pairingCode = await input({ message: "Código de pareamento (10 caracteres)" });
  const name = await input({ message: "Nome deste computador", default: process.env.COMPUTERNAME ?? "Meu computador" });
  const response = await fetch(`${apiUrl}/api/v1/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairingCode, name, platform: process.platform, fallbackSecret: createDeviceSecret() }) });
  if (!response.ok) throw new Error(`Pareamento recusado (${response.status}). Gere um novo código no dashboard.`);
  const data = await response.json() as { deviceToken: string };
  const policy = await select<PrivacyPolicy>({ message: "Política para repositórios", choices: [
    { name: "Mostrar públicos e ocultar privados", value: "public-only" },
    { name: "Mostrar públicos e anonimizar privados", value: "anonymize-private" },
    { name: "Ignorar repositórios não identificados", value: "ignore-unknown" }
  ] });
  config.set({ apiUrl, deviceToken: data.deviceToken, deviceSalt: createDeviceSecret(), policy });
  console.log(chalk.green("✓ Computador vinculado. A credencial foi salva no armazenamento local do usuário."));
});

program.command("scan").description("Mostra uma prévia sem enviar dados").action(async () => {
  const spinner = ora("Procurando fontes locais em modo somente leitura…").start();
  const sources = await discover(); spinner.stop();
  const records = sources.flatMap((source) => source.records);
  console.log(chalk.bold("\nPrévia da coleta"));
  for (const source of sources) console.log(`${source.detected ? "●" : "○"} ${source.adapter.name}: ${source.records.length} registro(s)${source.error ? ` — ${source.error}` : ""}`);
  console.log(`\nPeríodo: ${records.length ? records.map((r) => r.occurredAt).sort()[0] : "sem dados"} → ${records.length ? records.map((r) => r.occurredAt).sort().at(-1) : "sem dados"}`);
  console.log(`Política: ${config.get("policy") ?? "ainda não definida"}`);
  console.log("Campos enviados: agente, modelo, horário, hash da sessão, contagens de tokens, custo estimado, repositório filtrado e versões.");
  console.log(chalk.dim("Nunca enviados: prompts, respostas, código, conteúdo de arquivos, credenciais ou caminhos absolutos."));
});

program.command("sync").description("Sincroniza novos metadados após confirmação").action(async () => {
  const token = config.get("deviceToken"), apiUrl = config.get("apiUrl"), salt = config.get("deviceSalt");
  if (!token || !apiUrl || !salt) throw new Error("Execute `tokentometro setup` primeiro.");
  const sources = await discover();
  const records = sources.flatMap((s) => s.records).filter((r) => !config.get("lastSync") || r.occurredAt > config.get("lastSync")!).map((r) => normalizeUsage(r, salt));
  if (!records.length) return console.log(chalk.yellow("Nenhum registro novo para sincronizar."));
  console.log(`${records.length} registro(s) preparados. Apenas metadados permitidos serão enviados.`);
  if (!await confirm({ message: "Confirmar sincronização?", default: false })) return;
  let inserted = 0, updated = 0, ignored = 0, rejected = 0;
  for (let index = 0; index < records.length; index += 500) {
    const batch = makeBatch(records.slice(index, index + 500));
    const response = await fetch(`${apiUrl}/api/v1/ingest`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-collector-version": "0.1.0", "x-schema-version": "1", "x-batch-id": batch.batchId }, body: JSON.stringify(batch) });
    const result = ingestResponseSchema.parse(await response.json());
    inserted += result.inserted; updated += result.updated; ignored += result.ignored; rejected += result.rejected;
    if (!response.ok) throw new Error(`Lote ${batch.batchId} rejeitado.`);
  }
  config.set("lastSync", new Date().toISOString());
  console.log(chalk.green(`✓ Concluído: ${inserted} inseridos, ${updated} atualizados, ${ignored} ignorados, ${rejected} rejeitados.`));
});

program.command("status").description("Exibe o estado local sem mostrar segredos").action(() => console.table({ vinculado: Boolean(config.get("deviceToken")), api: config.get("apiUrl") ?? "não configurada", politica: config.get("policy") ?? "não configurada", ultimaSincronizacao: config.get("lastSync") ?? "nunca" }));
program.command("logout").description("Remove a credencial local deste computador").action(() => { config.clear(); console.log(chalk.green("✓ Credencial e preferências locais removidas.")); });
program.parseAsync().catch((error: unknown) => { console.error(chalk.red(error instanceof Error ? error.message : "Erro inesperado")); process.exitCode = 1; });

