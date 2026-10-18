# Arquitetura

O monorepo possui três limites explícitos:

1. `apps/collector` detecta fontes locais, chama o `ccusage@20.0.36` pelo adaptador e converte somente metadados.
2. `packages/contracts` define o contrato Zod versionado, cálculo de totais e rejeição de campos proibidos.
3. `apps/web` autentica dispositivos, valida e grava lotes no Supabase; o dashboard lê apenas dados pertencentes ao perfil.

O cursor local só avança depois que todos os lotes recebem confirmação. Cada registro recebe uma chave SHA-256 estável e `usage_events.idempotency_key` é único. Assim, uma tentativa repetida executa `upsert` sem somar o consumo duas vezes.

## Fluxo de confiança

- O código de pareamento é temporário, de uso único e armazenado como hash.
- A credencial do dispositivo é exibida uma vez. O servidor armazena apenas SHA-256.
- O coletor aplica privacidade antes da rede.
- A API faz uma segunda verificação estrutural e rejeita chaves ou caminhos proibidos.
- RLS separa perfis; a service role existe apenas nas rotas do servidor.

## Modo demonstração

Sem variáveis Supabase, o dashboard usa fixtures sanitizadas e a API aceita o código `SHRIMP-42Q`. A ingestão desse modo valida o contrato, mas não persiste eventos. Configure Supabase para persistência real.

