# Caption IA — Auto Edit | Montagem Inteligente BETA v0.3

## Problemas corrigidos a partir dos testes no Premiere

**1 — Transcrição perdida ao aprovar**

A prévia abre uma nova sequência e o módulo de transcrição existente limpa os dados quando detecta mudança de dono. O novo motor faz snapshot da transcrição antes de trocar, conserva o snapshot enquanto o painel aguarda revisão e, na aprovação, remapeia as palavras aos tempos **reais** retornados pelo Premiere, carimba o ID da sequência prévia, valida o dono e resegmenta as legendas. O callback que libera as etapas seguintes somente é disparado após essas verificações.

**2 — Espaços entre cortes na prévia**

Em vez de acumular durações pedidas, a ponte ExtendScript lê o tempo final de cada clipe realmente inserido e usa esse tempo como início do próximo corte. A ponte valida quantidade, continuidade, sincronização entre V1/A1 e qualquer alteração externa da prévia antes da aprovação. Se detectar gap, bloqueia a continuação com mensagem acionável.

## Instalação

Feche Premiere e instale sobre Caption IA BETA usando o novo ZIP fornecido na conversa, executando `INSTALAR_BETA_WINDOWS.bat`. O instalador substitui somente quatro módulos: `js/autoedit.js`, `js/narrative-beta.js`, `jsx/narrative-beta.jsx` e `css/narrative-beta.css`. Mantém `hostscript.jsxbin` e salva backup da instalação.

## Testes

- Segmentação, validação de IDs e corte sem cruzar clipes.
- Sequência simulada com arredondamento de frames, ordem alterada, áudio alinhado e restauração.
- Regressão de transcrição descartada na troca de sequência e recuperação antes de retomar Auto Edit.

**Pendente:** reproduzir novamente dentro do Premiere Pro Windows. Testes locais são simulações, não homologação Adobe. A branch permanece BETA e a `main` não deve ser alterada antes da validação real.
