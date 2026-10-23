/* Caption IA split screen. ES3 / public Premiere ExtendScript Motion. No QE/Crop. Original TrackItems remain unchanged. */
(function(){
var TICKS=254016000000;
var hostTrace=[];
function hostNote(phase,detail){if(hostTrace.length<150)hostTrace.push({phase:String(phase).slice(0,54),detail:String(detail||'').slice(0,230)});}
function response(value){value.ok=true;value.hostTrace=hostTrace.slice(0);hostTrace=[];return JSON.stringify(value);}
function error(e){var result={ok:false,error:String(e&&e.message||e),code:'SPLIT_HOST_GUARD',hostTrace:hostTrace.slice(0)};hostTrace=[];return JSON.stringify(result);}
function sec(value){return Number(value&&value.seconds!==undefined?value.seconds:value);}
function seq(){var s=app.project.activeSequence;if(!s)throw Error('Abra uma sequência do Premiere.');return s;}
function byID(id){for(var i=0;i<app.project.sequences.numSequences;i++){var s=app.project.sequences[i];if(String(s.sequenceID)===String(id))return s;}throw Error('A sequência original não está mais neste projeto.');}
function requireActive(id){if(!app.project.activeSequence||String(app.project.activeSequence.sequenceID)!==String(id))throw Error('O Premiere não abriu a cópia de trabalho. Nenhum ajuste será aplicado.');}
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
function apply(args){
 hostTrace=[];hostNote('split.start','validate native masks and selected tracks');
 var original=seq(),fresh=inspect(),presets={'side-by-side':2,'top-bottom':2,'grid-2x2':4};
 if(String(args.sequenceID)!==String(original.sequenceID)||args.signature!==fresh.signature)
  throw Error('A seleção mudou. Analise novamente antes de criar a tela dividida.');
 if(!presets[args.preset]||!args.items||args.items.length!==presets[args.preset]||args.items.length!==fresh.clips.length||(args.fit!=='fit'&&args.fit!=='fill'))
  throw Error('Plano de tela dividida inválido.');
 var columns=args.preset==='top-bottom'?1:2,rows=args.preset==='side-by-side'?1:2,used={},i,ref,clip,base=fresh.clips[0];
 for(i=0;i<fresh.clips.length;i++){
  ref=fresh.clips[i];clip=original.videoTracks[ref.track].clips[ref.index];
  if(used[ref.track])throw Error('Cada vídeo deve ficar numa faixa diferente.');
  used[ref.track]=true;
  if(Math.abs(ref.start-base.start)>fresh.frameDuration*1.01||Math.abs(ref.end-base.end)>fresh.frameDuration*1.01)
    throw Error('Os vídeos precisam começar e terminar no mesmo quadro.');
  if(!nativeCrop(clip))throw Error('O Premiere não disponibiliza os quatro controles nativos de Corte/Crop no vídeo V'+(ref.track+1)+'. Não vou criar uma tela dividida sem máscara. Atualize o Premiere ou habilite Crop para esse clipe.');
 }
 var before={};for(i=0;i<app.project.sequences.numSequences;i++)before[String(app.project.sequences[i].sequenceID)]=true;
 if(!original.clone())throw Error('Não consegui duplicar a sequência. Original intacta.');
 var target=null;for(i=0;i<app.project.sequences.numSequences;i++){
  var candidate=app.project.sequences[i];
  if(!before[String(candidate.sequenceID)]){target=candidate;break;}
 }
 if(!target)throw Error('A cópia da sequência não foi localizada. Original intacta.');
 target.name='Caption IA • Tela dividida • '+new Date().getTime();
 try{
  app.project.openSequence(target.sequenceID);requireActive(target.sequenceID);
  var panes=[],details,entry;
  for(i=0;i<args.items.length;i++){
   entry=args.items[i];ref=fresh.clips[i];
   if(entry.track!==ref.track||entry.index!==ref.index||entry.nodeId!==ref.nodeId)
    throw Error('Os clipes mudaram desde a análise.');
   details=reframe({sequenceID:String(target.sequenceID),track:entry.track,index:entry.index,
    focusX:50,focusY:50,zoom:1,columns:columns,rows:rows,
    col:i%columns,row:Math.floor(i/columns),fit:args.fit});
   panes.push({track:entry.track,index:entry.index,nativeCropAccessible:true,maskApplied:true,
    mask:details.mask,crop:details.crop});
  }
  hostNote('split.mask.finished','panes='+panes.length+' grid='+columns+'x'+rows+' mode='+args.fit);
  return {originalId:String(original.sequenceID),sequenceID:String(target.sequenceID),name:String(target.name),
   count:panes.length,created:true,originalPreserved:true,preset:args.preset,panes:panes,
   fitApplied:args.fit,requestedFit:args.fit,degraded:false,
   fillMethod:'intrinsic-crop',maskMethod:'native-motion-crop',
   warning:'Cada vídeo foi limitado à própria célula com Crop nativo. Use os controles de posição e ampliação para reenquadrar dentro dela.'};
 }catch(e){
  try{app.project.openSequence(original.sequenceID);}catch(restoreError){}
  throw Error('Tela dividida cancelada. Original intacta; a cópia incompleta permanece para revisão. '+e.message);
 }
}
// Reframing is performed on the COPY only. Native Crop is a Premiere
// intrinsic Motion control in supported builds; CEP may not expose it.
function nativeCrop(clip){
 // Never combine unrelated effect controls to invent a Crop implementation.
 // A valid set must come from ONE Crop or Motion component and be readable/writable.
 var comps=clip&&clip.components,i,j,component,prop,group,label,side,found,existing;
 if(!comps||typeof comps.numItems!=='number')return null;
 for(i=0;i<comps.numItems;i++){
  component=comps[i];group=normalize(component.displayName||'');
  if(!/^(motion|movimento|crop|cortar|recorte|recortar)$/.test(group))continue;
  if(!component.properties||typeof component.properties.numItems!=='number')continue;
  found={left:null,right:null,top:null,bottom:null};
  for(j=0;j<component.properties.numItems;j++){
   prop=component.properties[j];label=normalize(prop.displayName||'');side='';
   if(/(^|[ ._-])(esquerda|left)([ ._-]|$)/.test(label))side='left';
   if(/(^|[ ._-])(direita|right)([ ._-]|$)/.test(label))side='right';
   if(/(^|[ ._-])(superior|cima|top)([ ._-]|$)/.test(label))side='top';
   if(/(^|[ ._-])(inferior|baixo|bottom)([ ._-]|$)/.test(label))side='bottom';
   if(!side||!(group==='crop'||group==='recorte'||group==='recortar'||group==='cortar'||/crop|recort|cort/.test(label)||/^(left|right|top|bottom|esquerda|direita|superior|inferior|cima|baixo)$/.test(label)))continue;
   if(typeof prop.getValue!=='function'||typeof prop.setValue!=='function')continue;
   try{if(prop.isTimeVarying&&prop.isTimeVarying())continue;existing=Number(prop.getValue());if(!isFinite(existing)||existing<0||existing>100)continue;}catch(e){continue;}
   found[side]=prop;
  }
  if(found.left&&found.right&&found.top&&found.bottom)return found;
 }
 return null;
}
function selectPane(args){
 var target=byID(args.sequenceID);requireActive(target.sequenceID);
 if(String(target.name).indexOf('Caption IA • Tela dividida • ')!==0)throw Error('Abra a cópia criada pela Tela Dividida.');
 var t=Number(args.track),index=Number(args.index);
 if(!isFinite(t)||!isFinite(index)||t<0||index<0||t>=target.videoTracks.numTracks||index>=target.videoTracks[t].clips.numItems)
  throw Error('Vídeo não localizado na cópia.');
 var clip=target.videoTracks[t].clips[index],selected=false,i,j,tr;
 if(clip.setSelected){
  for(i=0;i<target.videoTracks.numTracks;i++){tr=target.videoTracks[i];for(j=0;j<tr.clips.numItems;j++)if(tr.clips[j].setSelected)tr.clips[j].setSelected(0,0);}
  clip.setSelected(1,1);selected=true;
 }
 hostNote('split.select','track='+t+' index='+index+' selected='+selected);
 return {selected:selected,track:t,index:index,nativeCropAccessible:!!nativeCrop(clip)};
}
// The crop sliders are enabled ONLY when all four native Crop parameters can
// actually be read and written in the current Premiere build. No QE guesswork.
function reframe(args){
 hostNote('split.reframe.start','mask position and crop');var target=byID(args.sequenceID);requireActive(target.sequenceID);if(String(target.name).indexOf('Caption IA • Tela dividida • ')!==0)throw Error('O reenquadramento só pode modificar uma cópia criada pelo Caption IA.');
 var track=Number(args.track),index=Number(args.index),focusX=Number(args.focusX),focusY=Number(args.focusY),zoom=Number(args.zoom);
 if(!isFinite(track)||!isFinite(index)||track<0||index<0||track>=target.videoTracks.numTracks||index>=target.videoTracks[track].clips.numItems)throw Error('Faixa ou clipe inválido.');
 if(!isFinite(focusX)||!isFinite(focusY)||focusX<0||focusX>100||focusY<0||focusY>100||!isFinite(zoom)||zoom<1||zoom>3)throw Error('Enquadramento fora do intervalo permitido.');
 var clip=target.videoTracks[track].clips[index],crop=nativeCrop(clip);if(!crop)throw Error('Este Premiere não expõe Crop à API CEP. Selecione este clipe e ajuste Cortar no painel Propriedades do Premiere.');
 var settings=target.getSettings(),width=Number(settings.videoFrameWidth),height=Number(settings.videoFrameHeight);
 var columns=Number(args.columns),rows=Number(args.rows),col=Number(args.col),row=Number(args.row);
 if(!((columns===1||columns===2)&&(rows===1||rows===2)&&col>=0&&col<columns&&row>=0&&row<rows))throw Error('Célula inválida.');
 var dim=dimensions(clip.projectItem),par=Number(settings.videoPixelAspectRatio)||1,slotW=width/columns,slotH=height/rows;
 var sx=slotW*par/(dim.width*dim.pixelAspect),sy=slotH/dim.height;
 var fitMode=args.fit==='fit';
 var scale=(fitMode?Math.min(sx,sy):Math.max(sx,sy))*zoom;
 var spanX=dim.width*dim.pixelAspect*scale/par,spanY=dim.height*scale;
 if(!isFinite(scale)||scale<=0||scale*100>10000)throw Error('Escala fora dos limites.');
 if(!fitMode&&(spanX<slotW-.1||spanY<slotH-.1))throw Error('A imagem não cobre totalmente a célula.');
 var extraX=Math.max(0,spanX-slotW),extraY=Math.max(0,spanY-slotH);
 var cropLeft=fitMode?0:extraX*focusX/100,cropTop=fitMode?0:extraY*focusY/100;
 var left=fitMode?0:100*cropLeft/spanX,right=fitMode?0:100*(extraX-cropLeft)/spanX;
 var top=fitMode?0:100*cropTop/spanY,bottom=fitMode?0:100*(extraY-cropTop)/spanY;
 var slotX=col*slotW,slotY=row*slotH;
 var positionX=slotX+slotW/2+(fitMode?0:(extraX/2-cropLeft));
 var positionY=slotY+slotH/2+(fitMode?0:(extraY/2-cropTop));
 var mask={x:slotX,y:slotY,width:slotW,height:slotH};
 var m=motionState(clip),position=m.normalized?[positionX/width,positionY/height]:[positionX,positionY];
 hostNote('split.reframe.plan','track='+track+' center='+positionX.toFixed(1)+','+positionY.toFixed(1)+' crop='+[left,right,top,bottom].map(function(v){return v.toFixed(2);}).join(',')+' scale='+scale.toFixed(4));
 // Preflight all parameters before writing. Premiere can reject even an advertised
 // setValue; restore every touched value on error so the COPY is not half-cropped.
 var edits=[
  {p:crop.left,value:left,name:'Crop esquerdo'},
  {p:crop.right,value:right,name:'Crop direito'},
  {p:crop.top,value:top,name:'Crop superior'},
  {p:crop.bottom,value:bottom,name:'Crop inferior'},
  {p:m.scale,value:scale*100,name:'Escala'},
  {p:m.position,value:position,name:'Posição'}
 ],previous=[],k,touched=-1,rollbackProblems=[];
 for(k=0;k<edits.length;k++){
  if(animated(edits[k].p))throw Error('O parâmetro '+edits[k].name+' tem keyframes e não pode ser reenquadrado em segurança.');
  previous.push(edits[k].p.getValue());
 }
 try{
  for(k=0;k<edits.length;k++){touched=k;propSet(edits[k].p,edits[k].value,edits[k].name);}
 }catch(failure){
  for(k=touched;k>=0;k--){
   try{propSet(edits[k].p,previous[k],edits[k].name+' original');}
   catch(restoreError){rollbackProblems.push(edits[k].name);}
  }
  hostNote('split.reframe.rollback','restored='+String(!rollbackProblems.length)+' touched='+String(touched+1));
  if(rollbackProblems.length)throw Error('Reenquadramento falhou ('+failure.message+'). Não foi possível restaurar completamente a cópia ('+rollbackProblems.join(', ')+'). Revise-a antes de continuar.');
  throw Error('Reenquadramento cancelado e estado anterior da cópia restaurado: '+failure.message);
 }
 hostNote('split.reframe.done','track='+track+' cropConfirmed=1');
 return {track:track,index:index,applied:true,cropMethod:'intrinsic',mask:mask,position:position,crop:{left:left,right:right,top:top,bottom:bottom},scale:scale*100};
}
$.global.captioniaSplitSelectPane=function(payload){try{hostTrace=[];return response(selectPane(JSON.parse(payload)));}catch(e){return error(e);}};
$.global.captioniaSplitReframe=function(payload){try{hostTrace=[];return response(reframe(JSON.parse(payload)));}catch(e){return error(e);}};
$.global.captioniaSplitInspect=function(){try{hostTrace=[];hostNote('inspect.start','reading selected Premiere clips');return response(inspect());}catch(e){return error(e);}};
$.global.captioniaSplitApply=function(payload){try{return response(apply(JSON.parse(payload)));}catch(e){return error(e);}};
$.global.captioniaSplitRestore=function(payload){try{var args=JSON.parse(payload),s=byID(args.sequenceID);app.project.openSequence(s.sequenceID);return response({restored:true,sequenceID:String(s.sequenceID)});}catch(e){return error(e);}};
})();
