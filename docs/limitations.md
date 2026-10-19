# Limitações conhecidas do MVP

## Comprovado nesta sessão

- A varredura somente leitura encontrou eventos reais de Claude Code via `ccusage@20.0.36` e eventos Codex nos JSONL locais. O parser Codex processa somente metadados estruturados e contadores cumulativos; testes cobrem JSONL inválido, total ausente, conteúdo conversacional ignorado, duplicata e contador regressivo.
- Um dispositivo já pareado sincronizou contra o Supabase configurado: houve inserções e atualização monotônica de sessão ativa. A auditoria posterior encontrou eventos dos dois adaptadores, sem campos proibidos nem caminhos absolutos.
- O reenvio exato de um evento e do mesmo lote retornou `ignored`, sem alterar contagem ou total. Um dispositivo de auditoria temporário foi aceito antes da revogação e recebeu `403 device_revoked` depois; o dispositivo e seus dados de teste foram removidos em seguida.
- O tarball do coletor foi instalado fora do monorepo. Ele não contém dependência runtime `workspace:*`; `setup`, `scan`, `status` e `logout` executaram, e `sync` recusou corretamente um backend demo. O pacote instalado detectou Claude Code e Codex.

## Pendências externas antes do beta público

- A migration `202610180004_persistent_ingest_rate_limit.sql`, adicionada depois da auditoria persistente, ainda precisa ser aplicada ao projeto Supabase pelo proprietário. A ingestão final falha fechada com `rate_limit_unavailable` enquanto ela não existir.
- Login GitHub, geração de novo código, pareamento e dashboard autenticado não foram repetidos de ponta a ponta em uma URL Vercel. O perfil e o dispositivo existentes comprovam uso anterior do Supabase, mas não substituem o smoke de produção desta versão.
- O isolamento RLS possui políticas, testes estáticos e escopo explícito nas rotas, mas o roteiro com dois usuários reais ainda não foi executado.
- Vercel/OAuth e npm não foram publicados nem alterados. A sequência manual está em `docs/deployment.md`.

## Escopo ainda limitado

- O ranking público permanece indisponível em sessões reais. A tela real explica isso e não usa o ranking de demonstração.
- O modo demonstração usa fixtures sanitizadas claramente rotuladas. Pareamento e ingestão demo não persistem e não declaram sucesso real.
- O formato local do Codex não possui contrato público estável e pode exigir atualização. Históricos Codex compactados em `.zst` ainda não são lidos. Antigravity continua somente detectado, sem eventos.
- O custo equivalente das sessões do Codex permanece `null`; seus números são **tokens reportados pela telemetria local do Codex**, não medição oficial da OpenAI nem cobrança.
- A descoberta Git e a classificação automática de visibilidade ainda não fornecem nomes canônicos ao adaptador atual. A política de itens desconhecidos é aplicada antes da rede e nenhum caminho local é transmitido.
- A credencial local é armazenada pelo pacote `conf` no perfil do usuário; integração com o cofre nativo do sistema operacional ainda não foi implementada.
- A UI/API de exclusão de eventos, dispositivo e conta ainda não foi implementada, embora o schema tenha cascatas e a revogação real funcione.
- A tabela de preços é a fornecida pelo adaptador fixado; ausência de preço permanece `null`. O valor exibido é sempre **Custo equivalente estimado**, nunca cobrança real.
