/* Caption IA 3.4.9 — licença + chave Groq individual, isolada por conta. */
(function(w,d){'use strict';
var MODEL='openai/gpt-oss-120b',WHISPER='whisper-large-v3';
var ready=false,checking=false,owner='',lastValidated=0,lastError='',quota={},verifiedKeyTag='',checkNonce=0;
var root=null, panel=null, clockTimer=null;
function el(id){return d.getElementById(id);}
function getStore(){return w.fsSecureKeyStore;}
function licenseOk(){return !!(w.CaptionIALicense&&w.CaptionIALicense.isAuthorized&&w.CaptionIALicense.isAuthorized());}
function validSyntax(v){return /^gsk_[A-Za-z0-9_-]{21,196}$/.test(String(v||''));}
function readKey(){return getStore()&&getStore().get()||'';}
function currentTag(){var key=readKey();if(!key)return'';try{return require('crypto').createHash('sha256').update(key).digest('hex').slice(0,16);}catch(e){return'';}}
function isReady(){return ready&&licenseOk()&&!!owner&&!!readKey()&&verifiedKeyTag===currentTag()&&Date.now()-lastValidated<12*60*60*1000;}
function status(message,isError){lastError=message||'';var x=el('cia-groq-status');if(x){x.textContent=lastError;x.className='cia-groq-status'+(isError?' is-error':'');}refreshPanel();}
function ensureUI(){
 if(!d.body||root)return;
 root=d.createElement('div');root.id='cia-groq-gate';root.className='cia-groq-gate';root.style.display='none';
 root.innerHTML='<div class="cia-groq-card"><div class="cia-groq-kicker">CAPTION IA · GROQ INDIVIDUAL</div>'+
 '<h2>Conecte sua chave Groq</h2><p class="cia-groq-desc">Sua licença está ativa. Para usar os recursos de IA, cada cliente utiliza sua própria chave Groq. Ela fica protegida neste computador e não é enviada ao Caption IA.</p>'+
 '<label for="cia-groq-input">Chave de API</label><input type="password" id="cia-groq-input" autocomplete="off" spellcheck="false" placeholder="gsk_..." />'+
 '<p class="cia-groq-status" id="cia-groq-status" role="status">Verificando a chave salva...</p>'+
 '<div class="cia-groq-actions"><button id="cia-groq-save" class="cia-groq-primary">Salvar e verificar</button><button id="cia-groq-recheck">Verificar chave salva</button></div>'+
 '<div class="cia-groq-links"><a href="https://console.groq.com/keys" id="cia-groq-help">Criar chave Groq ↗</a><button id="cia-groq-close" type="button" style="display:none">Voltar ao plugin</button></div>'+
 '<p class="cia-groq-foot">Validação segura pela API Groq. Não expomos a chave na interface, nos relatórios ou no servidor da licença.</p></div>';
 d.body.appendChild(root);
 el('cia-groq-save').onclick=saveAndCheck;
 el('cia-groq-recheck').onclick=function(){verify(true);};
 el('cia-groq-close').onclick=function(){if(isReady())hide();};
 el('cia-groq-help').onclick=function(ev){ev.preventDefault();try{new CSInterface().openURLInDefaultBrowser('https://console.groq.com/keys');}catch(e){try{w.open('https://console.groq.com/keys');}catch(_){}}};
}
function setChecking(value){checking=!!value;['cia-groq-save','cia-groq-recheck'].forEach(function(id){if(el(id))el(id).disabled=checking;});}
function show(message,allowClose){ensureUI();if(!root)return;root.style.display='flex';if(el('cia-groq-close'))el('cia-groq-close').style.display=allowClose?'inline-block':'none';if(message)status(message,false);}
function hide(){if(root)root.style.display='none';}
function revalidateWhenExpired(){if(!licenseOk()||!owner)return;if(Date.now()-lastValidated>11*60*60*1000){ready=false;show('Por segurança, precisamos verificar novamente a chave Groq.');verify(true);} }
function requestModels(key){return new Promise(function(resolve,reject){
  var https;try{https=require('https');}catch(e){return reject(new Error('Módulo HTTPS indisponível.'));}
  var finished=false;function settle(e,data){if(finished)return;finished=true;if(e)reject(e);else resolve(data);}
  var req=https.request({hostname:'api.groq.com',path:'/openai/v1/models',method:'GET',timeout:15000,
   headers:{Authorization:'Bearer '+key,Accept:'application/json'}},function(resp){
    var bytes=0,chunks=[];resp.on('data',function(x){bytes+=x.length;if(bytes>350000){req.destroy(new Error('Resposta grande demais.'));return;}chunks.push(x);});
    resp.on('end',function(){try{
       var data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
       if(resp.statusCode===401||resp.statusCode===403){var no=new Error('Chave Groq inválida, revogada ou sem acesso.');no.status=resp.statusCode;throw no;}
       if(resp.statusCode===429){var cap=new Error('A chave foi reconhecida, mas a Groq está aplicando um limite temporário. Aguarde e verifique novamente.');cap.status=429;throw cap;}
       if(resp.statusCode!==200||!Array.isArray(data.data)){var bad=new Error('Não foi possível confirmar o acesso aos modelos da Groq.');bad.status=resp.statusCode;throw bad;}
       var models={};data.data.forEach(function(item){if(item&&item.id)models[item.id]=true;});
       if(!models[MODEL]||!models[WHISPER])throw Error('A chave não tem acesso aos modelos GPT-OSS 120B e Whisper Large V3 necessários.');
       settle(null,{valid:true});
    }catch(e){settle(e);}});
  });req.on('error',settle);req.on('timeout',function(){req.destroy(new Error('Sem resposta da Groq. Verifique a internet.'));});req.end();
 });}
function verify(reopen){
 if(!licenseOk()||!owner)return Promise.reject(new Error('Licença Caption IA indisponível.'));
 if(checking)return Promise.resolve(false);
 var key=readKey();ready=false;
 if(!validSyntax(key)){show('Cadastre sua chave Groq para continuar.',false);return Promise.resolve(false);}
 setChecking(true);show('Conferindo chave e disponibilidade dos modelos...',false);
 var tag=currentTag(),targetOwner=owner,nonce=++checkNonce;
 return requestModels(key).then(function(){
   if(targetOwner!==owner||nonce!==checkNonce||tag!==currentTag())throw Error('Conta ou chave alterada durante a verificação.');
   ready=true;verifiedKeyTag=tag;lastValidated=Date.now();lastError='';status('✓ Chave válida. Caption IA liberado.',false);hide();refreshPanel();return true;
 }).catch(function(e){if(targetOwner===owner&&nonce===checkNonce){ready=false;status(e.message||String(e),true);show(null,false);}return false;}).then(function(result){setChecking(false);return result;},function(err){setChecking(false);throw err;});
}
function saveAndCheck(){
 var input=el('cia-groq-input'),key=String(input&&input.value||'').trim();if(!validSyntax(key))return status('A chave precisa começar com gsk_ e ter o formato esperado.',true);
 var store=getStore();if(!store||!store.set(key))return status('Não foi possível salvar a chave de forma protegida neste computador.',true);
 input.value='';verifiedKeyTag='';ready=false;quota={};verify(true);
}
function timeDuration(value){var match=String(value||'').match(/(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);if(!match||!match[0])return 0;return Math.ceil((Number(match[1]||0)*60+Number(match[2]||0))*1000);}
function observe(headers,model,httpStatus){
 if(!owner||!headers)return;
 if(httpStatus===401||httpStatus===403){ready=false;verifiedKeyTag='';show('A Groq recusou sua chave. Verifique em Minha conta.',false);}
 var item=quota[model]||{},r=headers;
 function num(k){var n=Number(r[k]);return isFinite(n)&&r[k]!=null?n:null;}
 var limit=num('x-ratelimit-limit-tokens'),remaining=num('x-ratelimit-remaining-tokens');
 if(limit!==null)item.limitTokens=limit;if(remaining!==null)item.remainingTokens=remaining;
 var reqMax=num('x-ratelimit-limit-requests'),reqRemain=num('x-ratelimit-remaining-requests');
 if(reqMax!==null)item.limitRequestsDay=reqMax;if(reqRemain!==null)item.remainingRequestsDay=reqRemain;
 var reset=timeDuration(r['x-ratelimit-reset-tokens']);
 if(reset)item.resetAt=Date.now()+reset;
 var wait=num('retry-after');
 if(httpStatus===429&&wait!==null)item.waitUntil=Date.now()+Math.ceil(wait*1000);
 if(httpStatus!==429)item.waitUntil=0;
 item.updatedAt=Date.now();quota[model]=item;refreshPanel();
}
function currentQuota(){return quota[MODEL]||{};}
function fmtWait(time){if(!time||time<=Date.now())return 'Disponível';var n=Math.ceil((time-Date.now())/1000);return n>=60?Math.floor(n/60)+'m '+n%60+'s':n+'s';}
function refreshPanel(){
 var valid=isReady(),q=currentQuota();
 if(el('cia-groq-account-status'))el('cia-groq-account-status').textContent=valid?'✓ Groq conectada':'Chave não verificada';
 if(el('cia-groq-meter')){
  el('cia-groq-meter').textContent=q.updatedAt&&q.limitTokens!=null&&q.remainingTokens!=null?
   Math.max(0,q.remainingTokens).toLocaleString('pt-BR')+' / '+q.limitTokens.toLocaleString('pt-BR')+' tokens/min':'Sem medição de tokens ainda';
 }
 if(el('cia-groq-meter-bar'))el('cia-groq-meter-bar').style.width=q.limitTokens>0?Math.min(100,Math.max(0,100*q.remainingTokens/q.limitTokens))+'%':'0%';
 if(el('cia-groq-timer'))el('cia-groq-timer').textContent=q.waitUntil>Date.now()?'Aguarde '+fmtWait(q.waitUntil):q.resetAt>Date.now()?'Renovação em '+fmtWait(q.resetAt):'Sem espera informada';
 if(el('cia-groq-meter-age'))el('cia-groq-meter-age').textContent=q.updatedAt?'Última leitura: '+new Date(q.updatedAt).toLocaleTimeString('pt-BR'):'Limites aparecem após a primeira chamada de IA';
}
function accountPanel(){
 var pop=el('cia-account-popover');if(!pop)return;
 if(panel&&panel.parentNode!==pop){panel.parentNode&&panel.parentNode.removeChild(panel);panel=null;}
 if(!panel){if(pop.className.indexOf('cia-groq-has-quota')<0)pop.className+=' cia-groq-has-quota';panel=d.createElement('section');panel.className='cia-groq-account';panel.innerHTML='<div class="cia-groq-account-title"><strong>Groq individual</strong><span id="cia-groq-account-status">Verificando...</span></div>'+
  '<div class="cia-groq-account-meter"><div id="cia-groq-meter">Sem medição de tokens ainda</div><div class="cia-groq-track"><div id="cia-groq-meter-bar"></div></div><small id="cia-groq-timer">Sem espera informada</small><small id="cia-groq-meter-age">Limites aparecem após a primeira chamada de IA</small></div>'+
  '<div class="cia-groq-account-actions"><button type="button" id="cia-groq-manage">Trocar chave</button><button type="button" id="cia-groq-check">Verificar</button></div>';
  var plan=pop.querySelector('.cia-account-plan');if(plan&&plan.nextSibling)pop.insertBefore(panel,plan.nextSibling);else pop.appendChild(panel);
  el('cia-groq-manage').onclick=function(){show('Cole uma nova chave para substituir a credencial deste usuário.',true);};
  el('cia-groq-check').onclick=function(){verify(true);};
 }
 refreshPanel();
}
function onLicense(e){
 var user=e&&e.detail&&e.detail.user||w.CaptionIALicense&&w.CaptionIALicense.getState().user||null;
 var id=user&&(user.id||user.email);
 if(!id)return;
 var next=String(id);
 if(owner!==next){owner=next;ready=false;verifiedKeyTag='';quota={};lastValidated=0;if(getStore())getStore().setOwner(owner);}
 ensureUI();accountPanel();if(isReady()){refreshPanel();hide();}else verify(false);
}
function onLogout(){checkNonce++;owner='';ready=false;verifiedKeyTag='';lastValidated=0;quota={};if(getStore())getStore().setOwner('');hide();panel=null;}
function ensureReady(){if(!isReady()){show('Cadastre e verifique sua chave Groq antes de usar o Caption IA.',false);throw Error('Chave Groq não verificada. Abra Minha conta para verificar.');}return true;}
// Block mouse/keyboard while key gate is visible, excluding its own controls.
function guard(ev){if(!licenseOk()||isReady())return;if(root&&root.style.display==='flex'){
 if(root.contains(ev.target))return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
 }}
d.addEventListener('click',guard,true);d.addEventListener('keydown',guard,true);
d.addEventListener('captionia:license-ready',onLicense);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ensureUI);else ensureUI();
clockTimer=setInterval(function(){refreshPanel();revalidateWhenExpired();},1000);
w.CaptionIAGroqAccess={isReady:isReady,ensureReady:ensureReady,onLicense:onLicense,onLogout:onLogout,verify:verify,observe:observe,readKey:readKey,quota:currentQuota,validSyntax:validSyntax,requestModels:requestModels,fmtWait:fmtWait};
})(window,document);