/* Caption IA — SFX scheduling, without timeline writes.
 * Modes: block (explicit spacing) and word (ONE visual onset per frame).
 */
(function(root){'use strict';
 function finite(v){return typeof v==='number'&&isFinite(v);}
 function plan(times,ends,options){
  options=options||{};
  if(!Array.isArray(times))throw new TypeError('SFX times must be an array.');
  var fps=finite(options.fps)&&options.fps>=12&&options.fps<=120?options.fps:null;
  var duration=finite(options.frameDuration)?options.frameDuration:(fps?1/fps:0);
  if(!finite(duration)||duration<=0)throw Error('Consulte o FPS real da sequência antes de posicionar SFX.');
  var words=options.mode==='word'||options.perWord===true;
  var minGap=finite(options.minGapSeconds)?Math.max(0.5,Math.min(2.5,options.minGapSeconds)):0.85;
  var gapFrames=words?1:Math.max(1,Math.ceil(minGap/duration));
  var ordered=[],invalid=0;
  for(var i=0;i<times.length;i++){
   var v=times[i];
   if(!finite(v)||v<0||v>21600){invalid++;continue;}
   var boundary=Array.isArray(ends)&&ends.length===times.length?ends[i]:null;
   if(finite(boundary)&&boundary<=v+duration*.5){invalid++;continue;}
   ordered.push({frame:Math.round(v/duration),index:i});
  }
  ordered.sort(function(a,b){return a.frame-b.frame||a.index-b.index;});
  var result=[],last=-Infinity,spacing=0,duplicate=0;
  var limit=Math.max(1,Math.min(4000,options.maxEvents||1200));
  for(var j=0;j<ordered.length;j++){
   var current=ordered[j].frame;
   if(current===last){duplicate++;continue;}
   if(current-last<gapFrames||result.length>=limit){spacing++;continue;}
   result.push(current*duration);last=current;
  }
  return {times:result,fins:[],received:times.length,omittedInvalid:invalid,omittedDuplicate:duplicate,
   omittedSpacing:spacing,gapSeconds:gapFrames*duration,
   strategy:words?'one-per-word-frame':'one-per-block-with-cooldown'};
 }
 var api=Object.freeze({plan:plan});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CaptionIASfxScheduler=api;
})(typeof window!=='undefined'?window:null);
