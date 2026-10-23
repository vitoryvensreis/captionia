/* Caption IA diagnostic events: metadata only, no media, transcripts, passwords or API keys. */
(function(root,doc){'use strict';
 var KEY='captionia_diagnostics_v1',MAX=120,limit=220;
 function sanitize(value){
  var s=String(value==null?'':value).slice(0,limit*4);
  s=s.replace(/\b(?:gsk_[\w-]+|sk-[\w-]+|Bearer\s+[\w.\-]+)\b/gi,'[SECRET]');
  s=s.replace(/[A-Za-z]:\\(?:[^\\\s]+\\)+[^\s]*/g,'[LOCAL_PATH]');
  s=s.replace(/(?:\/[\w.\-]+){3,}/g,'[PATH]');
  s=s.replace(/\b[\w.%+\-]+@[\w.\-]+\.[a-z]{2,}\b/gi,'[EMAIL]');
  return s.slice(0,limit);
 }
 function load(){try{var v=JSON.parse(root.localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.slice(-MAX):[];}catch(e){return [];}}
 var events=load(),seq=events.length?Number(events[events.length-1].n)||0:0;
 function save(){try{root.localStorage.setItem(KEY,JSON.stringify(events));}catch(e){}}
 function record(action,status,meta){
  if(!/^[a-z0-9._-]{1,80}$/i.test(String(action)))action='unknown';
  var item={n:++seq,at:new Date().toISOString(),action:action,status:/^(ok|start|failed|warning|info)$/.test(status)?status:'info'};
  if(meta&&typeof meta==='object'){
   item.meta={};Object.keys(meta).slice(0,7).forEach(function(k){
    if(!/^(code|detail|elapsedMs|phase|operation|count|mode|result|track|before|after|matched|qeCount|step)$/.test(k))return;
    var v=meta[k];if(typeof v==='number'&&isFinite(v))item.meta[k]=v;
    else if(typeof v==='string'||typeof v==='boolean')item.meta[k]=sanitize(v);
   });
  }
  events.push(item);if(events.length>MAX)events.splice(0,events.length-MAX);save();return item;
 }
 function recent(){return events.slice();}
 function exportLog(){
  var payload=JSON.stringify({product:'Caption IA',version:'3.6.3-dev',events:recent()},null,2);
  try{
   var fs=require('fs'),path=require('path'),os=require('os');
   var dir=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'CaptionIA','Logs');
   if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
   var dest=path.join(dir,'captionia-diagnostico-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
   fs.writeFileSync(dest,payload,'utf8');return dest;
  }catch(e){
   var blob=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(blob),a=doc.createElement('a');
   a.href=url;a.download='captionia-diagnostico.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},2000);return 'Arquivo baixado';
  }
 }
 function show(){
  var old=doc.getElementById('cia-diag-overlay');if(old){old.parentNode.removeChild(old);return;}
  var layer=doc.createElement('div');layer.id='cia-diag-overlay';layer.className='cia-diag-overlay';
  var panel=doc.createElement('section');panel.className='cia-diag-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Diagnóstico Caption IA');
  panel.innerHTML='<div class="cia-diag-head"><strong>Diagnóstico de operações</strong><button type="button" data-diag="close" aria-label="Fechar">×</button></div>'+
   '<p>Etapas do Premiere, verificações de efeito, tempos de execução e erro. Não inclui mídia, falas nem chaves. Últimos 120 eventos.</p>'+
   '<pre id="cia-diag-output"></pre><div class="cia-diag-actions"><button type="button" data-diag="export">Salvar relatório</button><button type="button" data-diag="clear">Limpar</button></div><small id="cia-diag-feedback"></small>';
  layer.appendChild(panel);doc.body.appendChild(layer);
  function paint(){doc.getElementById('cia-diag-output').textContent=recent().slice(-60).map(function(e){return e.at+' · '+e.action+' · '+e.status+(e.meta?' · '+JSON.stringify(e.meta):'');}).join('\n')||'Nenhum evento registrado.';}
  layer.addEventListener('click',function(e){if(e.target===layer){layer.remove();return;}var a=e.target.getAttribute('data-diag');if(a==='close')layer.remove();if(a==='clear'){events=[];save();paint();}if(a==='export'){var path=exportLog();doc.getElementById('cia-diag-feedback').textContent='Relatório: '+sanitize(path);}});
  paint();
 }
 function mount(){if(doc.getElementById('cia-diag-btn'))return;var holder=doc.querySelector('.header-actions');if(!holder)return;
  var b=doc.createElement('button');b.type='button';b.className='icon-btn cia-diag-trigger';b.id='cia-diag-btn';b.textContent='◉';b.title='Diagnóstico de operações';b.setAttribute('aria-label','Ver logs de diagnóstico');b.addEventListener('click',show);holder.appendChild(b);
 }
 var api={record:record,recent:recent,exportLog:exportLog,show:show,mount:mount};root.CaptionIADiagnostics=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window!=='undefined'?window:this,typeof document!=='undefined'?document:null);
