# Arquitetura

O monorepo possui três fronteiras explícitas:

1. `apps/collector` chama `ccusage@20.0.36` para Claude Code, lê somente eventos estruturados de uso dos históricos JSONL do Codex, normaliza metadados, aplica privacidade e envia lotes.
2. `packages/contracts` define o contrato Zod versionado, cálculo de totais e rejeição recursiva de dados proibidos.
3. `apps/web` autentica usuários e dispositivos, persiste eventos com Supabase e expõe ao dashboard apenas dados do perfil autenticado.

## Fluxo autenticado

1. Supabase conclui GitHub OAuth e entrega uma sessão ao navegador.
2. `requireAuthenticatedProfile` valida o JWT no servidor e cria o perfil uma única vez com metadados públicos mínimos.
3. `POST /api/v1/pairing-codes` gera um código aleatório, armazena somente seu hash e limita a validade a dez minutos.
4. `POST /api/v1/pair` chama `exchange_pairing_code`, que consome o código e cria o dispositivo na mesma transação.
5. O coletor envia lotes autenticados pela credencial exclusiva do dispositivo.
6. `POST /api/v1/ingest` rejeita conteúdo proibido, valida o contrato, verifica revogação e registra `sync_runs`.
7. `GET /api/v1/dashboard` consulta eventos e dispositivos sempre com filtro explícito por `profile_id`.

Antes de processar um lote autenticado, a API consome atomicamente uma cota de até 30 requisições por minuto e por dispositivo em `ingest_rate_limits`. A função correspondente é acessível somente por `service_role`, de modo que a proteção permanece consistente entre instâncias serverless.

## Idempotência

- Cada sessão recebe uma chave SHA-256 estável e `usage_events.idempotency_key` é único.
- `sync_runs.batch_id` é único; repetir um lote concluído retorna sua contagem armazenada.
- O mesmo estado de uma sessão em outro lote é contabilizado como `ignored`; quando uma sessão ainda ativa cresce, a linha existente é atualizada e contabilizada como `updated`.
- Contadores ou horários regressivos e colisões que tentem trocar agente/hash de sessão são ignorados e nunca substituem o estado cumulativo válido.
- O coletor mantém cursor por fonte e só grava os próximos cursores depois que todos os lotes foram confirmados.
- Dispositivo revogado recebe `403 device_revoked`; o coletor não avança os cursores.

## Fluxo de confiança

- Códigos e credenciais de dispositivo são persistidos somente como hash.
- A função atômica de pareamento é `SECURITY DEFINER`, revogada de `anon` e `authenticated` e liberada apenas para `service_role`.
- A service role existe apenas em módulos e rotas de servidor.
- O coletor remove o caminho local antes do contrato e executa uma verificação final de campos proibidos imediatamente antes da rede.
- A API repete a verificação e não ecoa o conteúdo rejeitado.
- O adaptador do Codex ignora mensagens, respostas e saídas de ferramentas; somente `session_meta`, `turn_context` e contadores estruturados de tokens entram no acumulador local.
- O Codex exige `total_tokens` cumulativo reportado. `cached_input_tokens` já pertence a `input_tokens` e `reasoning_output_tokens` já pertence a `output_tokens`; os componentes são preservados, mas não somados novamente.
- RLS restringe tabelas privadas a `auth.uid() = profile_id` ou `auth.uid() = id`.

## Fronteira de dados do dashboard

`RealDashboard` não importa fixtures: obtém a sessão e consulta `/api/v1/dashboard`. `DemoDashboard` é um componente separado que importa apenas `demo-data.ts`. O shell visual recebe um `mode` explícito e desabilita ações que seriam apenas simuladas.

## Modo demonstração

Sem configuração Supabase, o modo demo é identificado em todas as telas. O pareamento é ilustrativo e a ingestão retorna conflito explícito; nenhuma interface declara autenticação, persistência, revogação ou sincronização real.

## Distribuição

O contrato compartilhado é incorporado ao bundle do coletor. Assim, o tarball publicado não possui dependência runtime `workspace:*`. O executável resolve o CLI fixado do `ccusage` pela instalação do próprio pacote, sem depender de um binário transitivo estar no `PATH` global.

