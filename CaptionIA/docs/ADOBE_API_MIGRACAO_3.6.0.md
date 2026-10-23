# Caption IA 3.6 — Adobe API, limites e caminho UXP

## Referências oficiais
- [Premiere UXP DOM](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/)
- [Sequence](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequence/)
- [SequenceEditor](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor/)
- [ExtendScript Scripting Guide](https://ppro-scripting.docsforadobe.dev/)

**Não misturar APIs UXP e CEP na mesma execução.** A extensão atual utiliza CEP
+ ExtendScript; UXP exige novo host e manifesto próprios. Os módulos puros de
planejamento (timebase, editorial, geometria) poderão ser reaproveitados.

## Suporte atual (CEP)
- Timebase por `sequence.timebase` e `254016000000` ticks/segundo.
- Prévia de montagem e tela dividida em **cópias** das sequências.
- Protocolo `CaptionIABridge.call`: somente ações JSX permitidas, erros com timeout,
  sem registrar transcrição, chave Groq, conteúdo de media ou payload privado.
- Tela dividida `Ajustar`: parâmetros de Movimento públicos disponíveis na API CEP.
- Tela dividida `Preencher`: Crop via adaptador QE legado. **QE não é API pública da Adobe**.
  O modo deve ser substituído por operações de efeitos UXP antes de eliminar QE.
- SFX de clipes individuais ainda é distribuído pelo host legado; a sincronização
  visual exata existe quando as legendas têm WORD_TIMINGS confirmados.

## Limites deliberados
1. O algoritmo de montagem baseado em subclipes atualmente requer takes brutos
   em V1/A1, sincronizados e sem efeitos que seriam perdidos na reconstrução.
   Uma sequência com várias trilhas será recusada para **não degradar o projeto**.
2. Para vídeos grandes, o backend limita o tamanho da solicitação e os tokens da
   resposta. **Divisão automática em lotes com união semântica** é uma etapa futura.
3. Somente simulações locais foram executadas neste release; não houve teste real
   de frames, transições, Crop ou exportação de áudio no Premiere.
4. Renderizar cada palavra e inserir um SFX são operações diferentes. Quando a
   MOGRT expõe WORD_TIMINGS, usá-los; em outros modelos a entrada pode ser estimada.
5. O tempo de áudio SFX não é medido automaticamente em todos os formatos;
   dois canais de áudio não garantem ausência de sobreposição em fala muito rápida.

## Próximo ciclo UXP, com teste real de Premiere 25.6+
1. Novo painel Spectrum sem alterar o CEP instalado.
2. Adapter UXP de sequência por `Project.getActiveProject()` e `getActiveSequence()`.
3. `Sequence.createCloneAction`, `SequenceEditor.createCloneTrackItemAction` e
   `createInsertProjectItemAction` para as operações suportadas.
4. Parametrizar efeitos sem QE quando a versão/API realmente fornecer os meios.
5. Validar em Windows e macOS, versões suportadas do Premiere, usando projetos
   teste com clipes 23.976, 25, 29.97, 30 e 60 fps.
