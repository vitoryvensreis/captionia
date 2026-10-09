# Caption IA BETA v0.5 — Retake + Montagem Inteligente
## Fluxo
1. Transcrever
2. Retake: com Montagem IA ativa, detectar e AGRUPAR tentativas sem executar cortes. Sem Montagem IA, executar o Retake tradicional.
3. Montagem Inteligente: Groq GPT-OSS 120B recebe texto e sugestões do Retake; modos Livre e Por Roteiro; prévia para aprovação.
4. Corte de silêncios
5. Transições, Legendas, Zoom, SFX e Trilha.
## Proteções
A seleção com role duplicate/descartar é rejeitada; uma montagem que aproveita poucas ideias é reenviada para reanálise uma vez. Se continuar inconsistente, a montagem não é criada.
O relatório JSON de candidatos e descartes é exportado pelo botão "Exportar diagnóstico" em Documentos/CaptionIA/Diagnosticos.
## Testes
Bateria local com o detector original de repetição, integração das sugestões em prompt, bloqueio de descartes, correção automática de plano inconsistente, remapeamento de transcrição, prévia simulada do Premiere e retomada do Auto Edit. O Premiere real precisa ser testado pelo usuário. Faça backup do projeto.
## Instalação
Baixe o ZIP fornecido no chat, extraia, feche o Premiere, execute INSTALAR_BETA_WINDOWS.bat. Aplica patch na instalação existente e preserva hostscript.jsxbin. Base de fallback é v3.4.0, portanto prefira atualizar sua instalação atual.
