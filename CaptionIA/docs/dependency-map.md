# Caption IA — mapa de dependências e substituição gradual

Este documento descreve a fronteira encontrada no código instalado. O `jsx/hostscript.jsxbin` é preservado: não há fonte legível equivalente neste pacote, e seu conteúdo não foi descompilado. A lista abaixo mapeia as chamadas identificadas no cliente, não todas as funções internas que podem existir no binário. A classificação como legado decorre de chamadas ao host sem implementação JSX legível correspondente no pacote.

## Fronteiras da arquitetura

```text
index.html + css/*
  └─ JavaScript CEP editável: UI, preferências, planos, prévias, validações
       ├─ CSInterface.evalScript(expressão, callback)
       │    ├─ hostscript.jsxbin: execução legada preservada
       │    ├─ narrative-beta.jsx: ponte própria editável, namespace separado
       │    ├─ captionia-split.jsx: ponte própria editável, namespace separado
       │    └─ expressões inline: consultas/guardas editáveis no próprio JS
       ├─ Node/CEP: leitura de assets, áudio, caches e armazenamento seguro
       └─ rede: Groq e CaptionIACloudCore; planejamento/transcrição
```

Modificar HTML/CSS/JS e as pontes JSX próprias permite desenvolver na pasta instalada. O host compilado continua responsável pelas operações legadas abaixo. Um plano gerado na nuvem ou no JavaScript não substitui o executor da timeline.

## Chamadas identificadas ao host legado

Os nomes são contratos de integração, inclusive os prefixos `fs`. Não devem ser renomeados por uma troca de marca. As tabelas enumeram 78 nomes de chamadas literais identificadas; chamadas montadas dinamicamente e os detalhes internos do JSXBIN precisam ser confirmados na execução controlada. `main.js`, `captions.js` e vários módulos estão minificados: muitas referências ficam na linha 1.

