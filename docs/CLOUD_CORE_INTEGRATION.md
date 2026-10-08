# Caption IA CEP — migração Cloud Core

## Compatibilidade
O plugin distribuído é CEP/CSXS com JS/CSInterface e `jsx/hostscript.jsxbin`.
Não é UXP. O JSX fonte do host não consta no pacote 3.4.0.

## Código incluído nesta branch
- `CaptionIA/js/cloud_core.js` expõe `getConfig()`, `planCaptions()`,
  `planEdit()`, `listAssets()` e `downloadAsset()`.
- Requisições JSON passam pela licença do `auth.js`; 401 pode disparar revalidação.
- Download de asset é opt-in, fixa o host HTTPS, limita o tamanho e exige SHA-256 correspondente ao ID do catálogo.
- O cache fica em diretório de dados do usuário; não é um cofre impossível de copiar.

## IMPORTANTE
Os fluxos principais continuam usando os módulos locais:
`transcription.js`, `captions.js`, `autoedit.js`, `autocut.js`,
`autosfx.js`, `autotrilha.js`, além do executor JSXBIN.

**O módulo cloud ainda NÃO substitui esses fluxos**, nem remove os templates
locais. Isso é intencional para não destruir compatibilidade sem testes de
host/timeline reais. Não anuncie proteção plena do produto nesta etapa.

## Integração e testes pendentes
1. Recuperar/refazer e versionar o JSX fonte do `hostscript.jsxbin` antes de alterar
   comandos que criam/movem itens no Premiere.
2. Mapear modelo SRT/cues, timebase do Premiere e regras de undo.
3. Testar planos remotos sem alterações de timeline; depois adicionar preview e
   aprovação explícita antes da execução.
4. Testar offline, acessos revogados, 401/403/429/503, arquivos grandes e cancelamento.
5. Só após teste end-to-end remover algoritmos e arquivos locais substituídos.
6. Migrar GROQ com quota, privacidade e backend próprio; ainda não realizado.
7. Validar atualizador, SHA-256, instalação limpa e Windows/macOS.

## Rollback
Esta branch não altera fluxos antigos de edição. Não execute um rollout
acoplado antes da homologação do backend. A opção de rollback emergencial é
desligar `CAPTIONIA_CLOUD_CORE_ENABLED` e
`CAPTIONIA_CLOUD_ASSETS_ENABLED` no backend e manter o plugin estável 3.4.0.

Referência: docs/CLOUD_CORE_ROLLOUT.md na branch correspondente de
`vitoryvensreis/captionia-platform`.


## Novo fluxo opcional sem alterar o hostscript.jsxbin

O painel CEP injeta dois módulos locais:
- `js/cloud_audio_panel.js` insere opção **Transcrever na nuvem**. O usuário
  escolhe um arquivo e autoriza explicitamente o envio ao Caption IA/Groq.
  O resultado temporizado fica em `_fsLastResp`, vinculado à sequência ativa.
- `js/cloud_captions_ui.js` insere **Prévia na nuvem** e converte o plano
  aprovado em `premiereSrtData` (rascunho de legendas), preservando os tempos
  por palavra quando `fsAttachWordTimings` estiver disponível.
  Nada é inserido na timeline automaticamente. Há restauração do rascunho
  anterior enquanto ele não foi alterado depois da aplicação.

A transcrição tradicional e os arquivos locais NÃO foram removidos.
O painel novo verifica flags remotas e deve falhar com mensagem clara quando
as funções estiverem desativadas.

Homologação exigida: Premiere com sequência ativa, alteração de sequência
durante upload, rascunho existente, vídeo vertical/horizontal, word highlight,
modelo MOGRT e desfazer. A UI foi implementada sem fonte JSX, mas os testes
automáticos não substituem os testes dentro do Premiere/AE.

**Instalação e lançamento:** não trocar o pacote atual de clientes por esta
branch até o backend e o painel serem testados juntos. A API e a UI devem ser
publicadas em ordem, servidor primeiro.

## Smoke test local do painel (sem Premiere)

Execute `node scripts/test-cloud-panel.js` na raiz do repositório. O teste simula a janela CEP, garante que a prévia não altera a timeline/rascunho antes da confirmação, verifica os metadados de palavras e restaura o SRT anterior. É um teste isolado; não valida a API Adobe real.
