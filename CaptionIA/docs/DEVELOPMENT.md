# Desenvolver na instalação do Caption IA

Esta pasta é carregada diretamente pelo CEP. Não é necessário criar ZIP para testar HTML, CSS, JavaScript ou os novos arquivos JSX editáveis.

## Estado desta rodada

- A licença e os endpoints de produção continuam ativos.
- `js/captionia-config.js` pausa somente as atualizações automáticas para que uma release não sobrescreva o trabalho local.
- As cópias anteriores dos arquivos editados estão em `.captionia-backups/`. Não apague essa pasta durante a revisão.
- `jsx/hostscript.jsxbin` não foi modificado. SHA-256: `b7d39c14c221297549bc794e89aef20efe98ab6ff809b1837f55bdbfd33cf09f`.
- O mapa de substituição está em `dependency-map.md`. A limpeza da marca visível não significa que os contratos internos antigos já foram eliminados.

## Ciclo de teste no Premiere

1. Salve o projeto e prepare uma sequência de teste com cópia dos clipes usados na edição.
2. Abra **Janela → Extensões → Caption IA** (o nome do menu pode variar conforme a versão do Premiere).
3. Salve os arquivos editados e recarregue o painel. Fechar e reabrir pode reutilizar uma instância antiga; se isso ocorrer, reinicie o Premiere.
4. Para desenvolvimento com DevTools, adicione um arquivo `.debug` na raiz com o ID `com.editbest.panel`, host `PPRO` e uma porta livre, por exemplo `8088`. Reinicie o Premiere e abra `http://localhost:8088` no navegador de depuração. No console, `location.reload()` recarrega o painel.
5. HTML/CSS/JS recarregam juntos. Os módulos JSX próprios são carregados por `$.evalFile()`; o motor ExtendScript não é necessariamente reiniciado com o HTML. Reinicie o Premiere para garantir uma sessão limpa depois de mudar JSX já carregado.
6. Confira o resultado na timeline, o áudio, as palavras nas emendas e a possibilidade de voltar à sequência original.

Se a instalação for bloqueada por assinatura, configure `PlayerDebugMode` apenas para a versão CEP do Premiere em uso. A versão CSXS mínima no manifesto não identifica necessariamente o runtime instalado.

## Cenários para homologação

### Cortes

- Palavra baixa ou curta inteiramente dentro de uma pausa candidata: ela deve sobreviver.
- Começo/fim de palavra junto da emenda: preservar as margens de fala.
- Áudio estéreo com canais em oposição de fase: não tratá-lo como silêncio.
- Retake com repetição no final/início de takes: ouvir a sugestão e manter a tentativa correta.
- Ênfase intencional, como “muito, muito bom”: não excluir automaticamente.
- Troca de sequência, edição manual após a análise e troca de 30 para 60 fps: rejeitar plano antigo e analisar de novo.
- Warp Stabilizer presente: o painel deve interromper com uma explicação, sem remover o efeito.

### Tela dividida

- Dois vídeos simultâneos em faixas diferentes, alinhados no início e no fim: lado a lado e topo/baixo.
- Quatro vídeos alinhados em faixas diferentes: grade 2 × 2.
- Sequências 16:9 e 9:16, mídia com resoluções diferentes, ajustar/preencher.
- Seleção incompleta, keyframes, velocidade alterada e efeitos incompatíveis: conferir recusa explícita, sem editar a original.
- Conferir o resultado na cópia e usar “Voltar à sequência original”.

### Interface e tutorial

- Larguras de painel 380, 600 e 900 px; rolagem e acesso a todos os botões.
- Primeiro acesso, pular tutorial, reabrir pelo `?`, voltar/próximo e Escape.
- Navegar por teclado; o foco deve permanecer no balão e voltar ao controle anterior ao encerrar.
- Nenhum passo do tutorial deve executar corte, upload, montagem ou inserção de mídia.

### Montagem narrativa

- Priorizar fala natural e preservação do sentido.
- Exigir transcrição da sequência atual e gerar uma prévia antes da aprovação.
- Trocar mídia, mover clipes ou alterar palavras depois da análise: rejeitar a prévia antiga.
- Não reconstruir silenciosamente takes com tratamentos que não podem ser preservados.

## Testes locais

Com Node.js instalado, abra um terminal nesta pasta e rode:

```powershell
node --test
```

Os testes usam dados e objetos Adobe simulados. Eles não abrem o Premiere, não editam projetos e não chamam a Groq. Validam lógica, contratos e sintaxe, mas não substituem a homologação no Premiere.

Existe também uma prévia isolada da interface:

```powershell
node tests/preview-server.cjs
```

Abra `http://127.0.0.1:8766`. Essa prévia usa uma ponte simulada, exclui autenticação/serviços e não representa testes de execução no Premiere. O servidor deve ser encerrado com Ctrl+C depois da revisão.

Referências Adobe: [depuração de clientes CEP](https://github.com/Adobe-CEP/Getting-Started-guides/blob/master/Client-side%20Debugging/readme.md) e [handbook de depuração](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/Debugging%20Handbook.md).
