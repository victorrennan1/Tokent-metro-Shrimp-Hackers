# Deploy, OAuth e distribuição

Estas etapas dependem das contas do proprietário. O repositório está preparado, mas nenhum deploy Vercel, alteração OAuth ou publicação npm foi executado automaticamente.

## 1. Atualizar o Supabase

1. Abra o SQL Editor do projeto correto.
2. Aplique, em ordem, os arquivos `supabase/migrations/202610180001_initial_schema.sql` até `202610180004_persistent_ingest_rate_limit.sql`.
3. Confirme que a última migration criou `ingest_rate_limits` e a função `consume_device_ingest_rate_limit`; a função deve permanecer executável somente por `service_role`.
4. Execute localmente `corepack pnpm audit:persistent`. Depois da migration 004, execute também `corepack pnpm audit:idempotency` e `corepack pnpm audit:revocation`.

## 2. Configurar GitHub OAuth no Supabase

Use placeholders até conhecer os domínios finais:

- URL pública do site: `https://<seu-projeto-vercel>.vercel.app`;
- callback do app no navegador: `https://<seu-projeto-vercel>.vercel.app/auth/callback`;
- callback do GitHub OAuth App: `https://<project-ref>.supabase.co/auth/v1/callback`.

No GitHub, crie ou atualize o OAuth App com a URL pública como homepage e com o callback do Supabase, não o callback do app. No Supabase, habilite GitHub, informe Client ID/secret, defina **Site URL** para a URL pública e inclua os callbacks local e de produção na allow list de Redirect URLs. O app solicita somente `read:user`.

## 3. Criar o projeto Vercel

1. Importe este repositório na Vercel.
2. Mantenha **Root Directory** na raiz do repositório. O `vercel.json` raiz instala o workspace, compila `@tokentometro/web` e usa `apps/web/.next` como saída.
3. Cadastre, sem prefixar os segredos com `NEXT_PUBLIC_`:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_SECRET_KEY`;
   - `PAIRING_SECRET`.
4. Gere `PAIRING_SECRET` aleatoriamente com pelo menos 32 caracteres.
5. Publique somente depois de aplicar todas as migrations. Não habilite fixtures em produção.

## 4. Smoke test de produção

Na URL publicada, execute nesta ordem:

1. entrar com GitHub e confirmar que o dashboard real não exibe a faixa **DEMONSTRAÇÃO**;
2. gerar um código de pareamento e vincular um dispositivo de teste;
3. executar `tokentometro scan` e conferir somente fontes, contagens, período e campos permitidos;
4. executar `tokentometro sync`, atualizar o dashboard e comparar sessões/totais;
5. reenviar o mesmo lote com `corepack pnpm audit:idempotency` ou repetir sem dados novos e confirmar total inalterado;
6. revogar o dispositivo no dashboard e confirmar que novo `tokentometro sync` recebe `device_revoked` sem avançar cursores;
7. executar o roteiro RLS abaixo com duas identidades reais.

## 5. Teste RLS com dois usuários reais

1. Entre como usuário A, gere e pareie um dispositivo A; sincronize uma fixture sanitizada.
2. Em outro perfil de navegador, entre como usuário B e pareie um dispositivo B.
3. Com o JWT de B, tente ler e revogar o dispositivo A e consultar eventos/sync runs de A.
4. Todas as operações devem retornar zero linhas, `404` sanitizado ou negação; nenhum ID ou metadado de A pode aparecer.
5. Repita A contra B e registre data, ambiente e resultado. Não marque esta etapa como aprovada com mocks.

## 6. Publicar o coletor no npm

1. Confirme que o nome `tokentometro` está disponível ou pertence à conta correta.
2. Execute `corepack pnpm --filter ./apps/collector pack --pack-destination <diretorio-temporario>`.
3. Inspecione o tarball: ele deve conter somente `dist/cli.js`, `dist/cli.d.ts`, `package.json` e `README.md`.
4. Em diretório temporário, instale o tarball e repita `setup`, `scan`, `sync`, `status` e `logout`.
5. Execute `npm login` e depois `npm publish <caminho-do-tarball> --access public`.
6. Valide `npx tokentometro@latest --help` e uma instalação global limpa.

Não publique o pacote antes de confirmar propriedade do nome e não inclua `.env.local`, configurações do coletor ou arquivos de histórico no tarball.
