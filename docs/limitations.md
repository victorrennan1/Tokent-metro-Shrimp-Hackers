# Limitações conhecidas do MVP

## Comprovado nesta sessão

- A varredura somente leitura encontrou eventos reais de Claude Code via `ccusage@20.0.36` e eventos Codex nos JSONL locais. O parser Codex processa somente metadados estruturados e contadores cumulativos; testes cobrem JSONL inválido, total ausente, conteúdo conversacional ignorado, duplicata e contador regressivo.
- Um dispositivo já pareado sincronizou contra o Supabase configurado: houve inserções e atualização monotônica de sessão ativa. A auditoria posterior encontrou eventos dos dois adaptadores, sem campos proibidos nem caminhos absolutos.
- O reenvio exato de um evento e do mesmo lote retornou `ignored`, sem alterar contagem ou total. Um dispositivo de auditoria temporário foi aceito antes da revogação e recebeu `403 device_revoked` depois; o dispositivo e seus dados de teste foram removidos em seguida.
- O tarball `tokentometro@0.1.0-beta.1` foi inspecionado e instalado em diretório temporário fora do monorepo. Ele contém somente `LICENSE`, `NOTICE`, `README.md`, `package.json`, `dist/cli.js` e `dist/cli.d.ts`, sem dependência runtime `workspace:*`.
- Nessa instalação externa, `--version`, `setup`, `scan`, `sync`, `status` e `logout` executaram. O `setup` pareou contra um mock HTTP local, detectou Claude Code, Codex e Antigravity, mostrou somente contagens e categorias permitidas e, após a resposta negativa padrão, não enviou eventos nem avançou cursores. O caminho aceito de primeira sincronização, falhas, retry e revogação está coberto por testes automatizados; não substitui o smoke no backend de produção.
- O `tokentometro@0.1.0-beta.1` foi publicado e o smoke real inseriu 23 sessões. Uma sincronização incremental posterior atualizou uma sessão sem criar outra. O teste também revelou 42 sessões históricas duplicadas por pareamentos anteriores: o beta.1 gerava o hash com segredo do dispositivo, não do perfil.
- A correção beta.2 está implementada localmente com HMAC estável por perfil, unicidade composta no banco, negociação explícita no pareamento e testes entre dispositivos e perfis. Ela ainda depende de aplicar a migration, reimplantar a API, publicar o pacote e repetir o smoke antes de ser declarada funcional em produção.

## Pendências externas para o beta.2

- Aplicar `202610190001_profile_scoped_session_dedup.sql` no Supabase e confirmar as novas fronteiras de acesso.
- Reimplantar a API, publicar `tokentometro@0.1.0-beta.2` e repetir pareamento → sincronização → logout → novo pareamento na mesma conta.
- Os 42 eventos duplicados existentes não podem ser reconciliados pelos hashes antigos. Após o beta.2 ser validado, eles devem ser removidos por dispositivo revogado somente com autorização explícita do proprietário.
- O isolamento RLS possui políticas, testes estáticos e escopo explícito nas rotas, mas o roteiro com dois usuários reais ainda não foi executado.
- O isolamento RLS com duas identidades reais foi confirmado visualmente no dashboard, mas tentativas cruzadas diretas de leitura e revogação ainda não foram executadas com os dois JWTs.

## Escopo ainda limitado

- O ranking público permanece indisponível em sessões reais. A tela real explica isso e não usa o ranking de demonstração.
- O modo demonstração usa fixtures sanitizadas claramente rotuladas. Pareamento e ingestão demo não persistem e não declaram sucesso real.
- O formato local do Codex não possui contrato público estável e pode exigir atualização. Históricos Codex compactados em `.zst` ainda não são lidos. Antigravity continua somente detectado, sem eventos.
- O custo equivalente das sessões do Codex permanece `null`; seus números são **tokens reportados pela telemetria local do Codex**, não medição oficial da OpenAI nem cobrança.
- A descoberta Git e a classificação automática de visibilidade ainda não fornecem nomes canônicos ao adaptador atual. A política de itens desconhecidos é aplicada antes da rede e nenhum caminho local é transmitido.
- A credencial local é armazenada pelo pacote `conf` no perfil do usuário; integração com o cofre nativo do sistema operacional ainda não foi implementada.
- O beta.2 implementa exclusão autenticada de dispositivo já revogado e dos dados ligados a ele por cascata. Exclusão seletiva de eventos e exclusão completa da conta ainda não foram implementadas.
- A tabela de preços é a fornecida pelo adaptador fixado; ausência de preço permanece `null`. O valor exibido é sempre **Custo equivalente estimado**, nunca cobrança real.
