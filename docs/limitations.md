# Limitações conhecidas do MVP

- A UI funciona com fixtures sanitizadas até GitHub OAuth e variáveis Supabase serem configurados.
- O modo demonstração da API não persiste eventos entre requisições.
- `ccusage` é executado hoje para a fonte Claude Code. Codex e Antigravity são detectados, mas retornam sem eventos até adaptadores públicos compatíveis fornecerem dados estruturados; nenhuma API privada foi inventada.
- A descoberta e classificação automática de visibilidade do GitHub ainda depende da política escolhida e de metadados disponíveis; caminhos locais nunca são transmitidos.
- Preços são os equivalentes informados pelo adaptador, não a cobrança real de uma assinatura.
- Publicação no Vercel, configuração do Supabase e publicação npm exigem contas/credenciais do proprietário.