| Área | Funções chamadas | Módulos/proxy cliente | Responsabilidade |
|---|---|---|---|
| Contexto | `getActiveSequenceUniqueId`, `getPremiereCTI`, `getSequenceInOut`, `fsDuracaoSequencia`, `fsFrameDaSequencia`, `fsSeqFps`, `fsDefinirIdioma` | `main.js`, `captions.js`, `autodistribute.js`, `transcription.js`, `autocut.js` | Identidade da sequência, posição, limites, duração, FPS e idioma do host |
| Trilhas | `fsTrilhasAudio`, `fsRegioesDeAudio`, `fsAudioNoTrecho`, `fsTrilhaLivreNoIntervalo`, `fsCriarTrilhaVideo`, `addVideoTrackAndRetry` | `transcription.js`, `autocut.js`, `jlcut.js`, `cloud_audio_panel.js`, `autodistribute.js`, `dinamica.js`, `main.js` | Consultar áudio/trilhas, escolher espaço e criar trilha |
| Exportação áudio | `fsExportAudioTrilha`, `fsExportAudioTrecho`, `fsAutocutExport`, `fsAeFonteDeAudio` | `transcription.js`, `cloud_audio_panel.js`, `autocut.js` | Obter arquivo de áudio local para transcrição/análise; caminho AE também existe |
| Biblioteca | `getTemplateStructure`, `getNextTemplateNumber`, `saveUserTemplate`, `getAvailableFonts` | `main.js` | Catalogar/carregar modelos, salvar modelo e consultar fontes |
| Inserção de modelos | `injectMogrtPremiere`, `injectAegraphicAE`, `addVideoTrackAndRetry`, `disableGraphicLayersInRange`, `fsConferirFonteAplicada` | `main.js`; aplicação em lote reutilizada por `autodistribute.js` | Inserir gráficos, lidar com trilha ocupada, controlar camada/fonte |
| Legendas MOGRT | `insertCaptionBlocks`, `fsTirarBlocosLegenda`, `fsPontaNaAgulha`, `fsSelecaoVideoConta` | `captions.js`, `wordhighlight.js` | Inserir blocos, remover blocos registrados e consultar seleção/agulha |
| Legendas da timeline | `getPremiereCaptionsForSelection`, `fsLegendasDaTimeline`, `fsLegendasExportarProjeto` | `main.js`, `premiere_fix.js` | Ler texto/tempos de seleção e exportar dados do projeto |
| Subtítulos nativos | `fsSubtitulosImportar`, `fsSubtitulosCriarTrilha`, `fsSubtitulosConta`, `saveSrtFile` | `captions.js` | Importar SRT, criar/conferir trilha CC e gravar SRT |
| Legendas/AE | `importSRTCaptions`, `clearCaptions`, `applyPresetBatchAE`, `createTempTextLayerAE`, `stackSelectedTexts`, `countActiveCompTexts` | `main.js` | Fluxos de texto/legendas e modelos, incluindo suporte ao After Effects |
| Cortes/retakes | `fsAutocutApply`, `fsRetakeSubir`, `fsAutocutSetStep`, `fsIrParaTempo`, `fsAutocutDiag`, `fsAutocutSondaLink` | `autocut.js` | Executar cortes/movimentos, mudar etapa, navegar e diagnosticar vínculos |
| J/L cut | `fsJLAnalisar`, `fsJLAplicar`, `fsJLSonda3` | `jlcut.js` | Analisar/mover clipes e diagnosticar pares |
| AutoEdit | `fsRaioXTimeline`, `fsRelatorioAutoEdit` | `autoedit.js` | Ler resultado da montagem e produzir diagnóstico |
| Efeitos/zoom | `fsDynPreview`, `fsApplyTransitions`, `fsZoomCamada`, `fsZoomDesfazer`, `fsImportarCamadaAjuste` | `dinamica.js` | Ler pontos, aplicar efeitos/zoom, desfazer e importar camada de ajuste |
| Tela dividida legada | `fsTelaDividida`, `fsTelaDivididaLer`, `fsTelaDivididaAjustar` | `dinamica.js` | Implementação antiga, preservada separadamente do adaptador próprio |
| SFX | `insertSfxAtCTI`, `fsSfxBlocos`, `distributeSfxAtTimes`, `clearAutoSfx` | `main.js`, `autosfx.js`, `sfx_dual_tracks.js` | Inserir som na agulha, ler blocos, distribuir e remover efeitos |
| Trilha musical | `fsAutoTrilhaAplicar`, `fsAutoTrilhaRemover` | `autotrilha.js` | Cobrir vídeo com música, emendas, volume e remoção |
| Estilo/cor | `fsStyleCopy`, `fsStylePaste`, `fsStyleDumpParams`, `fsTrocarCores` | `styleclone.js` | Ler/aplicar estilo, cores, movimento e diagnóstico de propriedades |
| Animação/presets | `fsAnimTexto`, `fsFxCountTargets`, `fsPresetApply`, `fsSondaEfeitos` | `animtexto.js`, `fxpresets.js`; parser `prfpset.js` | Aplicar canais animados e componentes/parâmetros de preset |
| Guias | `fsGuiaEstado`, `fsGuiaAplicar`, `fsGuiaRemover` | `guias.js`, `dinamica.js` | Consultar formato e inserir/remover PNGs como clipes reais |

`addVideoTrackAndRetry` aparece em duas linhas por atender duas áreas; não representa outra função. A tabela é uma enumeração por grupos, com a contagem de nomes únicos indicada acima.

## Pontes e lógica que já são próprias/editáveis

