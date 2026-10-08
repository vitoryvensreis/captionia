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
