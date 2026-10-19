# Próxima sessão do Codex — implantar a deduplicação estável do beta.2

## Objetivo

Colocar em produção a correção que impede uma pessoa de inflar os tokens ao remover e parear novamente o mesmo computador. A mesma sessão local deve ser inserida uma única vez por perfil e apenas atualizada quando seus contadores crescerem, sem enviar a identificação original da sessão.

## Estado de partida

- `tokentometro@0.1.0-beta.1` está publicado e o fluxo real de instalação funciona.
- O smoke do beta.1 encontrou 23 sessões no pareamento atual e confirmou atualização incremental sem duplicação dentro desse pareamento.
- O dashboard também revelou 42 sessões antigas duplicadas por novos pareamentos da mesma conta.
- A correção beta.2 está implementada no repositório, mas ainda não foi aplicada ao Supabase, implantada na Vercel nem publicada no npm.
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

1. Revisar o diff e executar `corepack pnpm check`.
2. Aplicar `supabase/migrations/202610190001_profile_scoped_session_dedup.sql`.
3. Confirmar que `profile_secrets`, `exchange_pairing_code_v2` e a unicidade composta existem e continuam protegidos.
4. Fazer commit e push das mudanças.
5. Aguardar o deploy Vercel e validar `/api/health`.
6. Gerar e inspecionar o tarball `tokentometro@0.1.0-beta.2`.
7. Instalar o tarball fora do monorepo e validar `--version`, `setup`, `scan`, `sync`, `status` e `logout`.
8. Somente com autorização explícita, publicar `npm publish --tag beta --access public`.
9. Confirmar `npm view tokentometro@beta` e executar o pacote vindo do registro.

## Smoke obrigatório de repareamento

1. Parear a conta A com o beta.2 e sincronizar o histórico completo.
2. Registrar quantidade de sessões e total de tokens.
3. Executar logout local e revogar o dispositivo.
4. Gerar outro código para a mesma conta A e parear novamente.
5. Sincronizar o mesmo histórico.
6. Confirmar `0 inseridos`; registros podem ser `updated` ou `ignored`.
7. Confirmar que quantidade de sessões e total não aumentaram artificialmente.
8. Repetir com a conta B e confirmar que os dados permanecem independentes.

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
