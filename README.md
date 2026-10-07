# Caption IA 3.2.3 — versão livre / sem login

Esta árvore foi criada a partir do pacote recuperado do FrameSpeed 2.2.

## Alterações realizadas
- Nome público alterado para **Caption IA**.
- Nome público e menu do CEP alterados para **Caption IA**.
- IDs internos `com.editbest` / `com.editbest.panel` foram preservados por compatibilidade e para evitar duplicar a extensão em projetos/instalações existentes.
- Versão atual: **3.2.3**.
- Tela de login removida.
- Cliente de autenticação e chamadas `login.php`, `validate.php` e `logout.php` removidos do plugin.
- Revalidação periódica de sessão removida.
- Dependência do endpoint remoto de atualização antigo removida.
- Tela EULA de primeira execução removida para o painel abrir direto.
- Botão de logout, nome de usuário e atalho do Instagram antigo removidos.
- Textos públicos `Frame Speed` / `Victoframe` trocados por `Caption IA`.
- Instalador BAT por usuário incluído.

## Compatibilidade intencional
As chaves internas `framespeed_*`, alguns nomes de funções `fs*` e nomes temporários foram **mantidos**.
Isso é proposital: mudar tudo de uma vez pode quebrar preferências já salvas, integrações com o
`hostscript.jsxbin` recuperado e arquivos de projeto antigos. O nome exibido ao usuário é Caption IA.

## Backend do Premiere
`jsx/hostscript.jsxbin` continua sendo o backend recuperado da versão 2.2. Ele foi mantido intacto
para preservar as funções do Premiere enquanto o código fonte `.jsx` é reconstruído.

## Instalação
Execute `INSTALAR_CAPTION_IA.bat`, feche e abra o Premiere e procure:
**Janela > Extensões > Caption IA**.

O instalador migra automaticamente uma instalação anterior da pasta `editBest` para `CaptionIA`.
Os diretórios de dados em `Documentos/editBest` continuam sendo usados internamente por compatibilidade,
principalmente para preservar preferências, cache e a chave Groq já salva.


## Correções 3.1.0
Veja `ALTERACOES_3.1.0.txt`. Esta versão inclui correções de metadados .fsm, encaixe de texto, SFX, paginação, instalação segura e persistência verificada da chave de API.


## Novidades 3.2.0
- Karaoke/Word Highlight integrado à biblioteca normal de templates e ao AutoEdit.
- Contrato opcional `template.json` para declarar engine, limite de palavras e requisitos sem depender só do nome da pasta.
- Terceira cor de estilo para a palavra ativa do Karaoke.
- Identidades visuais de cliente passam a persistir também degradê secundário, sombra, tracking, regra de 1 linha e cor ativa do Karaoke.
- Caminhos persistentes centralizados mantendo `Documentos/editBest` como raiz compatível; cofre legado em `Frame Speed` é migrado sem apagar a origem.
- Chave da API no macOS usa Keychain quando disponível, com fallback compatível se o sistema recusar.
- Validador de release e workflow de empacotamento adicionados para reduzir regressões.

Veja `ALTERACOES_3.2.0.txt` para detalhes.


## Correções 3.2.1
- Karaoke/Word Highlight no AutoEdit volta a usar a frase completa de cada legenda; o destaque continua avançando palavra por palavra dentro da mesma frase.
- O modelo Karaoke passa a declarar uma única fonte de texto de frase (`lineCount: 1`) em vez de ser tratado como quatro slots genéricos.
- Removido o ícone antigo do cabeçalho; permanece apenas o nome Caption IA e a versão.


## Ajustes 3.2.2
- Dinâmica: "Animações FS" agora aparece como "Animações".
- A aba visível J/L Cut foi removida; o código interno permanece inativo para evitar regressões em outras ferramentas.
- Frame Grid: título interno alterado para "Grid".
- Frame Grid: removida a opção TikTok e substituída a moldura do Instagram pela arte atual fornecida.
- Preferências antigas salvas como TikTok são limpas automaticamente ao abrir a ferramenta.
- Color Grading agora mostra somente "Em breve".


## Correção 3.2.3
- Corrigida a distribuição do Karaoke/Word Highlight em várias trilhas de vídeo.
- O caminho especial do Karaoke agora respeita a mesma trilha preferencial já escolhida pelo AutoEdit/Auto-aplicar.
- Enquanto os blocos não se sobrepõem, o plugin reutiliza a mesma trilha em vez de procurar uma nova trilha para cada frase.
- Se houver uma trilha explicitamente informada pelo lote, ela continua tendo prioridade.


## Login e licença

A partir da 3.3.0, o painel usa a API da plataforma oficial:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/license/check`
- `GET /api/v1/me`

O usuário entra com a mesma conta do site. O `device_uuid` fica persistente no computador, e a API aplica o limite de dispositivos definido no plano. O refresh token é armazenado localmente cifrado e a senha nunca é salva pelo plugin.

## Instalador Windows

O repositório possui `installer/CaptionIA.iss` e o workflow `Build Windows installer`. Após uma validação bem-sucedida da `main`, o GitHub Actions gera um instalador `.exe` com interface moderna, remoção automática de instalações antigas e configuração do CEP.

O BAT antigo continua disponível como fallback técnico.
