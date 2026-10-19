# Limitações conhecidas do MVP

## Comprovado nesta sessão

- A varredura somente leitura encontrou eventos reais de Claude Code via `ccusage@20.0.36` e eventos Codex nos JSONL locais. O parser Codex processa somente metadados estruturados e contadores cumulativos; testes cobrem JSONL inválido, total ausente, conteúdo conversacional ignorado, duplicata e contador regressivo.
- Um dispositivo já pareado sincronizou contra o Supabase configurado: houve inserções e atualização monotônica de sessão ativa. A auditoria posterior encontrou eventos dos dois adaptadores, sem campos proibidos nem caminhos absolutos.
- O reenvio exato de um evento e do mesmo lote retornou `ignored`, sem alterar contagem ou total. Um dispositivo de auditoria temporário foi aceito antes da revogação e recebeu `403 device_revoked` depois; o dispositivo e seus dados de teste foram removidos em seguida.
- O tarball `tokentometro@0.1.0-beta.1` foi inspecionado e instalado em diretório temporário fora do monorepo. Ele contém somente `LICENSE`, `NOTICE`, `README.md`, `package.json`, `dist/cli.js` e `dist/cli.d.ts`, sem dependência runtime `workspace:*`.
- Nessa instalação externa, `--version`, `setup`, `scan`, `sync`, `status` e `logout` executaram. O `setup` pareou contra um mock HTTP local, detectou Claude Code, Codex e Antigravity, mostrou somente contagens e categorias permitidas e, após a resposta negativa padrão, não enviou eventos nem avançou cursores. O caminho aceito de primeira sincronização, falhas, retry e revogação está coberto por testes automatizados; não substitui o smoke no backend de produção.

## Pendências externas antes do beta público

- O histórico remoto do Supabase foi consultado em 19 de outubro de 2026 e confirmou as migrations `202610180001` a `202610180004` aplicadas, incluindo o rate limit persistente usado pela ingestão.
- Login GitHub, geração de novo código, pareamento e dashboard autenticado não foram repetidos de ponta a ponta em uma URL Vercel. O perfil e o dispositivo existentes comprovam uso anterior do Supabase, mas não substituem o smoke de produção desta versão.
- O isolamento RLS possui políticas, testes estáticos e escopo explícito nas rotas, mas o roteiro com dois usuários reais ainda não foi executado.
- O dashboard e as rotas alteradas nesta árvore ainda não foram redeployados. O pacote npm não foi publicado; em 19 de outubro de 2026, a consulta pública `npm view tokentometro` retornou `E404`, indicando que o nome público estava disponível naquele momento. A sequência manual está em `docs/deployment.md`.

## Escopo ainda limitado

- O ranking público permanece indisponível em sessões reais. A tela real explica isso e não usa o ranking de demonstração.
- O modo demonstração usa fixtures sanitizadas claramente rotuladas. Pareamento e ingestão demo não persistem e não declaram sucesso real.
- O formato local do Codex não possui contrato público estável e pode exigir atualização. Históricos Codex compactados em `.zst` ainda não são lidos. Antigravity continua somente detectado, sem eventos.
- O custo equivalente das sessões do Codex permanece `null`; seus números são **tokens reportados pela telemetria local do Codex**, não medição oficial da OpenAI nem cobrança.
- A descoberta Git e a classificação automática de visibilidade ainda não fornecem nomes canônicos ao adaptador atual. A política de itens desconhecidos é aplicada antes da rede e nenhum caminho local é transmitido.
- A credencial local é armazenada pelo pacote `conf` no perfil do usuário; integração com o cofre nativo do sistema operacional ainda não foi implementada.
- A UI/API de exclusão de eventos, dispositivo e conta ainda não foi implementada, embora o schema tenha cascatas e a revogação real funcione.
- A tabela de preços é a fornecida pelo adaptador fixado; ausência de preço permanece `null`. O valor exibido é sempre **Custo equivalente estimado**, nunca cobrança real.
