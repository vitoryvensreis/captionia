/* Caption IA: word-safe silence cuts and reviewable repeats. ES5 for CEP. */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CaptionIASpeechCuts = api;
}(typeof window !== 'undefined' ? window : this, function () {
    'use strict';
    var TICKS = 254016000000, context = null;
    function finite(n) { return typeof n === 'number' && isFinite(n); }
    function wordText(w) { return String(w && (w.word || w.text) || ''); }
    function validWord(w) { return w && finite(w.start) && finite(w.end) && w.end > w.start && wordText(w).replace(/\s/g, ''); }
    function owns(resp, sequenceId) {
        return !!(resp && !resp._fsSintetico && resp._fsSeq && sequenceId && String(resp._fsSeq) === String(sequenceId) && Array.isArray(resp.words) && resp.words.some(validWord));
    }
    /* Average ENERGY across channels. Averaging the wave first cancels anti-phase audio. */
    function rmsDb(audio) {
        var rate = Number(audio && audio.sampleRate), size = Number(audio && audio.length), count = Number(audio && audio.numberOfChannels);
        if (!(rate > 0 && size > 0 && count > 0)) return null;
        var block = Math.max(1, Math.round(rate * .01)), windows = Math.floor(size / block);
        if (windows < 3) return null;
        var channels = [], out = new Float32Array(windows), c, n, p, energy, value;
        for (c = 0; c < count; c++) channels.push(audio.getChannelData(c));
        for (n = 0; n < windows; n++) {
            energy = 0;
            for (p = n * block; p < (n + 1) * block; p++) for (c = 0; c < count; c++) {
                value = channels[c][p]; if (finite(value)) energy += value * value;
            }
            out[n] = 10 * Math.log(energy / (block * count) + 1e-20) / Math.LN10;
        }
        return out;
    }
    function union(spans) {
        var sorted = (spans || []).filter(function (s) { return s && finite(s.s) && finite(s.e) && s.e > s.s; }).map(function (s) { return {s: Math.max(0, s.s), e: s.e}; }).sort(function (a, b) { return a.s - b.s; }), out = [];
        sorted.forEach(function (s) { var last = out[out.length - 1]; if (last && s.s <= last.e + 1e-8) last.e = Math.max(last.e, s.e); else out.push(s); });
        return out;
    }
    function guardSilenceCuts(spans, resp, cfg, identity) {
        cfg = cfg || {}; identity = identity || {};
        var candidates = union(spans), result = [], changed = 0, dropped = 0, protectedCount = 0;
        var fps = finite(identity.fps) && identity.fps > 0 ? identity.fps : Number(cfg.fps) || 30, frame = 1 / fps;
        var hasWords = !!(resp && Array.isArray(resp.words) && resp.words.length), verified = owns(resp, identity.seq);
        if (hasWords && !verified) throw Error('A transcrição não pertence à sequência ativa ou usa tempos estimados. Transcreva novamente antes de cortar.');
        var before = Math.max(.06, Number(cfg.marginBefore) / 1000 || 0), after = Math.max(.09, Number(cfg.marginAfter) / 1000 || 0);
        var protectedSpans = verified ? union(resp.words.filter(validWord).map(function (w) { protectedCount++; return {s: Math.max(0, w.start - before), e: w.end + after}; })) : [];
        var minimum = verified ? Math.max(.18, Number(cfg.minDur) || 0, 2 * frame) : Math.max(.45, Number(cfg.minDur) || 0);
        candidates.forEach(function (candidate) {
            var pieces = [{s: candidate.s, e: candidate.e}], original = candidate.e - candidate.s;
            if (!verified) pieces = [{s: candidate.s + Math.max(.12, after), e: candidate.e - Math.max(.12, before)}];
            protectedSpans.forEach(function (word) {
                var next = [];
                pieces.forEach(function (piece) {
                    if (word.e <= piece.s || word.s >= piece.e) { next.push(piece); return; }
                    if (word.s > piece.s) next.push({s: piece.s, e: Math.min(piece.e, word.s)});
                    if (word.e < piece.e) next.push({s: Math.max(piece.s, word.e), e: piece.e});
                }); pieces = next;
            });
            var kept = 0;
            pieces.forEach(function (piece) {
                /* Inward rounding cannot reintroduce a protected word at the frame boundary. */
                var a = Math.ceil((piece.s - 1e-8) / frame) * frame, b = Math.floor((piece.e + 1e-8) / frame) * frame;
                if (b - a + 1e-8 >= minimum) { result.push({s: a, e: b}); kept += b - a; }
            });
            if (kept < .000001) dropped++;
            if (kept < original - frame * .001) changed++;
        });
        return {cortes: result, recuos: changed, descartados: dropped, protectedWords: protectedCount, verified: verified, semRelogio: false,
            warning: verified ? '' : 'Sem transcrição por palavra: usei margens conservadoras. Transcreva para ativar a proteção real das falas.'};
    }
    function normalize(word) { return String(word || '').toLowerCase().replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c').replace(/[^a-z0-9]/g, ''); }
    var STOP = {a:1,o:1,e:1,de:1,do:1,da:1,os:1,as:1,um:1,uma:1,no:1,na:1,que:1,com:1,para:1,pra:1,eu:1};
    function tokens(words) { return words.map(function (w) { return normalize(wordText(w)); }); }
    function coverage(a, b) {
        var pos = 0, matches = 0;
        a.forEach(function (token) { while (pos < b.length && b[pos] !== token) pos++; if (pos < b.length) { matches++; pos++; } });
        return a.length ? matches / a.length : 0;
    }
    function take(words) {
        var out = {ini: words[0].start, fim: words[words.length-1].end, tokens: tokens(words), tempos: [], fins: [], palavras: [], pausas: [], pausasInternas: 0};
        words.forEach(function(w, i) { out.tempos.push(w.start); out.fins.push(w.end); out.palavras.push(wordText(w)); var gap=i?w.start-words[i-1].end:0; out.pausas.push(gap); if(gap>.4)out.pausasInternas++; });
        out.texto=out.palavras.join(' ');out.n=words.length;out.dur=out.fim-out.ini;out.completa=/[.!?]$/.test(out.texto);return out;
    }
    function clipSeams(identity, preferredTrack) {
        if (!identity) return [];
        var all = identity.audioClips || [], selected = all.filter(function(c){return c.track === preferredTrack;});
        if (!selected.length) selected=(identity.videoClips||[]).filter(function(c){return c.track===0;});
        if (!selected.length && all.length) selected=all.filter(function(c){return c.track===all[0].track;});
        selected=selected.slice().sort(function(a,b){return a.start-b.start;});
        var seams=[];
        for(var i=1;i<selected.length;i++){var a=selected[i-1],b=selected[i];if(b.start>=a.end-.035&&b.start-a.end<=.25)seams.push({left:a,right:b});}
        return seams;
    }
    /* Exact suffix/prefix at a real take boundary. Short matches are weaker evidence and ALWAYS require review. */
    function findSeamRepeats(resp, identity, preferredTrack) {
        if(!owns(resp,identity&&identity.seq))return [];
        var words=resp.words.filter(validWord).slice().sort(function(a,b){return a.start-b.start;}), groups=[];
        clipSeams(identity,preferredTrack).forEach(function(seam){
            var left=words.filter(function(w){return w.start>=seam.left.start-.025&&w.end<=seam.left.end+.025;}).slice(-14);
            var right=words.filter(function(w){return w.start>=seam.right.start-.025&&w.end<=seam.right.end+.025;}).slice(0,14);
            var max=Math.min(12,left.length,right.length),match=0;
            for(var size=max;size>=1;size--){var suffix=left.slice(left.length-size),prefix=right.slice(0,size),a=tokens(suffix),b=tokens(prefix),same=true,content=0,contentSeen={};
                for(var j=0;j<size;j++){if(!a[j]||a[j]!==b[j])same=false;if(a[j].length>2&&!STOP[a[j]]&&!contentSeen[a[j]]){content++;contentSeen[a[j]]=true;}}
                var short=size<5,edge=short?.18:.45,minSpan=short?.06:.6;
                var enough=short?content>=1&&a.some(function(token){return token.length>=4&&!STOP[token];}):content>=3;
                if(same&&enough&&seam.left.end-suffix[suffix.length-1].end<=edge&&prefix[0].start-seam.right.start<=edge&&suffix[suffix.length-1].end-suffix[0].start>=minSpan&&prefix[prefix.length-1].end-prefix[0].start>=minSpan){match=size;break;}
            }
            if(!match)return;
            var first=take(left.slice(left.length-match)),second=take(right.slice(0,match));
            if(first.fim>second.ini+.025)return;
            groups.push({takes:[first,second],notas:[100],tipos:['emenda'],sugestao:{take:first,motivo:'Mesmas palavras no fim de um take e no início do seguinte; proposta: preservar a primeira ocorrência.'},descartar:[second],ganhoS:second.dur,seamCandidate:true,manualReview:true,confidence:match<5?.72:1,evidence:match<5?"Coincidência exata de "+match+" palavra(s) junto a uma emenda real; intenção editorial não inferida.":"Frase repetida exatamente dos dois lados de uma emenda real.",
                aviso:'Repetição na emenda entre takes: pode ser intencional. Ouça os dois lados e marque somente se quiser remover a segunda ocorrência.'});
        });return groups;
    }
    function safeAutomaticGroup(g) {
        if(!g||g.aviso||g.seamCandidate||!g.sugestao||!g.sugestao.take||!g.sugestao.take.completa)return false;
        var kept=g.sugestao.take,discarded=g.descartar||[],kt=kept.tokens||[];
        if(kt.length<5||!discarded.length)return false;
        return discarded.every(function(t){return !t.completa&&(t.tokens||[]).length>=3&&coverage(t.tokens,kt)>=.9&&kept.ini>=t.fim-.025&&kept.ini-t.fim<=20&&t.fim-t.ini<=30;});
    }
    function enrichRepeats(result, resp, identity, preferredTrack) {
        if(!result||!Array.isArray(result.grupos))return result;
        result.grupos.forEach(function(g){g.autoSafe=safeAutomaticGroup(g);if(!g.autoSafe&&!g.aviso){g.manualReview=true;g.aviso='Pode ser repetição intencional ou uma frase completa. Ouça e marque o grupo para confirmar o corte.';}});
        findSeamRepeats(resp,identity,preferredTrack).forEach(function(g){
            var overlap=result.grupos.some(function(old){return (old.takes||[]).some(function(t){return Math.min(t.fim,g.takes[1].fim)-Math.max(t.ini,g.takes[1].ini)>.1;});});
            if(!overlap)result.grupos.push(g);
        });return result;
    }
    function setContext(identity, track) { context={identity:identity,track:track}; }
    function enrichWithContext(result, resp) { return enrichRepeats(result,resp,context&&context.identity,context&&context.track); }
    function readSequence(cs, done) {
        var finished=false,timer=setTimeout(function(){finish({ok:false,error:'O Premiere não respondeu à verificação da sequência.'});},6000);
        function finish(info){if(finished)return;finished=true;clearTimeout(timer);done(info);}
        var script='(function(){try{var s=app.project.activeSequence;if(!s)return JSON.stringify({ok:false,error:"Abra uma sequência no Premiere."});var a=[],v=[],warp=[],sig=[String(s.sequenceID),String(s.timebase)],kind,t,i,tr,c,p;for(kind=0;kind<2;kind++){var tracks=kind?s.videoTracks:s.audioTracks;for(t=0;t<tracks.numTracks;t++){tr=tracks[t];sig.push((kind?"V":"A")+t+":"+tr.clips.numItems+":"+(typeof tr.isLocked==="function"?tr.isLocked():"")+":"+(typeof tr.isMuted==="function"?tr.isMuted():typeof tr.getMute==="function"?tr.getMute():""));for(i=0;i<tr.clips.numItems;i++){c=tr.clips[i];p=c.projectItem;var item={track:t,start:Number(c.start.seconds),end:Number(c.end.seconds),nodeId:String(p&&p.nodeId||"")};(kind?v:a).push(item);if(kind&&c.components){for(var f=0;f<c.components.numItems;f++){var fx=c.components[f];if(/warp stabilizer|estabilizador de distor|estabilizador de deform|adbe warp stabilizer/i.test(String(fx.displayName||" ")+" "+String(fx.matchName||" ")))warp.push(String(c.name||"clipe"));}}sig.push([item.nodeId,String(c.start.ticks),String(c.end.ticks),String(c.inPoint.ticks),String(c.outPoint.ticks),c.getSpeed?String(c.getSpeed()):"1"].join(":"));}}}return JSON.stringify({ok:true,seq:String(s.sequenceID),fps:254016000000/Number(s.timebase),signature:sig.join("|"),audioClips:a,videoClips:v,warpClips:warp});}catch(e){return JSON.stringify({ok:false,error:String(e)});}})()';
        try {cs.evalScript(script,function(raw){try{var info=JSON.parse(String(raw||''));if(!info.ok||!info.seq||!info.signature)throw Error(info.error||'Sequência indisponível.');finish(info);}catch(e){finish({ok:false,error:e.message});}});}catch(e){finish({ok:false,error:e.message});}
    }
    return {version:'1.0.0',rmsDb:rmsDb,owns:owns,guardSilenceCuts:guardSilenceCuts,findSeamRepeats:findSeamRepeats,safeAutomaticGroup:safeAutomaticGroup,enrichRepeats:enrichRepeats,enrichWithContext:enrichWithContext,setContext:setContext,readSequence:readSequence};
}));
