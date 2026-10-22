/* Caption IA: split-screen planning. No timeline mutation until apply(plan). */
(function(root){
'use strict';
var ready=null,lastResult=null,busy=false;
var presets={'side-by-side':{count:2,columns:2,rows:1,label:'Lado a lado'},'top-bottom':{count:2,columns:1,rows:2,label:'Topo e baixo'},'grid-2x2':{count:4,columns:2,rows:2,label:'Grade 2 × 2'}};
function fail(message){throw Error(message);}
function number(value,label){value=Number(value);if(!isFinite(value)||value<=0)fail(label+' inválido.');return value;}
function plan(snapshot,options){
 options=options||{};var preset=presets[options.preset||'side-by-side'];if(!preset)fail('Layout de tela dividida desconhecido.');
 var mode=options.fit||'fit';if(mode!=='fit'&&mode!=='fill')fail('Escolha ajustar ou preencher.');
 if(!snapshot||!snapshot.sequenceID||!snapshot.signature)fail('Inspecione a sequência antes de preparar a tela dividida.');
 var width=number(snapshot.width,'Largura da sequência'),height=number(snapshot.height,'Altura da sequência');
 var par=number(snapshot.pixelAspect||1,'Proporção de pixel'),clips=snapshot.clips||[];
 if(clips.length!==preset.count)fail('Selecione '+preset.count+' vídeos simultâneos em faixas diferentes para '+preset.label.toLowerCase()+'.');
 var frame=number(snapshot.frameDuration,'Duração do frame'),start=clips[0].start,end=clips[0].end,tracks={},items=[];
 clips.forEach(function(clip,index){
  if(tracks[clip.track])fail('Use uma faixa de vídeo diferente para cada clipe.');tracks[clip.track]=true;
  if(Math.abs(clip.start-start)>frame*.1||Math.abs(clip.end-end)>frame*.1)fail('Alinhe início e fim dos vídeos na timeline antes de dividir. O áudio permanece no lugar.');
  var sourceWidth=number(clip.width,'Largura de '+clip.name),sourceHeight=number(clip.height,'Altura de '+clip.name),sourcePAR=number(clip.pixelAspect||1,'Proporção de pixel da mídia');
  var slot={x:index%preset.columns*width/preset.columns,y:Math.floor(index/preset.columns)*height/preset.rows,width:width/preset.columns,height:height/preset.rows};
  var sx=slot.width*par/(sourceWidth*sourcePAR),sy=slot.height/sourceHeight,scale=(mode==='fill'?Math.max(sx,sy):Math.min(sx,sy));
  if(scale*100>10000||scale*100<.01)fail('Escala fora dos limites do Premiere para '+clip.name+'.');
  var cropX=mode==='fill'?Math.max(0,(1-slot.width*par/(sourceWidth*sourcePAR*scale))*50):0;
  var cropY=mode==='fill'?Math.max(0,(1-slot.height/(sourceHeight*scale))*50):0;
  items.push({track:clip.track,index:clip.index,nodeId:clip.nodeId,start:clip.start,end:clip.end,slot:slot,scale:scale*100,
   position:[(slot.x+slot.width/2)/width,(slot.y+slot.height/2)/height],crop:{left:cropX,right:cropX,top:cropY,bottom:cropY},name:clip.name});
 });
 return {version:1,sequenceID:String(snapshot.sequenceID),signature:snapshot.signature,preset:options.preset||'side-by-side',fit:mode,width:width,height:height,
  duration:end-start,items:items,notice:'A aplicação cria uma cópia da sequência e preserva a original, o áudio e os efeitos existentes. Movimento dos vídeos será ajustado.'};
}
function host(name,payload){return new Promise(function(resolve,reject){
 var cs=root.csInterface;if(!cs||typeof cs.evalScript!=='function')return reject(Error('Ponte Adobe indisponível.'));
 cs.evalScript(name+'('+JSON.stringify(JSON.stringify(payload||{}))+')',function(raw){try{var result=JSON.parse(raw);if(!result||!result.ok)throw Error(result&&result.error||'Resposta inválida do Premiere.');resolve(result);}catch(e){reject(e);}});
});}
function load(){if(ready)return ready;ready=new Promise(function(resolve,reject){
 try{var cs=root.csInterface;if(!cs)throw Error('Abra o painel no Premiere.');var path=cs.getSystemPath(SystemPath.EXTENSION).replace(/\\/g,'/')+'/jsx/captionia-split.jsx';
 cs.evalScript('$.evalFile('+JSON.stringify(path)+'); typeof captioniaSplitInspect === "function" ? "OK" : "NO"',function(raw){if(raw==='OK')resolve();else{ready=null;reject(Error('Ponte de tela dividida indisponível: '+raw));}});
 }catch(e){ready=null;reject(e);}
 });return ready;}
function inspect(){return load().then(function(){return host('captioniaSplitInspect',{});});}
function preview(options){return inspect().then(function(snapshot){return plan(snapshot,options);});}
function apply(prepared){if(busy)return Promise.reject(Error('Uma tela dividida já está sendo preparada.'));if(!prepared||prepared.version!==1)return Promise.reject(Error('Prepare e revise o layout antes de aplicar.'));
 busy=true;return load().then(function(){return host('captioniaSplitApply',prepared);}).then(function(result){lastResult=result;return result;}).then(function(v){busy=false;return v;},function(e){busy=false;throw e;});}
function restore(){if(!lastResult||!lastResult.originalId)return Promise.reject(Error('Nenhuma sequência original registrada nesta sessão.'));return host('captioniaSplitRestore',{sequenceID:lastResult.originalId});}
root.CaptionIASplit={presets:presets,plan:plan,inspect:inspect,preview:preview,apply:apply,restore:restore};
if(typeof module!=='undefined'&&module.exports)module.exports=root.CaptionIASplit;
})(typeof window!=='undefined'?window:this);
