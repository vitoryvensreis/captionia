/* Caption IA - aviso de versão disponível pelo endpoint autenticado.
 * O ZIP é baixado em Minha Conta, após validação da licença no servidor.
 */
(function(w,d){'use strict';
var last=0,checking=false;
function parts(v){return String(v||'').replace(/^v/i,'').split(/[-+]/)[0].split('.').map(function(n){return parseInt(n,10)||0;});}
function newer(next,current){
 var a=parts(next),b=parts(current);
 for(var i=0;i<3;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}
 return false;
}
function notify(version){
 if(d.getElementById('cia-update-notice'))return;
 var bar=d.querySelector('.header-actions')||d.querySelector('.app-header');
 if(!bar)return;
 var button=d.createElement('button');
 button.id='cia-update-notice';button.type='button';
 button.textContent='Atualização '+version;
 button.title='Abrir Minha Conta para baixar a versão autorizada';
 button.style.cssText='font-size:11px;border:1px solid #657286;border-radius:6px;background:#1a2737;color:#f1f5f9;padding:6px 10px;margin:0 5px;cursor:pointer';
 button.addEventListener('click',function(){
  var url='https://caption.escotilhaprodutora.com/minha-conta';
  try{new CSInterface().openURLInDefaultBrowser(url);}catch(e){try{w.open(url,'_blank');}catch(x){}}
 });
 bar.appendChild(button);
}
function check(){
 if(checking||Date.now()-last<15*60*1000)return;
 var license=w.CaptionIALicense;
 if(!license||!license.isAuthorized||!license.isAuthorized())return;
 checking=true;last=Date.now();
 license.apiRequest('GET','/releases/latest',null).then(function(data){
  if(!data||!data.available||!data.release)return;
  var state=license.getState&&license.getState();
  var current=state&&state.version?state.version:'3.4.1';
  if(newer(data.release.version,current))notify(data.release.version);
 }).catch(function(){}).then(function(){checking=false;},function(){checking=false;});
}
function setup(){check();setInterval(check,10*60*1000);w.addEventListener('focus',check);}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',setup);else setup();
})(window,document);
