'use strict';
/* Caption IA 3.5.1 -- narrative source-frame de-duplication regression.
   Runs the REAL Adobe ExtendScript entrypoint in a Premiere mock, not just regex tests. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const TICKS=254016000000;
const jsx=fs.readFileSync('CaptionIA/jsx/narrative-beta.jsx','utf8');
const narrative=fs.readFileSync('CaptionIA/js/narrative-beta.js','utf8');

function mockPremiere(frame, sources){
 let sequences=[],active=null;
 const counter={id:1},subclipCalls=[];
 function property(displayName,initial){
   return {displayName,getValue(){return initial},isTimeVarying(){return false}};
 }
 function component(displayName,props){
   Object.defineProperty(props,'numItems',{get(){return props.length;}});
   return {displayName,matchName:displayName,properties:props};
 }
 function makeClip(media,options,kind){
   const motion=component('Motion',[property('Position',[.5,.5]),property('Scale',100),
     property('Uniform Scale',true),property('Rotation',0),property('Anchor Point',[960,540])]);
   const opacity=component('Opacity',[property('Opacity',100),property('Blend Mode',18)]);
   const volume=component('Volume',[property('Level',1)]);
   const components=kind==='audio'?[volume]:[motion,opacity];
   Object.defineProperty(components,'numItems',{get(){return components.length;}});
   return {projectItem:media,name:media.name,start:{seconds:options.start},end:{seconds:options.end},
     inPoint:{seconds:options.sourceStart},outPoint:{seconds:options.sourceEnd},getSpeed(){return 1},
     components,remove(){throw Error('remove() should be replaced by track factory');}};
 }
 function track(clips){
   const arr=clips.slice();
   for(const c of arr){c.remove=()=>{const index=arr.indexOf(c);if(index<0)throw Error('already removed');arr.splice(index,1);};}
   Object.defineProperty(arr,'numItems',{get(){return arr.length;}});
   return {clips:arr};
 }
 function makeSequence(name,clips){
   const id=String(counter.id++),vid=track(clips.map(c=>makeClip(c.media,c,'video'))),aud=track(clips.map(c=>makeClip(c.media,c,'audio')));
   return {sequenceID:id,name,timebase:frame*TICKS,
     getSettings(){return {videoFrameWidth:1920,videoFrameHeight:1080,videoPixelAspectRatio:1}},
     videoTracks:{0:vid,numTracks:1},audioTracks:{0:aud,numTracks:1},
     clone(){const copy=makeSequence(name+' copy',clips);sequences.push(copy);return true;},
     insertClip(subclip,time){
       const at=Number(time.seconds),duration=subclip.end-subclip.start;
       for(const tr of [this.videoTracks[0],this.audioTracks[0]]){
         const inserted=makeClip(subclip.media,{start:at,end:at+duration,sourceStart:subclip.start,sourceEnd:subclip.end},tr===this.videoTracks[0]?'video':'audio');
         inserted.remove=()=>tr.clips.splice(tr.clips.indexOf(inserted),1);
         tr.clips.push(inserted);
       }
     }
   };
 }
 const media=sources.map((name,i)=>({
   nodeId:'src-'+i,name,
   getMediaPath(){return '/mock/take.mp4'},
   isOffline(){return false},
   getProjectMetadata(){return '<x:Column.Intrinsic.VideoInfo>1920 x 1080</x:Column.Intrinsic.VideoInfo>'},
   createSubClip(name,from,to){
     const sub={name,start:Number(from)/TICKS,end:Number(to)/TICKS,media:this};
     subclipCalls.push(sub);return sub;
   }
 }));
 let seq=makeSequence('Original', [{media:media[0],start:0,end:5,sourceStart:0,sourceEnd:5}]);
 sequences.push(seq);active=seq;
 Object.defineProperty(sequences,'numSequences',{get(){return sequences.length;}});
 const app={project:{sequences,get activeSequence(){return active;},
   openSequence(id){active=sequences.find(s=>s.sequenceID===id);if(!active)throw Error('not found '+id);}
 }};
 function File(path){this.exists=path==='/mock/take.mp4';this.fsName=path;this.length=1000;this.modified=new Date(1000);}
 const context={app,File,Time:function(){this.seconds=0;},JSON,Date,Math,isFinite,Number,String,Error,Array};
 context.$={global:{}};
 vm.runInNewContext(jsx,context,{filename:'narrative-beta.jsx'});
 return {api:context.$.global,media,original:seq,subclipCalls,sequences,get active(){return active;}};
}
function preview(frame,cuts){
 const host=mockPremiere(frame,['take.mp4']);
 const snapshot=JSON.parse(host.api.fsNarrativeBetaSnapshot());
 assert.equal(snapshot.ok,true,snapshot.error);
 const result=JSON.parse(host.api.fsNarrativeBetaPreview(JSON.stringify({sequenceID:host.original.sequenceID,sourceSignature:snapshot.signature,cuts})));
 return {host,result};
}
function cut(id,start,end){return {id,start,end};}
function almost(a,b,delta=1e-6){assert(Math.abs(a-b)<=delta,`${a} !== ${b}`);}

const test25=preview(1/25,[cut('S001',0.1,1.24),cut('S002',1.12,2.22)]);
assert.equal(test25.result.ok,true,test25.result.error);
const a=test25.host.subclipCalls;
assert.equal(a.length,2);almost(a[0].end,a[1].start);
assert.equal(test25.result.layout.length,2);
almost(test25.result.layout[0].sourceEnd,test25.result.layout[1].sourceStart);
almost(test25.result.layout[0].destEnd,test25.result.layout[1].destStart);
assert(test25.result.layout[0].sourceEnd<1.24,'First cut must surrender overlap to the second');
assert.equal(test25.host.original.videoTracks[0].clips.numItems,1,'Original sequence is untouched');
console.log('PASS: 25 fps consecutive overlapping cuts share exactly one frame boundary');

const test2997=preview(1001/30000,[cut('S001',0.1,1.259),cut('S002',1.153,2.26)]);
assert.equal(test2997.result.ok,true,test2997.result.error);
almost(test2997.host.subclipCalls[0].end,test2997.host.subclipCalls[1].start,1e-8);
assert.equal(test2997.result.layout.length,2);
console.log('PASS: 29.97 fps source interval cut is frame-exact');

const big=preview(1/25,[cut('S001',0.1,1.94),cut('S002',1.12,2.22)]);
assert.equal(big.result.ok,false,'Unsafe 800ms reuse must be blocked');
assert.match(big.result.error,/reutiliza|repetir/i);
assert.equal(big.host.subclipCalls.length,0,'Abort before creating any subclips');
assert.equal(big.host.original.videoTracks[0].clips.numItems,1);
console.log('PASS: unsafe overlap refuses preview, original untouched');

const reverse=preview(1/25,[cut('S001',1.12,2.22),cut('S002',0.1,1.24)]);
assert.equal(reverse.result.ok,false,'Reversed overlapping source should not silently trim');
assert.equal(reverse.host.subclipCalls.length,0);
console.log('PASS: reversed source overlap must be explicitly reviewed');

const noOverlap=preview(1/25,[cut('S001',0.1,1.08),cut('S002',1.25,2.22)]);
assert.equal(noOverlap.result.ok,true,noOverlap.result.error);
assert(noOverlap.host.subclipCalls[0].end<noOverlap.host.subclipCalls[1].start);
console.log('PASS: safe pauses are not collapsed accidentally');

const ctx={window:{},document:undefined,localStorage:{getItem(){return null;}},console,JSON,Date,Math,Promise,Number,String,isFinite,Error};
vm.runInNewContext(narrative,ctx,{filename:'narrative-beta.js'});
const remap=ctx.window.fsNarrativeBeta.remapTranscript;
assert.equal(typeof remap,'function');
const words=[
 {word:'Eu',start:0.12,end:0.31},
 {word:'quero',start:0.35,end:0.78},
 {word:'ir',start:1.08,end:1.28},
 {word:'para',start:1.32,end:1.53},
 {word:'praia',start:1.60,end:2.10}
];
const subtitle=remap({words,text:'Eu quero ir para praia'},
 [cut('S001',0.1,1.24),cut('S002',1.12,2.22)],
 test25.result.layout,'preview-test');
assert.deepEqual(Array.from(subtitle.words,w=>w.word),['Eu','quero','ir','para','praia']);
assert.equal(subtitle.words.filter(w=>w.word==='ir').length,1);
assert.equal(subtitle._fsSeq,'preview-test');
const ir=subtitle.words.find(w=>w.word==='ir');
assert(ir.start>=test25.result.layout[1].destStart,'Shared word belongs to the incoming cut');
console.log('PASS: 1 occurrence of "ir" across remapped preview, not duplicated subtitles');

const repeatOriginal=[
 {word:'ir',start:1.08,end:1.28},
 {word:'ir',start:2.35,end:2.51}
];
const repeatLayout=[{id:'S001',sourceStart:1,sourceEnd:1.5,destStart:0,destEnd:.5},
 {id:'S002',sourceStart:2.25,sourceEnd:2.75,destStart:.5,destEnd:1}];
const repeat=remap({words:repeatOriginal},[cut('S001',1,1.5),cut('S002',2.25,2.75)],repeatLayout,'p');
assert.equal(repeat.words.length,2,'Two different original word occurrences must remain');
console.log('PASS: real spoken retakes remain distinct; only accidental duplication eliminated');
