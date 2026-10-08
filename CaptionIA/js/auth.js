(function(w,d){'use strict';
var API='https://caption.escotilhaprodutora.com/api/v1';
var SITE='https://caption.escotilhaprodutora.com';
var VERSION='3.4.0';
var DEVICE_KEY='framespeed_license_device_uuid';
var EMAIL_KEY='framespeed_license_email';
var accessToken='';
var authorized=false;
var currentUser=null;
var currentLicense=null;
var gate=null;
var lastCheck=0;

function addClass(el,name){if(!el)return;if(el.classList)el.classList.add(name);else if((' '+el.className+' ').indexOf(' '+name+' ')<0)el.className+=(el.className?' ':'')+name;}
function removeClass(el,name){if(!el)return;if(el.classList)el.classList.remove(name);else el.className=(' '+el.className+' ').replace(' '+name+' ',' ').replace(/^\s+|\s+$/g,'');}
addClass(d.documentElement,'cia-auth-pending');

function safeJson(s){try{return JSON.parse(s||'{}');}catch(_e){return{};}}
function request(method,path,body,token){
  return new Promise(function(resolve,reject){
    var x=new XMLHttpRequest();
    x.open(method,API+path,true);
    x.timeout=20000;
    x.setRequestHeader('Accept','application/json');
    if(body!==null&&body!==undefined)x.setRequestHeader('Content-Type','application/json');
    if(token)x.setRequestHeader('Authorization','Bearer '+token);
    x.onreadystatechange=function(){
      if(x.readyState!==4)return;
      var data=safeJson(x.responseText);
      if(x.status>=200&&x.status<300){resolve(data);return;}
      var err=new Error(String(data.error||data.message||('Falha HTTP '+x.status)));
      err.status=x.status;err.payload=data;reject(err);
    };
    x.ontimeout=function(){reject(new Error('O servidor demorou para responder.'));};
    x.onerror=function(){reject(new Error('Não foi possível conectar ao servidor de licenças.'));};
    try{x.send(body===null||body===undefined?null:JSON.stringify(body));}catch(e){reject(e);}
  });
}
function openSite(path){
  var url=SITE+(path||'');
  try{new CSInterface().openURLInDefaultBrowser(url);}catch(e){try{w.open(url,'_blank');}catch(_e){}}
}
function makeUuid(){
  try{
    if(w.crypto&&w.crypto.getRandomValues){
      var a=new Uint8Array(16);w.crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
      var h=[];for(var i=0;i<a.length;i++)h.push(('0'+a[i].toString(16)).slice(-2));
      return h.slice(0,4).join('')+'-'+h.slice(4,6).join('')+'-'+h.slice(6,8).join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('');
    }
  }catch(_e){}
  return 'cia-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
}
function deviceUuid(){
  var v='';try{v=localStorage.getItem(DEVICE_KEY)||'';}catch(_e){}
  if(v.length>=8)return v;
  v=makeUuid();
  try{localStorage.setItem(DEVICE_KEY,v);if(w.fsCofreGravarAgora)w.fsCofreGravarAgora();}catch(_e2){}
  return v;
}
function deviceInfo(){
  var name='Computador',osName='';
  try{
    if(typeof require!=='undefined'){
      var os=require('os');name=String(os.hostname()||name);osName=String(os.platform()+' '+os.release());
    }
  }catch(_e){}
  if(!osName)osName=String(navigator.platform||'');
  return{name:name.slice(0,160),os:osName.slice(0,80)};
}
function storeRefresh(value){
  if(!w.CaptionIALicenseStore||!w.CaptionIALicenseStore.setRefresh(value))throw new Error('Não foi possível salvar a sessão localmente.');
}
function getRefresh(){try{return w.CaptionIALicenseStore?w.CaptionIALicenseStore.getRefresh():'';}catch(_e){return'';}}
function clearRefresh(){try{if(w.CaptionIALicenseStore)w.CaptionIALicenseStore.remove();}catch(_e){}}
function setMessage(text,type){
  var el=d.getElementById('cia-auth-message');if(!el)return;el.textContent=text||'';el.className='cia-auth-message'+(type?' '+type:'');
}
function setBusy(on,text){
  var form=d.getElementById('cia-login-form'),btn=d.getElementById('cia-login-submit');
  if(form){var fields=form.querySelectorAll('input,button');for(var i=0;i<fields.length;i++)fields[i].disabled=!!on;}
  if(btn)btn.textContent=on?(text||'Entrando...'):'Entrar';
}
function gateHtml(){
  return '<div class="cia-auth-shell"><div class="cia-auth-card">'
    +'<div class="cia-auth-mark">C</div><div class="cia-auth-kicker">CAPTION IA · LICENÇA</div>'
    +'<h1>Entre para continuar.</h1>'
    +'<p class="cia-auth-copy">Use a mesma conta criada no site do Caption IA. Sua licença fica vinculada a este computador.</p>'
    +'<form id="cia-login-form" class="cia-login-form">'
    +'<label>E-mail<input id="cia-login-email" type="email" autocomplete="username" required></label>'
    +'<label>Senha<input id="cia-login-password" type="password" autocomplete="current-password" required></label>'
    +'<button id="cia-login-submit" class="cia-auth-primary" type="submit">Entrar</button></form>'
    +'<div id="cia-auth-message" class="cia-auth-message"></div>'
    +'<div class="cia-auth-links"><button id="cia-create-account" type="button">Criar conta</button><button id="cia-buy-license" type="button">Comprar licença</button></div>'
    +'</div></div>';
}
function ensureGate(){
  if(gate)return gate;
  gate=d.createElement('div');gate.id='cia-auth-gate';gate.innerHTML=gateHtml();d.body.appendChild(gate);
  var form=d.getElementById('cia-login-form');
  if(form)form.addEventListener('submit',function(ev){ev.preventDefault();login((d.getElementById('cia-login-email')||{}).value||'',(d.getElementById('cia-login-password')||{}).value||'');});
  var c=d.getElementById('cia-create-account');if(c)c.addEventListener('click',function(){openSite('/criar-conta');});
  var b=d.getElementById('cia-buy-license');if(b)b.addEventListener('click',function(){openSite('/#planos');});
  try{var saved=localStorage.getItem(EMAIL_KEY)||'';var email=d.getElementById('cia-login-email');if(email)email.value=saved;}catch(_e){}
  return gate;
}
function showLogin(message,type){
  authorized=false;addClass(d.documentElement,'cia-auth-pending');ensureGate().style.display='flex';
  var form=d.getElementById('cia-login-form');if(form)form.style.display='grid';
  var links=gate.querySelector('.cia-auth-links');if(links)links.style.display='flex';
  var title=gate.querySelector('h1');if(title)title.textContent='Entre para continuar.';
  var copy=gate.querySelector('.cia-auth-copy');if(copy)copy.textContent='Use a mesma conta criada no site do Caption IA. Sua licença fica vinculada a este computador.';
  var retry=d.getElementById('cia-auth-retry');if(retry&&retry.parentNode)retry.parentNode.removeChild(retry);
  setBusy(false);setMessage(message||'',type||'');
}
function showLicenseBlocked(reason){
  authorized=false;addClass(d.documentElement,'cia-auth-pending');ensureGate().style.display='flex';
  var form=d.getElementById('cia-login-form');if(form)form.style.display='none';
  var title=gate.querySelector('h1'),copy=gate.querySelector('.cia-auth-copy');
  if(reason==='version_not_allowed'){
    if(title)title.textContent='Esta versão não está incluída.';
    if(copy)copy.textContent='Sua licença não cobre esta versão do Caption IA. Atualize seu plano no site ou use uma versão compatível.';
  }else{
    if(title)title.textContent='Licença necessária.';
    if(copy)copy.textContent='Sua conta está conectada, mas ainda não possui uma licença ativa para usar o Caption IA.';
  }
  setMessage('');
  var create=d.getElementById('cia-create-account');if(create){create.textContent='Entrar com outra conta';create.onclick=function(){clearRefresh();showLogin();};}
  var buy=d.getElementById('cia-buy-license');if(buy){buy.textContent='Comprar / renovar';buy.onclick=function(){openSite('/#planos');};}
  var old=d.getElementById('cia-auth-retry');if(old&&old.parentNode)old.parentNode.removeChild(old);
  var retry=d.createElement('button');retry.type='button';retry.className='cia-auth-retry';retry.id='cia-auth-retry';retry.textContent='Já comprei · verificar novamente';
  retry.onclick=function(){retry.disabled=true;retry.textContent='Verificando...';refreshAndCheck().catch(function(e){setMessage(e.message,'error');retry.disabled=false;retry.textContent='Já comprei · verificar novamente';});};
  gate.querySelector('.cia-auth-card').appendChild(retry);
}
function userChip(){
  var header=d.querySelector('.header-actions');if(!header||d.getElementById('cia-account-chip'))return;
  var btn=d.createElement('button');btn.id='cia-account-chip';btn.className='cia-account-chip';btn.type='button';
  var initial=(currentUser&&currentUser.name?String(currentUser.name).charAt(0):'C').toUpperCase();btn.innerHTML='<span>'+initial+'</span><b>Licença</b>';
  header.insertBefore(btn,header.firstChild);
  var pop=d.createElement('div');pop.id='cia-account-popover';pop.className='cia-account-popover';
  var title=d.createElement('strong');title.textContent=currentUser&&currentUser.name?currentUser.name:'Caption IA';
  var email=d.createElement('small');email.textContent=currentUser&&currentUser.email?currentUser.email:'';
  var plan=d.createElement('div');plan.className='cia-account-plan';plan.textContent=currentLicense&&currentLicense.plan_name?currentLicense.plan_name:'Licença ativa';
  var site=d.createElement('button');site.type='button';site.textContent='Minha conta';site.onclick=function(){openSite('/minha-conta');};
  var out=d.createElement('button');out.type='button';out.textContent='Sair';out.className='danger';out.onclick=logout;
  pop.appendChild(title);pop.appendChild(email);pop.appendChild(plan);pop.appendChild(site);pop.appendChild(out);d.body.appendChild(pop);
  btn.onclick=function(ev){ev.stopPropagation();pop.className=pop.className.indexOf(' open')>=0?'cia-account-popover':'cia-account-popover open';var r=btn.getBoundingClientRect();pop.style.top=(r.bottom+6)+'px';pop.style.right='8px';};
  d.addEventListener('click',function(){pop.className='cia-account-popover';});pop.addEventListener('click',function(ev){ev.stopPropagation();});
}
function unlock(user,license){
  authorized=true;currentUser=user||currentUser;currentLicense=license||currentLicense;lastCheck=Date.now();
  removeClass(d.documentElement,'cia-auth-pending');addClass(d.documentElement,'cia-auth-authorized');
  if(gate)gate.style.display='none';userChip();
  try{
    var ev;
    if(typeof CustomEvent==='function')ev=new CustomEvent('captionia:license-ready',{detail:{user:currentUser,license:currentLicense}});
    else{ev=d.createEvent('CustomEvent');ev.initCustomEvent('captionia:license-ready',false,false,{user:currentUser,license:currentLicense});}
    d.dispatchEvent(ev);
  }catch(_e){}
}
function checkLicense(token,userHint){
  return request('GET','/license/check?version='+encodeURIComponent(VERSION),null,token).then(function(data){
    currentLicense=data.license||null;
    if(data.allowed){
      return request('GET','/me',null,token).then(function(me){currentUser=(me&&me.user)||userHint||currentUser;unlock(currentUser,currentLicense);return data;});
    }
    showLicenseBlocked(data.reason||'no_active_license');return data;
  });
}
function refreshAndCheck(){
  var rt=getRefresh();if(!rt){showLogin();return Promise.reject(new Error('Faça login para continuar.'));}
  return request('POST','/auth/refresh',{refresh_token:rt,device_uuid:deviceUuid()},null).then(function(data){
    if(!data.refresh_token||!data.access_token)throw new Error('Resposta de sessão incompleta.');
    storeRefresh(data.refresh_token);accessToken=data.access_token;return checkLicense(accessToken,null);
  }).catch(function(err){
    if(err.status===400||err.status===401){clearRefresh();showLogin(err.message,'error');}
    else showLogin('Não foi possível validar sua licença agora. Verifique sua conexão e tente novamente.','error');
    throw err;
  });
}
function login(email,password){
  email=String(email||'').trim().toLowerCase();password=String(password||'');
  if(!email||!password){setMessage('Informe e-mail e senha.','error');return;}
  setBusy(true,'Validando...');
  var info=deviceInfo();
  request('POST','/auth/login',{email:email,password:password,device_uuid:deviceUuid(),device_name:info.name,os:info.os},null).then(function(data){
    if(!data.refresh_token||!data.access_token)throw new Error('Resposta de login incompleta.');
    storeRefresh(data.refresh_token);accessToken=data.access_token;currentUser=data.user||null;currentLicense=data.license||null;
    try{localStorage.setItem(EMAIL_KEY,email);if(w.fsCofreGravarAgora)w.fsCofreGravarAgora();}catch(_e){}
    return checkLicense(accessToken,currentUser);
  }).catch(function(err){showLogin(err.message||'Não foi possível entrar.','error');}).then(function(){setBusy(false);},function(){setBusy(false);});
}
function logout(){
  var rt=getRefresh();clearRefresh();accessToken='';authorized=false;currentUser=null;currentLicense=null;
  var chip=d.getElementById('cia-account-chip');if(chip&&chip.parentNode)chip.parentNode.removeChild(chip);
  var pop=d.getElementById('cia-account-popover');if(pop&&pop.parentNode)pop.parentNode.removeChild(pop);
  if(rt)request('POST','/auth/logout',{refresh_token:rt},null)['catch'](function(){});
  showLogin();
}
function boot(){
  ensureGate();var rt=getRefresh();
  if(!rt){showLogin();return;}
  var form=d.getElementById('cia-login-form');if(form)form.style.display='none';
  var title=gate.querySelector('h1');if(title)title.textContent='Validando sua licença...';
  var copy=gate.querySelector('.cia-auth-copy');if(copy)copy.textContent='Você não precisa entrar novamente a cada vez que abrir o Premiere.';
  setMessage('Conectando ao servidor de licenças...','loading');refreshAndCheck()['catch'](function(){});
}
function guard(ev){
  if(authorized)return;
  var target=ev.target;if(target&&gate&&gate.contains(target))return;
  if(target&&target.closest&&target.closest('#cia-auth-gate'))return;
  ev.preventDefault();ev.stopPropagation();
}
d.addEventListener('click',guard,true);d.addEventListener('keydown',guard,true);

w.CaptionIALicense={
  isAuthorized:function(){return authorized;},
  getState:function(){return{authorized:authorized,user:currentUser,license:currentLicense,lastCheck:lastCheck,version:VERSION};},
  assert:function(){if(!authorized)throw new Error('Licença do Caption IA necessária.');return true;},
  recheck:function(){return refreshAndCheck();},
  apiRequest:function(method,path,body){
    if(!authorized||!accessToken)return Promise.reject(new Error('Licença não validada.'));
    return request(method,path,body,accessToken);
  },
  getAccessToken:function(){return authorized?accessToken:'';},
  logout:logout
};

if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
setInterval(function(){if(authorized)refreshAndCheck()['catch'](function(){});},12*60*1000);
w.addEventListener('focus',function(){if(authorized&&Date.now()-lastCheck>10*60*1000)refreshAndCheck()['catch'](function(){});});
})(window,document);
