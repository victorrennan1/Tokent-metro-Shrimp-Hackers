# Arquitetura

O monorepo possui três fronteiras explícitas:

1. `apps/collector` chama `ccusage@20.0.36` para Claude Code, lê somente eventos estruturados de uso dos históricos JSONL do Codex, normaliza metadados, aplica privacidade e envia lotes.
2. `packages/contracts` define o contrato Zod versionado, cálculo de totais e rejeição recursiva de dados proibidos.
3. `apps/web` autentica usuários e dispositivos, persiste eventos com Supabase e expõe ao dashboard apenas dados do perfil autenticado.

## Fluxo autenticado

1. Supabase conclui GitHub OAuth e entrega uma sessão ao navegador.
2. `requireAuthenticatedProfile` valida o JWT no servidor e cria o perfil uma única vez com metadados públicos mínimos.
3. `POST /api/v1/pairing-codes` gera um código aleatório, armazena somente seu hash e limita a validade a dez minutos.
4. `POST /api/v1/pair` exige suporte a hash de sessão v1 e chama `exchange_pairing_code_v2`, que consome o código, cria o dispositivo e devolve a chave de pseudonimização estável do perfil na mesma transação.
5. O coletor aplica HMAC-SHA-256 localmente a `agente + session_id`; a identificação original da sessão nunca atravessa a rede.
6. O coletor envia lotes autenticados pela credencial exclusiva do dispositivo.
7. `POST /api/v1/ingest` rejeita conteúdo proibido, valida o contrato, verifica revogação e registra `sync_runs`.
8. `GET /api/v1/dashboard` consulta eventos e dispositivos sempre com filtro explícito por `profile_id`.

Antes de processar um lote autenticado, a API consome atomicamente uma cota de até 30 requisições por minuto e por dispositivo em `ingest_rate_limits`. A função correspondente é acessível somente por `service_role`, de modo que a proteção permanece consistente entre instâncias serverless.

## Idempotência

- Cada sessão recebe uma chave HMAC-SHA-256 estável no perfil; a restrição única `(profile_id, idempotency_key)` impede duplicação entre novos pareamentos sem causar colisão entre contas.
- `sync_runs.batch_id` é único; repetir um lote concluído retorna sua contagem armazenada.
- O mesmo estado de uma sessão em outro lote é contabilizado como `ignored`; quando uma sessão ainda ativa cresce, a linha existente é atualizada e contabilizada como `updated`.
- Contadores ou horários regressivos e colisões que tentem trocar agente/hash de sessão são ignorados e nunca substituem o estado cumulativo válido.
- O coletor mantém cursor por fonte e só grava os próximos cursores depois que todos os lotes foram confirmados.
- Dispositivo revogado recebe `403 device_revoked`; o coletor não avança os cursores.
- Ao reconhecer a mesma sessão em um dispositivo novo, a ingestão transfere a associação da linha ao dispositivo atual mesmo quando os contadores não mudaram. Assim, a exclusão posterior do dispositivo revogado não remove uma sessão já adotada pelo novo pareamento.

## Fluxo de confiança

- Códigos e credenciais de dispositivo são persistidos somente como hash.
- `profile_secrets` guarda a chave de pseudonimização por perfil, não concede acesso a `anon` ou `authenticated` e só a entrega ao coletor pela função de pareamento executável por `service_role`.
- A função atômica de pareamento é `SECURITY DEFINER`, revogada de `anon` e `authenticated` e liberada apenas para `service_role`.
- A service role existe apenas em módulos e rotas de servidor.
- O coletor remove o caminho local antes do contrato e executa uma verificação final de campos proibidos imediatamente antes da rede.
- A API repete a verificação e não ecoa o conteúdo rejeitado.
- O adaptador do Codex ignora mensagens, respostas e saídas de ferramentas; somente `session_meta`, `turn_context` e contadores estruturados de tokens entram no acumulador local.
- O Codex exige `total_tokens` cumulativo reportado. `cached_input_tokens` já pertence a `input_tokens` e `reasoning_output_tokens` já pertence a `output_tokens`; os componentes são preservados, mas não somados novamente.
- RLS restringe tabelas privadas a `auth.uid() = profile_id` ou `auth.uid() = id`.
- A rota de exclusão exige autenticação, filtra simultaneamente por dispositivo e perfil e só remove dispositivos previamente revogados; as chaves estrangeiras eliminam os dados dependentes em cascata.

## Fronteira de dados do dashboard

`RealDashboard` não importa fixtures: obtém a sessão e consulta `/api/v1/dashboard`. `DemoDashboard` é um componente separado que importa apenas `demo-data.ts`. O shell visual recebe um `mode` explícito e desabilita ações que seriam apenas simuladas.

## Modo demonstração

Sem configuração Supabase, o modo demo é identificado em todas as telas. O pareamento é ilustrativo e a ingestão retorna conflito explícito; nenhuma interface declara autenticação, persistência, revogação ou sincronização real.

## Distribuição

O contrato compartilhado é incorporado ao bundle do coletor. Assim, o tarball publicado não possui dependência runtime `workspace:*`. O executável resolve o CLI fixado do `ccusage` pela instalação do próprio pacote, sem depender de um binário transitivo estar no `PATH` global.

O `setup` resolve a origem da API na ordem `--api-url`, `TOKENTOMETRO_API_URL` e `https://web-beta-taupe-89.vercel.app`. Depois do pareamento, ele reutiliza a mesma preparação e sincronização dos comandos independentes: a prévia local acontece antes da confirmação, e a recusa mantém o dispositivo vinculado sem enviar eventos nem avançar cursores. Não existe sincronização periódica neste beta.

