/* Caption IA split screen. ES3 / Premiere ExtendScript. Original TrackItems are never moved or rebuilt. */
(function(){
var TICKS=254016000000;
function response(value){value.ok=true;return JSON.stringify(value);}
function error(e){return JSON.stringify({ok:false,error:String(e&&e.message||e)});}
function sec(value){return Number(value&&value.seconds!==undefined?value.seconds:value);}
function seq(){var s=app.project.activeSequence;if(!s)throw Error('Abra uma sequência do Premiere.');return s;}
function byID(id){for(var i=0;i<app.project.sequences.numSequences;i++){var s=app.project.sequences[i];if(String(s.sequenceID)===String(id))return s;}throw Error('A sequência original não está mais neste projeto.');}
function requireActive(id){if(!app.project.activeSequence||String(app.project.activeSequence.sequenceID)!==String(id))throw Error('O Premiere não abriu a cópia de trabalho. Nenhum ajuste será aplicado.');}
function qeSequence(id){requireActive(id);var current=qe.project.getActiveSequence(),expected=String(id).replace(/[{}]/g,'').toLowerCase();
 var a=current&&current.sequenceID,b=current&&current.guid;
 if(!current||String(a||'').replace(/[{}]/g,'').toLowerCase()!==expected&&String(b||'').replace(/[{}]/g,'').toLowerCase()!==expected)throw Error('Não consegui confirmar que o adaptador Crop está na cópia. Use Ajustar.');return current;
}
function normalize(s){return String(s||'').toLowerCase().replace(/[ç]/g,'c').replace(/[ãáàâ]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i').replace(/[óôõ]/g,'o').replace(/[ú]/g,'u');}
function property(component,names){for(var i=0;i<component.properties.numItems;i++){var p=component.properties[i],label=normalize(p.displayName),match=String(p.matchName||'');for(var j=0;j<names.length;j++)if(label===names[j]||match===names[j])return p;}return null;}
function motion(clip){for(var i=0;i<clip.components.numItems;i++){var c=clip.components[i];if(c.matchName==='AE.ADBE Motion'||normalize(c.displayName)==='motion'||normalize(c.displayName)==='movimento')return c;}throw Error('Movimento não disponível no clipe '+clip.name+'.');}
function animated(p){try{return !!(p.isTimeVarying&&p.isTimeVarying());}catch(e){throw Error('Não consegui verificar animação de Movimento.');}}
function value(p,label){if(!p||typeof p.getValue!=='function')throw Error('Parâmetro '+label+' não reconhecido neste Premiere.');if(animated(p))throw Error('O Movimento contém keyframes. Use clipes sem animação para a tela dividida.');return p.getValue();}
function motionState(clip){var m=motion(clip),position=property(m,['position','posicao','ADBE Position']),scale=property(m,['scale','escala','ADBE Scale']),rotation=property(m,['rotation','rotacao','ADBE Rotate Z']),anchor=property(m,['anchor point','ponto de ancoragem','ADBE Anchor Point']),uniform=property(m,['uniform scale','escala uniforme']);
 var pos=value(position,'Posição'),s=value(scale,'Escala'),rot=Number(value(rotation,'Rotação')),a=value(anchor,'Ponto de ancoragem');
 if(!pos||pos.length!==2||!a||a.length!==2||!isFinite(Number(s)))throw Error('Valores de Movimento incompatíveis.');
 if(Math.abs(rot)>.001)throw Error('Remova a rotação do Movimento antes de dividir a tela.');
 if(uniform&&!value(uniform,'Escala uniforme'))throw Error('Ative Escala uniforme no Movimento antes de dividir a tela.');
 return {position:position,scale:scale,anchor:anchor,pos:pos,scaleValue:Number(s),anchorValue:a,normalized:Math.abs(Number(pos[0]))<=10&&Math.abs(Number(pos[1]))<=10};
}
function videoInfo(xml){
 var value='';try{if(typeof ExternalObject!=='undefined'&&!ExternalObject.AdobeXMPScript)ExternalObject.AdobeXMPScript=new ExternalObject('lib:AdobeXMPScript');if(typeof XMPMeta!=='undefined'){var xmp=new XMPMeta(xml),p=xmp.getProperty('http://ns.adobe.com/premierePrivateProjectMetaData/1.0/','Column.Intrinsic.VideoInfo');if(p)value=String(p.value!==undefined?p.value:p);}}catch(e){}
 if(!value){var element=/<(?:[\w]+:)?Column\.Intrinsic\.VideoInfo[^>]*>([\s\S]*?)<\//i.exec(xml),attribute=/(?:[\w]+:)?Column\.Intrinsic\.VideoInfo\s*=\s*["']([^"']+)["']/i.exec(xml);value=element?element[1]:attribute?attribute[1]:'';}return value;
}
function dimensions(item){
 if(!item||!item.getMediaPath||!item.getMediaPath())throw Error('Use arquivos de vídeo locais; sequências aninhadas e gráficos não são suportados.');
 if(item.isOffline&&item.isOffline())throw Error('Há mídia offline na seleção.');
 var file=new File(item.getMediaPath());if(!file.exists)throw Error('Mídia não encontrada: '+file.fsName);
 var meta=String(item.getProjectMetadata?item.getProjectMetadata():''),m=/(\d{2,6})\s*[x×]\s*(\d{2,6})/.exec(videoInfo(meta));
 if(!m)throw Error('Dimensões da mídia indisponíveis no Premiere. Atualize os metadados da mídia e tente novamente.');
 var par=1;try{var interpretation=item.getFootageInterpretation();if(interpretation&&interpretation.pixelAspectRatio)par=Number(interpretation.pixelAspectRatio);}catch(e){}
 if(!isFinite(par)||par<=0)throw Error('Proporção de pixel da mídia inválida.');
 return {width:Number(m[1]),height:Number(m[2]),pixelAspect:par,path:file.fsName,size:Number(file.length),modified:file.modified?Number(file.modified.getTime()):0};
}
function inspect(){var s=seq(),settings=s.getSettings(),frame=Number(s.timebase)/TICKS,clips=[],i,j,tr,c,d,m,anchorX,anchorY;
 if(!isFinite(frame)||frame<=0)throw Error('Taxa de quadros da sequência indisponível.');
 for(i=0;i<s.videoTracks.numTracks;i++){tr=s.videoTracks[i];for(j=0;j<tr.clips.numItems;j++){c=tr.clips[j];if(!c.isSelected||!c.isSelected())continue;
  if(tr.isLocked&&tr.isLocked())throw Error('Destrave a faixa V'+(i+1)+'.');
  if(c.isAdjustmentLayer&&c.isAdjustmentLayer())throw Error('Camadas de ajuste não podem ocupar uma célula.');
  if(c.getSpeed&&Math.abs(Number(c.getSpeed())-1)>.001||c.isSpeedReversed&&c.isSpeedReversed())throw Error('Velocidade alterada não é suportada na tela dividida.');
  d=dimensions(c.projectItem);m=motionState(c);anchorX=Number(m.anchorValue[0]);anchorY=Number(m.anchorValue[1]);
  if(!((Math.abs(anchorX-.5)<.001&&Math.abs(anchorY-.5)<.001)||(Math.abs(anchorX-d.width/2)<.1&&Math.abs(anchorY-d.height/2)<.1)))throw Error('Centralize o ponto de ancoragem de '+c.name+' antes de dividir.');
  clips.push({track:i,index:j,nodeId:String(c.nodeId||''),mediaId:String(c.projectItem.nodeId||''),name:String(c.name),start:sec(c.start),end:sec(c.end),inPoint:sec(c.inPoint),outPoint:sec(c.outPoint),width:d.width,height:d.height,pixelAspect:d.pixelAspect,path:d.path,size:d.size,modified:d.modified,position:m.pos,scale:m.scaleValue});
 }}
 if(clips.length!==2&&clips.length!==4)throw Error('Selecione dois ou quatro vídeos simultâneos, em faixas diferentes.');
 var result={sequenceID:String(s.sequenceID),name:String(s.name),width:Number(settings.videoFrameWidth),height:Number(settings.videoFrameHeight),pixelAspect:Number(settings.videoPixelAspectRatio)||1,frameDuration:frame,clips:clips};
 result.signature=JSON.stringify(result);return result;
}
function propSet(p,v,label){var result=p.setValue(v,1);if(result===false)throw Error('Premiere recusou '+label+'.');var actual=p.getValue();if(v instanceof Array){if(!actual||actual.length!==v.length)throw Error('Não consegui conferir '+label+'.');for(var i=0;i<v.length;i++)if(Math.abs(Number(actual[i])-v[i])>.002)throw Error('Premiere não confirmou '+label+'.');}else if(Math.abs(Number(actual)-v)>.02)throw Error('Premiere não confirmou '+label+'.');}
function crop(clip,track,index,values,expectedID){
 if(values.left<.0001&&values.top<.0001&&values.right<.0001&&values.bottom<.0001)return;
 if(typeof qe==='undefined')app.enableQE();if(typeof qe==='undefined')throw Error('Preencher requer o Crop do adaptador QE (não documentado). Use Ajustar para trabalhar só com Movimento da API pública.');
 var effect=qe.project.getVideoEffectByName('Crop');if(!effect)effect=qe.project.getVideoEffectByName('Cortar');if(!effect)effect=qe.project.getVideoEffectByName('Recortar');if(!effect)throw Error('Efeito Crop não localizado. Use Ajustar.');
 var count=clip.components.numItems,qt=qeSequence(expectedID).getVideoTrackAt(track),target=null;
 // QE may return localized names or timecode values. Match timeline frame boundaries
 // first; refuse ambiguities rather than attaching Crop to the wrong clip.
 if(!qt)throw Error('Adaptador Crop não encontrou a faixa de vídeo V'+(track+1)+'. Use Ajustar.');
 var fpsFrame=Number(app.project.activeSequence.timebase)/TICKS;
 var maxDelta=isFinite(fpsFrame)&&fpsFrame>0?fpsFrame*.55:.020;
 var matching=[],qeItems=[];
 for(var i=0;i<qt.numItems;i++){
  var item=qt.getItemAt(i);if(!item||typeof item.addVideoEffect!=='function')continue;
  qeItems.push(item);
  var start=sec(item.start),end=sec(item.end),sourceStart=sec(clip.start),sourceEnd=sec(clip.end);
  if(!isFinite(start)||!isFinite(sourceStart)||Math.abs(start-sourceStart)>maxDelta)continue;
  if(isFinite(end)&&isFinite(sourceEnd)&&Math.abs(end-sourceEnd)>maxDelta)continue;
  matching.push(item);
 }
 if(matching.length===1)target=matching[0];
 // Some QE builds do not expose numeric times at all. A single video clip on
 // the mapped track is unambiguous; otherwise do not guess.
 if(!target&&matching.length===0&&qeItems.length===1&&index===0&&app.project.activeSequence.videoTracks[track].clips.numItems===1)target=qeItems[0];
 if(!target)throw Error('Crop não identificou um clipe único na V'+(track+1)+' (QE: '+qeItems.length+', correspondências: '+matching.length+'). Use Ajustar.');
 qeSequence(expectedID);target.addVideoEffect(effect);
 if(clip.components.numItems!==count+1)throw Error('Premiere não confirmou a adição do efeito Crop.');
 var component=clip.components[clip.components.numItems-1];
 var left=property(component,['left','esquerda']),right=property(component,['right','direita']),top=property(component,['top','topo','superior']),bottom=property(component,['bottom','inferior','base']);
 if(!left||!right||!top||!bottom)throw Error('Parâmetros Crop não reconhecidos. Use Ajustar.');
 propSet(left,values.left,'recorte esquerdo');propSet(right,values.right,'recorte direito');propSet(top,values.top,'recorte superior');propSet(bottom,values.bottom,'recorte inferior');
}
function apply(args){var original=seq(),fresh=inspect();if(String(args.sequenceID)!==String(original.sequenceID)||args.signature!==fresh.signature)throw Error('A seleção ou sequência mudou. Prepare a tela dividida novamente.');
 var presets={'side-by-side':2,'top-bottom':2,'grid-2x2':4};if(!presets[args.preset]||!args.items||args.items.length!==presets[args.preset]||args.items.length!==fresh.clips.length||(args.fit!=='fit'&&args.fit!=='fill'))throw Error('Plano de layout inválido.');
 var columns=args.preset==='top-bottom'?1:2,rows=args.preset==='side-by-side'?1:2,tracks={},base=fresh.clips[0];
 for(i=0;i<fresh.clips.length;i++){var check=fresh.clips[i];if(tracks[check.track])throw Error('Cada vídeo precisa ocupar uma faixa diferente.');tracks[check.track]=true;if(Math.abs(check.start-base.start)>fresh.frameDuration*1.01||Math.abs(check.end-base.end)>fresh.frameDuration*1.01)throw Error('Alinhe início e fim dos vídeos no mesmo frame antes de dividir a tela.');}
 var ids={},i,c,target;for(i=0;i<app.project.sequences.numSequences;i++)ids[String(app.project.sequences[i].sequenceID)]=true;
 if(!original.clone())throw Error('Não consegui criar a cópia de segurança. Nenhum clipe foi ajustado.');
 for(i=0;i<app.project.sequences.numSequences;i++)if(!ids[String(app.project.sequences[i].sequenceID)]){target=app.project.sequences[i];break;}
 if(!target)throw Error('Não localizei o clone. A sequência original está preservada.');
 target.name='Caption IA • Tela dividida • '+new Date().getTime();
 try{app.project.openSequence(target.sequenceID);requireActive(target.sequenceID);for(i=0;i<args.items.length;i++){
  var entry=args.items[i],ref=fresh.clips[i];if(entry.track!==ref.track||entry.index!==ref.index||entry.nodeId!==ref.nodeId)throw Error('Plano não corresponde à seleção.');
  // Recompute geometry on the host from the current media; never trust client scale/crop values.
  var slotW=fresh.width/columns,slotH=fresh.height/rows,sx=slotW*fresh.pixelAspect/(ref.width*ref.pixelAspect),sy=slotH/ref.height,scale=args.fit==='fill'?Math.max(sx,sy):Math.min(sx,sy);
  var pos=[(i%columns+.5)/columns,(Math.floor(i/columns)+.5)/rows];
  c=target.videoTracks[entry.track].clips[entry.index];var m=motionState(c),position=m.normalized?pos:[pos[0]*fresh.width,pos[1]*fresh.height];
  if(!isFinite(scale)||scale<=0||scale*100>10000)throw Error('Enquadramento inválido.');
  requireActive(target.sequenceID);propSet(m.scale,scale*100,'escala');propSet(m.position,position,'posição');
  if(args.fit==='fill'){var cropX=Math.max(0,(1-slotW*fresh.pixelAspect/(ref.width*ref.pixelAspect*scale))*50),cropY=Math.max(0,(1-slotH/(ref.height*scale))*50);crop(c,entry.track,entry.index,{left:cropX,right:cropX,top:cropY,bottom:cropY},target.sequenceID);}
 }
 return {originalId:String(original.sequenceID),sequenceID:String(target.sequenceID),name:String(target.name),count:args.items.length,created:true,originalPreserved:true};
 }catch(e){app.project.openSequence(original.sequenceID);throw Error('Tela dividida cancelada; original preservada. A cópia incompleta permanece no projeto para revisão. '+e.message);}
}
$.global.captioniaSplitInspect=function(){try{return response(inspect());}catch(e){return error(e);}};
$.global.captioniaSplitApply=function(payload){try{return response(apply(JSON.parse(payload)));}catch(e){return error(e);}};
$.global.captioniaSplitRestore=function(payload){try{var args=JSON.parse(payload),s=byID(args.sequenceID);app.project.openSequence(s.sequenceID);return response({restored:true,sequenceID:String(s.sequenceID)});}catch(e){return error(e);}};
})();
