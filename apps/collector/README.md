# Tokentômetro Collector

Coletor local e somente leitura de tokens reportados pela telemetria do Claude Code e do Codex. Requer Node.js 20 ou superior.

## Primeiro uso

No dashboard, entre com GitHub, escolha **Adicionar computador** e gere um código temporário de uso único. Depois execute:

```bash
npx tokentometro@beta setup
```

O código é solicitado separadamente e de forma mascarada, para não entrar no comando nem no histórico do terminal. O `setup` confirma o nome do computador e a política de repositórios, vincula o dispositivo, faz uma varredura local somente leitura e mostra uma prévia antes de perguntar `Sincronizar agora?`. A resposta padrão é não.

A distribuição usa `https://web-beta-taupe-89.vercel.app` por padrão. Para desenvolvimento, `--api-url` tem prioridade sobre `TOKENTOMETRO_API_URL`, que tem prioridade sobre a URL padrão.

## Comandos

```bash
npx tokentometro@beta setup   # pareamento, política, prévia e primeira sincronização opcional
npx tokentometro@beta scan    # prévia local; não envia dados
npx tokentometro@beta sync    # sincronização manual com confirmação
npx tokentometro@beta status  # estado local sem exibir a credencial
npx tokentometro@beta logout  # remove credencial, preferências e cursores locais
```

`sync --yes` pula somente a confirmação interativa daquela execução. A coleta continua manual: esta versão não instala daemon, cron, tarefa agendada ou serviço do sistema.

## Instalação global e remoção

Como alternativa ao `npx`:

```bash
npm install --global tokentometro@beta
tokentometro setup
npm uninstall --global tokentometro
```

Remover o pacote não apaga a configuração local nem revoga o dispositivo no servidor. `tokentometro logout` apaga a credencial e as preferências locais, mas também não revoga o dispositivo. Para impedir novos envios daquela credencial, use **Computadores → Revogar → Confirmar revogação** no dashboard.

Sair ou revogar não exclui o histórico. No dashboard beta.2, um dispositivo já revogado pode ser excluído por uma ação separada com confirmação; a exclusão remove também os eventos e execuções ligados a ele.

## Dados e privacidade

O coletor envia apenas agente, modelo, horário, hashes não reversíveis de sessão, componentes de tokens, **Custo equivalente estimado** quando disponível, repositório já filtrado e versões técnicas. Ele nunca envia a identificação original da sessão, prompts, respostas, mensagens, código-fonte, conteúdo de arquivos, comandos, saídas de ferramentas, credenciais, cookies, chaves ou caminhos absolutos.

No pareamento, o servidor fornece uma chave de pseudonimização exclusiva da conta. O coletor aplica HMAC-SHA-256 localmente à combinação de agente e identificação da sessão. Assim, a mesma sessão permanece reconhecível após um novo pareamento da mesma conta, sem poder ser correlacionada com outra conta e sem revelar sua identificação original.

Repositórios públicos podem usar `owner/repository`; privados são ocultados ou recebem hash estável conforme a política; itens desconhecidos podem ser ignorados. A política é aplicada antes da rede. Cursores avançam somente depois da confirmação integral do servidor, e retries reutilizam o mesmo lote.

Claude Code funciona por meio do `ccusage@20.0.36`. Codex funciona por leitura restrita aos metadados e contadores estruturados dos históricos JSONL; mensagens e conteúdo conversacional são ignorados. Históricos Codex `.zst` ainda não são processados. Antigravity é detectado, mas ainda não produz eventos.

## Desenvolvimento

No monorepo:

```bash
corepack pnpm --filter ./apps/collector dev setup
corepack pnpm --filter ./apps/collector test
corepack pnpm --filter ./apps/collector build
```

O contrato compartilhado é incorporado ao bundle; o pacote publicado não depende de `workspace:*` em runtime.

## Licença

Apache-2.0. Consulte `LICENSE` e `NOTICE`.
