/* Caption IA / narrative preview — Adobe ExtendScript (ES3, separate from compiled hostscript).
   Strict single talking-head track + linked audio guard. Original sequence NEVER edited here. */
(function(){
    var TICKS=254016000000;
    function ok(o){o.ok=true;return JSON.stringify(o);}
    function error(msg){return JSON.stringify({ok:false,error:String(msg)});}
    function byID(id){var seqs=app.project.sequences;for(var i=0;i<seqs.numSequences;i++){var s=seqs[i];if(String(s.sequenceID)===String(id))return s;}return null;}
    function active(){return app&&app.project&&app.project.activeSequence;}
    function secs(v){return Number(v&&v.seconds!==undefined?v.seconds:v);}
    function mediaItem(clip){return clip&&clip.projectItem;}
    function frameEpsilon(seq){var t=Number(seq&&seq.timebase);return t>0?Math.max(.009,Math.min(.055,.65*t/TICKS)):.015;}
    function snapshot(){
        var seq=active();if(!seq)throw Error('Abra uma sequência no Premiere.');
        var video=[],audio=[];var tr,i,c;
        for(i=0;i<seq.videoTracks.numTracks;i++){tr=seq.videoTracks[i];if(tr.clips.numItems){if(video.length)throw Error('BETA: use somente uma faixa de vídeo com falas; outras faixas devem estar vazias.');for(var j=0;j<tr.clips.numItems;j++){c=tr.clips[j];if(!mediaItem(c)||!mediaItem(c).createSubClip)throw Error('Item sem mídia editável na faixa de vídeo.');if(c.isAdjustmentLayer&&c.isAdjustmentLayer())throw Error('Faixa contém camada de ajuste.');if(c.getSpeed&&Math.abs(Number(c.getSpeed())-1)>.001)throw Error('Velocidade alterada não é suportada na BETA.');
             var vs=secs(c.start),ve=secs(c.end),ins=secs(c.inPoint),outs=secs(c.outPoint);if(Math.abs((ve-vs)-(outs-ins))>.12)throw Error('Um clipe tem velocidade/remapeamento incompatível.');video.push({index:j,start:vs,end:ve,inPoint:ins,outPoint:outs,name:c.name,nodeId:String(mediaItem(c).nodeId||'')});}}
        }
        if(!video.length)throw Error('A sequência não tem vídeos na faixa V1.');
        for(i=0;i<seq.audioTracks.numTracks;i++){tr=seq.audioTracks[i];if(tr.clips.numItems){if(audio.length)throw Error('BETA: múltiplas faixas de áudio não são suportadas nesta revisão.');for(var k=0;k<tr.clips.numItems;k++){c=tr.clips[k];audio.push({start:secs(c.start),end:secs(c.end),nodeId:String(mediaItem(c)&&mediaItem(c).nodeId||'')});}}}
        if(audio.length!==video.length)throw Error('Áudio separado/não alinhado: use takes com áudio vinculado na A1.');
        for(i=0;i<video.length;i++){if(Math.abs(audio[i].start-video[i].start)>.1||Math.abs(audio[i].end-video[i].end)>.1||audio[i].nodeId!==video[i].nodeId)throw Error('Áudio e vídeo não estão vinculados no take '+(i+1)+'.');}
        video.sort(function(a,b){return a.start-b.start;});
        for(i=1;i<video.length;i++)if(video[i].start<video[i-1].end-.02)throw Error('Clipes sobrepostos não são suportados nesta BETA.');
        return {sequenceID:String(seq.sequenceID),sequenceName:String(seq.name),clips:video,clipCount:video.length};
    }
    function hasExtraTracks(seq){var i;for(i=1;i<seq.videoTracks.numTracks;i++)if(seq.videoTracks[i].clips.numItems)return true;for(i=1;i<seq.audioTracks.numTracks;i++)if(seq.audioTracks[i].clips.numItems)return true;return false;}
    function makePreview(args){
        var original=byID(args.sequenceID);if(!original)throw Error('Sequência original não encontrada: reabra o projeto.');
        var previous=app.project.activeSequence;app.project.openSequence(original.sequenceID);
        var snap=snapshot();if(hasExtraTracks(original))throw Error('Existem faixas adicionais: não vou mexer nelas.');
        if(!args.cuts||!args.cuts.length||args.cuts.length>100)throw Error('Plano vazio ou grande demais.');
        var cuts=[],i,j,c,ref,source,clip;var sourceTrack=original.videoTracks[0];
        for(i=0;i<args.cuts.length;i++){
            c=args.cuts[i];var a=Number(c.start),b=Number(c.end);if(!isFinite(a)||!isFinite(b)||b-a<.18)throw Error('Intervalo inválido no trecho '+(i+1));
            ref=null;for(j=0;j<snap.clips.length;j++)if(a>=snap.clips[j].start-.035&&b<=snap.clips[j].end+.035){ref=snap.clips[j];break;}
            if(!ref)throw Error('Trecho cruza clipes/cortes: '+(i+1));
            clip=sourceTrack.clips[ref.index];source=mediaItem(clip);if(!source||!source.createSubClip)throw Error('Fonte incompatível.');
            var offsetStart=ref.inPoint+(a-ref.start),offsetEnd=ref.inPoint+(b-ref.start);
            if(offsetStart<ref.inPoint-.035||offsetEnd>ref.outPoint+.035)throw Error('Intervalo fora da fonte.');
            cuts.push({source:source,inTime:offsetStart,outTime:offsetEnd,description:String(c.id||'trecho')});
        }
        var subclips=[];for(i=0;i<cuts.length;i++){
            c=cuts[i];var name='Caption IA · '+(i+1)+' · '+c.description;
            var sub=c.source.createSubClip(name,String(Math.round(c.inTime*TICKS)),String(Math.round(c.outTime*TICKS)),1,1,1);
            if(!sub)throw Error('Premiere não conseguiu criar o subclipe '+(i+1));subclips.push(sub);
        }
        var priorIds={};for(i=0;i<app.project.sequences.numSequences;i++)priorIds[String(app.project.sequences[i].sequenceID)]=true;
        if(!original.clone())throw Error('Não consegui duplicar a sequência. Nada foi alterado no original.');
        var preview=null;for(i=0;i<app.project.sequences.numSequences;i++){var s=app.project.sequences[i];if(!priorIds[String(s.sequenceID)]){preview=s;break;}}
        if(!preview)throw Error('Clone criado, mas não foi possível localizá-lo. O original permanece intacto.');
        preview.name='Caption IA • PRÉVIA IA • '+(new Date()).getTime();
        try{
            var atr=preview.audioTracks[0], guard=0;
            while(atr.clips.numItems){if(++guard>3000)throw Error('Muitos clipes na A1.');var beforeA=atr.clips.numItems;atr.clips[beforeA-1].remove(0,0);if(atr.clips.numItems>=beforeA)throw Error('Não consegui remover um áudio do clone.');}
            var vtr=preview.videoTracks[0];guard=0;
            while(vtr.clips.numItems){if(++guard>3000)throw Error('Muitos clipes na V1.');var beforeV=vtr.clips.numItems;vtr.clips[beforeV-1].remove(0,0);if(vtr.clips.numItems>=beforeV)throw Error('Não consegui remover um vídeo do clone.');}
            var cursor=0,layout=[],epsilon=frameEpsilon(preview);
            for(i=0;i<subclips.length;i++){
                // Usar o fim REAL do clipe anterior. Subclipes sofrem arredondamento de frames.
                var t=new Time();t.seconds=cursor;
                var beforeCount=vtr.clips.numItems;
                preview.insertClip(subclips[i],t,0,0);
                if(vtr.clips.numItems!==beforeCount+1)throw Error('Não consegui inserir o trecho '+(i+1)+'.');
                var created=vtr.clips[vtr.clips.numItems-1];
                var actualStart=secs(created.start),actualEnd=secs(created.end);
                if(Math.abs(actualStart-cursor)>epsilon)throw Error('O Premiere deixou um espaço antes do trecho '+(i+1)+' ('+Math.abs(actualStart-cursor).toFixed(3)+'s).');
                if(actualEnd<=actualStart)throw Error('O trecho '+(i+1)+' foi inserido sem duração.');
                var aCreated=atr.clips[atr.clips.numItems-1];
                if(!aCreated||Math.abs(secs(aCreated.start)-actualStart)>epsilon||Math.abs(secs(aCreated.end)-actualEnd)>epsilon)throw Error('Áudio e vídeo dessincronizados no trecho '+(i+1)+'.');
                layout.push({id:args.cuts[i].id,sourceStart:Number(args.cuts[i].start),sourceEnd:Number(args.cuts[i].end),destStart:actualStart,destEnd:actualEnd});
                cursor=actualEnd;
            }
            if(preview.videoTracks[0].clips.numItems!==subclips.length)throw Error('A quantidade de clipes gerados difere do plano.');
            for(i=1;i<layout.length;i++)if(Math.abs(layout[i].destStart-layout[i-1].destEnd)>epsilon)throw Error('Detectado espaço entre os clipes '+i+' e '+(i+1));
            app.project.openSequence(preview.sequenceID);
            return {previewId:String(preview.sequenceID),duration:cursor,layout:layout,created:true};
        }catch(e){app.project.openSequence(original.sequenceID);throw Error('A prévia falhou e foi isolada. Original preservado. '+e.message);}
    }
    function validatePreview(args){
        var seq=byID(args.previewId);if(!seq)throw Error('Prévia não encontrada. Gere uma nova.');
        if(!active()||String(active().sequenceID)!==String(args.previewId))throw Error('Abra a sequência de prévia antes de aprovar.');
        if(!args.layout||seq.videoTracks[0].clips.numItems!==args.layout.length)throw Error('A quantidade de clipes da prévia foi alterada. Gere outra prévia.');
        var audio=seq.audioTracks[0],video=seq.videoTracks[0],out=[],i,actualV,actualA,planned,begin,end,epsilon=frameEpsilon(seq);
        if(audio.clips.numItems!==video.clips.numItems)throw Error('Faixa de áudio foi alterada.');
        for(i=0;i<video.clips.numItems;i++){
            actualV=video.clips[i];actualA=audio.clips[i];planned=args.layout[i];begin=secs(actualV.start);end=secs(actualV.end);
            if(Math.abs(begin-Number(planned.destStart))>epsilon||Math.abs(end-Number(planned.destEnd))>epsilon)throw Error('A prévia foi alterada após a criação. Gere novamente.');
            if(i===0&&Math.abs(begin)>epsilon)throw Error('A prévia começa com espaço vazio.');
            if(i>0&&Math.abs(begin-out[i-1].destEnd)>epsilon)throw Error('Encontrado espaço na prévia entre os trechos '+i+' e '+(i+1));
            if(Math.abs(secs(actualA.start)-begin)>epsilon||Math.abs(secs(actualA.end)-end)>epsilon)throw Error('A1 ficou dessincronizada no trecho '+(i+1));
            out.push({id:planned.id,sourceStart:planned.sourceStart,sourceEnd:planned.sourceEnd,destStart:begin,destEnd:end});
        }
        return {layout:out};
    }
    $.global.fsNarrativeBetaValidatePreview=function(payload){try{return ok(validatePreview(JSON.parse(payload)));}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaSnapshot=function(){try{return ok(snapshot());}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaPreview=function(payload){try{if(typeof JSON==='undefined')throw Error('JSON indisponível no ExtendScript.');return ok(makePreview(JSON.parse(payload)));}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaRestore=function(payload){try{var d=JSON.parse(payload),seq=byID(d.sequenceID);if(!seq)throw Error('Sequência anterior não encontrada');app.project.openSequence(seq.sequenceID);return ok({restored:true});}catch(e){return error(e.message);}};
})();