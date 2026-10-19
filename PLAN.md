# Próxima sessão do Codex — fechar o MVP para beta público

## Resultado esperado

Ao final da sessão, o repositório deve estar tecnicamente preparado para publicar um beta cujo caminho principal seja:

1. entrar com GitHub;
2. gerar um código de pareamento;
3. vincular o coletor;
4. detectar e ler telemetria local real do Codex;
5. mostrar uma prévia sem conteúdo sensível;
6. sincronizar de forma idempotente;
7. visualizar os totais no dashboard;
8. repetir a sincronização sem duplicação;
9. revogar o dispositivo e impedir novos envios.

Publicação na Vercel, alteração de OAuth, uso de um segundo usuário real e publicação no npm dependem das contas do proprietário. O Codex deve preparar, validar e documentar essas operações, mas não inventar credenciais, exibir segredos nem declarar concluído o que não foi executado.

## Escopo do beta

- **Claude Code:** integração funcional já existente.
- **Codex:** integração funcional por metadados estruturados dos históricos JSONL locais.
- **Antigravity:** apenas detectado, sem eventos. Não apresentar como integração funcional.
- Os números do Codex devem ser descritos como **tokens reportados pela telemetria local do Codex**, não como cobrança ou medição oficial da OpenAI.
- `cached_input_tokens` já pertence a `input_tokens`, e `reasoning_tokens` já pertence a `output_tokens`; não somá-los novamente ao total.
- Custo do Codex permanece `null` enquanto não houver preço verificável aplicável. Nunca inventar custo.

## Regras de execução

- Ler `AGENTS.md`, as seções relevantes do PRD, `docs/architecture.md`, `docs/privacy.md` e `docs/limitations.md` antes de alterar comportamento.
- Preservar mudanças existentes do usuário e não limpar o worktree.
- Implementar e verificar o trabalho autorizado; não parar somente em análise ou plano.
- Nunca coletar, transmitir ou registrar prompts, respostas, mensagens, código, comandos, saídas de ferramentas, credenciais ou caminhos absolutos.
- Não imprimir valores de `.env.local`. Confirmar apenas presença, formato e uso correto das variáveis.
- Não publicar na Vercel ou npm nem modificar configurações remotas sem autorização explícita no momento da ação.
- Distinguir claramente evidência local, evidência contra Supabase real e evidência em produção.

## Etapa 1 — consolidar a integração do Codex

1. Revisar o adaptador e seus testes contra o formato real observado, sem ler ou reproduzir conteúdo conversacional.
2. Confirmar que somente registros estruturados de metadados e contagens são considerados.
3. Confirmar uma linha de origem auditável por evento: agente, modelo, horário, hash da sessão, componentes de tokens, total, `source_version` e versão do contrato.
4. Verificar deduplicação de uma mesma sessão, atualização de sessão crescente e estabilidade da chave de idempotência.
5. Testar casos negativos: JSONL inválido, campos ausentes, total indisponível, contador regressivo, duplicata e conteúdo proibido.
6. Manter `.zst` explicitamente documentado como não suportado, salvo se houver uma implementação pequena, segura e testada sem nova dependência de produção desnecessária.
7. Garantir que UI e documentação expliquem como o total foi obtido e quais são seus limites.

## Etapa 2 — auditoria do fluxo persistente

1. Executar `scan` e registrar somente contagens e fontes detectadas.
2. Executar `sync` contra o Supabase já configurado, sem revelar credenciais.
3. Comparar prévia local, resposta da ingestão e eventos persistidos.
4. Repetir a sincronização e comprovar que os totais não aumentam sem novos dados.
5. Confirmar que o cursor só avança após a confirmação de todos os lotes.
6. Revogar um dispositivo de teste e comprovar que uma ingestão posterior é recusada.
7. Validar que nenhuma coluna, log ou resposta contém dados proibidos ou caminhos absolutos.
8. Se não houver duas identidades reais disponíveis, preparar um roteiro reproduzível para o teste RLS com dois usuários e marcar a execução como pendente; não simular aprovação.

## Etapa 3 — fechar o escopo público

