/* AutoCut preflight: remove Warp Stabilizer when the supported Component.remove()
 * operation exists. Never delete clips, and refuse to cut when removal is uncertain.
 */
(function(w){'use strict';
function script(){
 return '(function(){try{'+
 'var seq=app.project.activeSequence;if(!seq)return JSON.stringify({error:"Abra uma sequência."});'+
 'var removed=0,found=0,unsupported=[],failures=[];'+
 'for(var t=0;t<seq.videoTracks.numTracks;t++){var tr=seq.videoTracks[t];'+
 'for(var i=0;i<tr.clips.numItems;i++){var clip=tr.clips[i];if(!clip||!clip.components)continue;'+
 'for(var c=clip.components.numItems-1;c>=0;c--){var fx=clip.components[c];'+
 'var name=String(fx.displayName||"");var match=String(fx.matchName||"");'+
 'if(!/warp stabilizer|estabilizador de distor|estabilizador de deform|adbe warp stabilizer/i.test(name+" "+match))continue;'+
 'found++;if(typeof fx.remove!=="function"){unsupported.push("V"+(t+1)+" / "+String(clip.name||"clipe"));continue;}'+
 'try{var result=fx.remove();if(result===false){failures.push(String(clip.name||"clipe"));}else removed++;}catch(e){failures.push(String(clip.name||"clipe")+": "+String(e));}'+
 '}}}'+
 'if(unsupported.length||failures.length)return JSON.stringify({error:"Warp Stabilizer detectado, mas a remoção automática não está disponível ou falhou. Remova o efeito manualmente antes do AutoCut.",found:found,removed:removed,unsupported:unsupported.slice(0,6),failures:failures.slice(0,6)});'+
 'return JSON.stringify({ok:true,found:found,removed:removed});'+
 '}catch(e){return JSON.stringify({error:"Falha na verificação dos efeitos: "+String(e)});}})()';
}
function install(){
 if(typeof w.fsAutoEditCorte!=='function'||!w.csInterface||typeof w.csInterface.evalScript!=='function')return;
 var original=w.fsAutoEditCorte;
 w.fsAutoEditCorte=function(done){
  if(typeof done!=='function')return;
  w.csInterface.evalScript(script(),function(raw){
   var result;
   try{result=JSON.parse(String(raw||''));}catch(e){done({ok:false,erro:'Não consegui verificar os efeitos da sequência; nenhum novo corte foi iniciado.'});return;}
   if(!result||result.error||!result.ok){
    done({ok:false,erro:result&&result.error||'Verificação de efeitos não concluída.'});return;
   }
   original(function(response){
    if(response&&response.ok&&result.removed)
      response.resumo=(response.resumo||'')+' · '+result.removed+' Warp Stabilizer removido(s) antes do corte.';
    done(response);
   });
  });
 };
}
if(w) {
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
 else install();
}
})(window);
