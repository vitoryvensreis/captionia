/* Read-only Warp Stabilizer preflight. No effects are removed automatically. */
(function (w) {
    'use strict';
    function script() {
        return '(function(){try{var seq=app.project.activeSequence;if(!seq)return JSON.stringify({ok:false,error:"Abra uma sequência."});var found=[];for(var t=0;t<seq.videoTracks.numTracks;t++){var tr=seq.videoTracks[t];for(var i=0;i<tr.clips.numItems;i++){var clip=tr.clips[i];if(!clip||!clip.components)continue;for(var c=0;c<clip.components.numItems;c++){var fx=clip.components[c],name=String(fx.displayName||""),match=String(fx.matchName||"");if(/warp stabilizer|estabilizador de distor|estabilizador de deform|adbe warp stabilizer/i.test(name+" "+match))found.push("V"+(t+1)+" / "+String(clip.name||"clipe"));}}}if(found.length)return JSON.stringify({ok:false,found:found.length,clips:found.slice(0,8),error:"Warp Stabilizer detectado. O Caption IA não remove efeitos automaticamente. Remova o efeito manualmente de uma cópia da sequência antes de cortar; nenhum corte foi iniciado."});return JSON.stringify({ok:true,found:0});}catch(e){return JSON.stringify({ok:false,error:"Não consegui conferir os efeitos: "+String(e)});}})()';
    }
    function check(cs, done) {
        try { cs.evalScript(script(), function (raw) {
            var result;
            try { result = JSON.parse(String(raw || '')); } catch (_) { result = {ok:false,error:'Não consegui verificar os efeitos da sequência; nenhum corte foi iniciado.'}; }
            done(result);
        }); } catch (e) { done({ok:false,error:'Falha na verificação dos efeitos: '+String(e)}); }
    }
    function install() {
        if (typeof w.fsAutoEditCorte !== 'function' || !w.csInterface || typeof w.csInterface.evalScript !== 'function') return;
        var original = w.fsAutoEditCorte;
        w.fsAutoEditCorte = function (done) {
            if (typeof done !== 'function') return;
            check(w.csInterface, function (result) {
                if (!result || !result.ok) { done({ok:false,erro:result&&result.error||'Verificação dos efeitos não concluída.'}); return; }
                original(done);
            });
        };
    }
    w.CaptionIAWarpGuard={check:check,buildScript:script};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
}(window));
