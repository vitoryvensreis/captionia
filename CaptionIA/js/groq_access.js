/* Caption IA 3.5.0 — user-managed Groq: client NEVER handles the API secret. */
(function(w,d){'use strict';
var MODEL='openai/gpt-oss-120b',ready=false,checking=false,owner='',lastValidated=0,quota={},checkNonce=0;
var root=null,panel=null,lastAttempt=0;
function el(id){return d.getElementById(id);}
function license(){return w.CaptionIALicense;}
function licenseOk(){return !!(license()&&license().isAuthorized&&license().isAuthorized());}
function openSite(){
 var url='https://caption.escotilhaprodutora.com/minha-conta#integracao-groq';
 try{new CSInterface().openURLInDefaultBrowser(url);}catch(e){try{w.open(url,'_blank');}catch(_e){}}
}
function isReady(){return !!(ready&&owner&&licenseOk()&&Date.now()-lastValidated<12*60*60*1000);}
function status(message,isError){var x=el('cia-groq-status');if(x){x.textContent=message||'';x.className='cia-groq-status'+(isError?' is-error':'');}refreshPanel();}
function ensureUI(){
 if(!d.body||root)return;
 root=d.createElement('div');root.id='cia-groq-gate';root.className='cia-groq-gate';root.style.display='none';
 root.innerHTML='<div class="cia-groq-card"><div class="cia-groq-kicker">CAPTION IA · INTEGRAÇÃO GROQ</div>'+
 '<h2>Conecte sua conta Groq</h2><p class="cia-groq-desc">Sua licença está ativa. Configure sua chave Groq uma única vez em Minha conta, no site Caption IA. O plugin nunca recebe nem salva a chave.</p>'+
 '<p class="cia-groq-status" id="cia-groq-status" role="status">Verificando integração da sua conta...</p>'+
 '<div class="cia-groq-actions"><button id="cia-groq-save" class="cia-groq-primary" type="button">Abrir minha conta</button><button id="cia-groq-recheck" type="button">Verificar integração</button></div>'+
 '<div class="cia-groq-links"><a href="https://caption.escotilhaprodutora.com/tutoriais#groq" id="cia-groq-help">Como conectar a Groq ↗</a><button type="button" id="cia-groq-close" style="display:none">Voltar ao plugin</button></div>'+
 '<p class="cia-groq-foot">Seu limite de IA é individual. A chave fica protegida no site e o servidor encaminha as solicitações com a sua credencial.</p></div>';
 d.body.appendChild(root);
 el('cia-groq-save').onclick=openSite;
 el('cia-groq-recheck').onclick=function(){verify(true);};
 el('cia-groq-close').onclick=function(){if(isReady())hide();};
 el('cia-groq-help').onclick=function(ev){ev.preventDefault();try{new CSInterface().openURLInDefaultBrowser('https://caption.escotilhaprodutora.com/tutoriais#groq');}catch(e){}};
}
function setChecking(x){checking=!!x;if(el('cia-groq-recheck'))el('cia-groq-recheck').disabled=checking;}
function show(message,close){ensureUI();if(!root)return;root.style.display='flex';if(el('cia-groq-close'))el('cia-groq-close').style.display=close?'inline-block':'none';if(message)status(message,false);}
function hide(){if(root)root.style.display='none';}
function requestStatus(){
 if(!licenseOk())return Promise.reject(Error('Entre novamente na sua conta Caption IA.'));
 return license().apiRequest('GET','/groq/status',null).catch(function(e){
  if(e&&e.status===401&&license().recheck)return license().recheck().then(function(){return license().apiRequest('GET','/groq/status',null);});
  throw e;
 });
}
function verify(reopen){
 if(!licenseOk()||!owner)return Promise.resolve(false);
 if(checking)return Promise.resolve(false);
  lastAttempt=Date.now();setChecking(true);if(reopen||!isReady())show('Consultando sua integração Groq na plataforma...',false);
 var target=owner,nonce=++checkNonce;
 return requestStatus().then(function(data){
  if(target!==owner||nonce!==checkNonce)return false;
  if(!data||!data.connected){ready=false;show('Nenhuma chave Groq vinculada a esta conta. Abra Minha conta no site e cadastre sua chave.',false);return false;}
  ready=true;lastValidated=Date.now();status('✓ Groq conectada à sua conta. Plugin liberado.',false);hide();return true;
 }).catch(function(err){
  if(target===owner&&nonce===checkNonce){ready=false;show(err&&err.message||'Não foi possível verificar a conexão com o site Caption IA.',false);status(err&&err.message||'Falha de comunicação.',true);}
  return false;
 }).then(function(value){setChecking(false);refreshPanel();return value;},function(err){setChecking(false);throw err;});
}
function parseDuration(v){var m=String(v||'').match(/^(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/);if(!m)return 0;return Math.ceil((Number(m[1]||0)*60+Number(m[2]||0))*1000);}
function observe(data,model,statusCode){
 if(!owner)return;
 if(statusCode===401||statusCode===403){ready=false;show('Sua integração Groq precisa ser atualizada em Minha conta.',false);}
 var headers=data&&data.rate_limit?data.rate_limit:data||{};
 var item=quota[model]||{};
 function number(key){var n=Number(headers[key]);return headers[key]!=null&&isFinite(n)?n:null;}
 var lim=number('x-ratelimit-limit-tokens'),rem=number('x-ratelimit-remaining-tokens');
 if(lim!==null)item.limitTokens=lim;if(rem!==null)item.remainingTokens=rem;
 var reset=parseDuration(headers['x-ratelimit-reset-tokens']);if(reset)item.resetAt=Date.now()+reset;
 var retry=number('retry-after')||number('retry_after_seconds');
 if(statusCode===429&&retry!==null)item.waitUntil=Date.now()+Math.max(1,retry)*1000;
 if(statusCode!==429)item.waitUntil=0;
 item.updatedAt=Date.now();quota[model]=item;refreshPanel();
}
function currentQuota(){return quota[MODEL]||{};}
function fmtWait(time){if(!time||time<=Date.now())return 'Disponível';var t=Math.ceil((time-Date.now())/1000);return t>=60?Math.floor(t/60)+'m '+t%60+'s':t+'s';}
function refreshPanel(){
 var q=currentQuota();
 if(el('cia-groq-account-status'))el('cia-groq-account-status').textContent=isReady()?'✓ Conectada':'Aguardando integração';
 if(el('cia-groq-meter'))el('cia-groq-meter').textContent=q.updatedAt&&q.limitTokens!=null&&q.remainingTokens!=null?Math.max(0,q.remainingTokens).toLocaleString('pt-BR')+' / '+q.limitTokens.toLocaleString('pt-BR')+' tokens (última leitura)':'Limites disponíveis após a primeira análise';
 if(el('cia-groq-meter-bar'))el('cia-groq-meter-bar').style.width=q.limitTokens>0?Math.min(100,Math.max(0,100*q.remainingTokens/q.limitTokens))+'%':'0%';
 if(el('cia-groq-timer'))el('cia-groq-timer').textContent=q.waitUntil>Date.now()?'Aguarde '+fmtWait(q.waitUntil):q.resetAt>Date.now()?'Renovação em '+fmtWait(q.resetAt):'Sem espera informada';
 if(el('cia-groq-meter-age'))el('cia-groq-meter-age').textContent=q.updatedAt?'Última leitura: '+new Date(q.updatedAt).toLocaleTimeString('pt-BR'):'Os limites informados são da sua chave Groq';
}
function accountPanel(){
 var pop=el('cia-account-popover');if(!pop)return;
 if(panel&&panel.parentNode!==pop){panel.parentNode&&panel.parentNode.removeChild(panel);panel=null;}
 if(!panel){if(pop.className.indexOf('cia-groq-has-quota')<0)pop.className+=' cia-groq-has-quota';
  panel=d.createElement('section');panel.className='cia-groq-account';
  panel.innerHTML='<div class="cia-groq-account-title"><strong>Groq da minha conta</strong><span id="cia-groq-account-status">Verificando...</span></div>'+
   '<div class="cia-groq-account-meter"><div id="cia-groq-meter">Limites disponíveis após a primeira análise</div><div class="cia-groq-track"><div id="cia-groq-meter-bar"></div></div><small id="cia-groq-timer">Sem espera informada</small><small id="cia-groq-meter-age">Sua chave fica no site</small></div>'+
   '<div class="cia-groq-account-actions"><button type="button" id="cia-groq-manage">Gerenciar no site</button><button type="button" id="cia-groq-check">Atualizar</button></div>';
  var plan=pop.querySelector('.cia-account-plan');if(plan&&plan.nextSibling)pop.insertBefore(panel,plan.nextSibling);else pop.appendChild(panel);
  el('cia-groq-manage').onclick=openSite;el('cia-groq-check').onclick=function(){verify(true);};
 }refreshPanel();
}
function onLicense(e){
 var state=license()&&license().getState?license().getState():{};
 var user=e&&e.detail&&e.detail.user||state.user||null;
 var id=user&&(user.id||user.email);if(!id)return;
 var next=String(id);
 if(owner!==next){owner=next;ready=false;lastValidated=0;quota={};checkNonce++;}
 ensureUI();accountPanel();verify(false);
}
function onLogout(){checkNonce++;owner='';ready=false;lastValidated=0;quota={};hide();panel=null;}
function ensureReady(){if(!isReady()){show('Conecte a Groq em Minha conta no site e clique Verificar integração.',false);throw Error('Integração Groq não verificada. Configure-a no site Caption IA.');}return true;}
function guard(ev){if(!licenseOk()||isReady())return;if(root&&root.style.display==='flex'){if(root.contains(ev.target))return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}}
d.addEventListener('click',guard,true);d.addEventListener('keydown',guard,true);
d.addEventListener('captionia:license-ready',onLicense);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ensureUI);else ensureUI();
setInterval(function(){refreshPanel();if(licenseOk()&&owner&&(!isReady()||Date.now()-lastValidated>11*60*60*1000)&&Date.now()-lastAttempt>=60000&&!checking)verify(false);},1000);
w.addEventListener('focus',function(){if(licenseOk()&&owner&&Date.now()-lastValidated>3*60*1000&&Date.now()-lastAttempt>=60000)verify(false);});
w.CaptionIAGroqAccess={isReady:isReady,ensureReady:ensureReady,onLicense:onLicense,onLogout:onLogout,verify:verify,observe:observe,quota:currentQuota,fmtWait:fmtWait};
})(window,document);
