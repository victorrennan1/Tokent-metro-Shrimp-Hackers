# Tokentômetro

Telemetria privada de consumo de tokens para builders que usam Claude Code, Codex e Antigravity. Este repositório implementa o MVP descrito em `PRD-Tokentometro-MVP.md` com dashboard Next.js, coletor Node.js, contrato compartilhado e Supabase/Postgres com RLS.

## Requisitos

- Node.js 20 ou superior
- Corepack/pnpm 12.14.0
- Supabase CLI apenas para aplicar migrations localmente

## Desenvolvimento rápido

```bash
corepack pnpm install
corepack pnpm dev
```

Abra `http://localhost:3000`. Sem `.env.local`, o app inicia em modo demonstração com dados sanitizados.

## Configuração real

1. Copie `.env.example` para `.env.local` e preencha a URL, anon key e service role do Supabase.
2. Ative GitHub em Supabase Authentication com escopo mínimo (`read:user`).
3. Aplique `supabase/migrations/202610180001_initial_schema.sql`.
4. Defina `PAIRING_SECRET` com pelo menos 32 caracteres aleatórios.
5. Configure as mesmas variáveis no Vercel e publique `apps/web` com a raiz do monorepo.

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` em variáveis `NEXT_PUBLIC_*`.

## Coletor

Durante o desenvolvimento:

```bash
corepack pnpm --filter tokentometro build
corepack pnpm --filter tokentometro dev -- setup
corepack pnpm --filter tokentometro dev -- scan
corepack pnpm --filter tokentometro dev -- sync
corepack pnpm --filter tokentometro dev -- status
corepack pnpm --filter tokentometro dev -- logout
```

O coletor usa `ccusage@20.0.36` atrás de `UsageAdapter`. Antes do primeiro envio, `scan` apresenta fontes, contagens, período, política e os campos permitidos.

## Qualidade

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Remoção

Execute `tokentometro logout` para apagar a credencial local. No dashboard, **Computadores → Revogar** interrompe novos envios. Em **Privacidade**, o fluxo de exclusão remove eventos ou toda a conta.

Consulte [arquitetura](docs/architecture.md), [privacidade](docs/privacy.md) e [limitações](docs/limitations.md).
