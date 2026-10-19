# Tokentômetro — instruções do repositório

## Missão e fontes de verdade

O Tokentômetro fornece telemetria local de uso de tokens para builders que usam Claude Code, Codex e Antigravity, inclusive por assinatura, sem depender de chaves de API dos provedores.

- Use `PRD-Tokentometro-MVP.md` para escopo e requisitos; `docs/architecture.md` para fronteiras e fluxo de confiança; `docs/privacy.md` para coleta, retenção e exclusão; e `docs/limitations.md` para o estado real. Leia somente o que a tarefa exigir.
- Confirme alegações de funcionamento no código e, quando relevante, no fluxo ponta a ponta. UI, fixture ou adapter existente não provam integração funcional.
- Estado atual importante: o dashboard pode operar com fixtures; a API em modo demonstração valida, mas não persiste; somente Claude Code produz eventos via `ccusage`. Codex e Antigravity são apenas detectados e retornam sem eventos. Mantenha `docs/limitations.md` alinhado ao que realmente funciona.

## Mapa do monorepo

- `apps/web`: dashboard Next.js, autenticação, pareamento e ingestão.
- `apps/collector`: CLI Node.js, detecção, normalização, privacidade e sincronização local.
- `packages/contracts`: contratos Zod e regras compartilhadas; é a fronteira entre produtores e consumidores.
- `supabase`: schema, migrations, RLS e seed.

O projeto usa Node.js 20+ e pnpm 12.14.0 via Corepack. Instale com `corepack pnpm install`; execute o web app com `corepack pnpm dev`. Verificações raiz: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` ou o conjunto completo com `corepack pnpm check`.

## Regras de produto e dados

- Nunca colete, envie ou registre prompts, respostas, mensagens, código-fonte, conteúdo de arquivos, comandos/saídas de ferramentas, credenciais, cookies, chaves ou caminhos locais absolutos.
- Aplique a política de repositório antes de qualquer envio. Repositórios privados devem ser omitidos ou representados somente por hash estável; nunca exponha nome, URL ou caminho local.
- Preserve os componentes de tokens e a semântica da fonte. Evite dupla contagem de cache; campo indisponível é nulo, não inventado.
- Eventos, lotes e retries de sincronização devem ser idempotentes. O cursor local só avança após confirmação do servidor.
- Mudanças de schema ou contrato exigem verificar produtores, consumidores, validação, persistência e testes relevantes.
- Marque dados simulados de forma explícita e mantenha-os isolados de autenticação, persistência, métricas e fluxos de produção.
- Custos de uso por assinatura nunca são cobrança real. Exiba-os somente como **Custo equivalente estimado**, com preço desconhecido representado por nulo.

## Forma de trabalhar

- Preserve mudanças do usuário e siga os padrões existentes. Prefira mudanças pequenas e completas de ponta a ponta.
- Não adicione dependência de produção sem necessidade concreta e justificável.
- Windows é a plataforma prioritária do MVP; preserve compatibilidade prevista para macOS/Linux e produza erros claros, sanitizados e acionáveis.
- Infira a intenção e conclua o trabalho autorizado, incluindo implementação e verificação. Não pare em um plano quando foi solicitada uma mudança.
- Pergunte somente quando uma decisão mudar materialmente o resultado ou exigir nova autoridade. Ações destrutivas ou irreversíveis continuam exigindo identificação exata do alvo e cuidado proporcional.
- Instruções explícitas do usuário prevalecem sobre este arquivo e sobre skills. Se uma skill exigir pausa, trabalho incompleto ou desvio, informe a skill e a regra exata que causou isso.
- Quando o usuário escrever em português, responda em português claro por padrão. Apresente o resultado primeiro, calibre o detalhe técnico ao contexto e evite formatação excessiva.

## Verificação

- Calibre a verificação ao risco. Mudanças apenas em documentação pedem checagens leves, incluindo `git diff --check`; código pede lint, typecheck, testes e/ou build dos pacotes afetados.
- Amplie ou repita a suíte somente quando risco, falha ou dúvida não resolvida justificar. Para fluxos de privacidade, contrato, ingestão ou RLS, inclua testes negativos e de integração quando aplicáveis.
- Se uma verificação não puder ser executada, informe exatamente qual comando faltou, por quê e o que permanece sem validação.

## Code Review Rules

- **Dados sensíveis:** sinalize qualquer leitura, payload, log, erro, fixture ou telemetria que possa revelar conteúdo proibido. A correção segura é reduzir aos metadados permitidos e testar rejeição/sanitização.
- **Caminhos locais:** sinalize caminhos absolutos em rede, banco, logs ou UI, inclusive em mensagens de erro. Converta somente o necessário localmente e descarte o caminho antes da fronteira de rede.
- **Demo como produção:** sinalize UI, fixture, código fixo ou adapter vazio apresentado como fluxo funcional. O estado simulado deve estar rotulado e não pode mascarar ausência de autenticação, persistência ou eventos reais.
- **Idempotência:** sinalize retries que duplicam consumo, chaves instáveis, `upsert` incorreto ou cursor atualizado antes da confirmação.
- **Contratos:** sinalize mudanças incompatíveis ou unilaterais. Confirme todos os produtores e consumidores, versionamento, limites, campos proibidos e semântica de tokens/cache.
- **RLS e autorização:** sinalize acesso entre perfis, bypass indevido, uso de service role fora do servidor, dispositivo revogado aceito ou operação sem vínculo ao proprietário. Exija teste com pelo menos dois usuários quando a fronteira mudar.
- **Estimativas:** sinalize custo equivalente descrito como gasto, fatura, cobrança real ou valor exato da assinatura; exija o rótulo correto e nulo quando o preço for desconhecido.

Formatação e lint pertencem à automação; a revisão humana/semântica deve priorizar os riscos acima.

## Definição de pronto

O comportamento solicitado está implementado e validado com testes proporcionais; não há regressão de privacidade, autorização ou contrato; documentação acompanha qualquer mudança de comportamento público; e limitações restantes estão declaradas com precisão.
