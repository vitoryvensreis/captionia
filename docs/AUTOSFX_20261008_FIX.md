# Caption IA — Correção de densidade e duração do AutoSFX

## Causa observada na beta 3.4.0

O AutoEdit selecionava o modo `sync`, que dispara efeitos por palavra a cada poucos quadros. No teste real houve 46 efeitos em aproximadamente 11 segundos. A função host `distributeSfxAtTimes` também recebia o final de cada bloco como limite, possibilitando SFX cortados antes da cauda.

## Mudança

- Somente no **AutoEdit**, usar modo `capsync` (um evento por bloco de legenda), respeitando modelos que já possuem SFX interno.
- Depois de filtrar os blocos animados, aplicar intervalo mínimo de **0,85 segundo** entre eventos válidos, por tempo de quadro.
- Preservar os timecodes originais dos disparos selecionados.
- Para o AutoEdit, passar lista de finais vazia, não forçando corte no fim de cada legenda. O executor compilado ainda pode limitar clipes por colisões ou fim de sequência; isso precisa de teste real no Premiere.
- Não alterar modo manual de AutoSFX, timbres, trilhas, modelos ou o `hostscript.jsxbin`.
- Falhar com erro se o agendador não estiver carregado, evitando voltar silenciosamente aos 46 disparos.

## Teste de regressão

`node scripts/test-autosfx-scheduler.js`

Confere densidade de 46 eventos, espaçamento, duplicatas, timecodes e preservação de caudas. A suíte está integrada a `scripts/validate-release.js`.

## Aplicar sem reinstalar o plugin

O artefato `CaptionIA-AutoSFX-Hotfix-Windows` contém o ZIP `CaptionIA-AutoSFX-Hotfix.zip`. Extraia para ter `CaptionIA/`, `APLICAR_PATCH_SFX.bat` e `RESTAURAR_PATCH_SFX.bat`. Feche Premiere e After Effects; execute `APLICAR_PATCH_SFX.bat` com o usuário normal do Windows. Backup em `%LOCALAPPDATA%\CaptionIA\SfxFixBackup`.

Depois, abra **uma cópia do projeto** no Premiere, remova somente os SFX anteriormente gerados pelo Caption IA (trilha **FS SFX**) e execute novamente apenas a etapa **Efeitos sonoros** no AutoEdit (desative outras etapas). Não é necessário retranscrever ou recriar templates.

**Rollback:** feche Premiere/AE e execute `RESTAURAR_PATCH_SFX.bat`.

## Limitações

A correção reduz eventos e evita enviar limites de legenda à função JSXBIN, mas não pode garantir a duração integral de todo efeito enquanto o executor Adobe estiver compilado. Efeitos muito longos ainda poderão colidir em uma única trilha. Validar em projeto de teste antes de considerar final.