1. Verificar filtros por período, agente, modelo e repositório no fluxo real.
2. Verificar que rankings e qualquer compartilhamento público respeitam consentimento explícito.
3. Se o ranking público real não estiver completo e seguro, removê-lo da promessa inicial e mantê-lo indisponível/claramente identificado, sem misturar fixtures com produção.
4. Remover alegações de suporte funcional ao Antigravity das superfícies de produto; manter a limitação explícita.
5. Confirmar que **Custo equivalente estimado** nunca é apresentado como gasto, fatura ou cobrança real.

## Etapa 4 — preparar Vercel e OAuth

1. Verificar a configuração do monorepo para build reproduzível na Vercel.
2. Documentar os comandos e o diretório de projeto corretos, incluindo dependências workspace.
3. Documentar somente os nomes das variáveis necessárias:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_SECRET_KEY`;
   - `PAIRING_SECRET`.
4. Criar ou atualizar um checklist de configuração de URL do site, redirects do Supabase e callback do GitHub, usando placeholders seguros.
5. Depois que o proprietário publicar, executar o smoke test na URL de produção: login, pareamento, scan, sync, dashboard, ressincronização e revogação.
6. Confirmar que produção não carrega fixtures nem exibe a faixa de demonstração.

## Etapa 5 — preparar distribuição do coletor

1. Verificar se o pacote `tokentometro` pode ser instalado fora do monorepo.
2. Executar build e `pnpm pack`/equivalente em modo de inspeção, verificando arquivos incluídos e ausência de segredos.
3. Resolver referências `workspace:*` que impedirem a instalação do pacote publicado, sem duplicar contratos nem enfraquecer validações.
4. Testar a instalação do tarball em diretório temporário e os comandos `setup`, `scan`, `sync`, `status` e `logout`.
5. Documentar a instalação por package runner ou globalmente.
6. Deixar a publicação npm como etapa explícita do proprietário, a menos que ele autorize a publicação durante a sessão.

## Etapa 6 — documentação e estado real

1. Atualizar `docs/limitations.md`: remover a afirmação obsoleta de que Supabase/GitHub OAuth não foram exercitados e registrar exatamente o que foi comprovado.
2. Atualizar README, instalação, privacidade e limitações para refletirem Claude Code e Codex como funcionais e Antigravity como não funcional.
3. Documentar a formulação correta da confiabilidade dos números do Codex.
4. Incluir instruções de revogação, logout e remoção do coletor.
5. Não declarar Vercel, npm, teste de dois usuários ou produção aprovados enquanto não houver evidência da execução.

## Etapa 7 — verificação final

Executar, no mínimo:

1. `corepack pnpm lint`;
2. `corepack pnpm typecheck`;
3. `corepack pnpm test`;
4. `corepack pnpm build`;
5. `git diff --check`;
6. testes negativos de privacidade, idempotência, dispositivo revogado e contrato;
7. smoke test local completo;
8. smoke test de produção quando a URL publicada estiver disponível.

Falhas não podem ser mascaradas. Informar exatamente o comando, a causa e o que permaneceu sem validação.

## Entregáveis da sessão

1. Integração do Codex validada com testes positivos e negativos.
2. Evidência resumida da cadeia `registro local → normalização → ingestão → banco → dashboard`.
3. Resultado da repetição sem duplicação e da revogação de dispositivo.
4. Configuração do monorepo pronta para Vercel e checklist de OAuth/redirects.
5. Tarball do coletor validado fora do monorepo ou bloqueio técnico corrigido e documentado.
6. Documentação e `docs/limitations.md` alinhados ao estado real.
7. Matriz final com cada critério marcado como **aprovado**, **reprovado** ou **pendente de ação do proprietário**.
8. Lista curta e ordenada das ações manuais restantes, sem incluir segredos.

## Definição de pronto

A sessão termina quando tudo que pode ser concluído localmente estiver implementado e validado, e as únicas pendências restantes dependerem de autorização, credenciais ou identidades externas do proprietário. O beta público só pode ser declarado pronto após o smoke test na Vercel, o teste RLS com dois usuários e a confirmação de que o pacote distribuído instala e executa fora do monorepo.
