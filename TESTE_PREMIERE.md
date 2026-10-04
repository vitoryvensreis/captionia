# Checklist de validação no Premiere — Caption IA 3.1.0

> A validação offline do pacote já foi executada. Os itens abaixo são os testes finais no host Adobe, principalmente renderização, inserção, undo e persistência entre reinicializações.

1. Feche o Premiere Pro e execute `INSTALAR_CAPTION_IA.bat`.
2. Abra o Premiere e vá em **Janela > Extensões > Caption IA**.
3. Confirme que o painel abre sem login e mostra a identidade azul do Caption IA.
4. **Modelos/legendas:** rode o AutoEdit com frases curtas e longas, incluindo `WWW WWW`, `iii iii`, acentos e números. Confirme que frases grandes são repartidas/trocadas de modelo em vez de perder palavras.
5. **Animação:** confira o início, o meio e o overshoot das legendas. A legenda precisa continuar dentro da área segura durante o movimento, não só quando parada.
6. **SFX sync:** use um bloco curto com muitas palavras. Confirme que nenhum SFX nasce no mesmo frame de outro e nenhum começa exatamente no fim do bloco.
7. **SFX preview:** compare -24 dB, 0 dB e +12 dB; a pré-escuta deve mudar de volume conforme o ajuste.
8. **SFX reverso:** gere o reverso, substitua o arquivo original no mesmo caminho e teste de novo. O reverso deve ser recriado.
9. **SFX ausente:** adicione um som de disco externo, desconecte o disco, reabra o painel e confira que o item aparece como `arquivo indisponível` com botão **Localizar**, sem perder volume/reverso.
10. **Navegação de legendas:** carregue mais de 200 legendas e use seta para baixo da legenda 200 para a 201. Repita em um conjunto com 450 legendas.
11. **Groq:** cole a chave, feche o Premiere, abra novamente e confirme que continua disponível. Se a gravação falhar, o painel deve exibir erro em vez de dizer que salvou.
12. **Atualização segura:** com a 3.1.0 já instalada, execute o instalador de novo. Confirme que ele cria staging/backup e conclui sem apagar dados pessoais em `Documentos/editBest`.
13. Teste **Undo**, cancelar no meio, reaplicar o mesmo lote e salvar/reabrir o projeto.

## Formatos recomendados para o teste
- 1080×1920 (9:16)
- 1080×1080 (1:1)
- 1920×1080 (16:9)
- 23,976 / 29,97 / 30 / 60 fps

## Observação
`jsx/hostscript.jsxbin` foi preservado byte a byte. Por isso, chamadas nativas do Premiere e o resultado renderizado precisam ser validados no Premiere; a camada CEP/JavaScript, os 79 modelos `.fsm` e as correções de lógica foram validados offline.
