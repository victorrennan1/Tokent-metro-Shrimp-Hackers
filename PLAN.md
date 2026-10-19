# Próxima sessão do Codex — preparar e publicar o coletor npm beta

## Objetivo da sessão

Transformar o coletor existente em uma experiência pública instalável pelo npm, com primeiro uso guiado por um único comando:

```powershell
npx tokentometro@beta setup
```

Ao final, o pacote `tokentometro@0.1.0-beta.1` deve estar validado fora do monorepo e pronto para publicação. A publicação no npm só pode ocorrer depois de o proprietário revisar o tarball e autorizar explicitamente `npm publish` durante a sessão.

## Experiência final esperada

1. O usuário entra no dashboard de produção com GitHub.
2. Clica em **Adicionar computador** e recebe um código temporário de uso único.
3. Executa `npx tokentometro@beta setup`.
4. O coletor usa a URL de produção como padrão, mas preserva `--api-url` e `TOKENTOMETRO_API_URL` para desenvolvimento.
5. O usuário informa o código, confirma o nome do computador e escolhe a política de repositórios.
6. O próprio `setup` executa uma varredura somente leitura e mostra a prévia sanitizada.
7. O coletor pergunta se deve realizar a primeira sincronização.
8. Somente após confirmação, os metadados permitidos são enviados.
9. O terminal mostra o resultado e o endereço do dashboard.
10. As próximas coletas permanecem manuais com `npx tokentometro@beta sync`.

`start` não faz parte desta versão. Esse nome fica reservado para uma futura sincronização periódica ou serviço em segundo plano.

## Decisões já tomadas

- Nome público pretendido: `tokentometro`.
- Canal inicial: `beta`.
- Primeira versão: `0.1.0-beta.1`; não publicar `0.1.0` antes de validar o beta.
- Forma principal de uso: `npx tokentometro@beta <comando>`.
- Instalação global é alternativa: `npm install --global tokentometro@beta`.
- Coleta e sincronização permanecem manuais.
- Claude Code e Codex são integrações funcionais.
- Antigravity é somente detectado e não deve ser anunciado como integração funcional.
- O coletor e `packages/contracts` usam Apache-2.0, copyright 2026 Victor Rennan.
- `apps/web`, `supabase` e as demais partes do monorepo permanecem com todos os direitos reservados.
- A URL atual de produção é `https://web-beta-taupe-89.vercel.app`; não inventar domínio definitivo.

## Regras obrigatórias

- Ler `AGENTS.md`, este plano e somente as referências de arquitetura, privacidade e limitações necessárias.
- Preservar mudanças existentes do usuário e não limpar o worktree.
- Nunca coletar, transmitir, empacotar ou registrar prompts, respostas, código, comandos, saídas de ferramentas, credenciais, cookies, chaves ou caminhos absolutos.
- O código de pareamento não deve ser incluído no comando mostrado pela UI, para não ficar gravado no histórico do terminal.
- A prévia ocorre antes do primeiro envio; cancelamento não pode avançar cursores.
- Cursores só avançam depois da confirmação integral do servidor.
- Não adicionar sincronização automática, daemon, serviço do Windows ou cron nesta sessão.
- Não publicar no npm sem confirmação explícita do proprietário depois da inspeção final.
- Não imprimir tokens de autenticação npm nem qualquer segredo durante diagnóstico.

## Etapa 1 — consolidar os metadados do pacote

1. Alterar a versão do coletor para `0.1.0-beta.1` e manter CLI, cabeçalhos de ingestão e pacote consistentes.
2. Evitar versões divergentes no código; preferir uma única fonte de verdade segura para a versão.
3. Completar `package.json` com `author`, `license`, `repository`, `homepage`, `bugs` e `keywords` corretos.
4. Manter `engines.node >=20`, o binário `tokentometro` e somente arquivos necessários em `files`.
5. Confirmar que `LICENSE`, `NOTICE` e README acompanham o tarball.
6. Verificar licenças das dependências de produção e registrar qualquer incompatibilidade real antes da publicação.

## Etapa 2 — implementar o primeiro uso guiado

1. Refatorar o fluxo para que `setup` reutilize as mesmas funções de descoberta, preparação e sincronização dos comandos independentes, sem duplicar regras.
2. Usar a URL de produção como padrão de distribuição.
3. Preservar a precedência explícita:
   - `--api-url`;
   - `TOKENTOMETRO_API_URL`;
   - URL de produção padrão.
4. Manter as perguntas de código de pareamento, nome do computador e política de repositórios.
5. Após parear, executar uma prévia somente leitura com:
   - fontes detectadas;
   - quantidade de sessões por fonte;
   - período;
   - política aplicada;
   - campos permitidos;
   - campos que nunca são enviados.
6. Perguntar `Sincronizar agora?` com resposta padrão negativa.
7. Se o usuário recusar, manter o computador vinculado, não enviar eventos e não avançar cursores.
8. Se aceitar, usar exatamente o fluxo idempotente já existente.
9. Ao concluir, mostrar contagens sanitizadas e a URL do dashboard, sem abrir navegador automaticamente.
10. Preservar os comandos independentes `scan`, `sync`, `status` e `logout`.

