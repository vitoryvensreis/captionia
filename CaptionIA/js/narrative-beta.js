/* Caption IA — Montagem Inteligente / CEP */
(function(root){'use strict';
var STATE='captionia_narrativa_beta_v1'; var MODEL='openai/gpt-oss-120b';
var pending=null, lastPlan=null, lastManifest=null, lastSegments=[], lastCoverage=[], removedDuplicates=[], lastRetake=null, isBusy=false;
var reportState={state:'idle',events:[],error:null};
function el(id){return document.getElementById(id);} function fail(s){throw new Error(s);}
function escapeHTML(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function save(o){try{var v=settings();Object.keys(o).forEach(function(k){v[k]=o[k];});localStorage.setItem(STATE,JSON.stringify(v));}catch(_){} }
function settings(){try{return JSON.parse(localStorage.getItem(STATE)||'{}')||{};}catch(_){return {};}}
function getKey(){var secure=root.fsSecureKeyStore;if(!secure||typeof secure.get!=='function')throw Error('Armazenamento seguro da chave Groq indisponível.');return String(secure.get()||'').trim();}

function host(functionName,payload){return new Promise(function(resolve,reject){if(typeof csInterface==='undefined')return reject(Error('O Premiere não está conectado ao painel.'));var expr=functionName+'('+JSON.stringify(JSON.stringify(payload||{}))+')';csInterface.evalScript(expr,function(out){try{if(!out||out==='EvalScript error.')throw Error('Falha da ponte JSX: '+String(out));var v=JSON.parse(out);if(!v.ok)throw Error(v.error||'Erro no Premiere');resolve(v);}catch(e){reject(e);}});});}
function loadHost(){return new Promise(function(resolve,reject){if(typeof csInterface==='undefined'||typeof CSInterface==='undefined')return reject(Error('Somente Premiere Pro'));var p='';try{p=csInterface.getSystemPath(SystemPath.EXTENSION);}catch(_){}if(!p)return reject(Error('Diretório da extensão indisponível'));p=p.replace(/\\/g,'/')+'/jsx/narrative-beta.jsx';var script='$.evalFile('+JSON.stringify(p)+'); typeof fsNarrativeBetaSnapshot === "function" ? "OK" : "NO"';csInterface.evalScript(script,function(x){if(x==='OK')resolve();else reject(Error('Não foi possível carregar a ponte de montagem ('+x+').'));});});}
function groupWords(words,clips){var result=[], cur=[];
function emit(){if(!cur.length)return;var text=cur.map(function(x){return x.word;}).join(' ').replace(/\s+([,.!?;:])/g,'$1');var flag=/\b(n[aã]o[,.]?\s*calma|errei|de novo|pera a[ií]|come[cç]a de novo)\b/i.test(text);result.push({id:'S'+String(result.length+1).padStart(3,'0'),start:cur[0].start,end:cur[cur.length-1].end,text:text,blocked:flag});cur=[];}
(words||[]).forEach(function(w){var a=Number(w.start),b=Number(w.end);if(!isFinite(a)||!isFinite(b)||b<=a||!String(w.word||'').trim())return;
var inside=clips.some(function(c){return a>=c.start-.05&&b<=c.end+.05;});if(!inside)return;
if(cur.length){var prev=cur[cur.length-1], gap=a-prev.end;var sameClip=clips.some(function(c){return prev.start>=c.start-.05&&b<=c.end+.05;});if(gap>=.65||gap<-.2||!sameClip||gap>=.15&&/[.!?]$/.test(prev.word))emit();}
cur.push({start:a,end:b,word:String(w.word).trim()});});emit();return result.filter(function(s){return s.end-s.start>=.18;});}
/* Retake em modo análise: não remover takes antes da decisão editorial. */
/* Pauses extracted from the word timeline: hints only; no destructive cut. */
function silenceHints(words,clips){var result=[], last=null;
 (words||[]).forEach(function(w){var a=Number(w.start),b=Number(w.end);if(!isFinite(a)||!isFinite(b)||b<=a)return;
  var target=(clips||[]).find(function(c){return a>=c.start-.05&&b<=c.end+.05;});if(!target){last=null;return;}
  if(last&&last.clipIndex===target.index&&a-last.end>=.45){result.push({start:last.end,end:a,duration:Math.round((a-last.end)*1000)/1000,after:String(last.word||'').slice(0,50),before:String(w.word||'').slice(0,50)});}
  last={end:b,clipIndex:target.index,word:w.word};
 });return result.slice(0,350);}
function eventLog(phase,details){reportState.events.push({time:new Date().toISOString(),phase:phase,details:String(details||'').slice(0,1800)});}
function safeRetakes(entry){if(!entry)return null;return {groupCount:(entry.groups||[]).length,semanticGroupCount:(entry.semanticGroups||[]).length,semanticStatus:entry.semanticStatus||'not-run',semanticError:entry.semanticError||null,semanticGroups:(entry.semanticGroups||[]).slice(0,70),farCount:(entry.far||[]).length,groups:(entry.groups||[]).slice(0,60).map(function(g){return {takes:(g.takes||[]).map(function(t){return {start:t.ini,end:t.fim,text:String(t.texto||'').slice(0,1000),complete:!!t.completa};}),recommendation:g.sugestao&&g.sugestao.motivo||'',warning:g.aviso||'',similarity:g.notas||[]};})};}
// Relatorios de diagnóstico e upload foram retirados da distribuição pública.
// Erros da montagem permanecem visíveis no próprio painel.
function failureDiagnostic(e,phase){
 reportState.state='error';
 reportState.error={phase:phase||'narrative',message:String(e&&e.message||e),time:new Date().toISOString()};
 eventLog('error',reportState.error.message);
 return null;
}
function resetReport(transcript,config){reportState={state:'analyzing',events:[],error:null};eventLog('start','Montagem '+(config&&config.mode||'livre'));}
function transcriptFingerprint(resp){if(!resp||!Array.isArray(resp.words))return '';var w=resp.words,n=w.length;return [String(resp._fsSeq||''),n,n?Number(w[0].start).toFixed(3):'',n?Number(w[n-1].end).toFixed(3):'',n?String(w[n-1].word):''].join('|');}
/* Retake v0.7: two-layer analysis. The existing Retake is lexical; semantic grouping
   is advisory, source-ID-based and never performs a destructive cut. */
function localRetakePairs(segments){
 var eligible=(segments||[]).filter(function(s){return !s.blocked&&ideaTokens(s.text).length>=3;});
 var groups=[],occupied={};
 eligible.forEach(function(s,i){if(occupied[s.id])return;var ids=[s.id];
  for(var j=i+1;j<eligible.length;j++){
   var t=eligible[j];if(occupied[t.id])continue;
   var a=ideaTokens(s.text),b=ideaTokens(t.text),na={},nb={},shared=0;
   a.forEach(function(x){na[x]=1;});b.forEach(function(x){nb[x]=1;});
   var ka=Object.keys(na),kb=Object.keys(nb);
   ka.forEach(function(x){if(nb[x])shared++;});
   var overlap=shared/Math.max(1,Math.min(ka.length,kb.length));
   var lengthRatio=Math.max(ka.length,kb.length)/Math.max(1,Math.min(ka.length,kb.length));
   // Strong evidence only: moderate overlap with similar lengths, or near-exact matching.
   if(shared>=3&&((overlap>=.86&&lengthRatio<=1.5)||(overlap>=.72&&lengthRatio<=1.18&&shared>=4))){ids.push(t.id);occupied[t.id]=true;}
  }
  if(ids.length>1){occupied[s.id]=true;groups.push({group:'LX'+String(groups.length+1).padStart(3,'0'),ids:ids,confidence:.92,reason:'Falas com forte coincidência de palavras (possível retake)',origin:'lexical-local'});}
 });return groups;
}
function verifySemanticGroups(response,segments){
 var map={},groups=[],used={},raw=response&&Array.isArray(response.groups)?response.groups:[];
 (segments||[]).forEach(function(s){map[s.id]=s;});
 raw.slice(0,120).forEach(function(g){
  if(!g||!Array.isArray(g.ids))return;
  var idList=[],seen={};g.ids.forEach(function(id){if(typeof id!=='string'||!map[id]||map[id].blocked||seen[id])return;seen[id]=true;idList.push(id);});
  var confidence=Number(g.confidence);
  if(idList.length<2||idList.length>12||!isFinite(confidence)||confidence<.78||confidence>1)return;
  // Contradictory groups must not discard anything on their own.
  if(idList.some(function(id){return used[id];}))return;
  idList.forEach(function(id){used[id]=true;});
  var best=idList.indexOf(g.recommendedId)>=0?g.recommendedId:null;
  groups.push({group:'SEM'+String(groups.length+1).padStart(3,'0'),ids:idList,confidence:confidence,recommendedId:best,reason:String(g.reason||'Mesma informação narrada de formas diferentes').slice(0,350),origin:'groq-semantic'});
 });return groups;
}
function semanticRequest(segments){return {instruction:'Você é um DETECTOR DE RETAKES, não é o editor final. Procure SOMENTE falas com a MESMA IDEIA EQUIVALENTE, quando uma pode SUBSTITUIR a outra sem perda de informação. Reconheça paráfrases. NÃO agrupe frases que apenas compartilham o assunto, continuações de uma frase, etapas diferentes do argumento, perguntas e respostas ou informações complementares. Compare também takes fora de ordem. Não confunda abertura e fechamento. Retorne JSON {groups:[{ids:["S001","S002"],confidence:0.9,reason:"mesma ideia",recommendedId:"S002"}]}. Confidence 0..1. Não invente ids; grupos distintos não se sobrepõem. Se tiver dúvida, não agrupe.',segments:(segments||[]).slice(0,160).map(function(s){return {id:s.id,text:s.text,start:s.start,end:s.end,blocked:!!s.blocked};})};}
function buildRetakeHints(resp,segments){
 var data=root._fsNarrativeRetakeHints;
 if(!data||data.source!==resp||data.fingerprint!==transcriptFingerprint(resp))data=analyzeRetakes(resp);
 var local=localRetakePairs(segments);
 data.localGroups=local;
 data.semanticGroups=[];
 data.semanticStatus='pending';data.semanticError='';
 var eligible=segments.filter(function(s){return !s.blocked&&ideaTokens(s.text).length>=3;});
 if(eligible.length<2){data.semanticStatus='not-enough-speech';return Promise.resolve(data);}
 if(segments.length>160){data.semanticStatus='partial';data.semanticError='Mais de 160 segmentos: análise semântica limitada aos primeiros. Use cortes menores para revisão completa.';}
 // One compact Groq request; no video, raw audio, or cloud report sent.
 return groq([{role:'system',content:'Especialista em identificar repetições semânticas em gravações audiovisuais em português. Responda APENAS JSON no formato solicitado.'},{role:'user',content:JSON.stringify(semanticRequest(segments))}]).then(function(response){
  data.semanticGroups=verifySemanticGroups(response,segments);
  data.semanticStatus=segments.length>160?'partial':'ok';
  data.semanticRawCount=response&&Array.isArray(response.groups)?response.groups.length:0;
  eventLog('retake-semantic','Grupos de sentido: '+data.semanticGroups.length+'; pares lexicais: '+local.length);
  return data;
 }).catch(function(err){
  data.semanticStatus='fallback';data.semanticError=String(err&&err.message||err).slice(0,250);
  eventLog('retake-semantic-fallback',data.semanticError);
  return data; // Remain operational, but the UI warns that semantic matching was unavailable.
 });
}
function strongRetakePlanGuard(cuts,hints){
 var keep={};cuts.forEach(function(c){keep[c.id]=1;});
 var groups=(hints&&hints.semanticGroups||[]).filter(function(g){return g.confidence>=.92;});
 groups.forEach(function(g){var duplicates=(g.ids||[]).filter(function(id){return keep[id];});
  if(duplicates.length>1)fail('O plano manteve '+duplicates.length+' tentativas da mesma ideia ('+g.group+': '+duplicates.join(', ')+'). Selecione apenas uma ou reveja a análise.');
 });return true;
}
function analyzeRetakes(resp){
 if(!resp||!Array.isArray(resp.words)||!resp.words.length)fail('Retake: transcrição por palavra indisponível.');
 if(!root.fsRepeticoes||typeof root.fsRepeticoes.analisar!=='function')fail('O detector Retake não foi carregado.');
 var result=root.fsRepeticoes.analisar(resp,null);if(!result||!Array.isArray(result.grupos))fail('Resposta inválida do detector Retake.');
 var entry={fingerprint:transcriptFingerprint(resp),source:resp,groups:result.grupos,far:result.distantes||[],createdAt:Date.now()};
 root._fsNarrativeRetakeHints=entry;return entry;
}
function analyzeOnly(done){
 var resp=root._fsLastResp;
 try{resetReport(resp,{mode:'retake-analysis'});
  var data=analyzeRetakes(resp);reportState.retakes=safeRetakes(data);
  loadHost().then(function(){return host('fsNarrativeBetaSnapshot',{});}).then(function(snapshot){
   var segments=groupWords(resp.words,snapshot.clips);if(!segments.length)fail('Sem falas alinhadas aos clipes.');
   reportState.segments=deepCopy(segments);
   return buildRetakeHints(resp,segments);
  }).then(function(entry){
   reportState.retakes=safeRetakes(entry);
   var lexical=entry.groups.length,local=(entry.localGroups||[]).length,sem=(entry.semanticGroups||[]).length;
   var warn=entry.semanticStatus==='fallback'?' · IA semântica indisponível; usei detecção por palavras':entry.semanticStatus==='partial'?' · análise parcial':'';
   eventLog('retake','Tradicional: '+lexical+'; semelhantes: '+local+'; por sentido: '+sem+warn);
   done({ok:true,resumo:lexical+' grupo(s) tradicional(is), '+local+' por texto e '+sem+' por sentido; sem cortes'+warn});
  }).catch(function(err){
   var old=root._fsNarrativeRetakeHints;
   if(old){old.semanticStatus='fallback';old.semanticError=String(err.message||err).slice(0,250);reportState.retakes=safeRetakes(old);
     eventLog('retake-fallback',old.semanticError);
     return done({ok:true,resumo:old.groups.length+' grupo(s) tradicional(is), sem cortes · análise avançada indisponível: '+old.semanticError});}
   failureDiagnostic(err,'retake');done({ok:false,erro:'Retake (análise): '+err.message});
  });
 }catch(e){failureDiagnostic(e,'retake');done({ok:false,erro:'Retake (análise): '+e.message});}
}
root.fsAutoEditRetakeAnalise=analyzeOnly;
function overlappingSegments(take,segments){if(!take||!isFinite(take.ini)||!isFinite(take.fim))return [];
 return segments.filter(function(s){var overlap=Math.max(0,Math.min(s.end,take.fim)-Math.max(s.start,take.ini));return overlap>=.12&&overlap/Math.max(.18,s.end-s.start)>=.42;}).map(function(s){return s.id;});}
function retakeContext(resp,segments){
 var cached=root._fsNarrativeRetakeHints;
 if(!cached||cached.source!==resp||cached.fingerprint!==transcriptFingerprint(resp))cached=analyzeRetakes(resp);
 var out=[];cached.groups.slice(0,50).forEach(function(g,i){var items=[];
 (g.takes||[]).forEach(function(t,j){var ids=overlappingSegments(t,segments);if(!ids.length)return;
 items.push({take:j+1,ids:ids,start:t.ini,end:t.fim,text:String(t.texto||'').slice(0,650),preferred:!!(g.sugestao&&g.sugestao.take===t),complete:!!t.completa});});
 if(items.length>1)out.push({group:'RT'+String(i+1).padStart(3,'0'),candidates:items,advice:g.sugestao&&g.sugestao.motivo||'',warning:g.aviso||'',kind:(g.tipos||[]).join(',')});});
 (cached.localGroups||[]).forEach(function(g){out.push({group:g.group,candidates:g.ids.map(function(id){return {ids:[id]};}),confidence:g.confidence,reason:g.reason,origin:g.origin});});
 (cached.semanticGroups||[]).forEach(function(g){out.push({group:g.group,candidates:g.ids.map(function(id){return {ids:[id]};}),confidence:g.confidence,recommendedId:g.recommendedId,reason:g.reason,origin:g.origin});});
 return {groups:out,nearGroupsCount:cached.groups.length,localGroupCount:(cached.localGroups||[]).length,semanticGroupCount:(cached.semanticGroups||[]).length,semanticGroups:cached.semanticGroups||[],semanticStatus:cached.semanticStatus||'not-run',semanticError:cached.semanticError||'',farMatchesCount:cached.far.length};
}
function narrativeGuard(cuts,segments){
 var candidate=segments.filter(function(s){return !s.blocked&&s.text&&s.text.trim();}),unique=[];
 candidate.forEach(function(s){if(!unique.some(function(x){return nearDuplicate(x.text,s.text);})){unique.push(s);}});
 var covered=unique.filter(function(s){return cuts.some(function(c){return nearDuplicate(c.text,s.text);});});
 var totalWords=candidate.reduce(function(n,s){return n+s.text.trim().split(/\s+/).length;},0);
 if(unique.length>=3&&totalWords>=25&&covered.length/unique.length<.35){
  fail('Montagem com cobertura insuficiente: apenas '+covered.length+' de '+unique.length+' ideias candidatas aproveitadas. Refaça a análise ou use o modo por roteiro. Nenhuma prévia foi gerada.');
 }
 return {sourceIdeaCandidates:unique.length,coveredIdeaCandidates:covered.length};
}
/* v0.7 protocol: source-backed selected / discarded / ideas, no overlapping decisions. */
function editorialNormalize(raw){if(!raw||typeof raw!=='object')fail('A IA não retornou um plano editorial.');
 var selected=Array.isArray(raw.selected)?raw.selected:(Array.isArray(raw.cuts)?raw.cuts:[]),discarded=Array.isArray(raw.discarded)?raw.discarded.slice():[],kept=[],moved=[],warnings=[];
 selected.forEach(function(c){if(!c||typeof c.id!=='string')return;var role=String(c.role||'').trim(),reason=String(c.reason||'');
  if(/^(?:duplicate|duplicado|duplicata|discard|descartar|rejected|rejeitado|filler|erro|ignore|ignorar|repeticao|repetição)$/i.test(role)||/^\s*(?:informa[cç][aã]o repetida|repeti[cç][aã]o de|erro de grava[cç][aã]o|descartar)/i.test(reason)){moved.push({id:c.id,reason:role||'duplicate',replacedBy:c.replacedBy||null});warnings.push('O modelo selecionou '+c.id+' como '+role+'; realocado para descartes.');}
  else kept.push(c);
 });
 var ids={};kept.forEach(function(c){ids[c.id]=true;});
 discarded=discarded.concat(moved).filter(function(d){return d&&typeof d.id==='string';});
 discarded.forEach(function(d){if(ids[d.id])fail('Contradição: '+d.id+' foi marcado simultaneamente como selecionado e descartado.');});
 return {cuts:kept,discarded:discarded,ideas:Array.isArray(raw.ideas)?raw.ideas:[],coverage:Array.isArray(raw.coverage)?raw.coverage:[],summary:raw.summary||'',warnings:warnings};
}
function ideaAudit(editorial,selected,allSegments){var ids={};selected.forEach(function(c){ids[c.id]=true;});var candidates={};allSegments.forEach(function(s){candidates[s.id]=true;});var ideas=editorial.ideas||[],required=0,covered=0;
 ideas.forEach(function(i){if(!i||typeof i.id!=='string')fail('Ideia editorial sem ID.');var alternatives=(i.candidateIds||[]).filter(function(id){return candidates[id];});if(i.required===false)return;
  if(!alternatives.length)return;required++;
  if(alternatives.some(function(id){return ids[id];}))covered++;
 });
 if(required>=2&&covered/required<.65)fail('Cobertura insuficiente por ideias: '+covered+'/'+required+' ideias essenciais com falas identificadas foram aproveitadas.');
 return {requiredIdeas:required,coveredIdeas:covered};
}
function validate(raw,segments,clips){if(!raw||!Array.isArray(raw.cuts))fail('A IA não retornou uma lista de cortes.');if(raw.cuts.length<1||raw.cuts.length>100)fail('Quantidade de cortes fora do limite de segurança.');
var map={};segments.forEach(function(s){map[s.id]=s;});var out=[],seen={};raw.cuts.forEach(function(c,i){var s=map[c.id];if(!s)fail('Trecho desconhecido: '+c.id);if(s.blocked)fail('Trecho marcado como erro de gravação: '+s.id);if(seen[s.id])fail('Trecho duplicado: '+s.id);seen[s.id]=true;
if(/^(?:duplicate|duplicado|duplicata|discard|descartar|rejected|rejeitado|filler|erro|ignore|ignorar|repeticao|repetição)$/i.test(String(c.role||'').trim())||/^\s*(?:informa[cç][aã]o repetida|repeti[cç][aã]o de|erro de grava[cç][aã]o|descartar)/i.test(String(c.reason||'')))fail('A IA tentou manter um descarte: '+s.id+' ('+String(c.role||'sem classificação')+').');var containing=clips.filter(function(v){return s.start>=v.start-.05 && s.end<=v.end+.05;});if(containing.length!==1)fail('Trecho cruza cortes existentes: '+s.id);if(s.end-s.start<.18)fail('Trecho curto demais: '+s.id);out.push({id:s.id,start:s.start,end:s.end,text:s.text,role:String(c.role||'conteúdo').slice(0,60),reason:String(c.reason||'').slice(0,400),clipIndex:containing[0].index});});
if(!out.length)fail('Nenhum trecho aproveitável');return out;}
/** Send narrative, review and retake semantic requests using the SAME provider selected in Transcription. */
function groq(messages,signal){
 if(!root.CaptionIAGroqAccess||!root.CaptionIAGroqAccess.isReady())return Promise.reject(Error('Configure e valide sua chave Groq em Minha conta.'));
 var key='';try{key=getKey();}catch(e){return Promise.reject(e);}
 if(!/^gsk_[A-Za-z0-9_-]{21,196}$/.test(key))return Promise.reject(Error('Chave Groq do usuário não configurada.'));
 var body={model:MODEL,temperature:0.1,max_completion_tokens:3500,response_format:{type:'json_object'},messages:messages};
 function post(){return new Promise(function(resolve,reject){
  var https;try{https=require('https');}catch(e){return reject(Error('HTTPS do CEP indisponível.'));}
  var data=JSON.stringify(body),settled=false;
  function finish(err,result){if(settled)return;settled=true;if(err)reject(err);else resolve(result);}
  var req=https.request({hostname:'api.groq.com',port:443,path:'/openai/v1/chat/completions',method:'POST',timeout:100000,
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json','Content-Length':Buffer.byteLength(data)}},function(resp){
    var chunks=[],n=0;
    if(root.CaptionIAGroqAccess)root.CaptionIAGroqAccess.observe(resp.headers,MODEL,resp.statusCode);
    resp.on('data',function(c){n+=c.length;if(n>300000){req.destroy(Error('Resposta da IA excessiva.'));return;}chunks.push(c);});
    resp.on('end',function(){try{
      var parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(resp.statusCode<200||resp.statusCode>=300){
       var msg=typeof parsed.error==='string'?parsed.error:parsed.error&&parsed.error.message||'HTTP '+resp.statusCode;
       var err=Error('Groq pessoal: '+msg);err.status=resp.statusCode;
       err.retryAfter=Math.min(120,Math.max(0,Number(resp.headers['retry-after'])||0));throw err;
      }
      var answer=JSON.parse(String(parsed.choices&&parsed.choices[0]&&parsed.choices[0].message&&parsed.choices[0].message.content||''));
      if(!answer||typeof answer!=='object'||Array.isArray(answer))throw Error('A IA não retornou JSON válido.');
      finish(null,answer);
    }catch(e){finish(e);}});
   });
   req.on('error',finish);req.on('timeout',function(){req.destroy(Error('A Groq demorou para responder.'));});
   if(signal&&signal.aborted){req.destroy();return finish(Error('Cancelado.'));}
   req.end(data);
 });}
 // Retry at most twice, using upstream retry-after and no provider fallback.
 function attempt(i){return post().catch(function(err){if(err.status!==429||i>=2)return Promise.reject(err);
  var seconds=err.retryAfter||Math.min(50,8*Math.pow(2,i));
  return new Promise(function(resolve,reject){if(signal&&signal.aborted)return reject(Error('Cancelado.'));
   setTimeout(function(){if(signal&&signal.aborted)return reject(Error('Cancelado.'));resolve(attempt(i+1));},Math.ceil(seconds*1000));});
 });}
 return attempt(0);
}

function normalizeIdea(text){return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
var STOP={'a':1,'o':1,'e':1,'de':1,'da':1,'do':1,'um':1,'uma':1,'as':1,'os':1,'no':1,'na':1,'para':1,'pra':1,'eu':1,'que':1,'com':1,'é':1,'vou':1,'vai':1,'hoje':1,'meu':1,'minha':1,'se':1,'nos':1,'das':1,'dos':1};
function ideaTokens(text){return normalizeIdea(text).split(' ').filter(function(w){return w.length>2&&!STOP[w];});}
function nearDuplicate(a,b){var x=ideaTokens(a),y=ideaTokens(b);if(!x.length||!y.length)return normalizeIdea(a)===normalizeIdea(b);var ax={},bx={},inter=0;x.forEach(function(t){ax[t]=1;});y.forEach(function(t){bx[t]=1;});var ka=Object.keys(ax),kb=Object.keys(bx);ka.forEach(function(t){if(bx[t])inter++;});var union=ka.length+kb.length-inter;return (union&&inter/union>=.82&&inter>=Math.min(2,ka.length,kb.length)) ||(Math.min(ka.length,kb.length)>=4&&inter/Math.min(ka.length,kb.length)>=.9&&Math.max(ka.length,kb.length)/Math.min(ka.length,kb.length)<1.45);}
function parseScript(raw){var text=String(raw||'').trim();if(!text)return[];if(text.length>12000)fail('O roteiro excede 12.000 caracteres. Separe o projeto em partes.');var lines=text.split(/\r?\n/),sections=[],cur=null;
function flush(){if(cur&&cur.text.trim())sections.push({id:'R'+String(sections.length+1).padStart(3,'0'),title:cur.title||'Trecho '+(sections.length+1),text:cur.text.trim()});cur=null;}
lines.forEach(function(line){var t=line.trim();var match=t.match(/^#{1,4}\s+(.{2,70})$/)||t.match(/^((?:abertura|introdução|intro|gancho|conteúdo|desenvolvimento|fechamento|encerramento|cta|cena\s*\d+|parte\s*\d+)[^:]{0,45}):\s*(.*)$/i);if(match){flush();cur={title:match[1].trim(),text:match[2]||''};}else if(!t){if(cur&&cur.text&&!cur.title)flush();}else{if(!cur)cur={title:'',text:''};cur.text+=(cur.text?'\n':'')+t;}});flush();if(!sections.length&&text)sections=[{id:'R001',title:'Roteiro',text:text}];if(sections.length>30)fail('Roteiro com mais de 30 blocos. Agrupe cenas ou trechos.');return sections;}
function readConfig(){var selected=document.querySelector('input[name="nb-montagem-modo"]:checked');var mode=selected?selected.value:'livre';var fidelity=el('nb-fidelity')?el('nb-fidelity').value:'flexivel';var raw=el('nb-script')?el('nb-script').value:'';if(mode!=='livre'&&mode!=='roteiro')mode='livre';if(fidelity!=='fiel'&&fidelity!=='flexivel')fidelity='flexivel';var sections=mode==='roteiro'?parseScript(raw):[];if(mode==='roteiro'&&!sections.length)fail('Cole o roteiro de referência antes de iniciar o Auto Edit.');return {mode:mode,fidelity:fidelity,sections:sections};}
function buildPayload(segs,config,hints,silences){return JSON.stringify({retakeHints:hints||{groups:[]},silenceHints:silences||[],outputSchema:{selected:[{id:'S001',role:'abertura',ideaId:'I001',reason:'Por que esta fala foi escolhida'}],discarded:[{id:'S002',reason:'duplicate',replacedBy:'S001'}],ideas:[{id:'I001',summary:'Ideia central',required:true,candidateIds:['S001','S002']}],coverage:[{sectionId:'R001',status:'matched',ids:['S001'],note:''}],summary:'Resumo'},schemaRules:['NUNCA colocar descarte em selected; roles duplicate/filler/discard pertencem somente a discarded','Cada ideia essencial com candidato válido deve estar representada uma vez em selected','Somente IDs existentes da entrada; sem inventar texto nem falas','Não omitir desenvolvimento só para reduzir duração'],retakeInstruction:"Os grupos RTxxx e LXxxx indicam suspeitas técnicas; SEMxxx são sugestões de equivalência de sentido. Analise alternativas antes de selecionar. Escolha uma versão COMPLETA por ideia SEMxxx quando forem verdadeiramente substituíveis. Ignore agrupamentos falsos e nunca elimine informação complementar. Preserve a história completa, sem criar repetições; apenas evidências, nenhuma exclusão automática.",objective:config.mode==='roteiro'?'Seguir o roteiro-base por objetivos e na ordem indicada; escolher a melhor tentativa de cada ideia':'Construir uma narrativa coerente somente com as falas existentes, reorganizando takes fora de ordem',mode:config.mode,fidelity:config.fidelity,correspondenceRule:config.fidelity==='fiel'?'Priorizar falas próximas ao texto do roteiro; aceitar equivalentes somente quando necessário e registrar desvios.':'Aceitar paráfrases naturais que mantenham significado e intenção do roteiro.',scriptSections:config.sections,requirements:['Usar apenas IDs presentes; nunca inventar falas nem atribuir conteúdo ao trecho errado','Ignorar blocked=true; descartar início falso, frases incompletas e repetição semântica mesmo com palavras diferentes','Escolher a MELHOR versão por ideia; outra tentativa da mesma informação não é novo conteúdo','No modo roteiro, mapear cada parte Rxxx para os IDs presentes e sinalizar ausências com status missing','No modo livre, criar abertura, desenvolvimento e fechamento se existirem falas para isso','Reter contexto essencial; manter frases completas e coerentes','Retornar objeto JSON: cuts:[{id,role,reason,sectionId}], coverage:[{sectionId,status,ids,note}], summary; status deve ser matched ou missing'],segments:segs.map(function(x){return {id:x.id,text:x.text,start:x.start,end:x.end,blocked:x.blocked};})});}
function dedupePlan(cuts,sections){var out=[],dropped=[];cuts.forEach(function(c){var previous=out.find(function(p){return nearDuplicate(p.text,c.text);});if(previous){dropped.push({id:c.id,reason:'Informação repetida de '+previous.id,text:c.text});return;}out.push(c);});return {cuts:out,removed:dropped};}
function coverageReport(raw,sections,cuts){if(!sections.length)return[];var all={};cuts.forEach(function(c){all[c.id]=true;});var claims={};(raw&&Array.isArray(raw.coverage)?raw.coverage:[]).forEach(function(c){if(c&&typeof c.sectionId==='string')claims[c.sectionId]=c;});return sections.map(function(s){var c=claims[s.id]||{},ids=(Array.isArray(c.ids)?c.ids:[]).filter(function(id){return all[id];});return {sectionId:s.id,title:s.title,status:c.status==='matched'&&ids.length?'matched':'missing',ids:ids,note:String(c.note||'').slice(0,220)};});}

function progress(str){var s=el('nb-status');if(s)s.textContent=str;}
function view(stage){var main=el('nb-review');if(main)main.hidden=stage==='ready';var choice=el('nb-choice');if(choice)choice.hidden=stage!=='ready';var label=el('nb-step-label');if(label)label.textContent=stage==='pending'?'Aguardando sua aprovação':stage==='working'?'Analisando montagem':'Configuração';var row=el('ae-est-narrativa');if(row&&stage==='pending')row.textContent='⏸ aguardando aprovação';var status=el('autoedit-status');if(status&&stage==='pending')status.textContent='⏸ Auto Edit pausado: revise a montagem abaixo para continuar.';if(main&&stage==='pending'&&main.scrollIntoView)try{main.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){main.scrollIntoView();}}
function cards(){var wrap=el('nb-segments');if(!wrap)return;wrap.innerHTML='';(lastPlan||[]).forEach(function(item,i){var d=document.createElement('div');d.className='nb-segment';d.innerHTML='<span class="nb-num">'+String(i+1).padStart(2,'0')+'</span><div class="nb-copy"><div class="nb-segment-top"><strong>'+escapeHTML(item.role)+'</strong><span>'+item.start.toFixed(2)+'s–'+item.end.toFixed(2)+'s</span></div><div class="nb-quote">'+escapeHTML(item.text)+'</div><small>'+escapeHTML(item.reason||'Trecho selecionado')+'</small></div><div class="nb-actions"><button type="button" data-action="up" title="Mover para cima">↑</button><button type="button" data-action="down" title="Mover para baixo">↓</button><button type="button" data-action="remove" title="Remover da proposta">×</button></div>';
 d.querySelector('[data-action="up"]').onclick=function(){if(i){var t=lastPlan[i-1];lastPlan[i-1]=lastPlan[i];lastPlan[i]=t;cards();}};d.querySelector('[data-action="down"]').onclick=function(){if(i<lastPlan.length-1){var t=lastPlan[i+1];lastPlan[i+1]=lastPlan[i];lastPlan[i]=t;cards();}};d.querySelector('[data-action="remove"]').onclick=function(){if(lastPlan.length<=1)return;lastPlan.splice(i,1);cards();};wrap.appendChild(d);});var dur=(lastPlan||[]).reduce(function(n,c){return n+c.end-c.start;},0);if(el('nb-summary'))el('nb-summary').textContent=lastPlan.length+' trechos • '+dur.toFixed(1)+' segundos';renderCoverage();}
function renderCoverage(){var holder=el('nb-coverage');if(holder){holder.hidden=!lastCoverage.length;holder.innerHTML=lastCoverage.length?'<h4>Conferência do roteiro</h4>'+lastCoverage.map(function(c){return '<div class="nb-coverage-row"><span>'+ (c.status==='matched'?'✓':'!') +'</span><div><strong>'+escapeHTML(c.title)+'</strong><small>'+escapeHTML(c.status==='matched'?'Trecho sugerido: '+c.ids.join(', '):'Não localizado nas gravações')+'</small></div></div>';}).join(''):'';}var d=el('nb-duplicates');if(d){d.hidden=!removedDuplicates.length;d.textContent=removedDuplicates.length+' possível(is) repetição(ões) retirada(s) do plano. Revise a prévia.';}}
function addUI(){if(!el('autoedit-panel')||el('nb-review'))return;var panel=el('autoedit-panel'),target=el('autoedit-etapas');if(!target)return;
var card=document.createElement('section');card.className='nb-panel';card.id='nb-choice';
card.innerHTML='<div class="nb-heading"><div class="nb-icon">✦</div><div><strong>Montagem Inteligente</strong><p>Escolha como a IA deve organizar as falas</p></div></div>'+
'<div class="nb-mode-switch" role="radiogroup" aria-label="Modo de montagem"><label><input type="radio" name="nb-montagem-modo" value="livre" checked><span>✦ Montagem livre</span></label><label><input type="radio" name="nb-montagem-modo" value="roteiro"><span>▤ Por roteiro</span></label></div>'+
'<div id="nb-script-fields" class="nb-script-fields" hidden><label for="nb-script" class="nb-script-label">Roteiro de referência</label><textarea id="nb-script" rows="7" maxlength="12000" placeholder="ABERTURA:\nFala inicial esperada...\n\nDESENVOLVIMENTO:\nIdeias principais...\n\nFECHAMENTO:\nComo encerrar..."></textarea><div class="nb-script-tools"><label class="nb-file" for="nb-script-file">↑ Importar TXT / MD</label><input id="nb-script-file" type="file" accept=".txt,.md,text/plain,text/markdown" hidden><span id="nb-script-count">0 / 12.000 caracteres</span></div><label class="nb-script-label" for="nb-fidelity">Correspondência das falas</label><select id="nb-fidelity"><option value="flexivel">Flexível — mantém o sentido</option><option value="fiel">Fiel — mais próximo das palavras</option></select><p class="nb-help">A IA procura cada parte do roteiro nas gravações, compara tentativas e informa o que não foi encontrado. Nunca inventa falas.</p></div>'+
'<div class="nb-inline-note">◷ O Auto Edit pausa para você assistir à prévia e aprovar. Depois continua sozinho.</div>';
var review=document.createElement('section');review.className='nb-panel nb-review';review.id='nb-review';review.hidden=true;review.innerHTML='<div class="nb-heading"><div class="nb-icon">✓</div><div><strong>Montagem pronta</strong><p id="nb-step-label">Aguardando sua aprovação</p></div><span class="nb-pill">GROQ</span></div><p class="nb-progress" id="nb-status" role="status">Analisando roteiro...</p><div class="nb-summary" id="nb-summary"></div><div id="nb-coverage" class="nb-coverage" hidden></div><div id="nb-duplicates" class="nb-duplicates" hidden></div><div class="nb-list" id="nb-segments"></div><div class="nb-buttons"><button id="nb-preview" type="button" class="nb-primary">▶ Ver prévia no Premiere</button><button id="nb-approve" type="button" class="nb-primary">✓ Aprovar e continuar</button><button id="nb-skip" type="button" class="nb-secondary">Pular esta etapa</button></div><p class="nb-help">Sua sequência anterior permanece preservada. Use as setas para alterar a ordem e gere outra prévia antes de aprovar.</p>';
target.parentNode.insertAdjacentElement('afterend',card);card.insertAdjacentElement('afterend',review);
var st=settings(),mode=(st.mode==='roteiro'?'roteiro':'livre');function syncMode(){var chosen=document.querySelector('input[name="nb-montagem-modo"]:checked');mode=chosen?chosen.value:'livre';el('nb-script-fields').hidden=mode!=='roteiro';save({mode:mode});}document.querySelectorAll('input[name="nb-montagem-modo"]').forEach(function(r){r.checked=r.value===mode;r.onchange=syncMode;});el('nb-mode')||Object.defineProperty(card,'_nbMode',{value:function(){return mode;}});el('nb-fidelity').value=st.fidelity==='fiel'?'fiel':'flexivel';el('nb-fidelity').onchange=function(){save({fidelity:this.value});};
el('nb-script').oninput=function(){el('nb-script-count').textContent=this.value.length+' / 12.000 caracteres';};el('nb-script-file').onchange=function(){var file=this.files&&this.files[0];if(!file)return;if(file.size>262144){alert('O arquivo é grande demais (máximo 256 KB).');return;}if(!/\.(txt|md)$/i.test(file.name)){alert('Use um roteiro TXT ou Markdown (MD).');return;}var reader=new FileReader();reader.onload=function(){el('nb-script').value=String(reader.result||'').slice(0,12000);el('nb-script').oninput();};reader.onerror=function(){alert('Não consegui ler o arquivo. Cole o texto no campo.');};reader.readAsText(file,'UTF-8');};
syncMode();el('nb-preview').onclick=preview;el('nb-approve').onclick=approve;el('nb-skip').onclick=skip;
 // A configuração existe somente no painel Auto Edit.
 initCollapsible(card);
}
function initCollapsible(card){
 var heading=card.querySelector('.nb-heading');
 if(!heading)return;
 var trigger=document.createElement('button');
 trigger.type='button';trigger.id='nb-collapse-trigger';trigger.className='nb-collapse-trigger';
 trigger.setAttribute('aria-controls','nb-choice-body');
 trigger.title='Expandir ou recolher as configurações da Montagem Inteligente';
 heading.parentNode.replaceChild(trigger,heading);
 trigger.appendChild(heading);
 var chevron=document.createElement('span');chevron.className='nb-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';trigger.appendChild(chevron);
 var body=document.createElement('div');body.id='nb-choice-body';body.className='nb-choice-body';
 while(trigger.nextSibling)body.appendChild(trigger.nextSibling);
 card.appendChild(body);
 function setCollapsed(collapsed){body.hidden=!!collapsed;trigger.setAttribute('aria-expanded',collapsed?'false':'true');chevron.textContent=collapsed?'⌄':'⌃';card.classList.toggle('nb-collapsed',!!collapsed);save({collapsed:!!collapsed});}
 trigger.onclick=function(){setCollapsed(!body.hidden);};
 setCollapsed(settings().collapsed!==false);
}


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
  reportState.state='approved';eventLog('approved','Usuário aprovou '+lastPlan.length+' segmentos');progress('Aprovação concluída. Continuando o Auto Edit...');
  pending=null;view('ready');finished.done({ok:true,resumo:'montagem aprovada: '+lastPlan.length+' trechos'});
 }).catch(function(e){
  eventLog('approval-error',e.message);progress('Aprovação não concluída: '+e.message+'. A revisão permanece aberta.');
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
  reportState.state='skipped';eventLog('skipped','Usuário pulou a montagem');pending=null;view('ready');current.done({ok:true,resumo:'montagem ignorada; sequência original mantida'});
 }).catch(function(e){progress('Não consegui voltar à sequência original com transcrição preservada: '+e.message);}).then(function(){isBusy=false;});
}

function run(done){addUI();if(pending)return done({ok:false,erro:'Já existe uma montagem aguardando revisão.'});
var config;try{config=readConfig();}catch(e){failureDiagnostic(e,'configuração');return done({ok:false,erro:e.message});}
progress('Conferindo sequência e transcrição...');view('working');var transcript=root._fsLastResp;resetReport(transcript,config);
if(!transcript||!transcript.words||!transcript.words.length){var err=new Error('A montagem precisa da transcrição por palavras. Ative a etapa Transcrever.');failureDiagnostic(err,'transcricao');view('ready');return done({ok:false,erro:err.message});}
loadHost().then(function(){return host('fsNarrativeBetaSnapshot',{});}).then(function(snapshot){
lastManifest=snapshot;lastSegments=groupWords(transcript.words,snapshot.clips);var hints=retakeContext(transcript,lastSegments);var pauses=silenceHints(transcript.words,snapshot.clips);
 eventLog('input','Segmentos: '+lastSegments.length+'; Retakes: '+hints.nearGroupsCount+'; pausas: '+pauses.length);
var counted=lastSegments.reduce(function(n,x){return n+x.text.trim().split(/\s+/).length;},0);
if(counted<transcript.words.length*.6)fail('Transcrição não corresponde à sequência ativa (mais de 40% fora dos clipes). Refaça a transcrição.');
if(!lastSegments.length)fail('Nenhuma fala coincide com a sequência atual.');
progress('IA organizando '+lastSegments.length+' trechos ('+(config.mode==='roteiro'?'por roteiro':'livre')+')...');
var sys='Você é editor audiovisual profissional em português. Os takes podem estar fora de ordem. Escolha as melhores tentativas e elimine TODA informação repetida, inclusive paráfrases em IDs diferentes. Preserve coerência. Não invente falas. Responda somente JSON com cuts, coverage e summary. Se não houver trecho para uma parte do roteiro, diga missing. Marcados blocked=true são proibidos.';
var payload=buildPayload(lastSegments,config,hints,pauses);
function invokeEditor(messages,label){eventLog('groq-request',label);return groq(messages).then(function(answer){return answer;});}
function inspectPlan(candidate,first){
 var normalized=editorialNormalize(candidate);
 if(!normalized.cuts.length)fail('A IA não selecionou falas aproveitáveis.');
 var cuts=validate({cuts:normalized.cuts},lastSegments,snapshot.clips),unique=dedupePlan(cuts,config.sections);
 if(!unique.cuts.length)fail('Montagem vazia após remover repetições.');
 var audit=narrativeGuard(unique.cuts,lastSegments),ideaCoverage=ideaAudit(normalized,unique.cuts,lastSegments);strongRetakePlanGuard(unique.cuts,hints);
 var coverage=coverageReport(normalized,config.sections,unique.cuts);
 return {snapshot:snapshot,cuts:unique.cuts,removed:normalized.discarded.concat(unique.removed),coverage:coverage,config:config,summary:normalized.summary||first&&first.summary||'',retake:hints,audit:audit,ideaAudit:ideaCoverage};
}
return invokeEditor([{role:'system',content:sys+' Estruture a resposta obrigatoriamente em selected, discarded, ideas, coverage, summary. NÃO use cuts. Nunca marque uma fala selecionada como duplicate.'},{role:'user',content:payload}],'editor').then(function(first){
 var firstPlan;try{firstPlan=editorialNormalize(first);}catch(e){eventLog('first-plan-invalid',e.message);firstPlan={cuts:[],discarded:[],ideas:[]};}
 progress('IA revisando cobertura, tentativas e continuidade...');
 var reviewRequest={requirements:JSON.parse(payload),firstPlan:firstPlan.cuts,firstDiscarded:firstPlan.discarded,firstIdeas:firstPlan.ideas,firstCoverage:first.coverage||[]};
 return invokeEditor([{role:'system',content:sys+' Você é o REVISOR INDEPENDENTE. Entregue selected, discarded, ideas, coverage, summary. Corrija classificação contraditória, ideias essenciais omitidas e repetições. selected não pode conter role duplicate.'},{role:'user',content:JSON.stringify(reviewRequest)}],'review').then(function(review){
  try{return inspectPlan(review,first);}catch(editorialError){
   eventLog('review-rejected',editorialError.message);progress('A proposta foi rejeitada. Tentando reconstruir a montagem...');
   return invokeEditor([{role:'system',content:sys+' REPARO FINAL. A proposta anterior falhou. Separe selected e discarded; nunca use duplicate como role de selected. Identifique TODAS as ideias principais que possuem falas disponíveis e cubra-as sem repetir. Devolva JSON com selected,discarded,ideas,coverage,summary.'},{role:'user',content:JSON.stringify({requirements:JSON.parse(payload),rejected:review,error:String(editorialError.message||editorialError),first:firstPlan})}],'repair').then(function(repaired){return inspectPlan(repaired,first);});
  }
 });
});
}).then(function(result){lastPlan=result.cuts;lastManifest=result.snapshot;lastCoverage=result.coverage;removedDuplicates=result.removed;lastRetake=result.retake;
 reportState.state='awaiting_approval';eventLog('ready','Plano seguro validado, aguardando aprovação');pending={done:done,previewId:null,previewCuts:null,previewLayout:null,originalTranscript:deepCopy(transcript),config:result.config};cards();
var missing=result.coverage.filter(function(x){return x.status==='missing';}).length;var retakeInfo=result.retake&&result.retake.nearGroupsCount||0;var semantics=result.retake&&result.retake.semanticGroupCount||0;
progress(missing?('Revisão necessária: '+missing+' parte(s) do roteiro não localizada(s). Assista à prévia.'):('Montagem pronta: '+retakeInfo+' grupo(s) técnicos e '+semantics+' semântico(s) avaliados. Nenhum take apagado. Confira a prévia.'));
el('nb-approve').disabled=true;view('pending'); }).catch(function(e){failureDiagnostic(e,'montagem');view('ready');progress('Montagem interrompida: '+e.message);done({ok:false,erro:'Montagem Inteligente: '+e.message});});}

root.fsAutoEditNarrativa=run;
root.fsNarrativeBeta={localRetakePairs:localRetakePairs,verifySemanticGroups:verifySemanticGroups,semanticRequest:semanticRequest,buildRetakeHints:buildRetakeHints,strongRetakePlanGuard:strongRetakePlanGuard,editorialNormalize:editorialNormalize,ideaAudit:ideaAudit,silenceHints:silenceHints,analyzeRetakes:analyzeRetakes,retakeContext:retakeContext,narrativeGuard:narrativeGuard,analyzeOnly:analyzeOnly,transcriptFingerprint:transcriptFingerprint,groupWords:groupWords,validate:validate,parseScript:parseScript,buildPayload:buildPayload,dedupePlan:dedupePlan,coverageReport:coverageReport,nearDuplicate:nearDuplicate,readConfig:readConfig,settings:settings,remapTranscript:remapTranscript,createPreview:preview,approve:approve,skip:skip,get pending(){return !!pending;}};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addUI);else addUI();}
})(typeof window!=='undefined'?window:this);