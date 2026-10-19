# Próxima sessão do Codex — implantar a deduplicação estável do beta.2

## Objetivo

Colocar em produção a correção que impede uma pessoa de inflar os tokens ao remover e parear novamente o mesmo computador. A mesma sessão local deve ser inserida uma única vez por perfil e apenas atualizada quando seus contadores crescerem, sem enviar a identificação original da sessão.

## Estado de partida

- `tokentometro@0.1.0-beta.1` está publicado e o fluxo real de instalação funciona.
- O smoke do beta.1 encontrou 23 sessões no pareamento atual e confirmou atualização incremental sem duplicação dentro desse pareamento.
- O dashboard também revelou 42 sessões antigas duplicadas por novos pareamentos da mesma conta.
- A correção beta.2 foi aplicada ao Supabase, implantada na Vercel e publicada no npm.
- O teste real conta A → logout/revogação → conta A terminou com 23 sessões atualizadas e 0 inseridas; a auditoria confirmou contagem e total idempotentes.
- Nenhum registro histórico deve ser apagado antes de a correção estar ativa e validada.

## Solução implementada

1. `profile_secrets` mantém uma chave aleatória exclusiva por perfil, inacessível aos papéis do navegador.
2. `exchange_pairing_code_v2` entrega essa chave somente durante um pareamento autorizado.
3. O coletor calcula localmente HMAC-SHA-256 de `agente + session_id`; a `session_id` original nunca atravessa a rede.
4. A unicidade passa a ser `(profile_id, idempotency_key)`, evitando duplicação na mesma conta e colisão entre contas.
5. A ingestão procura eventos no perfil inteiro, não apenas no dispositivo atual.
6. Coletores sem `sessionHashVersion: 1` recebem `426 collector_upgrade_required` em novos pareamentos.
7. Logout e revogação preservam o histórico; exclusão de dados continua sendo uma ação explícita separada.

## Ordem obrigatória de implantação

As nove etapas de implantação foram concluídas. A tag `beta` e a execução pública por `npx` apontam para `0.1.0-beta.2`.

## Smoke obrigatório de repareamento

O fluxo da conta A foi aprovado com 23 sessões, `0 inseridos`, `23 atualizados` e nenhum campo proibido. O teste cruzado com a conta B e a limpeza dos dados legados permanecem como próximos gates.

## Limpeza dos dados antigos

Somente depois do smoke aprovado:

1. identificar exatamente o perfil do proprietário e os dispositivos revogados;
2. conferir que o conjunto beta.2 ativo contém o histórico completo;
3. apresentar a contagem exata que será removida;
4. obter autorização explícita;
5. excluir apenas eventos e execuções ligados aos dispositivos antigos selecionados;
6. confirmar o dashboard sem as 42 sessões duplicadas.

## Entregáveis

- migration aplicada e verificada;
- API Vercel usando pareamento v2;
- `tokentometro@0.1.0-beta.2` auditado e, se autorizado, publicado;
- teste conta A → logout/revogação → conta A sem novas inserções;
- teste entre contas sem colisão ou vazamento;
- dashboard sem inflação por repareamento;
- documentação e limitações correspondendo ao comportamento comprovado;
- limpeza antiga executada somente mediante autorização separada.

## Definição de pronto

O trabalho termina quando um mesmo histórico puder ser sincronizado novamente após um novo pareamento da mesma conta sem aumentar o número de sessões ou o total de tokens, enquanto outra conta continua recebendo registros independentes e nenhuma identificação original de sessão atravessa a rede.
