# Caption IA Desktop · Beta 1.0

Aplicativo independente do Adobe Premiere Pro, para Windows e macOS.

## Para quem usa

1. Instale o aplicativo e entre com **a mesma conta** de https://caption.escotilhaprodutora.com.
2. Tenha uma licença ativa com acesso à versão 3.6.5 e uma chave Groq cadastrada em **Minha conta** no site.
3. Importe um MP4, MOV, MKV ou WEBM com áudio e fala. Escolha:
   - **Montagem Inteligente IA:** identifica/ordena trechos a partir da transcrição;
   - **Cortes automáticos:** remove os intervalos de silêncio entre trechos reconhecidos;
   - **Somente legendar:** preserva o vídeo completo.
4. Escolha estilo de legenda, formato de tela e pasta de saída.
5. Clique em **Processar e renderizar vídeo**.

O programa devolve o **vídeo MP4 final, já com as legendas**, e uma pasta complementar com `legendas.srt`, `legendas.ass`, `cortes.csv`, `projeto.captionia.json` e `timeline.fcpxml` (intercâmbio experimental).

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

**Windows:** instale Python 3.12 e Inno Setup 6. Execute `powershell -ExecutionPolicy Bypass -File packaging/build-win.ps1`. Saída: `dist_installer/CaptionIA-Desktop-Setup-Windows-1.0.0-beta.exe`.

**macOS:** instale Python 3.12 (com `venv`) e execute `bash packaging/build-mac.sh` em um Mac. Saída: `dist_installer/CaptionIA-Desktop-macOS-<arquitetura>.dmg`.

O workflow `.github/workflows/build-desktop.yml` executa esses processos automaticamente nos runners Windows e macOS do GitHub Actions e disponibiliza os resultados na seção **Artifacts** da execução. Para baixar os binários compilados, abra a execução do workflow.

**Avisos:** os instaladores são **não assinados**. Windows SmartScreen e macOS Gatekeeper podem solicitar autorização. DMG ad-hoc não é notarizado pela Apple. Não prometemos que tenham sido testados em todas as versões do sistema.

## Limites da versão Beta

- Não replica presets Adobe MOGRT; a legendar ASS é uma implementação independente.
- Modo de cortes automáticos usa tempos de palavras; não interpreta todos os sons ou pausas sem fala.
- A Montagem Inteligente aplica critérios e validações inspirados no algoritmo do plugin e os endpoints existentes, **não é um porte byte a byte** do editor Premiere e seus efeitos.
- A revisão editorial é automática. Para decisões críticas, revisar o vídeo final antes de enviar ao cliente.
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