| Implementação | Entrada/exportação | Dependência que permanece |
|---|---|---|
| `jsx/captionia-split.jsx` + `js/captionia-split.js` | `captioniaSplitInspect`, `captioniaSplitApply`, `captioniaSplitRestore` | DOM do Premiere e suporte das propriedades dos clipes; não substitui nem renomeia `fsTelaDividida*` |
| `jsx/narrative-beta.jsx` + `js/narrative-beta.js` | `fsNarrativeBetaSnapshot`, `fsNarrativeBetaPreview`, `fsNarrativeBetaValidatePreview`, `fsNarrativeBetaRestore` | DOM do Premiere, identidade/assinatura de sequências, mídia disponível; fonte JSX é legível apesar do prefixo histórico |
| `js/speech-cuts.js` | `CaptionIASpeechCuts` | Decide cortes seguros com palavras/energia/contexto. `autocut.js` ainda entrega o plano de execução ao `fsAutocutApply` compilado; não é um novo executor de ripple |
| `js/autocut_warp_guard.js` | Guarda antes do corte e expressão inline de inspeção | DOM/QE do Premiere conforme consulta; não executa a operação final de corte |
| `js/sfx_dual_tracks.js` | `probeScript`, `addTracksScript`, `countsScript`, `run` | Consultas e criação de trilhas editáveis; inserção final continua em `distributeSfxAtTimes` |
| `js/sfx_scheduler.js`, `sfx_timing_calibration.js` | `CaptionIASfxScheduler`, `CaptionIASfxTiming` | Planejam/calibram tempos; dependem do executor SFX existente |
| `js/sfx_media_store.js`, `sfxopcoes.js` | Cópia estável de mídia, prévia/reverso | Node, AudioContext e arquivos locais; não substituem execução da timeline |
| `js/template_contract.js`, `wordhighlight.js` | Contrato de karaoke, validação de palavras/cores e construção dos dados | Inserção usa `insertCaptionBlocks`; recoloração usa script host editável construído no JS |
| `js/prfpset.js` | Leitura/normalização XML de presets | Aplicação final usa `fsPresetApply`; interpolação original precisa ser validada |
| `js/captionia-branding.js` | `cleanVisibleText`, `sanitizeVisible` | Apenas apresentação. Sem acesso a Storage no carregamento, sem observador próprio, sem alteração de caminhos/identificadores |

`CSInterface.js` é a ponte Adobe, não o motor de edição. `fsHostChamar` em `main.js` é proxy cliente de chamada/repetição; os auxiliares de UI/arquivo `fsNoFimDoClique`, `fsEscolherArquivos`, `fsAttachWordTimings` e `fsConferirDonoTranscricao` também não devem ser confundidos com exports do JSXBIN.

## Nuvem e Groq

| Módulo | Responsabilidade | Onde acaba sua autonomia |
|---|---|---|
| `transcription.js` | Motor legado de provedores diretos; permanece fornecendo resegmentação, tempos por palavra, autoria e remapeamento após cortes | Os botões e a transcrição do AutoEdit são assumidos pelo `cloud_audio_panel.js`. A exportação e a edição da timeline ainda usam o host |
| `groq_access.js` | Consulta autenticada a `/groq/status`, integração da conta e limites | A chave Groq da produção fica no servidor e não é recebida pelo painel. `secure_storage.js` pertence ao caminho legado, separado da sessão/licença e da integração cloud |
| `cloud_core.js` | `CaptionIACloudCore.planCaptions`, `planEdit`, `listAssets`, `downloadAsset`, configuração e verificação de asset | Recebe/devolve planos e assets; não edita o Premiere por conta própria |
| `cloud_audio_panel.js` | Intercepta os botões atuais e o adaptador de transcrição do AutoEdit; envia áudio para `/api/v1/groq/transcription` e palavras para `/core/captions/plan` | Exportação usa host; aplicação posterior depende do caminho de legendas selecionado. O token enviado é da sessão Caption IA |
| `cloud_captions_ui.js` | Interface de homologação de prévia/aplicação/restauração Cloud | Está no pacote, mas o carregador correspondente declarado em `cloud_core.js` não é chamado no caminho padrão atual |
| `narrative-beta.js` | Revisão/planejamento narrativo e validação do plano | A criação/validação da prévia passa pela ponte JSX própria |
| `autotrilha.js` | Classificação local por palavras, pontuação e ritmo da fala | Escolha automática de música é heurística local; aplicação é host compilado |

Não se realizou chamada de rede ou leitura de credenciais externas para este mapa.

## Marca visível versus contratos preservados

Podem mudar rótulos, textos, tooltips e nomes apresentados de sons/modelos. O cleaner fornece texto puro e ignora campos editáveis, `PRE`, `CODE`, `SCRIPT`, `STYLE` e texto que contém caminhos/URLs. Ele não altera atributos de caminho, valores de input, comandos, classes ou IDs. A integração pode limpar separadamente `title`/`aria-label` com os mesmos cuidados.

