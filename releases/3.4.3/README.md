# Caption IA 3.4.3 — registro de distribuição

## Pacote publicado para clientes

- **Arquivo:** `CaptionIA-3.4.3.zip`
- **Versão CEP:** `3.4.3`
- **Tamanho do ZIP conferido:** `177242646` bytes
- **SHA-256 do ZIP conferido pelo projeto:**
  `47010c8d06f666209a77b3e6a2cd14e37417c707b00560e7e2d9e782ec5a6b1d`
- **Conteúdo:** `CaptionIA/`, `INSTALAR_CAPTION_IA.bat`,
  `INSTALAR_CAPTION_IA.ps1`, `LEIA_PRIMEIRO.txt`
- **Origem:** geração validada pelo GitHub Actions na branch `main`;
  artefato original: [Build 37729644565](https://github.com/vitoryvensreis/captionia/actions/runs/37729644565).
- **Checagem:** ZIP íntegro, 632 entradas (523 arquivos);
  16 arquivos críticos comparados por Git blob SHA-1 com a árvore da `main`
  e sem diferenças.

**Importante:** a soma SHA-256 acima corresponde especificamente ao ZIP
validado e entregue ao administrador da plataforma. ZIPs reconstruídos do
mesmo commit podem ter SHA-256 diferente devido a timestamps e metadados
de compactação. Compare sempre com `SHA256SUMS.txt` fornecido **junto do
arquivo específico**.

## Localização permanente

O código-fonte e os arquivos de template estão no repositório Git **privado**.
O workflow `.github/workflows/archive-private-release-343.yml` recompila
o instalador da `main` e o arquiva como *draft GitHub Release*
`v3.4.3`, anexando ZIP + `SHA256SUMS.txt`.

Uma release **rascunho** não é uma distribuição pública. A distribuição
aos clientes continua sendo exclusivamente via
[Minha Conta](https://caption.escotilhaprodutora.com/minha-conta),
com licença elegível. Nunca tornar públicos o repositório ou seus assets
sem auditoria dos direitos autorais dos modelos, efeitos e músicas.

## Mudanças relevantes

- Transcrição com GROQ via API protegida por licença (chave no servidor)
- Motor de legendas Cloud e integração com Premiere
- AutoEdit / AutoSFX por palavra em duas trilhas
- Cópia persistente dos áudios AutoSFX em
  `%LOCALAPPDATA%\CaptionIA\Media\SFX`
- Correção de ícones antigos e instalador Windows com backup e logs

## Para uma versão futura

Atualizar versões de `main.js`, `auth.js`, `updater.js`,
`CSXS/manifest.xml`, `INSTALAR_CAPTION_IA.bat` e
`INSTALAR_CAPTION_IA.ps1`, rodar os testes automatizados,
publicar nova versão do pacote pelo site e arquivar o novo
instalador em release **privada**.

Não subir manualmente um binário de 177 MB como commit Git comum: além do
limite de tamanho do GitHub (100 MB por arquivo), isso causaria
crescimento desnecessário do histórico.
