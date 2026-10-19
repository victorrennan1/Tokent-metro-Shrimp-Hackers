#!/usr/bin/env node
import { Command } from "commander";
import { confirm, input, password, select } from "@inquirer/prompts";
import Conf from "conf";
import chalk from "chalk";
import ora from "ora";
import { createEphemeralHashKey } from "./core";
import {
  parsePolicy,
  prepareCollection,
  previewLines,
  runSetup,
  synchronizePrepared,
  type Settings,
  type SettingsStore,
} from "./workflow";
import { COLLECTOR_VERSION } from "./version";

const config = new Conf<Settings>({
  projectName: "tokentometro",
}) as SettingsStore;

export function createProgram(store: SettingsStore = config): Command {
  const program = new Command();
  program
    .name("tokentometro")
    .description("Telemetria privada de tokens para builders")
    .version(COLLECTOR_VERSION);

  program
    .command("setup")
    .description(
      "Vincula este computador, mostra a prévia e oferece a primeira sincronização",
    )
    .option("--api-url <url>", "Origem HTTP(S) do dashboard")
    .option("--name <name>", "Nome deste computador")
    .option(
      "--policy <policy>",
      "Política: public-only, anonymize-private ou ignore-unknown",
    )
    .action(
      async (options: { apiUrl?: string; name?: string; policy?: string }) =>
        runSetup(options, {
          store,
          promptPairingCode: () =>
            password({ message: "Código temporário de pareamento", mask: "*" }),
          promptName: (defaultName) =>
            input({ message: "Nome deste computador", default: defaultName }),
          promptPolicy: () =>
            select({
              message: "Política para repositórios",
              choices: [
                {
                  name: "Mostrar públicos e ocultar privados",
                  value: "public-only" as const,
                },
                {
                  name: "Mostrar públicos e anonimizar privados",
                  value: "anonymize-private" as const,
                },
                {
                  name: "Ignorar repositórios não identificados",
                  value: "ignore-unknown" as const,
                },
              ],
            }),
          confirmFirstSync: () =>
            confirm({ message: "Sincronizar agora?", default: false }),
          log: console.log,
        }),
    );

  program
    .command("scan")
    .description("Mostra uma prévia local sem enviar dados")
    .action(async () => {
      const spinner = ora(
        "Procurando fontes locais em modo somente leitura…",
      ).start();
      const policy = store.get("policy") ?? "public-only";
      const hashKey = store.get("profileHashKey") ?? createEphemeralHashKey();
      const plan = await prepareCollection(
        policy,
        hashKey,
        store.get("cursors") ?? {},
      );
      spinner.stop();
      previewLines(plan, policy).forEach((line) => console.log(line));
    });

  program
    .command("sync")
    .description("Sincroniza novos metadados após confirmação")
    .option("-y, --yes", "Confirma o envio sem prompt interativo")
    .action(async (options: { yes?: boolean }) => {
      const token = store.get("deviceToken");
      const apiUrl = store.get("apiUrl");
      const hashKey = store.get("profileHashKey");
      if (!token || !apiUrl || !hashKey)
        throw new Error("Esta vinculação usa uma identidade de sessão antiga. Execute `tokentometro logout` e depois `tokentometro setup`.");

      const policy = parsePolicy(store.get("policy")) ?? "public-only";
      const plan = await prepareCollection(
        policy,
        hashKey,
        store.get("cursors") ?? {},
      );
      if (!plan.records.length) {
        console.log(
          chalk.yellow(
            "Nenhum registro novo permitido pela política para sincronizar.",
          ),
        );
        return;
      }
      console.log(
        `${plan.records.length} registro(s) preparados. Apenas metadados permitidos serão enviados.`,
      );
      if (
        !options.yes &&
        !(await confirm({
          message: "Confirmar sincronização?",
          default: false,
        }))
      ) {
        console.log(
          "Sincronização cancelada. Nenhum evento foi enviado e os cursores permanecem inalterados.",
        );
        return;
      }
      const summary = await synchronizePrepared(plan, apiUrl, token, store);
      if (summary)
        console.log(
          chalk.green(
            `✓ Concluído: ${summary.inserted} inseridos, ${summary.updated} atualizados, ${summary.ignored} ignorados, ${summary.rejected} rejeitados.`,
          ),
        );
    });

  program
    .command("status")
    .description("Exibe o estado local sem mostrar segredos")
    .action(() =>
      console.table({
        vinculado: Boolean(store.get("deviceToken")),
        api: store.get("apiUrl") ?? "não configurada",
        politica: store.get("policy") ?? "não configurada",
        fontesComCursor: Object.keys(store.get("cursors") ?? {}).length,
      }),
    );

  program
    .command("logout")
    .description("Remove a credencial local deste computador")
    .action(() => {
      store.clear();
      console.log(chalk.green("✓ Credencial e preferências locais removidas."));
    });

  return program;
}

createProgram()
  .parseAsync()
  .catch((error: unknown) => {
    console.error(
      chalk.red(error instanceof Error ? error.message : "Erro inesperado"),
    );
    process.exitCode = 1;
  });
