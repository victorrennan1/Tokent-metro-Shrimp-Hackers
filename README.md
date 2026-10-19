# Tokentômetro

Telemetria privada de consumo de tokens para builders que usam agentes de programação. O monorepo contém dashboard Next.js, coletor Node.js, contratos compartilhados e Supabase/Postgres com RLS.

## Requisitos

- Node.js 20 ou superior
- Corepack/pnpm 12.14.0
- Um projeto Supabase para o fluxo persistente

## Modo demonstração

```bash
corepack pnpm install
corepack pnpm dev
```

Abra `http://localhost:3000`. Sem variáveis do Supabase, o dashboard mostra uma faixa **DEMONSTRAÇÃO** e usa somente fixtures sanitizadas. O código `SHRIMP-42Q` demonstra o formato de pareamento, mas não cria dispositivo nem permite alegar sincronização persistida; `/api/v1/ingest` responde `demo_mode_does_not_persist`.

## Configuração persistente

1. Copie `.env.example` para `apps/web/.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e um `PAIRING_SECRET` aleatório com pelo menos 32 caracteres.
3. Aplique, em ordem, todas as migrations de `supabase/migrations/`.
4. Ative o provedor GitHub no Supabase Authentication com o escopo mínimo `read:user`.
5. Cadastre `http://localhost:3000/auth/callback` entre as URLs de redirecionamento permitidas.
6. Reinicie `corepack pnpm dev` e entre por `/login`.

No primeiro acesso autenticado, o servidor cria o perfil idempotentemente com nome, handle e avatar públicos do GitHub. A UI real gera códigos de pareamento de uso único, lê `usage_events`, lista dispositivos e permite revogá-los.

Os nomes legados `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` continuam aceitos somente para facilitar migração local. Em configuração nova, use os nomes acima. Nunca exponha `SUPABASE_SECRET_KEY` ou `PAIRING_SECRET` em variáveis `NEXT_PUBLIC_*`.

## Coletor

```bash
corepack pnpm --filter ./apps/collector build
corepack pnpm --filter ./apps/collector dev setup
corepack pnpm --filter ./apps/collector dev scan
corepack pnpm --filter ./apps/collector dev sync
corepack pnpm --filter ./apps/collector dev status
corepack pnpm --filter ./apps/collector dev logout
```

Depois que o pacote for publicado pelo proprietário, a instalação suportada será:

```bash
npx tokentometro@latest setup
# ou
npm install --global tokentometro@latest
tokentometro setup
```

O coletor usa `ccusage@20.0.36` para Claude Code e lê os contadores estruturados dos históricos JSONL do Codex atrás de `UsageAdapter`. Mensagens, prompts, respostas, comandos e saídas de ferramentas do Codex são ignorados. A política de repositório é aplicada antes da rede; caminhos locais não entram no contrato. Cada fonte possui cursor próprio, atualizado somente após a confirmação de todos os lotes. Retries usam o mesmo lote durante a tentativa e as chaves de evento permanecem estáveis entre execuções. No Codex, `cached_input_tokens` já pertence à entrada e `reasoning_tokens` já pertence à saída; eles não são somados novamente. O custo equivalente do Codex permanece nulo.

Antigravity é apenas detectado e ainda não produz eventos. Históricos Codex `.zst` ainda não são processados.

## Verificação

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Os testes incluem perfil idempotente, pareamento válido/expirado/reutilizado, payload proibido, ingestão autenticada, retry de lote, evento repetido, dispositivo revogado, política local e limites RLS estáticos. Testes contra uma instância Supabase real exigem credenciais externas.

As auditorias opcionais abaixo usam a configuração já existente, imprimem apenas contagens e estados sanitizados e nunca exibem segredos, IDs ou conteúdo:

```bash
corepack pnpm audit:persistent
corepack pnpm audit:idempotency
corepack pnpm audit:revocation
```

Consulte [deploy e OAuth](docs/deployment.md) para a sequência de Vercel, Supabase, GitHub e npm que depende das contas do proprietário.

## Revogação e remoção

Execute `tokentometro logout` para apagar a credencial local. No dashboard real, **Computadores → Revogar → Confirmar revogação** impede novos envios imediatamente. A exclusão completa de dados possui suporte de cascata no schema, mas a operação autenticada de exclusão ainda não faz parte desta fatia.

Consulte [arquitetura](docs/architecture.md), [privacidade](docs/privacy.md) e [limitações](docs/limitations.md).
