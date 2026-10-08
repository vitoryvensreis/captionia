# Caption IA Cloud Beta — ajuste fino do SFX por palavra (fase experimental)

## Problema observado
No Premiere, a transcrição Groq forneceu timecodes por palavra, porém as animações do template de legenda podem iniciar visualmente antes/depois desses marcos. Os SFX já foram distribuídos em duas trilhas independentes e ficaram completos, mas algumas palavras não coincidem com o momento visual do texto.

## Solução aplicada
Módulo `js/sfx_timing_calibration.js` carregado antes do `autosfx.js`:
- Seção "Sincronia fina de SFX por palavra" no AutoEdit
- Campo de ajuste geral em **quadros** (-15 a +15)
- Lista de palavras com ajuste individual em **quadros** (-15 a +15)
- Campo para FPS da sequência, padrão 30 até que o usuário ajuste
- Valores negativos antecipam SFX, positivos atrasam
- Offset aplicado **antes** de alternar palavras entre A4/A5 (ou outro par vazio)
- Armazenamento no localStorage isolado por sequência + texto/timecodes da transcrição
- Verificação de ordenação, timestamps válidos e sequência ativa
- Nenhuma alteração em texto/posição de legenda ou áudio já existente
- O motor compilado `hostscript.jsxbin` segue inalterado

## Como usar com segurança
1. Faça cópia do projeto no Premiere. Feche Adobe Premiere e After Effects.
2. Extraia o ZIP de hotfix e execute `APLICAR_PATCH_SFX.bat`.
3. Reabra Premiere, abra a sequência correta e confirme que a última transcrição é da mesma sequência.
4. No AutoEdit, use **Sincronia fina de SFX por palavra**.
5. Selecione **FPS** igual ao do projeto; caso tenha dúvida, consulte Sequência > Configurações da sequência.
6. Clique **Atualizar palavras** para listar os timecodes da transcrição.
7. Reproduza e anote quais palavras estão ligeiramente adiantadas/atrasadas. Ajuste **-1/-2** quadros para antecipar e **+1/+2** para atrasar. O valor por palavra é adicional ao ajuste geral.
8. No projeto de teste, selecione e remova SOMENTE os clips SFX da rodada anterior nas duas trilhas dedicadas. Preserve voz/música. A opção Limpar SFX não garante apagar SFX fora da trilha dedicada FS SFX.
9. Confirme duas trilhas de áudio vazias/desbloqueadas com **Verificar trilhas antes de gerar SFX**.
10. Marque só **Efeitos sonoros** no AutoEdit e rode. Confira resultado por áudio e visual.
11. Se precisar corrigir pontos adicionais, repita 7–10. O painel não arrasta SFX existentes automaticamente.

### Cuidados
- Os limites por legenda permanecem desligados; as duas camadas se alternam e a duração original do som continua protegida.
- Se o código apontar transcrição de outra sequência, a geração é bloqueada.
- Se um ajuste fizer as palavras inverterem a ordem ou ficarem antes do tempo zero, a operação é bloqueada.
- **Não existe autoalinhamento pixel-perfect com a animação do MOGRT:** o motor host compilado não disponibiliza aqui os keyframes internos, e o texto pode entrar com atraso visual deliberado. A calibração fina manual é o caminho seguro até termos fonte JSX/um adaptador Adobe adequado.
- Revogar/alterar a transcrição impede a reutilização automática de correções antigas.

## Rollback
O instalador usa `%LOCALAPPDATA%\CaptionIA\SfxTimingCalibrationBackup`. Com Premiere/AE fechados, execute `RESTAURAR_PATCH_SFX.bat` do mesmo ZIP. O backup de rodadas anteriores é mantido.

## Teste automatizado
`node scripts/test-autosfx-timing.js` confirma correções gerais e por palavra, sequência isolada, ordenação e rejeição de dados inconsistentes. Testes em Premiere devem ser feitos em uma cópia do projeto.
