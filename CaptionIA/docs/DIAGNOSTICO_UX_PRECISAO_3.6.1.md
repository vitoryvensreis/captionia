# Caption IA 3.6.1 DEV — erros reais e melhorias orientadas à Adobe

## Observações no Premiere enviadas pelo usuário

1. **Tela Dividida, modo Preencher:** "Não consegui localizar o clipe no adaptador Crop. Use Ajustar." Em `jsx/captionia-split.jsx`, o CEP consultava o QE por nome igual e diferença de início inferior a 0,001 s. O novo identificador procura por início e fim em uma janela até 0,55 frame, usa Vn específica e recusa resultados ambíguos. Fallback pelo clipe único somente em uma faixa que tem um único clipe no DOM público.
2. **Montagem Inteligente:** "Modo de mesclagem alterado ou não reconhecido." Em `jsx/narrative-beta.jsx`, o verificador aceitava estritamente `18` numérico ou a string `Normal`; a versão nova aceita também representações técnicas conhecidas `0`, `1` e a enumeração como texto, sem remover a verificação de efeitos diferentes de Normal. Valores não reconhecidos agora aparecem na mensagem técnica, sem alterar a sequência original.
3. **Retake:** 0 grupos encontrados não equivale necessariamente a falha. O plano registra os grupos lexicais e semânticos, indicando quando a Groq não concluiu a comparação.

## Logs e privacidade

- Um ícone `◉` no cabeçalho abre um diagnóstico com os últimos 120 eventos.
- São registrados ação, fase, status, código de falha e duração, sem enviar dados para fora do computador.
- O arquivo JSON é exportado somente quando o usuário clica em **Salvar relatório** e é gravado em `%LOCALAPPDATA%/CaptionIA/Logs`.
- Não registrar transcrição, áudio, chaves, prompts, tokens nem paths de mídia. Regex mascara caminhos Windows, emails e formatos comuns de token. Para suporte público, revisar o relatório antes do compartilhamento.

## UX e desempenho

- Favoritos é um subfiltro de **Modelos**, não uma seção independente na barra superior.
- Tema neon gamer em ciano, lima e roxo sutil, sem bloquear legibilidade de texto; animação de varredura acontece **somente no hover**.
- `prefers-reduced-motion` desativa movimento quando o sistema do usuário assim solicita.
- Nenhum timer visual infinito foi adicionado.

## Conformidade oficial e próximos incrementos recomendados

- A API UXP do Premiere a partir de 25.6 permite acessar sequências, trilhas, clipes e operações de efeitos de maneira documentada. A transição para UXP deve ser feita com verificações de versão e sem descartar CEP existente: https://developer.adobe.com/premiere-pro/uxp/resources/fundamentals/apis/
- Manipular Crop via **QE** é legado não documentado e não garante compatibilidade universal; migrar primeiro o motor de efeitos/crop para UXP nos hosts suportados. **Não afirmar que Preencher funciona em toda versão sem teste real**.
- Para maior assertividade da montagem: (a) mapear cada palavra para um ID de mídia e frames da timeline, (b) proteger valores numéricos/negações/ressalvas, (c) comparar Retakes lexical e semanticamente, (d) exigir consistência de IDs e durações antes da prévia, (e) separar decisão editorial Groq de execução determinística local.
- Para avaliar precisão: comparar cortes propostos e finais, taxa de palavras cortadas, duplicações de áudio, percentual de sequências que geram prévia, desvio em frames e resultados por proporção/tipo de mídia.
- Microinterações curtas de 100–300ms ajudam a comunicar resposta ao clique sem atrapalhar o fluxo: https://www.nngroup.com/articles/animation-duration/

## Limites

Auditoria do código e testes em simulação; **não houve execução do Premiere neste ambiente**. O retorno exato do enum de Blend Mode e a forma dos trackitems QE dependem da versão do host, por isso as falhas inesperadas continuam sendo recusadas em vez de modificar o original.
