/* Caption IA — Montagem Narrativa BETA / CEP — isolated UX + Groq director/reviewer */
(function(root){'use strict';
var STATE='captionia_narrativa_beta_v1'; var MODEL='openai/gpt-oss-120b';
var pending=null, lastPlan=null, lastManifest=null, lastSegments=[], lastCoverage=[], removedDuplicates=[], isBusy=false;
function el(id){return document.getElementById(id);} function fail(s){throw new Error(s);}
function escapeHTML(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function save(o){try{var v=settings();Object.keys(o).forEach(function(k){v[k]=o[k];});localStorage.setItem(STATE,JSON.stringify(v));}catch(_){} }
function settings(){try{return JSON.parse(localStorage.getItem(STATE)||'{}')||{};}catch(_){return {};}}
function getKey(){var k='';try{k=root.fsSecureKeyStore&&root.fsSecureKeyStore.get()||'';}catch(_){}if(!k)try{k=localStorage.getItem('framespeed_groq_key')||'';}catch(_){}return String(k).trim();}
function host(functionName,payload){return new Promise(function(resolve,reject){if(typeof csInterface==='undefined')return reject(Error('O Premiere não está conectado ao painel.'));var expr=functionName+'('+JSON.stringify(JSON.stringify(payload||{}))+')';csInterface.evalScript(expr,function(out){try{if(!out||out==='EvalScript error.')throw Error('Falha da ponte JSX: '+String(out));var v=JSON.parse(out);if(!v.ok)throw Error(v.error||'Erro no Premiere');resolve(v);}catch(e){reject(e);}});});}
function loadHost(){return new Promise(function(resolve,reject){if(typeof csInterface==='undefined'||typeof CSInterface==='undefined')return reject(Error('Somente Premiere Pro'));var p='';try{p=csInterface.getSystemPath(SystemPath.EXTENSION);}catch(_){}if(!p)return reject(Error('Diretório da extensão indisponível'));p=p.replace(/\\/g,'/')+'/jsx/narrative-beta.jsx';var script='$.evalFile('+JSON.stringify(p)+'); typeof fsNarrativeBetaSnapshot === "function" ? "OK" : "NO"';csInterface.evalScript(script,function(x){if(x==='OK')resolve();else reject(Error('Não foi possível carregar a ponte de montagem ('+x+').'));});});}
function groupWords(words,clips){var result=[], cur=[];
function emit(){if(!cur.length)return;var text=cur.map(function(x){return x.word;}).join(' ').replace(/\s+([,.!?;:])/g,'$1');var flag=/\b(n[aã]o[,.]?\s*calma|errei|de novo|pera a[ií]|come[cç]a de novo)\b/i.test(text);result.push({id:'S'+String(result.length+1).padStart(3,'0'),start:cur[0].start,end:cur[cur.length-1].end,text:text,blocked:flag});cur=[];}
(words||[]).forEach(function(w){var a=Number(w.start),b=Number(w.end);if(!isFinite(a)||!isFinite(b)||b<=a||!String(w.word||'').trim())return;
var inside=clips.some(function(c){return a>=c.start-.05&&b<=c.end+.05;});if(!inside)return;
if(cur.length){var prev=cur[cur.length-1], gap=a-prev.end;var sameClip=clips.some(function(c){return prev.start>=c.start-.05&&b<=c.end+.05;});if(gap>=.65||gap<-.2||!sameClip||gap>=.15&&/[.!?]$/.test(prev.word))emit();}
cur.push({start:a,end:b,word:String(w.word).trim()});});emit();return result.filter(function(s){return s.end-s.start>=.18;});}
function validate(raw,segments,clips){if(!raw||!Array.isArray(raw.cuts))fail('A IA não retornou uma lista de cortes.');if(raw.cuts.length<1||raw.cuts.length>100)fail('Quantidade de cortes fora do limite de segurança.');
var map={};segments.forEach(function(s){map[s.id]=s;});var out=[],seen={};raw.cuts.forEach(function(c,i){var s=map[c.id];if(!s)fail('Trecho desconhecido: '+c.id);if(s.blocked)fail('Trecho marcado como erro de gravação: '+s.id);if(seen[s.id])fail('Trecho duplicado: '+s.id);seen[s.id]=true;
var containing=clips.filter(function(v){return s.start>=v.start-.05 && s.end<=v.end+.05;});if(containing.length!==1)fail('Trecho cruza cortes existentes: '+s.id);if(s.end-s.start<.18)fail('Trecho curto demais: '+s.id);out.push({id:s.id,start:s.start,end:s.end,text:s.text,role:String(c.role||'conteúdo').slice(0,60),reason:String(c.reason||'').slice(0,400),clipIndex:containing[0].index});});
if(!out.length)fail('Nenhum trecho aproveitável');return out;}
function groq(messages,signal){return new Promise(function(resolve,reject){var key=getKey();if(!/^gsk_/.test(key))return reject(Error('Configure sua chave Groq nas Legendas antes de iniciar.'));var https;try{https=require('https');}catch(_){return reject(Error('HTTPS do CEP indisponível'));}
var data=JSON.stringify({model:MODEL,temperature:0.1,max_completion_tokens:1800,response_format:{type:'json_object'},messages:messages});var req=https.request({hostname:'api.groq.com',path:'/openai/v1/chat/completions',method:'POST',timeout:65000,headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},function(resp){var str='';resp.on('data',function(ch){str+=ch;if(str.length>150000){req.destroy();reject(Error('Resposta Groq excessiva'));}});resp.on('end',function(){try{var j=JSON.parse(str);if(resp.statusCode<200||resp.statusCode>=300)fail(j.error&&j.error.message||'Groq HTTP '+resp.statusCode);var v=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;resolve(JSON.parse(v));}catch(e){reject(e);}});});req.on('error',reject);req.on('timeout',function(){req.destroy(Error('Tempo limite da Groq.'));});req.end(data);
});}
function normalizeIdea(text){return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
var STOP={'a':1,'o':1,'e':1,'de':1,'da':1,'do':1,'um':1,'uma':1,'as':1,'os':1,'no':1,'na':1,'para':1,'pra':1,'eu':1,'que':1,'com':1,'é':1,'vou':1,'vai':1,'hoje':1,'meu':1,'minha':1,'se':1,'nos':1,'das':1,'dos':1};
function ideaTokens(text){return normalizeIdea(text).split(' ').filter(function(w){return w.length>2&&!STOP[w];});}
function nearDuplicate(a,b){var x=ideaTokens(a),y=ideaTokens(b);if(!x.length||!y.length)return normalizeIdea(a)===normalizeIdea(b);var ax={},bx={},inter=0;x.forEach(function(t){ax[t]=1;});y.forEach(function(t){bx[t]=1;});var ka=Object.keys(ax),kb=Object.keys(bx);ka.forEach(function(t){if(bx[t])inter++;});var union=ka.length+kb.length-inter;return (union&&inter/union>=.82&&inter>=Math.min(2,ka.length,kb.length)) ||(Math.min(ka.length,kb.length)>=4&&inter/Math.min(ka.length,kb.length)>=.9&&Math.max(ka.length,kb.length)/Math.min(ka.length,kb.length)<1.45);}
function parseScript(raw){var text=String(raw||'').trim();if(!text)return[];if(text.length>12000)fail('O roteiro excede 12.000 caracteres. Separe o projeto em partes.');var lines=text.split(/\r?\n/),sections=[],cur=null;
function flush(){if(cur&&cur.text.trim())sections.push({id:'R'+String(sections.length+1).padStart(3,'0'),title:cur.title||'Trecho '+(sections.length+1),text:cur.text.trim()});cur=null;}
lines.forEach(function(line){var t=line.trim();var match=t.match(/^#{1,4}\s+(.{2,70})$/)||t.match(/^((?:abertura|introdução|intro|gancho|conteúdo|desenvolvimento|fechamento|encerramento|cta|cena\s*\d+|parte\s*\d+)[^:]{0,45}):\s*(.*)$/i);if(match){flush();cur={title:match[1].trim(),text:match[2]||''};}else if(!t){if(cur&&cur.text&&!cur.title)flush();}else{if(!cur)cur={title:'',text:''};cur.text+=(cur.text?'\n':'')+t;}});flush();if(!sections.length&&text)sections=[{id:'R001',title:'Roteiro',text:text}];if(sections.length>30)fail('Roteiro com mais de 30 blocos. Agrupe cenas ou trechos.');return sections;}
function readConfig(){var selected=document.querySelector('input[name="nb-montagem-modo"]:checked');var mode=selected?selected.value:'livre';var fidelity=el('nb-fidelity')?el('nb-fidelity').value:'flexivel';var raw=el('nb-script')?el('nb-script').value:'';if(mode!=='livre'&&mode!=='roteiro')mode='livre';if(fidelity!=='fiel'&&fidelity!=='flexivel')fidelity='flexivel';var sections=mode==='roteiro'?parseScript(raw):[];if(mode==='roteiro'&&!sections.length)fail('Cole o roteiro de referência antes de iniciar o Auto Edit.');return {mode:mode,fidelity:fidelity,sections:sections};}
function buildPayload(segs,config){return JSON.stringify({objective:config.mode==='roteiro'?'Seguir o roteiro-base por objetivos e na ordem indicada; escolher a melhor tentativa de cada ideia':'Construir uma narrativa coerente somente com as falas existentes, reorganizando takes fora de ordem',mode:config.mode,fidelity:config.fidelity,scriptSections:config.sections,requirements:['Usar apenas IDs presentes; nunca inventar falas nem atribuir conteúdo ao trecho errado','Ignorar blocked=true; descartar início falso, frases incompletas e repetição semântica mesmo com palavras diferentes','Escolher a MELHOR versão por ideia; outra tentativa da mesma informação não é novo conteúdo','No modo roteiro, mapear cada parte Rxxx para os IDs presentes e sinalizar ausências com status missing','No modo livre, criar abertura, desenvolvimento e fechamento se existirem falas para isso','Reter contexto essencial; manter frases completas e coerentes','Retornar objeto JSON: cuts:[{id,role,reason,sectionId}], coverage:[{sectionId,status,ids,note}], summary; status deve ser matched ou missing'],segments:segs.map(function(x){return {id:x.id,text:x.text,start:x.start,end:x.end,blocked:x.blocked};})});}
function dedupePlan(cuts,sections){var out=[],dropped=[];cuts.forEach(function(c){var previous=out.find(function(p){return nearDuplicate(p.text,c.text);});if(previous){dropped.push({id:c.id,reason:'Informação repetida de '+previous.id,text:c.text});return;}out.push(c);});return {cuts:out,removed:dropped};}
function coverageReport(raw,sections,cuts){if(!sections.length)return[];var all={};cuts.forEach(function(c){all[c.id]=true;});var claims={};(raw&&Array.isArray(raw.coverage)?raw.coverage:[]).forEach(function(c){if(c&&typeof c.sectionId==='string')claims[c.sectionId]=c;});return sections.map(function(s){var c=claims[s.id]||{},ids=(Array.isArray(c.ids)?c.ids:[]).filter(function(id){return all[id];});return {sectionId:s.id,title:s.title,status:c.status==='matched'&&ids.length?'matched':'missing',ids:ids,note:String(c.note||'').slice(0,220)};});}

function progress(str){var s=el('nb-status');if(s)s.textContent=str;}
function view(stage){var main=el('nb-review');if(main)main.hidden=stage==='ready';var choice=el('nb-choice');if(choice)choice.hidden=stage!=='ready';var label=el('nb-step-label');if(label)label.textContent=stage==='pending'?'Aguardando sua aprovação':stage==='working'?'Analisando montagem':'Configuração';var row=el('ae-est-narrativa');if(row&&stage==='pending')row.textContent='⏸ aguardando aprovação';var status=el('autoedit-status');if(status&&stage==='pending')status.textContent='⏸ Auto Edit pausado: revise a montagem abaixo para continuar.';if(main&&stage==='pending'&&main.scrollIntoView)try{main.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){main.scrollIntoView();}}
function cards(){var wrap=el('nb-segments');if(!wrap)return;wrap.innerHTML='';(lastPlan||[]).forEach(function(item,i){var d=document.createElement('div');d.className='nb-segment';d.innerHTML='<span class="nb-num">'+String(i+1).padStart(2,'0')+'</span><div class="nb-copy"><div class="nb-segment-top"><strong>'+escapeHTML(item.role)+'</strong><span>'+item.start.toFixed(2)+'s–'+item.end.toFixed(2)+'s</span></div><div class="nb-quote">'+escapeHTML(item.text)+'</div><small>'+escapeHTML(item.reason||'Trecho selecionado')+'</small></div><div class="nb-actions"><button type="button" data-action="up" title="Mover para cima">↑</button><button type="button" data-action="down" title="Mover para baixo">↓</button><button type="button" data-action="remove" title="Remover da proposta">×</button></div>';
 d.querySelector('[data-action="up"]').onclick=function(){if(i){var t=lastPlan[i-1];lastPlan[i-1]=lastPlan[i];lastPlan[i]=t;cards();}};d.querySelector('[data-action="down"]').onclick=function(){if(i<lastPlan.length-1){var t=lastPlan[i+1];lastPlan[i+1]=lastPlan[i];lastPlan[i]=t;cards();}};d.querySelector('[data-action="remove"]').onclick=function(){if(lastPlan.length<=1)return;lastPlan.splice(i,1);cards();};wrap.appendChild(d);});var dur=(lastPlan||[]).reduce(function(n,c){return n+c.end-c.start;},0);if(el('nb-summary'))el('nb-summary').textContent=lastPlan.length+' trechos • '+dur.toFixed(1)+' segundos';renderCoverage();}
function renderCoverage(){var holder=el('nb-coverage');if(holder){holder.hidden=!lastCoverage.length;holder.innerHTML=lastCoverage.length?'<h4>Conferência do roteiro</h4>'+lastCoverage.map(function(c){return '<div class="nb-coverage-row"><span>'+ (c.status==='matched'?'✓':'!') +'</span><div><strong>'+escapeHTML(c.title)+'</strong><small>'+escapeHTML(c.status==='matched'?'Trecho sugerido: '+c.ids.join(', '):'Não localizado nas gravações')+'</small></div></div>';}).join(''):'';}var d=el('nb-duplicates');if(d){d.hidden=!removedDuplicates.length;d.textContent=removedDuplicates.length+' possível(is) repetição(ões) retirada(s) do plano. Revise a prévia.';}}
function addUI(){if(!el('autoedit-panel')||el('nb-review'))return;var panel=el('autoedit-panel'),target=el('autoedit-etapas');if(!target)return;
var card=document.createElement('section');card.className='nb-panel';card.id='nb-choice';
card.innerHTML='<div class="nb-heading"><div class="nb-icon">✦</div><div><strong>Montagem Inteligente</strong><p>Escolha como a IA deve organizar as falas</p></div><span class="nb-pill">BETA</span></div>'+
'<div class="nb-mode-switch" role="radiogroup" aria-label="Modo de montagem"><label><input type="radio" name="nb-montagem-modo" value="livre" checked><span>✦ Montagem livre</span></label><label><input type="radio" name="nb-montagem-modo" value="roteiro"><span>▤ Por roteiro</span></label></div>'+
'<div id="nb-script-fields" class="nb-script-fields" hidden><label for="nb-script" class="nb-script-label">Roteiro de referência</label><textarea id="nb-script" rows="7" maxlength="12000" placeholder="ABERTURA:\nFala inicial esperada...\n\nDESENVOLVIMENTO:\nIdeias principais...\n\nFECHAMENTO:\nComo encerrar..."></textarea><div class="nb-script-tools"><label class="nb-file" for="nb-script-file">↑ Importar TXT / MD</label><input id="nb-script-file" type="file" accept=".txt,.md,text/plain,text/markdown" hidden><span id="nb-script-count">0 / 12.000 caracteres</span></div><label class="nb-script-label" for="nb-fidelity">Correspondência das falas</label><select id="nb-fidelity"><option value="flexivel">Flexível — mantém o sentido</option><option value="fiel">Fiel — mais próximo das palavras</option></select><p class="nb-help">A IA procura cada parte do roteiro nas gravações, compara tentativas e informa o que não foi encontrado. Nunca inventa falas.</p></div>'+
'<div class="nb-inline-note">◷ O Auto Edit pausa para você assistir à prévia e aprovar. Depois continua sozinho.</div>';
var review=document.createElement('section');review.className='nb-panel nb-review';review.id='nb-review';review.hidden=true;review.innerHTML='<div class="nb-heading"><div class="nb-icon">✓</div><div><strong>Montagem pronta</strong><p id="nb-step-label">Aguardando sua aprovação</p></div><span class="nb-pill">GROQ</span></div><p class="nb-progress" id="nb-status" role="status">Analisando roteiro...</p><div class="nb-summary" id="nb-summary"></div><div id="nb-coverage" class="nb-coverage" hidden></div><div id="nb-duplicates" class="nb-duplicates" hidden></div><div class="nb-list" id="nb-segments"></div><div class="nb-buttons"><button id="nb-preview" type="button" class="nb-primary">▶ Ver prévia no Premiere</button><button id="nb-approve" type="button" class="nb-primary">✓ Aprovar e continuar</button><button id="nb-skip" type="button" class="nb-secondary">Pular esta etapa</button></div><p class="nb-help">Sua sequência anterior permanece preservada. Use as setas para alterar a ordem e gere outra prévia antes de aprovar.</p>';
target.parentNode.parentNode.insertAdjacentElement('afterend',card);card.insertAdjacentElement('afterend',review);
var st=settings(),mode=(st.mode==='roteiro'?'roteiro':'livre');function syncMode(){var chosen=document.querySelector('input[name="nb-montagem-modo"]:checked');mode=chosen?chosen.value:'livre';el('nb-script-fields').hidden=mode!=='roteiro';save({mode:mode});}document.querySelectorAll('input[name="nb-montagem-modo"]').forEach(function(r){r.checked=r.value===mode;r.onchange=syncMode;});el('nb-mode')||Object.defineProperty(card,'_nbMode',{value:function(){return mode;}});el('nb-fidelity').value=st.fidelity==='fiel'?'fiel':'flexivel';el('nb-fidelity').onchange=function(){save({fidelity:this.value});};
el('nb-script').oninput=function(){el('nb-script-count').textContent=this.value.length+' / 12.000 caracteres';};el('nb-script-file').onchange=function(){var file=this.files&&this.files[0];if(!file)return;if(file.size>262144){alert('O arquivo é grande demais (máximo 256 KB).');return;}if(!/\.(txt|md)$/i.test(file.name)){alert('Use um roteiro TXT ou Markdown (MD).');return;}var reader=new FileReader();reader.onload=function(){el('nb-script').value=String(reader.result||'').slice(0,12000);el('nb-script').oninput();};reader.onerror=function(){alert('Não consegui ler o arquivo. Cole o texto no campo.');};reader.readAsText(file,'UTF-8');};
syncMode();el('nb-preview').onclick=preview;el('nb-approve').onclick=approve;el('nb-skip').onclick=skip;}

function preview(){if(isBusy||!pending||!lastPlan||!lastPlan.length)return;isBusy=true;progress('Preparando sequência de prévia...');el('nb-preview').disabled=true;el('nb-approve').disabled=true;pending.previewId=null;pending.previewCuts=null;pending.previewLayout=null;
loadHost().then(function(){return host('fsNarrativeBetaPreview',{sequenceID:lastManifest.sequenceID,cuts:lastPlan});}).then(function(r){pending.previewId=String(r.previewId);pending.previewDuration=r.duration;pending.previewLayout=r.layout;pending.previewCuts=lastPlan.map(function(x){return Object.assign({},x);});progress('Prévia criada: assista no monitor do Premiere e aprove quando estiver pronto.');el('nb-approve').disabled=false;}).catch(function(e){progress('Não consegui criar a prévia: '+e.message);}).then(function(){isBusy=false;el('nb-preview').disabled=false;});}
function deepCopy(o){return JSON.parse(JSON.stringify(o));}
function restoreTranscript(resp,sequenceID){
 if(!resp||!Array.isArray(resp.words)||!resp.words.length)fail('Snapshot da transcrição indisponível.');
 var data=deepCopy(resp);data._fsSeq=String(sequenceID);data._fsQuando=Date.now();
 root._fsLastResp=data;localStorage.setItem('framespeed_last_resp',JSON.stringify(data));
 return data;
}
function remapTranscript(snapshot,cuts,layout,previewId){
 if(!snapshot||!Array.isArray(snapshot.words)||!snapshot.words.length)fail('Backup da transcrição não está disponível.');
 if(!Array.isArray(layout)||layout.length!==cuts.length)fail('O Premiere não confirmou os tempos reais de todos os clipes. Gere nova prévia.');
 var out=[];
 cuts.forEach(function(c,i){
  var actual=layout[i];
  if(actual.id!==c.id||Math.abs(Number(actual.sourceStart)-Number(c.start))>.06||Math.abs(Number(actual.sourceEnd)-Number(c.end))>.06)fail('O tempo do corte '+(i+1)+' mudou entre plano e prévia.');
  var begin=Number(actual.destStart),end=Number(actual.destEnd);
  if(!isFinite(begin)||!isFinite(end)||end<=begin)fail('O Premiere devolveu tempo inválido no trecho '+(i+1));
  snapshot.words.forEach(function(w){
   var a=Number(w.start),b=Number(w.end);
   if(a>=c.start-.055&&b<=c.end+.055&&b>a){
    var mappedStart=Math.max(begin,begin+a-c.start),mappedEnd=Math.min(end,begin+b-c.start);
    if(mappedEnd-mappedStart>.01)out.push(Object.assign({},w,{start:mappedStart,end:mappedEnd}));
   }
  });
 });
 if(!out.length)fail('Não existem palavras válidas nos trechos da prévia.');
 out.sort(function(a,b){return a.start-b.start;});
 var cloned=deepCopy(snapshot);
 cloned.words=out;cloned.segments=[];cloned.text=out.map(function(w){return w.word;}).join(' ');cloned._fsSeq=String(previewId);cloned._fsQuando=Date.now();
 return cloned;
}
function verifySequence(expected){return new Promise(function(resolve,reject){
 if(typeof root.fsConferirDonoTranscricao!=='function')return reject(Error('Validação da transcrição indisponível'));
 root.fsConferirDonoTranscricao(function(result){
  if(!result||!result.seq||String(result.seq)!==String(expected)||result.descartou||!root._fsLastResp||String(root._fsLastResp._fsSeq)!==String(expected))
   return reject(Error('A sequência ativa mudou ou a transcrição não foi associada corretamente.'));resolve(result);
 });
});}
function approve(){
 if(isBusy||!pending||!pending.previewId){progress('Primeiro crie e assista à prévia no Premiere.');return;}
 if(JSON.stringify(lastPlan)!==JSON.stringify(pending.previewCuts)){progress('A ordem mudou: gere a prévia novamente antes de aprovar.');return;}
 var finished=pending;isBusy=true;el('nb-approve').disabled=true;progress('Sincronizando as palavras da transcrição com a prévia...');
 loadHost().then(function(){
  return host('fsNarrativeBetaValidatePreview',{previewId:finished.previewId,layout:finished.previewLayout});
 }).then(function(checked){
  var transcript=remapTranscript(finished.originalTranscript,finished.previewCuts,checked.layout,finished.previewId);
  restoreTranscript(transcript,finished.previewId);
  return verifySequence(finished.previewId);
 }).then(function(){
  if(!root._fsLastResp||!root._fsLastResp.words||!root._fsLastResp.words.length)fail('Transcrição da nova sequência não foi preservada.');
  root._fsRespOriginal=null;root._fsCortesTotal=0;root._fsAudioRegions=null;
  localStorage.removeItem('framespeed_audio_regions');localStorage.removeItem('framespeed_resp_original');localStorage.removeItem('framespeed_cortes_total');
  // A legenda deve ser gerada novamente, nunca manter cues do vídeo bruto.
  root.premiereSrtData=[];
  if(typeof root.fsResegment!=='function')fail('Motor de segmentação indisponível.');var newCues=root.fsResegment(null);if(!newCues||!newCues.length)fail('Não consegui recriar as legendas sincronizadas da prévia.');
  progress('Aprovação concluída. Continuando o Auto Edit...');
  pending=null;view('ready');finished.done({ok:true,resumo:'montagem aprovada: '+lastPlan.length+' trechos'});
 }).catch(function(e){
  progress('Aprovação não concluída: '+e.message+'. A revisão permanece aberta.');
  // O snapshot continua preservado para permitir nova tentativa/pular.
 }).then(function(){isBusy=false;if(pending)el('nb-approve').disabled=false;});
}
function skip(){
 if(isBusy||!pending)return;
 var current=pending;isBusy=true;progress('Voltando à sequência original...');
 host('fsNarrativeBetaRestore',{sequenceID:lastManifest.sequenceID}).then(function(){
  restoreTranscript(current.originalTranscript,lastManifest.sequenceID);
  return verifySequence(lastManifest.sequenceID);
 }).then(function(){
  pending=null;view('ready');current.done({ok:true,resumo:'montagem ignorada; sequência original mantida'});
 }).catch(function(e){progress('Não consegui voltar à sequência original com transcrição preservada: '+e.message);}).then(function(){isBusy=false;});
}

function run(done){addUI();if(pending)return done({ok:false,erro:'Já existe uma montagem aguardando revisão.'});
var config;try{config=readConfig();}catch(e){return done({ok:false,erro:e.message});}
progress('Conferindo sequência e transcrição...');view('working');var transcript=root._fsLastResp;
if(!transcript||!transcript.words||!transcript.words.length){view('ready');return done({ok:false,erro:'A montagem precisa da transcrição por palavras. Ative a etapa Transcrever.'});}
loadHost().then(function(){return host('fsNarrativeBetaSnapshot',{});}).then(function(snapshot){
lastManifest=snapshot;lastSegments=groupWords(transcript.words,snapshot.clips);
var counted=lastSegments.reduce(function(n,x){return n+x.text.trim().split(/\s+/).length;},0);
if(counted<transcript.words.length*.6)fail('Transcrição não corresponde à sequência ativa (mais de 40% fora dos clipes). Refaça a transcrição.');
if(!lastSegments.length)fail('Nenhuma fala coincide com a sequência atual.');
progress('IA organizando '+lastSegments.length+' trechos ('+(config.mode==='roteiro'?'por roteiro':'livre')+')...');
var sys='Você é editor audiovisual profissional em português. Os takes podem estar fora de ordem. Escolha as melhores tentativas e elimine TODA informação repetida, inclusive paráfrases em IDs diferentes. Preserve coerência. Não invente falas. Responda somente JSON com cuts, coverage e summary. Se não houver trecho para uma parte do roteiro, diga missing. Marcados blocked=true são proibidos.';
var payload=buildPayload(lastSegments,config);
return groq([{role:'system',content:sys},{role:'user',content:payload}]).then(function(first){
var preliminary=validate(first,lastSegments,snapshot.clips);progress('IA revisando repetição, fidelidade e continuidade...');
return groq([{role:'system',content:sys+' Esta é uma REVISÃO FINAL INDEPENDENTE. Rejeite informação duplicada e tentativas incompletas. No modo por roteiro, não omita uma ideia existente e marque trechos não encontrados. Retorne cuts,coverage,summary em JSON.'},{role:'user',content:JSON.stringify({requirements:JSON.parse(payload),firstPlan:first.cuts,firstCoverage:first.coverage||[],candidateWords:preliminary.map(function(x){return {id:x.id,text:x.text};})})}]).then(function(final){
var finalCuts=validate(final,lastSegments,snapshot.clips),unique=dedupePlan(finalCuts,config.sections);
if(!unique.cuts.length)fail('A análise eliminou todos os segmentos; revise os takes.');
return {snapshot:snapshot,cuts:unique.cuts,removed:unique.removed,coverage:coverageReport(final,config.sections,unique.cuts),config:config,summary:final.summary||first.summary||''};});});
}).then(function(result){lastPlan=result.cuts;lastManifest=result.snapshot;lastCoverage=result.coverage;removedDuplicates=result.removed;pending={done:done,previewId:null,previewCuts:null,previewLayout:null,originalTranscript:deepCopy(transcript),config:result.config};cards();
var missing=result.coverage.filter(function(x){return x.status==='missing';}).length;
progress(missing?('Revisão necessária: '+missing+' parte(s) do roteiro não localizada(s). Assista à prévia.'):('Montagem proposta pronta. Confira no Premiere e aprove para continuar.'));
el('nb-approve').disabled=true;view('pending');}).catch(function(e){view('ready');done({ok:false,erro:'Montagem Inteligente: '+e.message});});}

root.fsAutoEditNarrativa=run;
root.fsNarrativeBeta={groupWords:groupWords,validate:validate,parseScript:parseScript,buildPayload:buildPayload,dedupePlan:dedupePlan,coverageReport:coverageReport,nearDuplicate:nearDuplicate,readConfig:readConfig,settings:settings,remapTranscript:remapTranscript,createPreview:preview,approve:approve,skip:skip,get pending(){return !!pending;}};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addUI);else addUI();}
})(typeof window!=='undefined'?window:this);