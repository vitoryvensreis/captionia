/* Caption IA 3.6 — one host IPC gateway for EDITABLE JSX adapters.
 * Only known methods may be invoked. No payloads or user content in logs.
 * The compiled legacy hostscript is left untouched for existing functionality.
 */
(function(root){'use strict';
 var allow={
  captioniaSplitInspect:1,captioniaSplitApply:1,captioniaSplitRestore:1,
  fsNarrativeBetaSnapshot:1,fsNarrativeBetaPreview:1,
  fsNarrativeBetaValidatePreview:1,fsNarrativeBetaRestore:1,fsNarrativeBetaCloneForRetake:1
 };
 function record(action,status,elapsed,err){
  if(root&&root.CaptionIADiagnostics)root.CaptionIADiagnostics.record('premiere.'+action,status,{elapsedMs:elapsed,code:err?'HOST_OPERATION_FAILED':null,detail:err||null});
 }

 function trackHostTrace(name,trace){
  if(!Array.isArray(trace)||!root||!root.CaptionIADiagnostics)return;
  trace.slice(-150).forEach(function(step){
   if(!step||typeof step!=='object')return;
   root.CaptionIADiagnostics.record('premiere.host-step','info',{
    operation:name,phase:String(step.phase||'host').slice(0,55),
    detail:String(step.detail||'').slice(0,235)
   });
  });
 }
 function invoke(name,data,options){return new Promise(function(resolve,reject){
  if(!allow[name])return reject(Error('Operação Adobe não autorizada: '+name));
  var cs=root.csInterface;
  if(!cs||typeof cs.evalScript!=='function')return reject(Error('Abra o Caption IA dentro do Premiere.'));
  var started=Date.now(),settled=false,timeout=options&&Number(options.timeoutMs)||45000;
  timeout=Math.max(5000,Math.min(120000,timeout));
  var timer=setTimeout(function(){finish(Error('O Premiere não respondeu à operação '+name+'. Verifique o estado da sequência antes de repetir.'));},timeout);
  function finish(error,value){
   if(settled)return;settled=true;clearTimeout(timer);
   record(name,error?'failed':'ok',Date.now()-started,error&&error.message);
   if(error)reject(error);else resolve(value);
  }
  try{cs.evalScript(name+'('+JSON.stringify(JSON.stringify(data||{}))+')',function(raw){
   try{
    if(!raw||raw==='EvalScript error.')throw Error('Ponte Adobe não conseguiu executar '+name+'.');
    var value=JSON.parse(String(raw));
    if(value)trackHostTrace(name,value.hostTrace);
    if(!value||value.ok!==true)throw Error(value&&value.error||'A operação não foi confirmada no Premiere.');
    finish(null,value);
   }catch(e){finish(e);}
  });}catch(e){finish(e);}
 });}
 var api=Object.freeze({call:invoke,recent:function(){return root&&root.CaptionIADiagnostics?root.CaptionIADiagnostics.recent():[];},version:'3.6.4'});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CaptionIABridge=api;
})(typeof window!=='undefined'?window:null);
