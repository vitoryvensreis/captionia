# Montagem Inteligente — Auto Edit BETA

## Implementação
- Etapa **narrativa** inserida imediatamente após `Corte de silêncios`, desligada por padrão.
- O fluxo aguarda a aprovação antes de continuar com legendas, zoom, transições, SFX e trilha.
- `js/narrative-beta.js` lê os `words` da transcrição do Caption IA, cria segmentos por pausas e fronteiras entre clipes, faz **duas passagens Groq GPT-OSS 120B** (direção + revisão) e valida IDs, tempos, exclusões e duplicatas.
- `jsx/narrative-beta.jsx` é carregado separadamente do hostscript compilado, verifica estrutura da timeline, cria subclipes e gera uma sequência clonada para prévia. A sequência fonte não é alterada por esta etapa.
- `css/narrative-beta.css` mantém a linguagem visual e as variáveis do painel atual.

## Instalação e teste
Aplique os quatro arquivos alterados/adicionados sobre uma instalação atual do Caption IA. Não substitua `hostscript.jsxbin`. Reinicie o Premiere, abra Auto Edit, habilite **Montagem inteligente IA** e verifique a chave Groq. Teste com takes propositalmente fora de ordem em V1 e áudio original vinculado em A1. Quando a revisão aparecer, clique em **Ver prévia no Premiere**, assista, depois **Aprovar e continuar** ou **Pular**.

## Limitações / segurança
- **Ainda não validado dentro do Premiere Pro** — esta branch é para testes, não produção.
- Uma faixa de vídeo e uma de áudio, clipes vinculados e em velocidade normal. Timeline multi-faixa, áudio externo, MOGRTs, multicâmera, speed ramp e efeitos prévios não são suportados.
- A nova montagem usa uma cópia da sequência pós-AutoCut; o AutoCut anterior pode ter alterado a sequência em uso.
- O modelo recebe o texto e os metadados das falas; o processamento usa a chave Groq já configurada.
- Se fechar o Premiere durante a revisão, reinicie o Auto Edit; a prévia pode continuar salva no projeto.
- Mudanças na ordem exigem gerar outra prévia. Não aplicar sobre projetos sem backup.
- A geração do plano narrativo depende de dados da transcrição corretamente remapeados após o AutoCut.
