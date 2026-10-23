/* Caption IA 3.6 - frame-accurate, host-independent timing utilities.
 * Timestamp math is based on Premiere sequence.timebase (ticks per frame),
 * not on a rounded UI label such as "29.97 fps".
 * No project/timeline mutation in this module. */
(function(root){'use strict';
 var TICKS=254016000000;
 function valid(x){return typeof x==='number'&&isFinite(x);}
 function frameDuration(timebase){
  var t=Number(timebase),d=t/TICKS;
  if(!isFinite(d)||d<1/120.5||d>1/12)throw Error('Timebase de sequência inválido.');
  return d;
 }
 function frame(seconds,duration,method){
  if(!valid(seconds)||seconds<0)throw Error('Tempo inválido para posicionamento no Premiere.');
  if(!valid(duration)||duration<=0)throw Error('Duração de frame inválida.');
  var value=seconds/duration;
  return method==='floor'?Math.floor(value+1e-8):method==='ceil'?Math.ceil(value-1e-8):Math.round(value);
 }
 function at(seconds,duration,method){return frame(seconds,duration,method)*duration;}
 function remap(sourceTime,segments){
  if(!valid(sourceTime)||!Array.isArray(segments))throw Error('Mapa de edição inválido.');
  for(var i=0;i<segments.length;i++){
   var s=segments[i];
   if(!s||!valid(s.sourceStart)||!valid(s.sourceEnd)||!valid(s.destStart)||!valid(s.destEnd))continue;
   if(sourceTime>=s.sourceStart-1e-6&&sourceTime<s.sourceEnd-1e-6){
    var sourceLength=s.sourceEnd-s.sourceStart,destLength=s.destEnd-s.destStart;
    if(sourceLength<=0||destLength<=0)throw Error('Trecho sem duração na prévia.');
    return s.destStart+(sourceTime-s.sourceStart)*destLength/sourceLength;
   }
  }
  return null; // omitted speech must never generate a stray sound
 }
 function schedule(starts,options){
  options=options||{};
  var duration=Number(options.frameDuration),segments=options.segments||null;
  if(!valid(duration)||duration<=0)throw Error('Informe timebase real da sequência antes de aplicar SFX por palavra.');
  if(!Array.isArray(starts))throw Error('Palavras sem timestamps.');
  var events=[],invalid=0,skipped=0,collisions=0,seen={};
  for(var i=0;i<starts.length;i++){
   var item=starts[i],source=Number(typeof item==='number'?item:item&&item.start);
   if(!valid(source)||source<0||source>21600){invalid++;continue;}
   var t=segments?remap(source,segments):source;
   if(t===null){skipped++;continue;}
   var f=frame(t,duration,'round');
   if(seen[f]){collisions++;continue;} // Two distinct words cannot have different onsets in the SAME video frame.
   seen[f]=true;
   events.push({sourceIndex:i,frame:f,time:f*duration,word:item&&item.word||''});
  }
  events.sort(function(a,b){return a.frame-b.frame||a.sourceIndex-b.sourceIndex;});
  return {events:events,invalid:invalid,omittedByEdit:skipped,sameFrame:collisions,frameDuration:duration};
 }
 function hostFrameDuration(cs){return new Promise(function(resolve,reject){
  if(!cs||typeof cs.evalScript!=='function')return reject(Error('A ponte Adobe não está disponível.'));
  cs.evalScript('(function(){try{var s=app.project.activeSequence;return s?String(s.timebase):"NO_SEQUENCE";}catch(e){return "ERROR:"+String(e);}})()',function(raw){
   try{resolve(frameDuration(raw));}catch(e){reject(Error('Não consegui ler o FPS real da sequência. '+String(raw||'')));}
  });
 });}
 var api=Object.freeze({TICKS:TICKS,frameDuration:frameDuration,frame:frame,at:at,remap:remap,schedule:schedule,hostFrameDuration:hostFrameDuration});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CaptionIATimebase=api;
})(typeof window!=='undefined'?window:null);
