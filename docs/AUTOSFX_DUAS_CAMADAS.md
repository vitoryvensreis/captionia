# AutoSFX por palavra — duas camadas (beta)

## Comportamento solicitado
Uma palavra falada gera um único disparo SFX, sincronizado ao tempo `word.start`
da transcrição. Exemplo: "eu quero ir embora" → 4 sons, intercalados
A (eu), B (quero), A (ir), B (embora). O AutoEdit não aplica cooldown
artificial nem limita cada SFX ao fim da legenda.

## Como usar em Premiere (projeto de teste)
1. Faça cópia do projeto e mantenha o áudio original.
2. Desligue AutoEdit e remova os SFX gerados na rodada anterior, sem apagar música, voz ou efeitos manuais.
3. Confirme uma transcrição da sequência com timecodes por palavra (Cloud ou legado).
4. Em **Sequência → Adicionar trilhas**, crie duas trilhas de áudio **estéreo** vazias
   (por exemplo A4 e A5); não use duas trilhas onde já há áudio.
5. Instale o patch e reinicie o Premiere.
6. Marque apenas **Efeitos sonoros** no AutoEdit e execute.
7. Confira se a quantidade de disparos bate com o número de palavras; o resumo
   indicará as duas trilhas selecionadas. Ouça o resultado.
8. Se o Premiere não honrar o índice explícito da trilha ou faltar espaço,
   o painel interrompe com mensagem de erro. Pode haver uma primeira camada
   parcialmente inserida: inspecione a timeline antes de repetir.

## Compatibilidade
O motor Adobe `hostscript.jsxbin` permanece compilado e inalterado.
A nova distribuição chama o executor existente duas vezes em série com duas
trilhas separadas; cada chamada só recebe metade dos eventos.
Não usa APIs internas QE para criar trilhas.
A verificação de contagem de clipes detecta redirecionamento evidente,
mas não certifica duração real nem garante que dois canais comportem efeitos
maiores que o intervalo entre palavras alternadas.

### Duração dos SFX
A amostra padrão `FS Crisp Snap.wav` tem cerca de 0,125 segundo de áudio
estéreo, favorecendo este fluxo. Sons mais longos ainda poderão se sobrepor
quando um mesmo canal recebe a palavra 1 e a palavra 3 rapidamente. Para
efeitos longos, usar um SFX menor ou uma versão com mais camadas (ainda não
implementada).

### Reversão
O patch usa `%LOCALAPPDATA%\CaptionIA\SfxDualTracksBackup`,
separado do backup da correção anterior. Execute
`RESTAURAR_PATCH_SFX.bat` do novo ZIP com Premiere e After Effects fechados.
Ele restaura o estado anterior do plugin.

## Testes
`node scripts/test-autosfx-dual-tracks.js` simula um host com duas
trilhas livres e verifica distribuição por palavra, ordem e ausências
de cortes baseados em fim de legenda. `node scripts/validate-release.js`
executa a suíte completa. A validação final requer teste real em Premiere.