## Etapa 3 — atualizar o dashboard de pareamento

1. Em produção, trocar a instrução interna do monorepo por:

   ```powershell
   npx tokentometro@beta setup
   ```

2. Manter o código separado do comando.
3. Explicar que o código é temporário e de uso único.
4. Informar que o coletor mostrará uma prévia antes do primeiro envio.
5. Manter o comportamento do modo demonstração claramente separado e rotulado.

## Etapa 4 — documentação pública

1. Reescrever `apps/collector/README.md` para usuários externos, removendo o comando do monorepo como instrução principal.
2. Documentar:
   - requisito Node.js 20+;
   - primeiro uso com `npx`;
   - comandos `setup`, `scan`, `sync`, `status` e `logout`;
   - instalação global opcional e desinstalação;
   - diferença entre remover o pacote, executar `logout` e revogar o dispositivo;
   - coleta manual;
   - dados coletados e proibidos;
   - Claude Code e Codex funcionais;
   - Antigravity ainda sem eventos;
   - licença Apache-2.0.
3. Atualizar README raiz, `docs/deployment.md` e `docs/limitations.md` para o estado real já comprovado em produção.
4. Não descrever tokens como cobrança ou gasto oficial; usar **tokens reportados pela telemetria local** e **Custo equivalente estimado**.

## Etapa 5 — testes obrigatórios

Adicionar ou atualizar testes para cobrir, no mínimo:

1. prioridade de `--api-url`, variável de ambiente e padrão de produção;
2. `setup` com pareamento válido e primeira sincronização aceita;
3. `setup` com primeira sincronização recusada;
4. cancelamento sem avanço de cursor;
5. nenhuma sessão encontrada;
6. fonte detectada sem eventos;
7. falha de ingestão sem avanço de cursor;
8. retry/idempotência sem duplicação;
9. dispositivo revogado;
10. saída sem credenciais, caminhos absolutos ou conteúdo proibido;
11. preservação dos comandos independentes;
12. UI de pareamento exibindo o comando npm correto em produção e sem código embutido.

## Etapa 6 — validar o artefato fora do monorepo

1. Executar lint, typecheck, testes e build dos pacotes afetados.
2. Executar `npm pack --dry-run` obrigatoriamente dentro de `apps/collector`, nunca na raiz.
3. Revisar a lista completa do tarball e confirmar ausência de `.env`, fontes desnecessárias, fixtures, credenciais e arquivos do dashboard.
4. Gerar o tarball real do beta.
5. Criar diretório temporário fora do monorepo e instalar o tarball.
6. Validar nessa instalação:
   - `tokentometro --version`;
   - `tokentometro setup` contra um fluxo seguro de teste;
   - `tokentometro scan`;
   - `tokentometro sync`;
   - `tokentometro status`;
   - `tokentometro logout`.
7. Confirmar que o pacote não depende de `workspace:*` em runtime.
8. Executar `git diff --check`.

## Etapa 7 — gate de publicação

Antes de qualquer publicação, apresentar ao proprietário:

- versão exata;
- nome e tag npm;
- conteúdo completo do tarball;
- resultado dos testes;
- resultado da instalação fora do monorepo;
- confirmação de que o nome ainda está disponível;
- comando exato que será executado.

Somente depois de autorização explícita, executar a partir de `apps/collector`:

```powershell
npm publish --tag beta --access public
```

Se autenticação ou 2FA forem solicitados, deixar o usuário concluir a etapa diretamente. Nunca solicitar que ele cole senha, token ou OTP no chat.

## Etapa 8 — smoke test do pacote publicado

Se a publicação for autorizada e concluída:

1. Confirmar `npm view tokentometro@beta`.
2. Em novo diretório temporário, executar o pacote vindo do registro, não o tarball local.
3. Validar `npx tokentometro@beta --version`.
4. Executar o fluxo real autorizado: pareamento, prévia, primeira sincronização e dashboard.
5. Repetir `sync` e confirmar ausência de duplicação.
6. Revogar o dispositivo de teste, confirmar recusa posterior e executar `logout`.
7. Não apagar dados ou dispositivos do usuário sem autorização específica.

## Entregáveis claros

Ao final da sessão, devemos ter:

1. `tokentometro@0.1.0-beta.1` com metadados e licença corretos.
2. `setup` guiando pareamento, prévia e primeira sincronização.
3. URL de produção como padrão, com overrides para desenvolvimento preservados.
4. Modal de pareamento usando o comando npm público.
5. README público completo para instalação e uso manual.
6. Testes positivos e negativos do novo onboarding.
7. Tarball auditado e instalado fora do monorepo.
8. Matriz final de verificações aprovadas, reprovadas ou pendentes.
9. Se autorizado: beta publicado e smoke test executado a partir do registro npm.
10. Se não autorizado: pacote pronto, sem publicação, com apenas a ação do proprietário pendente.

## Definição de pronto

A sessão estará concluída quando um builder conseguir partir do dashboard, executar `npx tokentometro@beta setup`, revisar a prévia, autorizar a primeira sincronização e visualizar seus tokens no dashboard sem acessar o monorepo. A versão não pode ser declarada publicada até ser instalada e testada diretamente do registro npm.
