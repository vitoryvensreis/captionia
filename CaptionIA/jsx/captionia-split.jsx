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
function apply(args){hostTrace=[];hostNote('split.start','checking selected tracks');var original=seq(),fresh=inspect();hostNote('split.selection','clips='+fresh.clips.length+' frameMs='+Math.round(fresh.frameDuration*1000));if(String(args.sequenceID)!==String(original.sequenceID)||args.signature!==fresh.signature)throw Error('A seleção ou sequência mudou. Prepare a tela dividida novamente.');
 var presets={'side-by-side':2,'top-bottom':2,'grid-2x2':4};if(!presets[args.preset]||!args.items||args.items.length!==presets[args.preset]||args.items.length!==fresh.clips.length||(args.fit!=='fit'&&args.fit!=='fill'))throw Error('Plano de layout inválido.');
 var columns=args.preset==='top-bottom'?1:2,rows=args.preset==='side-by-side'?1:2,tracks={},base=fresh.clips[0];
 for(i=0;i<fresh.clips.length;i++){var check=fresh.clips[i];if(tracks[check.track])throw Error('Cada vídeo precisa ocupar uma faixa diferente.');tracks[check.track]=true;if(Math.abs(check.start-base.start)>fresh.frameDuration*1.01||Math.abs(check.end-base.end)>fresh.frameDuration*1.01)throw Error('Alinhe início e fim dos vídeos no mesmo frame antes de dividir a tela.');}
 var ids={},i,c,target;for(i=0;i<app.project.sequences.numSequences;i++)ids[String(app.project.sequences[i].sequenceID)]=true;
 if(!original.clone())throw Error('Não consegui criar a cópia de segurança. Nenhum clipe foi ajustado.');
 for(i=0;i<app.project.sequences.numSequences;i++)if(!ids[String(app.project.sequences[i].sequenceID)]){target=app.project.sequences[i];break;}
 if(!target)throw Error('Não localizei o clone. A sequência original está preservada.');
 hostNote('split.clone','created=1 copyActive='+String(target.sequenceID!==original.sequenceID));
 target.name='Caption IA • Tela dividida • '+new Date().getTime();
 try{app.project.openSequence(target.sequenceID);requireActive(target.sequenceID);var effectiveFit=args.fit,warning='';for(i=0;i<args.items.length;i++){
  var entry=args.items[i],ref=fresh.clips[i];if(entry.track!==ref.track||entry.index!==ref.index||entry.nodeId!==ref.nodeId)throw Error('Plano não corresponde à seleção.');
  // Recompute geometry on the host from the current media; never trust client scale/crop values.
  var slotW=fresh.width/columns,slotH=fresh.height/rows,sx=slotW*fresh.pixelAspect/(ref.width*ref.pixelAspect),sy=slotH/ref.height,scale=args.fit==='fill'?Math.max(sx,sy):Math.min(sx,sy);
  // For fill, align the OUTSIDE edge of each scaled image to the INNER
  // cell boundary. The Premiere program frame itself clips everything outside
  // its canvas. This yields real two-up/four-up fill without QE or Crop.
  // The edit is reversible and cannot spill into an adjacent pane.
  var col=i%columns,row=Math.floor(i/columns);
  var x=columns===1?fresh.width/2:(col===0?slotW-ref.width*scale/2*ref.pixelAspect/fresh.pixelAspect:slotW+ref.width*scale/2*ref.pixelAspect/fresh.pixelAspect);
  var y=rows===1?fresh.height/2:(row===0?slotH-ref.height*scale/2:slotH+ref.height*scale/2);
  if(effectiveFit==='fit'){
   scale=Math.min(sx,sy);
   x=(col+.5)*slotW;y=(row+.5)*slotH;
  }
  if(!isFinite(scale)||scale<=0||scale*100>10000||!isFinite(x)||!isFinite(y))throw Error('Enquadramento inválido.');
  var m=motionState(target.videoTracks[entry.track].clips[entry.index]);
  var position=m.normalized?[x/fresh.width,y/fresh.height]:[x,y];
  requireActive(target.sequenceID);
  hostNote('split.geometry','track='+entry.track+' col='+col+' row='+row+' mode='+effectiveFit+' scalePct='+Math.round(scale*10000)/100+' px='+Math.round(x)+','+Math.round(y));
  propSet(m.scale,scale*100,'escala');propSet(m.position,position,'posição');
  if(effectiveFit==='fill'){
   warning='Preencher aplicado pelo recorte das bordas da sequência, sem efeito Crop/QE. Revise o enquadramento das pessoas: ajustes livres exigem Crop via UXP.';
   hostNote('split.edge-clip','track='+entry.track+' successful=true noQE=true');
  }

 }
 hostNote('split.finished','clips='+args.items.length+' requested='+args.fit+' actual='+effectiveFit+' frameMs='+Math.round(fresh.frameDuration*1000));
 return {originalId:String(original.sequenceID),sequenceID:String(target.sequenceID),name:String(target.name),count:args.items.length,created:true,originalPreserved:true,fitApplied:effectiveFit,requestedFit:args.fit,degraded:effectiveFit!==args.fit,fillMethod:effectiveFit==='fill'?'canvas-edge':'native-motion-fit',panes:args.items.map(function(item){return {track:item.track,index:item.index};}),preset:args.preset,warning:warning};
 }catch(e){app.project.openSequence(original.sequenceID);throw Error('Tela dividida cancelada; original preservada. A cópia incompleta permanece no projeto para revisão. '+e.message);}
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
 var target=byID(args.sequenceID);requireActive(target.sequenceID);if(String(target.name).indexOf('Caption IA • Tela dividida • ')!==0)throw Error('Selecione primeiro uma cópia criada pela Tela Dividida.');
 var t=Number(args.track),index=Number(args.index);
 if(!isFinite(t)||!isFinite(index)||t<0||index<0||t>=target.videoTracks.numTracks||index>=target.videoTracks[t].clips.numItems)throw Error('Vídeo não localizado na cópia.');
 var tr,i,j;for(i=0;i<target.videoTracks.numTracks;i++){tr=target.videoTracks[i];for(j=0;j<tr.clips.numItems;j++){if(tr.clips[j].setSelected)tr.clips[j].setSelected(0,0);}}
 var clip=target.videoTracks[t].clips[index];if(!clip.setSelected)throw Error('Esta versão do Premiere não permite selecionar o clipe pela extensão.');
 clip.setSelected(1,1);hostNote('split.reframe.select','track='+t+' index='+index);
 return {selected:true,track:t,index:index,nativeCropAccessible:!!nativeCrop(clip)};
}
// The crop sliders are enabled ONLY when all four native Crop parameters can
// actually be read and written in the current Premiere build. No QE guesswork.
function reframe(args){
 hostTrace=[];var target=byID(args.sequenceID);requireActive(target.sequenceID);if(String(target.name).indexOf('Caption IA • Tela dividida • ')!==0)throw Error('O reenquadramento só pode modificar uma cópia criada pelo Caption IA.');
 var track=Number(args.track),index=Number(args.index),focusX=Number(args.focusX),focusY=Number(args.focusY),zoom=Number(args.zoom);
 if(!isFinite(track)||!isFinite(index)||track<0||index<0||track>=target.videoTracks.numTracks||index>=target.videoTracks[track].clips.numItems)throw Error('Faixa ou clipe inválido.');
 if(!isFinite(focusX)||!isFinite(focusY)||focusX<0||focusX>100||focusY<0||focusY>100||!isFinite(zoom)||zoom<1||zoom>3)throw Error('Enquadramento fora do intervalo permitido.');
 var clip=target.videoTracks[track].clips[index],crop=nativeCrop(clip);if(!crop)throw Error('Este Premiere não expõe Crop à API CEP. Selecione este clipe e ajuste Cortar no painel Propriedades do Premiere.');
 var settings=target.getSettings(),width=Number(settings.videoFrameWidth),height=Number(settings.videoFrameHeight);
 var columns=Number(args.columns),rows=Number(args.rows),col=Number(args.col),row=Number(args.row);
 if(!((columns===1||columns===2)&&(rows===1||rows===2)&&col>=0&&col<columns&&row>=0&&row<rows))throw Error('Célula inválida.');
 var dim=dimensions(clip.projectItem),par=Number(settings.videoPixelAspectRatio)||1,slotW=width/columns,slotH=height/rows;
 var sx=slotW*par/(dim.width*dim.pixelAspect),sy=slotH/dim.height,scale=Math.max(sx,sy)*zoom;
 var spanX=dim.width*dim.pixelAspect*scale/par,spanY=dim.height*scale;
 if(scale*100>10000||spanX<slotW-.1||spanY<slotH-.1)throw Error('Zoom inválido para o quadro.');
 var totalX=Math.max(0,(1-slotW/spanX)*100),totalY=Math.max(0,(1-slotH/spanY)*100);
 var left=totalX*focusX/100,right=totalX-left,top=totalY*focusY/100,bottom=totalY-top;
 var dx=(left-right)/200*spanX,dy=(top-bottom)/200*spanY;
 var positionX=(col+.5)*slotW-dx,positionY=(row+.5)*slotH-dy;
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
 return {track:track,index:index,applied:true,cropMethod:'intrinsic',crop:{left:left,right:right,top:top,bottom:bottom},scale:scale*100};
}
$.global.captioniaSplitSelectPane=function(payload){try{hostTrace=[];return response(selectPane(JSON.parse(payload)));}catch(e){return error(e);}};
$.global.captioniaSplitReframe=function(payload){try{hostTrace=[];return response(reframe(JSON.parse(payload)));}catch(e){return error(e);}};
$.global.captioniaSplitInspect=function(){try{hostTrace=[];hostNote('inspect.start','reading selected Premiere clips');return response(inspect());}catch(e){return error(e);}};
$.global.captioniaSplitApply=function(payload){try{return response(apply(JSON.parse(payload)));}catch(e){return error(e);}};
$.global.captioniaSplitRestore=function(payload){try{var args=JSON.parse(payload),s=byID(args.sequenceID);app.project.openSequence(s.sequenceID);return response({restored:true,sequenceID:String(s.sequenceID)});}catch(e){return error(e);}};
})();
