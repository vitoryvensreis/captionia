# Caption IA Desktop · Beta 1.1

Aplicativo independente do Adobe Premiere Pro, para Windows e macOS.

## Para quem usa

1. Instale o aplicativo e entre com **a mesma conta** de https://caption.escotilhaprodutora.com.
2. Tenha uma licença ativa com acesso à versão 3.6.5 e uma chave Groq cadastrada em **Minha conta** no site.
3. Importe um MP4, MOV, MKV ou WEBM com áudio e fala. Escolha:
   - **Montagem Inteligente IA:** identifica/ordena trechos a partir da transcrição;
   - **Cortes automáticos:** remove os intervalos de silêncio entre trechos reconhecidos;
   - **Somente legendar:** preserva o vídeo completo.
4. Ative independentemente **Montagem/cortes**, **Legendas** e **Zoom**. É possível deixar só zoom, só legendas ou combinar os três.
5. Se habilitar legendas, selecione um estilo, cores do texto/destaque e tamanho da fonte; importe templates `.mogrt` adicionais quando desejado.
6. Configure zoom suave ou impacto, força 6%, 10% ou 15%, alternando entre cortes ou aplicando a todos.
7. Escolha formato de tela/pasta e clique em **Processar e renderizar vídeo**.

O programa devolve o **vídeo MP4 final** com os recursos ativados e uma pasta com `cortes.csv`, `projeto.captionia.json` e `timeline.fcpxml` (experimental). `legendas.srt` e `legendas.ass` são gerados somente se legendas estiverem habilitadas.

## Templates MOGRT do Premiere (compatibilidade de metadados)

O Desktop já inclui as **duas identidades MOGRT diferentes** encontradas no arquivo do usuário:

- `CAPTIONIA_WORD_HIGHLIGHT.mogrt`: recriação nativa de realce de palavras, configurável por cores.
- `bloco_legenda.mogrt` (`01 word top-down`): recriação simples de entrada vertical por palavra.

Os MOGRTs armazenados são arquivos do próprio projeto. O aplicativo **lê `definition.json`, controles expostos e miniatura PNG** e identifica os presets conhecidos. Em **Importar template .MOGRT** ele também cataloga arquivos personalizados, com aviso claro. Templates que não reconhecemos são catalogados, porém renderizados no fallback genérico clássico.

**Limitação importante:** `project.aegraphic`, expressões After Effects, máscaras, plugins Adobe e animações complexas NÃO são interpretados nem renderizados pelo Python/FFmpeg. Os estilos são aproximações independentes em ASS/libass; não existe garantia de fidelidade quadro a quadro ao MOGRT original. Não necessita do Premiere instalado.

Há ainda cinco templates nativos: Palavra ativa, Clássico, Minimalista, Impacto Pop, Box Tarja.


## Como funciona

- O vídeo original fica **no seu computador**.
- O programa extrai áudio em MP3 mono, em partes de até 150 segundos. Somente **esses trechos de áudio** são enviados por HTTPS ao servidor Caption IA; a plataforma encaminha a transcrição à Groq com a chave cadastrada na conta.
- A **chave Groq nunca é fornecida ao aplicativo**; a plataforma usa o serviço `UserGroqService` já implementado, com credencial cifrada no servidor.
- A análise narrativa envia **texto transcrito e timecodes** ao serviço de IA da própria plataforma, não o vídeo.
- O render é **local via FFmpeg**, com legendas ASS incorporadas e áudio AAC. Internet é necessária para login/transcrição/análise.
- Os tokens de sessão ficam no **cofre de credenciais do sistema (Windows Credential Manager/macOS Keychain)** quando disponível; não são gravados em texto claro.

## Executar pelo código-fonte

Python 3.12 recomendado:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate  |  Mac: source .venv/bin/activate
python -m pip install -r requirements.txt
python main.py
```

A biblioteca `imageio-ffmpeg` inclui o binário FFmpeg usado para importação, extração de áudio, legendas e exportação.

## Criar instaladores

**Windows:** instale Python 3.12 e Inno Setup 6. Execute `powershell -ExecutionPolicy Bypass -File packaging/build-win.ps1`. Saída: `dist_installer/CaptionIA-Desktop-Setup-Windows-1.1.0-beta.exe`.

**macOS:** instale Python 3.12 (com `venv`) e execute `bash packaging/build-mac.sh` em um Mac. Saída: `dist_installer/CaptionIA-Desktop-macOS-1.1.0-<arquitetura>.dmg`.

O workflow `.github/workflows/build-desktop.yml` executa esses processos automaticamente nos runners Windows e macOS do GitHub Actions e disponibiliza os resultados na seção **Artifacts** da execução. Para baixar os binários compilados, abra a execução do workflow.

**Avisos:** os instaladores são **não assinados**. Windows SmartScreen e macOS Gatekeeper podem solicitar autorização. DMG ad-hoc não é notarizado pela Apple. Não prometemos que tenham sido testados em todas as versões do sistema.

## Limites da versão Beta

- Não executa os renderizadores Adobe MOGRT; importa metadados e reproduz estilos de forma aproximada em ASS/libass.
- Modo de cortes automáticos usa tempos de palavras; não interpreta todos os sons ou pausas sem fala.
- A Montagem Inteligente aplica critérios e validações inspirados no algoritmo do plugin e os endpoints existentes, **não é um porte byte a byte** do editor Premiere e seus efeitos.
- A revisão editorial é automática. Para decisões críticas, revisar o vídeo final antes de enviar ao cliente.
- Zoom opera sobre o centro da imagem, sem rastreamento de rosto, e pode cortar bordas. Pré-visualize o resultado antes da entrega.
- Se Montagem e Legendas estiverem desativadas, a transcrição/Groq é pulada. A verificação de licença continua obrigatória.
- FCPXML é apenas um formato de intercâmbio experimental; não substitui projetos nativos `.prproj`, `.drp` ou `.aep`.
- A Groq e a plataforma aplicam limites de áudio e processamento e podem rejeitar chamadas.
- O login da API consome uma vaga de dispositivo da licença, conforme as regras existentes do site.
- Sem internet não é possível transcrever ou fazer análise narrativa por IA.

## Segurança

Nunca coloque `GROQ_API_KEY` dentro do executável. O aplicativo chama os endpoints HTTPS existentes:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/license/check`
- `GET /api/v1/groq/status`
- `POST /api/v1/groq/transcription`
- `POST /api/v1/groq/narrative/analyze`

Não copie credenciais, tokens ou vídeos para logs de suporte. Para reinstalar, mantenha seu dispositivo cadastrado ou remova a autorização antiga em Minha conta.
