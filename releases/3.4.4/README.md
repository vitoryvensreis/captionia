# Caption IA 3.4.4 — Groq Cloud ou chave pessoal

- Data: 2026-10-08
- Versão do plugin e manifesto: `3.4.4`
- Pacote do cliente: `CaptionIA-3.4.4.zip`, com a pasta CaptionIA e os instaladores Windows BAT/PowerShell.
- Fonte: `main` do repositório privado Caption IA.
- **Backup permanente privado**: [Releases do Caption IA](https://github.com/vitoryvensreis/captionia/releases), rascunho `v3.4.4`. Nenhum asset deve ser publicado como release público.

## Alterações

1. Removida a cota diária do Caption IA no servidor; permanecem as proteções de solicitações por minuto e os limites da própria Groq.
2. Retirada a caixa de autorização adicional ao transcrever, mantendo aviso de envio e processamento remoto do áudio.
3. Padrão: Groq da nuvem, com chave somente no servidor do Caption IA.
4. Alternativa: chave pessoal Groq `gsk_...` armazenada por usuário no Windows (DPAPI). Nesta opção a requisição vai **diretamente à Groq**; a chave pessoal não é encaminhada nem salva no servidor Caption IA.
5. Mantidos licença obrigatória, AutoEdit, AutoSFX, legendas, templates e `hostscript.jsxbin`.

## Distribuição

Ao cliente, envie somente o ZIP da versão `3.4.4` disponibilizado pela área Minha Conta do site, após publicar o pacote na área Admin → Releases. O GitHub é backup técnico, não canal público de download.

O arquivo SHA256SUMS.txt da release refere-se **àquele ZIP gerado no GitHub**. Outro ZIP com os mesmos arquivos pode ter SHA diferente devido a metadados de compactação. Não colocar nenhuma chave Groq real no pacote.
