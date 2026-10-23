/* Caption IA / narrative preview — Adobe ExtendScript (ES3, separate from compiled hostscript).
   Strict single talking-head track + linked audio guard. Original sequence NEVER edited here. */
(function(){
    var TICKS=254016000000;
    var hostTrace=[];
    var BUILD='3.6.5-dev-r3-audio-cross-component-20261023';
    function hostNote(phase,detail){if(hostTrace.length<150)hostTrace.push({phase:String(phase).slice(0,54),detail:String(detail||'').slice(0,240)});}
    function ok(o){o.ok=true;o.hostTrace=hostTrace.slice(0);hostTrace=[];return JSON.stringify(o);}
    function error(msg){var result={ok:false,error:String(msg),code:'NARRATIVE_HOST_GUARD',hostTrace:hostTrace.slice(0)};hostTrace=[];return JSON.stringify(result);}
    function byID(id){var seqs=app.project.sequences;for(var i=0;i<seqs.numSequences;i++){var s=seqs[i];if(String(s.sequenceID)===String(id))return s;}return null;}
    function active(){return app&&app.project&&app.project.activeSequence;}
    function secs(v){return Number(v&&v.seconds!==undefined?v.seconds:v);}
    function mediaItem(clip){return clip&&clip.projectItem;}
    // Transcript-only montage. Editorial selection uses the existing timed words.
    // Do not read Premiere's localized Motion, Volume, Crop or color parameters.
    function timelineClip(c,index){
        var item=mediaItem(c);
        if(!item||!item.createSubClip)throw Error('A montagem requer vídeo importado com mídia editável na V1.');
        var start=secs(c.start),end=secs(c.end),ins=secs(c.inPoint),outs=secs(c.outPoint);
        if(!isFinite(start)||!isFinite(end)||!isFinite(ins)||!isFinite(outs)||end<=start||outs<=ins)
            throw Error('Clipe '+(index+1)+' com intervalos inválidos.');
        if(Math.abs((end-start)-(outs-ins))>.12)
            throw Error('Clipe '+(index+1)+' com velocidade ou remapeamento incompatível.');
        if(c.getSpeed&&Math.abs(Number(c.getSpeed())-1)>.001)
            throw Error('Clipe '+(index+1)+' com velocidade alterada não é suportado.');
        return {index:index,start:start,end:end,inPoint:ins,outPoint:outs,nodeId:String(item.nodeId||'')};
    }
    function trackSafe(track){
        if(track.isLocked&&track.isLocked())throw Error('Destrave as faixas de áudio e vídeo antes de gerar a prévia.');
        // Track.transitions is not exposed by every Premiere version. A missing
        // collection must not make an otherwise safe, cloned rough cut impossible.
        if(!track.transitions||typeof track.transitions.numItems==='undefined')return;
        if(track.transitions.numItems)throw Error('A montagem por subclipes não preserva transições. Use uma sequência com takes brutos.');
    }
    function frameEpsilon(seq){var t=Number(seq&&seq.timebase);return t>0?Math.max(.009,Math.min(.055,.65*t/TICKS)):.015;}
    function frameDuration(seq){
        var ticks=Number(seq&&seq.timebase),seconds=ticks/TICKS;
        if(!isFinite(seconds)||seconds<.004||seconds>.1)throw Error('Não foi possível obter a duração real do frame da sequência.');
        return seconds;
    }
    function snapFrame(seconds,frame){return Math.round(seconds/frame)*frame;}
    function sameSource(a,b){
        return a.source===b.source || (a.mediaId!==''&&a.mediaId===b.mediaId);
    }
    /* Adjacent edit segments may reference the same word. The OUT of the first MUST
       never overlap the IN of the second in original source media time, after frame snapping.
       Non-adjacent reuse of media is rejected rather than silently changing editorial intent. */
    function assertUniqueSourceFrames(cuts,frame){
        var i,j,a,b,overlap,tolerance=frame*.015,MAX_AUTO_TRIM=.45;
        for(i=0;i<cuts.length;i++){
            for(j=i+1;j<cuts.length;j++){
                a=cuts[i];b=cuts[j];
                if(!sameSource(a,b))continue;
                overlap=Math.min(a.outTime,b.outTime)-Math.max(a.inTime,b.inTime);
                if(overlap<=tolerance)continue;
                if(j===i+1 && a.inTime<b.inTime && a.outTime>b.inTime && overlap<=MAX_AUTO_TRIM){
                    // Ownership is given to the following segment: its first word is kept intact.
                    a.outTime=b.inTime;
                    a.sourceEnd=a.originStart+(a.outTime-a.originInPoint);
                    if(a.outTime-a.inTime<.18-frame*.01)throw Error('Corte em cima de palavra: trecho anterior ficaria curto. Reveja a montagem.');
                }else{
                    throw Error('A montagem reutiliza '+overlap.toFixed(3)+'s da mesma fonte em dois trechos. Reveja a seleção: não vou repetir fala.');
                }
            }
        }
        // A trimmed interval must not collide with any other media selection.
        for(i=0;i<cuts.length;i++)for(j=i+1;j<cuts.length;j++){
            a=cuts[i];b=cuts[j];
            if(sameSource(a,b) && Math.min(a.outTime,b.outTime)-Math.max(a.inTime,b.inTime)>tolerance)
                throw Error('Cortes compartilhando frames da fonte: prévia cancelada para evitar fala repetida.');
        }
        for(i=0;i<cuts.length;i++)if(cuts[i].outTime-cuts[i].inTime<.18-frame*.01)
            throw Error('Trecho curto demais depois de alinhar os cortes aos frames ('+(i+1)+').');
    }
    function snapshot(target){
        var seq=target||active();if(!seq)throw Error('Abra uma sequência no Premiere.');
        hostNote('snapshot.build','3.6.5-dev-r4-transcript-only-20261023');
        hostNote('snapshot.sequence','videoTracks='+seq.videoTracks.numTracks+' audioTracks='+seq.audioTracks.numTracks+' frameTicks='+String(seq.timebase));
        if(hasExtraTracks(seq))throw Error('A montagem simples usa V1 e A1. Mova materiais extras para outra sequência antes de gerar a prévia.');
        var video=[],audio=[],tr,i,j,c;
        for(i=0;i<seq.videoTracks.numTracks;i++){
            tr=seq.videoTracks[i];if(!tr.clips.numItems)continue;
            if(video.length)throw Error('Use apenas uma faixa de vídeo com falas.');
            for(j=0;j<tr.clips.numItems;j++){
                c=tr.clips[j];if(c.isAdjustmentLayer&&c.isAdjustmentLayer())throw Error('A V1 contém uma camada de ajuste.');
                video.push(timelineClip(c,j));
            }
        }
        if(!video.length)throw Error('A sequência não tem vídeos na V1.');
        for(i=0;i<seq.audioTracks.numTracks;i++){
            tr=seq.audioTracks[i];if(!tr.clips.numItems)continue;
            if(audio.length)throw Error('Use apenas a faixa A1 para as falas.');
            for(j=0;j<tr.clips.numItems;j++)audio.push(timelineClip(tr.clips[j],j));
        }
        if(audio.length!==video.length)throw Error('V1/A1 não estão alinhadas: cada take precisa ter seu áudio correspondente.');
        for(i=0;i<video.length;i++){
            if(Math.abs(audio[i].start-video[i].start)>.01||Math.abs(audio[i].end-video[i].end)>.01||
               Math.abs(audio[i].inPoint-video[i].inPoint)>.01||Math.abs(audio[i].outPoint-video[i].outPoint)>.01||
               (audio[i].nodeId&&video[i].nodeId&&audio[i].nodeId!==video[i].nodeId))
                throw Error('Áudio e vídeo estão fora de sincronismo no take '+(i+1)+'.');
        }
        video.sort(function(a,b){return a.start-b.start;});
        for(i=1;i<video.length;i++)if(video[i].start<video[i-1].end-.02)
            throw Error('Há sobreposição de takes na V1. Use uma timeline de fala simples.');
        var result={sequenceID:String(seq.sequenceID),clips:video,audio:audio,clipCount:video.length,frameDuration:frameDuration(seq)};
        result.signature=JSON.stringify(result);
        result.sequenceName=String(seq.name);
        result.effectNotice='A prévia utiliza a mídia de origem: efeitos, volume, cor e transições aplicados aos clipes da timeline não são copiados para os novos subclipes. Revise antes de aprovar.';
        hostNote('snapshot.transcript-only','clipCount='+video.length+' audioCount='+audio.length+' no-effect-inspection=1');
        return result;
    }
    function hasExtraTracks(seq){var i;for(i=1;i<seq.videoTracks.numTracks;i++)if(seq.videoTracks[i].clips.numItems)return true;for(i=1;i<seq.audioTracks.numTracks;i++)if(seq.audioTracks[i].clips.numItems)return true;return false;}
    function makePreview(args){
        var original=byID(args.sequenceID);if(!original)throw Error('Sequência original não encontrada: reabra o projeto.');
        var previous=app.project.activeSequence;
        if(!previous||(String(previous.sequenceID)!==String(original.sequenceID)&&String(previous.sequenceID)!==String(args.currentPreviewId||'')))throw Error('A sequência ativa mudou. Volte à original ou à prévia desta montagem.');
        var snap=snapshot(original);if(!args.sourceSignature||args.sourceSignature!==snap.signature)throw Error('Os intervalos da timeline original mudaram desde a análise. Refaça a montagem.');
        if(!args.cuts||!args.cuts.length||args.cuts.length>100)throw Error('Plano vazio ou grande demais.');
        var cuts=[],i,j,c,ref,source,clip;var sourceTrack=original.videoTracks[0],frame=frameDuration(original);
        hostNote('preview.plan','cuts='+args.cuts.length+' clips='+snap.clips.length+' frameMs='+Math.round(frame*1000));
        hostNote('preview.effects','raw-source-subclips; timeline effects not transferred');
        for(i=0;i<args.cuts.length;i++){
            c=args.cuts[i];var a=Number(c.start),b=Number(c.end);if(!isFinite(a)||!isFinite(b)||b-a<.18)throw Error('Intervalo inválido no trecho '+(i+1));
            ref=null;for(j=0;j<snap.clips.length;j++)if(a>=snap.clips[j].start-.035&&b<=snap.clips[j].end+.035){ref=snap.clips[j];break;}
            if(!ref)throw Error('Trecho cruza clipes/cortes: '+(i+1));
            clip=sourceTrack.clips[ref.index];source=mediaItem(clip);if(!source||!source.createSubClip)throw Error('Fonte incompatível.');
            if(source.isOffline&&source.isOffline())throw Error('A mídia do trecho '+(i+1)+' está offline. Religue o arquivo original.');
            var offsetStart=ref.inPoint+(a-ref.start),offsetEnd=ref.inPoint+(b-ref.start);
            if(offsetStart<ref.inPoint-.035||offsetEnd>ref.outPoint+.035)throw Error('Intervalo fora da fonte.');
            // Align SOURCE in/out once to the timeline frame grid, not independently
            // after insertion. The resulting media intervals are the source of truth.
            var minTime=Math.ceil((ref.inPoint-.000001)/frame)*frame;
            var maxTime=Math.floor((ref.outPoint+.000001)/frame)*frame;
            offsetStart=Math.max(minTime,Math.min(maxTime,snapFrame(offsetStart,frame)));
            offsetEnd=Math.max(minTime,Math.min(maxTime,snapFrame(offsetEnd,frame)));
            if(offsetEnd-offsetStart<.18-frame*.01)throw Error('Trecho '+(i+1)+' ficou curto após alinhar aos frames.');
            hostNote('preview.cut','index='+(i+1)+' inFrame='+Math.round(offsetStart/frame)+' outFrame='+Math.round(offsetEnd/frame));
            cuts.push({source:source,mediaId:String(ref.nodeId||''),originStart:ref.start,originInPoint:ref.inPoint,
                inTime:offsetStart,outTime:offsetEnd,
                sourceStart:ref.start+(offsetStart-ref.inPoint),sourceEnd:ref.start+(offsetEnd-ref.inPoint),
                description:String(c.id||'trecho')});
        }
        assertUniqueSourceFrames(cuts,frame);
        var priorIds={};for(i=0;i<app.project.sequences.numSequences;i++)priorIds[String(app.project.sequences[i].sequenceID)]=true;
        if(!original.clone())throw Error('Não consegui duplicar a sequência. Nada foi alterado no original.');
        var preview=null;for(i=0;i<app.project.sequences.numSequences;i++){var s=app.project.sequences[i];if(!priorIds[String(s.sequenceID)]){preview=s;break;}}
        if(!preview)throw Error('Clone criado, mas não foi possível localizá-lo. O original permanece intacto.');
        preview.name='Caption IA • PRÉVIA IA • '+(new Date()).getTime();
        try{
            // Preserve an untouched source sequence before any subclip/project mutation.
            var subclips=[];for(i=0;i<cuts.length;i++){
                c=cuts[i];var name='Caption IA · '+(i+1)+' · '+c.description;
                var sub=c.source.createSubClip(name,String(Math.round(c.inTime*TICKS)),String(Math.round(c.outTime*TICKS)),1,1,1);
                if(!sub)throw Error('Premiere não conseguiu criar o subclipe '+(i+1));subclips.push(sub);
            }
            var atr=preview.audioTracks[0], guard=0;
            while(atr.clips.numItems){if(++guard>3000)throw Error('Muitos clipes na A1.');var beforeA=atr.clips.numItems;atr.clips[beforeA-1].remove(0,0);if(atr.clips.numItems>=beforeA)throw Error('Não consegui remover um áudio do clone.');}
            var vtr=preview.videoTracks[0];guard=0;
            while(vtr.clips.numItems){if(++guard>3000)throw Error('Muitos clipes na V1.');var beforeV=vtr.clips.numItems;vtr.clips[beforeV-1].remove(0,0);if(vtr.clips.numItems>=beforeV)throw Error('Não consegui remover um vídeo do clone.');}
            var cursor=0,layout=[],epsilon=frameEpsilon(preview);
            for(i=0;i<subclips.length;i++){
                // O Premiere arredonda os subclipes para os limites de frame. Não acumular
                // duração solicitada: anexar cada corte ao END real do vídeo anterior.
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
                layout.push({id:args.cuts[i].id,sourceStart:cuts[i].sourceStart,sourceEnd:cuts[i].sourceEnd,
                    destStart:actualStart,destEnd:actualEnd});
                cursor=actualEnd;
            }
            hostNote('preview.result','sourceCuts='+cuts.length+' inserted='+preview.videoTracks[0].clips.numItems+' endFrame='+Math.round(cursor/frame));
            if(preview.videoTracks[0].clips.numItems!==subclips.length)throw Error('A quantidade de clipes gerados difere do plano.');
            for(i=1;i<layout.length;i++)if(Math.abs(layout[i].destStart-layout[i-1].destEnd)>epsilon)throw Error('Detectado espaço entre os clipes '+i+' e '+(i+1));
            app.project.openSequence(preview.sequenceID);
            return {previewId:String(preview.sequenceID),duration:cursor,layout:layout,previewSignature:snapshot(preview).signature,created:true,effectNotice:snap.effectNotice};
        }catch(e){app.project.openSequence(original.sequenceID);throw Error('A prévia falhou e foi isolada. Original preservado. '+e.message);}
    }
    function validatePreview(args){
        var seq=byID(args.previewId);if(!seq)throw Error('Prévia não encontrada. Gere uma nova.');
        var original=byID(args.sequenceID);if(!original||snapshot(original).signature!==args.sourceSignature)throw Error('A sequência original ou sua mídia mudou desde a análise. Gere um novo plano.');
        if(!active()||String(active().sequenceID)!==String(args.previewId))throw Error('Abra a sequência de prévia antes de aprovar.');
        if(!args.previewSignature||snapshot(seq).signature!==args.previewSignature)throw Error('Mídia, efeitos ou conteúdo da prévia foram alterados. Gere novamente antes de aprovar.');
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
    function cloneForRetake(args){
        var original=byID(args.sequenceID),current=active();
        if(!original||!current||String(original.sequenceID)!==String(current.sequenceID))
            throw Error('Abra a sequência transcrita antes de iniciar o Retake.');
        var ids={},i,copy=null;
        for(i=0;i<app.project.sequences.numSequences;i++)ids[String(app.project.sequences[i].sequenceID)]=true;
        if(!original.clone())throw Error('O Premiere não conseguiu duplicar a sequência. Original intacto.');
        for(i=0;i<app.project.sequences.numSequences;i++){
            var candidate=app.project.sequences[i];
            if(!ids[String(candidate.sequenceID)]){copy=candidate;break;}
        }
        if(!copy)throw Error('A cópia do Retake não foi localizada. Original intacto.');
        copy.name='Caption IA - RETAKE - '+(new Date()).getTime();
        try{app.project.openSequence(copy.sequenceID);}catch(e){throw Error('O Premiere não abriu a cópia. Original intacto.');}
        if(!active()||String(active().sequenceID)!==String(copy.sequenceID))
            throw Error('A cópia do Retake não ficou ativa. Não foram aplicados cortes.');
        return {sequenceID:String(original.sequenceID),previewId:String(copy.sequenceID)};
    }
    $.global.fsNarrativeBetaCloneForRetake=function(payload){try{return ok(cloneForRetake(JSON.parse(payload)));}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaValidatePreview=function(payload){try{return ok(validatePreview(JSON.parse(payload)));}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaSnapshot=function(){try{hostTrace=[];hostNote('snapshot.start','checking source tracks and effect defaults');hostNote('snapshot.build',BUILD);return ok(snapshot());}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaPreview=function(payload){try{hostTrace=[];hostNote('preview.start','verify clone and source intervals');if(typeof JSON==='undefined')throw Error('JSON indisponível no ExtendScript.');return ok(makePreview(JSON.parse(payload)));}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaRestore=function(payload){try{var d=JSON.parse(payload),seq=byID(d.sequenceID);if(!seq)throw Error('Sequência anterior não encontrada');if(!d.sourceSignature||snapshot(seq).signature!==d.sourceSignature)throw Error('A original mudou desde a análise. Refaça a transcrição antes de continuar o Auto Edit.');app.project.openSequence(seq.sequenceID);return ok({restored:true});}catch(e){return error(e.message);}};
})();
