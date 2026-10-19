# Tokentômetro Collector

Requer Node.js 20+. Execute com `corepack pnpm --filter ./apps/collector dev <comando>` durante o desenvolvimento.

O adaptador `ccusage@20.0.36` para Claude Code e o adaptador de históricos JSONL do Codex são encapsulados em `src/core.ts`. O coletor lê somente metadados estruturados de uso e não envia prompts, respostas, código, comandos, saídas de ferramentas, credenciais ou caminhos absolutos. Históricos Codex compactados em `.zst` ainda não são processados.

Após a publicação pelo proprietário, use `npx tokentometro@latest setup` ou `npm install --global tokentometro@latest`. Os comandos são `setup`, `scan`, `sync`, `status` e `logout`; `sync --yes` existe para automação consciente. O tarball inclui o contrato compartilhado no bundle e não depende de um pacote `workspace:*` em runtime.
