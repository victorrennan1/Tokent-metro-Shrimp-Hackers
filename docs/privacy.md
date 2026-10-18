# Privacidade e retenção

O Tokentômetro coleta agente, modelo, data/hora, hashes não reversíveis, componentes de tokens, custo equivalente estimado, identificação de repositório já filtrada e versões técnicas.

Nunca coleta prompts, respostas, mensagens, código-fonte, conteúdo de arquivos, comandos, saída de ferramentas, caminhos absolutos, cookies, chaves de API ou credenciais Git/agentes. A leitura local é somente leitura e usa as permissões do usuário atual.

Repositórios privados podem ser ocultados ou substituídos por hash estável antes do envio. O perfil não aparece no ranking público até o opt-in explícito.

## Retenção e exclusão

No MVP, os metadados permanecem até o usuário excluir eventos, um dispositivo ou a conta. Excluir a conta remove em cascata dispositivos, repositórios, eventos, sincronizações e códigos de pareamento. Revogar um dispositivo impede novos envios sem remover o histórico; a exclusão é uma ação separada.

Logs devem conter somente início/fim, versão, contagens, duração, agente afetado e códigos de erro sanitizados.

