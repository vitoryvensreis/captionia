# Montagem automática: fala natural e preservação do sentido

## O que já existe

O projeto possui um planejador narrativo editável em `js/narrative-beta.js` e um executor de prévia em `jsx/narrative-beta.jsx`. O cliente agrupa palavras temporizadas em segmentos com identificadores, envia o pedido ao endpoint autenticado de análise narrativa e valida o plano antes da prévia. A montagem pode passar por revisão independente e reparo do plano. Isso já permite inteligência editorial sem depender do código interno do host compilado para o planejamento.

O backend não está nesta pasta. Sua implementação, políticas de modelo e garantias de processamento não foram alteradas nem verificadas por chamadas reais nesta rodada.

## Direção adotada

O objetivo padrão é **fala natural e contínua, preservando o sentido**. A montagem não deve perseguir um número de cortes ou uma duração curta à custa da explicação. A seleção de takes deve priorizar a frase completa e a continuidade entre uma frase e a seguinte.

As revisões desta rodada acrescentam validações de autoria da transcrição, identidade da timeline, mídia e integridade da prévia. Casos em que o executor não consegue preservar os tratamentos do clipe devem ser recusados com uma explicação, sem reconstrução silenciosa da edição original.

## Evolução recomendada

1. **Planejar primeiro a fala.** Usar palavras e pausas reais; nunca permitir um corte dentro de uma palavra. Criar unidades de frase com contexto anterior e posterior.
2. **Escolher retakes por evidência.** Combinar coincidência textual, proximidade temporal e qualidade do áudio. Frases incompletas podem ser descartadas com confiança maior; frases completas, números, negações e repetições expressivas exigem revisão.
3. **Validar as emendas.** Procurar palavras repetidas no fim/início dos takes e conferir se a remoção não altera o sentido. O detector local deve fornecer sugestões auditáveis, não apenas uma decisão opaca da IA.
4. **Organizar o raciocínio.** A nuvem pode propor a ordem das unidades, mas o padrão deve preservar a ordem original. Mudanças de ordem devem explicar o motivo e preservar referências como “isso”, “ele”, “por isso” e “depois”.
5. **Aplicar ritmo como consequência.** Pausas curtas podem manter a respiração. Pausas longas podem ser reduzidas. Música, zoom e efeitos entram depois de a fala estar aprovada.
6. **Executar um plano imutável.** O plano deve carregar IDs de sequência, clipes, pontos de origem, FPS, assinatura da transcrição e versão do algoritmo. Se qualquer item mudar, gerar uma nova prévia.

## Contrato de planejamento sugerido para a nuvem

Cada decisão deveria retornar o ID do segmento de origem, ação, justificativa, confiança e necessidade de revisão. O servidor deve escolher IDs existentes; os tempos reais são resolvidos e validados no cliente. Não se deve executar JavaScript ou ExtendScript recebido do modelo.

A validação local deve rejeitar IDs inexistentes, durações inválidas, cortes em palavras, referências a outra sequência e duplicação não explicada. A prévia deve informar o que foi mantido, removido e por quê.

## Limites atuais e substituição gradual

- A montagem narrativa tem restrições de faixas, alinhamento, velocidade e tratamentos de clipe. Não equivale ainda a um editor geral de multicâmera, B-roll e projetos complexos.
- O AutoCut ainda usa o executor compilado para realizar os cortes. O novo módulo local melhora a decisão e protege palavras, mas não reimplementa esse executor.
- A prévia de montagem e a tela dividida próprias são caminhos separados. Elas não substituem automaticamente todas as operações antigas de timeline.
- O próximo passo de reconstrução deve ser um executor próprio de cortes com backup, sincronismo e verificação de resultado. Só depois de compará-lo com o comportamento atual faz sentido retirar o caminho compilado.

## Critérios de aceitação

- Preservar começo/fim das palavras, nomes, números e negações.
- Não eliminar ênfases como “muito, muito bom”.
- Identificar repetição na fronteira de dois takes e permitir ouvir/revisar a sugestão.
- Recusar transcrição ou plano de outra sequência, mesmo com duração semelhante.
- Recusar prévia quando a fonte, o in/out ou a edição tiver mudado.
- Manter a sequência original acessível e conferir o áudio após cada prévia.
- Demonstrar os resultados em projetos de teste no Premiere antes de tornar um novo executor o padrão.