Referências visíveis concretas no código original: mensagens de `autosfx.js` sobre “Frame Speed”/“FS SFX”; mensagens de `autotrilha.js` sobre “FS TRILHA”; títulos/status das receitas `FS ...` em `animtexto.js`; títulos de relatórios em `autoedit.js`, `autocut.js`, `captions.js`; rótulos de biblioteca/som derivados de nomes de arquivo em `main.js`; nome de produto/arquivos exportados em `clientes.js` e texto do cofre. Caminhos mostrados em diagnósticos devem continuar correspondendo ao caminho real.

Preservar nesta rodada:

- `jsx/hostscript.jsxbin`, manifest/IDs de extensão e nomes das funções host.
- Nomes/caminhos dos assets `.fsm`, `.fsa`, `.mogrt`, áudio e previews já utilizados em projetos.
- Diretório `Documents/editBest`, nomes de trilhas/propriedades usados pelo host e identificadores de parâmetros dos templates.
- Chaves de preferências/credenciais existentes e formato de importação de clientes já exportado.

As funções de migração em `captionia-branding.js` são **opt-in e não foram ativadas**. Não há migração de diretórios nesta rodada. Sua eventual ativação exige validar backup/restauração, perfis com chaves internas, exclusão de segredos/licença, conflitos e remoção de preferências. Não se deve trocar `Storage.prototype`: o cofre existente já o intercepta.

## Plano de substituição gradual

1. **Fixar o ponto de partida.** Guardar hash do JSXBIN e inventário de arquivos; registrar cenários atuais em projeto descartável. Separar teste de UI, planejamento e execução real. Nesta fase só se apresentam mapa/plano e se limpa a marca visível.
2. **Criar fachada própria de chamada.** Namespace `CaptionIAPremiere` com envelopes versionados, IDs de sequência esperados, erros consistentes e logs sem tokens. Inicialmente encaminhar cada operação ao contrato legado sem mudar o resultado. Não redefinir funções globais `fs*`.
3. **Substituir consultas primeiro.** Nova ponte JSX legível para identidade, seleção, tracks, FPS e intervalos. Comparar respostas com consultas legadas em modo leitura. Só promover depois de paridade em sequências e mídias variadas.
4. **Operações locais e limitadas.** Evoluir a ponte própria de tela dividida com inspeção, aplicação explícita e restauração. Manter caminho legado acessível e testar persistência ao salvar/reabrir o projeto. Depois avançar para inserção unitária de som/gráfico, validando mídia online, trilha e ausência de sobrescrita.
5. **Planejamento independente.** Consolidar decisões de silêncio/retake/narrativa em JS testável, como `speech-cuts.js`. Continuar executando pelo legado até existir executor próprio verificado. Comparar listas de intervalos antes de qualquer edição.
6. **Executor de timeline próprio, por operação.** Começar em cópia de sequência; validar vínculos A/V, frame rate, speed changes, multicam/nests, efeitos de análise, locks e sobreposição. Implementar recuperação verificável; um relatório ou botão “desfazer” isolado não prova rollback. Só depois migrar cortes/ripple, J/L, zoom, estilos e operações em lote.
7. **Migração opcional de dados e aposentadoria.** Após paridade funcional, planejar migração explícita para `captionia_*` e diretórios CaptionIA sem apagar originais nem quebrar projetos antigos. Desativar apenas rotas substituídas e testadas; remover o JSXBIN fica para decisão posterior, quando nenhum fluxo ativo depender dele.

Cada fase precisa de critério de aceite e retorno ao caminho anterior. O prefixo histórico de uma função não impede desenvolver uma implementação nova com namespace Caption IA ao lado dela.

## Teste direto na instalação

Para HTML/CSS/JS, editar a pasta instalada e recarregar o painel CEP permite repetir o teste sem ZIP. Se o host mantiver funções antigas na sessão ExtendScript, recarregar o painel pode não limpar o contexto: recarregar explicitamente a ponte própria ou reiniciar o Premiere conforme o tipo de alteração. Não substituir/remover o binário para testar um script novo.

Verificação estática/Node cobre sintaxe, contratos e algoritmos puros com mocks; não comprova corte, QE, MOGRT, áudio online ou desfazer dentro do Premiere. O teste funcional deve usar uma cópia curta da sequência, executar uma operação por vez, comparar limites/contagens/sincronia e salvar/reabrir para confirmar referências de mídia. Não foi executado plugin, corte ou teste funcional no Premiere na elaboração deste documento.
