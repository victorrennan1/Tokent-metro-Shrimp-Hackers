# Privacidade e retenção

O Tokentômetro aceita agente, modelo, data/hora, hashes não reversíveis, componentes de tokens, custo equivalente estimado, identificação de repositório já filtrada e versões técnicas.

Nunca aceita prompts, respostas, mensagens, código-fonte, conteúdo de arquivos, comandos, saída de ferramentas, caminhos absolutos, cookies, chaves de API ou credenciais Git/agentes. O filtro é aplicado no coletor e repetido na API. Respostas de rejeição usam somente códigos e caminhos estruturais do schema; o valor proibido não é ecoado.

## Repositórios

A política escolhida no `setup` é aplicada antes da criação do lote:

- público autorizado: `owner/repository`;
- privado oculto: `unknown`;
- privado anonimizado: hash estável;
- desconhecido ignorado: o evento não atravessa a fronteira de rede.

O caminho absoluto pode ser usado somente durante descoberta local e é descartado antes da normalização.

## Autorização

- O navegador envia o access token do usuário apenas às rotas autenticadas do próprio dashboard.
- O servidor valida o token diretamente no Supabase antes de ler ou alterar o perfil.
- Consultas administrativas incluem `profile_id` mesmo quando usam service role.
- A credencial de dispositivo autoriza somente ingestão para o perfil ao qual o dispositivo pertence.
- Revogação impede novas ingestões sem apagar o histórico.

## Retenção

Os metadados permanecem até exclusão pelo usuário. O schema remove em cascata dispositivos, repositórios, eventos, sincronizações e códigos quando o perfil é excluído. A API/UI de exclusão completa ainda está pendente e está declarada nas limitações.

Logs devem conter somente início/fim, versões, contagens, duração, agente afetado e códigos de erro sanitizados.

## Auditoria local

`audit:persistent`, `audit:idempotency` e `audit:revocation` usam somente a configuração já existente. A saída contém contagens, estados e resultados booleanos: nunca imprime URL, chaves, tokens de dispositivo, IDs, modelos, hashes de sessão ou conteúdo. O teste de revogação cria um dispositivo e um evento sanitizado temporários, revoga o dispositivo, comprova a recusa e remove exatamente essas linhas em cascata.

