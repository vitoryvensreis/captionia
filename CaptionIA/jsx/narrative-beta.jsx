/* Caption IA / narrative preview — Adobe ExtendScript (ES3, separate from compiled hostscript).
   Strict single talking-head track + linked audio guard. Original sequence NEVER edited here. */
(function(){
    var TICKS=254016000000;
    var hostTrace=[];
    function hostNote(phase,detail){if(hostTrace.length<22)hostTrace.push({phase:String(phase).slice(0,48),detail:String(detail||'').slice(0,105)});}
    function ok(o){o.ok=true;o.hostTrace=hostTrace.slice(0);hostTrace=[];return JSON.stringify(o);}
    function error(msg){var result={ok:false,error:String(msg),code:'NARRATIVE_HOST_GUARD',hostTrace:hostTrace.slice(0)};hostTrace=[];return JSON.stringify(result);}
    function byID(id){var seqs=app.project.sequences;for(var i=0;i<seqs.numSequences;i++){var s=seqs[i];if(String(s.sequenceID)===String(id))return s;}return null;}
    function active(){return app&&app.project&&app.project.activeSequence;}
    function secs(v){return Number(v&&v.seconds!==undefined?v.seconds:v);}
    function mediaItem(clip){return clip&&clip.projectItem;}
    function normalized(s){return String(s||'').toLowerCase().replace(/ç/g,'c').replace(/[ãáàâ]/g,'a').replace(/[éê]/g,'e').replace(/í/g,'i').replace(/[óôõ]/g,'o').replace(/ú/g,'u');}
    function videoInfo(xml){
        var value='';try{if(typeof ExternalObject!=='undefined'&&!ExternalObject.AdobeXMPScript)ExternalObject.AdobeXMPScript=new ExternalObject('lib:AdobeXMPScript');if(typeof XMPMeta!=='undefined'){var xmp=new XMPMeta(xml),p=xmp.getProperty('http://ns.adobe.com/premierePrivateProjectMetaData/1.0/','Column.Intrinsic.VideoInfo');if(p)value=String(p.value!==undefined?p.value:p);}}catch(e){}
        if(!value){var element=/<(?:[\w]+:)?Column\.Intrinsic\.VideoInfo[^>]*>([\s\S]*?)<\//i.exec(xml),attribute=/(?:[\w]+:)?Column\.Intrinsic\.VideoInfo\s*=\s*["']([^"']+)["']/i.exec(xml);value=element?element[1]:attribute?attribute[1]:'';}return value;
    }
    function mediaState(item){
        if(!item||!item.getMediaPath)throw Error('Use mídia local com áudio e vídeo; sequências aninhadas não são suportadas.');
        if(item.isOffline&&item.isOffline())throw Error('Há mídia offline. Religue os arquivos antes da montagem.');
        var path=String(item.getMediaPath()||''),file=new File(path);
        if(!path||!file.exists)throw Error('Arquivo de mídia não encontrado: '+path);
        var xml=String(item.getProjectMetadata?item.getProjectMetadata():''),size=/(\d{2,6})\s*[x×]\s*(\d{2,6})/.exec(videoInfo(xml));
        if(!size)throw Error('Dimensões da mídia indisponíveis para validar o Movimento.');
        return {path:file.fsName,size:Number(file.length),modified:file.modified?Number(file.modified.getTime()):0,width:Number(size[1]),height:Number(size[2])};
    }
    // CEP returns Scale as 100, 1.0 (fraction), '100%' or a two-value array
    // depending on the Premiere build / Scale Width mode. Only neutral scale
    // passes; genuinely scaled clips remain blocked, as subclips drop Motion.
    function neutralScale(value){
        function neutralNumber(n){return isFinite(n)&&(Math.abs(n-100)<=.05||Math.abs(n-1)<=.0005);}
        if(value instanceof Array||Object.prototype.toString.call(value)==='[object Array]'){
            if(value.length<1||value.length>2)return false;
            for(var i=0;i<value.length;i++)if(!neutralScale(value[i]))return false;
            return true;
        }
        if(typeof value==='string'){
            var txt=value.replace(/\s/g,'').replace(',','.');
            if(!/^[-+]?[0-9]+(?:\.[0-9]+)?%?$/.test(txt))return false;
            return txt.indexOf('%')!==-1?Math.abs(parseFloat(txt)-100)<=.05:neutralNumber(Number(txt));
        }
        return neutralNumber(Number(value));
    }
    function debugValue(value){
        var text='';try{text=JSON.stringify(value);}catch(e){text=String(value);}
        return String(text).slice(0,80);
    }
    function plainClipState(clip,isAudio,media){
        var result=[],i,j,component,p,label,name,v,allowed,center;
        if(!clip.components)throw Error('Não foi possível verificar os efeitos do take.');
        for(i=0;i<clip.components.numItems;i++){
            component=clip.components[i];name=normalized(component.displayName);var match=String(component.matchName||'');
            allowed=isAudio?/^(volume|channel volume|volume do canal|panner|panoramica|panoramico|panoramizador)$/.test(name):/^(motion|movimento|opacity|opacidade|time remapping|remapeamento de tempo)$/.test(name);
            if(!allowed)throw Error('A montagem por subclipes não preserva o efeito "'+component.displayName+'". Use takes brutos ou faça uma cópia renderizada para esta etapa.');
            var props=[];
            for(j=0;j<component.properties.numItems;j++){
                p=component.properties[j];label=normalized(p.displayName);
                if(p.isTimeVarying&&p.isTimeVarying())throw Error('O take contém animação em '+component.displayName+'. A prévia não pode preservar esses keyframes.');
                v=p.getValue();props.push({name:String(p.displayName),value:v});
                if(name==='motion'||name==='movimento'){
                    // Only technical Adobe property metadata; never log a clip name, media path or dialogue.
                    hostNote('motion.property',label.slice(0,45)+' = '+debugValue(v).slice(0,32));
                    if(label==='position'||label==='posicao'||label==='anchor point'||label==='ponto de ancoragem'){
                        center=v&&v.length===2&&((Math.abs(Number(v[0])-.5)<.001&&Math.abs(Number(v[1])-.5)<.001)||(Math.abs(Number(v[0])-media.width/2)<.1&&Math.abs(Number(v[1])-media.height/2)<.1));
                        if(!center)throw Error('O take tem enquadramento alterado. A montagem por subclipes não preserva Movimento; use takes brutos.');
                    }else if(/^(scale|escala|scale width|largura da escala|largura de escala|dimensionar largura|dimensao largura)$/.test(label)){if(!neutralScale(v))throw Error('O take contém escala alterada ou sem leitura segura ('+p.displayName+': '+debugValue(v)+'). Use takes brutos na Montagem.');}
                    else if(/^(rotation|rotacao|anti-flicker filter|filtro anticintilacao|filtro anticintilante)$/.test(label)){if(Math.abs(Number(v))>.001)throw Error('O take contém rotação/filtro de Movimento alterado.');}
                    else if(label==='uniform scale'||label==='escala uniforme'){if(!v)throw Error('Escala não uniforme não é preservada na montagem.');}
                    else throw Error('Parâmetro de Movimento não reconhecido: '+p.displayName+'. Não consigo garantir a preservação.');
                }else if(name==='opacity'||name==='opacidade'){
                    if(label==='opacity'||label==='opacidade'){if(Math.abs(Number(v)-100)>.01)throw Error('Opacidade alterada não é preservada na montagem.');}
                    else if(label==='blend mode'||label==='modo de mesclagem'){
                        // CEP can expose either its UI enum, a numeric enum or the
                        // localized label. Never block an untouched Normal blend
                        // solely because getValue() used another representation.
                        var blend=normalized(v).replace(/^\s+|\s+$/g,''),code=Number(v);
                        if(!(blend==='normal'||blend==='padrao'||blend==='default'||(isFinite(code)&&(code===0||code===1||code===18))))
                            throw Error('Modo de mesclagem diferente de Normal ou sem identificação segura (tipo '+typeof v+', valor '+String(v).slice(0,24)+'). Ajuste o clipe para Normal antes de montar.');
                    }
                    else throw Error('Máscaras/ajustes de Opacidade não são preservados na montagem.');
                }else if(name==='time remapping'||name==='remapeamento de tempo'){
                    if(!/^(speed|velocidade)$/.test(label)||Math.abs(Number(v)-100)>.01)throw Error('Remapeamento de tempo não é preservado na montagem.');
                }else if(/^(volume|channel volume|volume do canal)$/.test(name)){
                    if(/^(bypass|ignorar|desvio)$/.test(label)){if(v)throw Error('Bypass de áudio alterado.');}
                    else if(/^(level|nivel|left|right|esquerda|direita|channel [0-9]+|canal [0-9]+)$/.test(label)){if(Math.abs(Number(v)-1)>.00001)throw Error('Volume do take alterado. Renderize uma cópia para preservar o tratamento.');}
                    else throw Error('Ajuste de áudio não reconhecido: '+p.displayName+'. Não consigo preservá-lo por subclipe.');
                }else if(/^(balance|balanco|pan|panoramica)$/.test(label)){if(Math.abs(Number(v))>.00001)throw Error('Panorama de áudio alterado não é preservado.');}
                else throw Error('Panorama de áudio não reconhecido; a montagem foi bloqueada para preservar seu tratamento.');
            }
            result.push({matchName:match,name:String(component.displayName),properties:props});
        }
        return result;
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
        if(hasExtraTracks(seq))throw Error('Use somente V1 e A1 com takes brutos. Faixas adicionais não são preservadas por esta montagem.');
        var video=[],audio=[];var tr,i,c;
        for(i=0;i<seq.videoTracks.numTracks;i++){tr=seq.videoTracks[i];if(tr.clips.numItems){trackSafe(tr);if(video.length)throw Error('BETA: use somente uma faixa de vídeo com falas; outras faixas devem estar vazias.');for(var j=0;j<tr.clips.numItems;j++){c=tr.clips[j];if(!mediaItem(c)||!mediaItem(c).createSubClip)throw Error('Item sem mídia editável na faixa de vídeo.');if(c.isAdjustmentLayer&&c.isAdjustmentLayer())throw Error('Faixa contém camada de ajuste.');if(c.getSpeed&&Math.abs(Number(c.getSpeed())-1)>.001)throw Error('Velocidade alterada não é suportada na BETA.');
             var vs=secs(c.start),ve=secs(c.end),ins=secs(c.inPoint),outs=secs(c.outPoint),media=mediaState(mediaItem(c));if(Math.abs((ve-vs)-(outs-ins))>.12)throw Error('Um clipe tem velocidade/remapeamento incompatível.');video.push({index:j,start:vs,end:ve,inPoint:ins,outPoint:outs,name:String(c.name),nodeId:String(mediaItem(c).nodeId||''),media:media,effects:plainClipState(c,false,media)});}}
        }
        if(!video.length)throw Error('A sequência não tem vídeos na faixa V1.');
        for(i=0;i<seq.audioTracks.numTracks;i++){tr=seq.audioTracks[i];if(tr.clips.numItems){trackSafe(tr);if(audio.length)throw Error('BETA: múltiplas faixas de áudio não são suportadas nesta revisão.');for(var k=0;k<tr.clips.numItems;k++){c=tr.clips[k];var am=mediaState(mediaItem(c));audio.push({start:secs(c.start),end:secs(c.end),inPoint:secs(c.inPoint),outPoint:secs(c.outPoint),nodeId:String(mediaItem(c)&&mediaItem(c).nodeId||''),media:am,effects:plainClipState(c,true,am)});}}}
        if(audio.length!==video.length)throw Error('Áudio separado/não alinhado: use takes com áudio vinculado na A1.');
        for(i=0;i<video.length;i++){if(Math.abs(audio[i].start-video[i].start)>.01||Math.abs(audio[i].end-video[i].end)>.01||Math.abs(audio[i].inPoint-video[i].inPoint)>.01||Math.abs(audio[i].outPoint-video[i].outPoint)>.01||audio[i].nodeId!==video[i].nodeId)throw Error('Áudio e vídeo não estão alinhados à mesma mídia no take '+(i+1)+'.');}
        video.sort(function(a,b){return a.start-b.start;});
        for(i=1;i<video.length;i++)if(video[i].start<video[i-1].end-.02)throw Error('Clipes sobrepostos não são suportados nesta BETA.');
        var result={sequenceID:String(seq.sequenceID),clips:video,audio:audio,clipCount:video.length,frameDuration:frameDuration(seq),settings:seq.getSettings()};
        result.signature=JSON.stringify(result);result.sequenceName=String(seq.name);return result;
    }
    function hasExtraTracks(seq){var i;for(i=1;i<seq.videoTracks.numTracks;i++)if(seq.videoTracks[i].clips.numItems)return true;for(i=1;i<seq.audioTracks.numTracks;i++)if(seq.audioTracks[i].clips.numItems)return true;return false;}
    function makePreview(args){
        var original=byID(args.sequenceID);if(!original)throw Error('Sequência original não encontrada: reabra o projeto.');
        var previous=app.project.activeSequence;
        if(!previous||(String(previous.sequenceID)!==String(original.sequenceID)&&String(previous.sequenceID)!==String(args.currentPreviewId||'')))throw Error('A sequência ativa mudou. Volte à original ou à prévia desta montagem.');
        var snap=snapshot(original);if(!args.sourceSignature||args.sourceSignature!==snap.signature)throw Error('Mídia, efeitos ou cortes da original mudaram desde a análise. Refaça a montagem.');
        if(!args.cuts||!args.cuts.length||args.cuts.length>100)throw Error('Plano vazio ou grande demais.');
        var cuts=[],i,j,c,ref,source,clip;var sourceTrack=original.videoTracks[0],frame=frameDuration(original);
        for(i=0;i<args.cuts.length;i++){
            c=args.cuts[i];var a=Number(c.start),b=Number(c.end);if(!isFinite(a)||!isFinite(b)||b-a<.18)throw Error('Intervalo inválido no trecho '+(i+1));
            ref=null;for(j=0;j<snap.clips.length;j++)if(a>=snap.clips[j].start-.035&&b<=snap.clips[j].end+.035){ref=snap.clips[j];break;}
            if(!ref)throw Error('Trecho cruza clipes/cortes: '+(i+1));
            clip=sourceTrack.clips[ref.index];source=mediaItem(clip);if(!source||!source.createSubClip)throw Error('Fonte incompatível.');
            var offsetStart=ref.inPoint+(a-ref.start),offsetEnd=ref.inPoint+(b-ref.start);
            if(offsetStart<ref.inPoint-.035||offsetEnd>ref.outPoint+.035)throw Error('Intervalo fora da fonte.');
            // Align SOURCE in/out once to the timeline frame grid, not independently
            // after insertion. The resulting media intervals are the source of truth.
            var minTime=Math.ceil((ref.inPoint-.000001)/frame)*frame;
            var maxTime=Math.floor((ref.outPoint+.000001)/frame)*frame;
            offsetStart=Math.max(minTime,Math.min(maxTime,snapFrame(offsetStart,frame)));
            offsetEnd=Math.max(minTime,Math.min(maxTime,snapFrame(offsetEnd,frame)));
            if(offsetEnd-offsetStart<.18-frame*.01)throw Error('Trecho '+(i+1)+' ficou curto após alinhar aos frames.');
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
            if(preview.videoTracks[0].clips.numItems!==subclips.length)throw Error('A quantidade de clipes gerados difere do plano.');
            for(i=1;i<layout.length;i++)if(Math.abs(layout[i].destStart-layout[i-1].destEnd)>epsilon)throw Error('Detectado espaço entre os clipes '+i+' e '+(i+1));
            app.project.openSequence(preview.sequenceID);
            return {previewId:String(preview.sequenceID),duration:cursor,layout:layout,previewSignature:snapshot(preview).signature,created:true};
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
    $.global.fsNarrativeBetaSnapshot=function(){try{hostTrace=[];hostNote('snapshot.start','checking source tracks and effect defaults');return ok(snapshot());}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaPreview=function(payload){try{hostTrace=[];hostNote('preview.start','verify clone and source intervals');if(typeof JSON==='undefined')throw Error('JSON indisponível no ExtendScript.');return ok(makePreview(JSON.parse(payload)));}catch(e){return error(e.message);}};
    $.global.fsNarrativeBetaRestore=function(payload){try{var d=JSON.parse(payload),seq=byID(d.sequenceID);if(!seq)throw Error('Sequência anterior não encontrada');if(!d.sourceSignature||snapshot(seq).signature!==d.sourceSignature)throw Error('A original mudou desde a análise. Refaça a transcrição antes de continuar o Auto Edit.');app.project.openSequence(seq.sequenceID);return ok({restored:true});}catch(e){return error(e.message);}};
})();
