'use strict';
// Pure logic and Adobe DOM stubs only. No Premiere, network or installed project is opened.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function source(file){return fs.readFileSync(path.join(root,file),'utf8');}
for(const file of ['js/captionia-split.js','jsx/captionia-split.jsx','js/narrative-beta.js','jsx/narrative-beta.jsx'])new vm.Script(source(file),{filename:file});
const split=require('../js/captionia-split.js');
function selection(count=2){return {sequenceID:'original',signature:'snapshot',width:1920,height:1080,pixelAspect:1,frameDuration:1/30,clips:Array.from({length:count},(_,i)=>({track:i,index:0,nodeId:'c'+i,start:0,end:10,width:1920,height:1080,pixelAspect:1,name:'Video '+i}))};}
let p=split.plan(selection(),{preset:'side-by-side',fit:'fit'});
assert.equal(p.items[0].scale,50);assert.deepEqual(p.items[0].position,[.25,.5]);assert.deepEqual(p.items[1].position,[.75,.5]);
p=split.plan(selection(),{preset:'side-by-side',fit:'fill'});assert.equal(p.items[0].scale,100);assert.equal(p.items[0].crop.left,25);
p=split.plan(selection(4),{preset:'grid-2x2',fit:'fit'});assert.equal(p.items.length,4);assert.deepEqual(p.items[3].position,[.75,.75]);
let s=selection();s.width=1080;s.height=1920;s.clips[0].width=3840;s.clips[0].height=2160;p=split.plan(s,{preset:'top-bottom',fit:'fit'});assert.equal(p.items[0].scale,28.125);assert.equal(p.items[0].slot.height,960);
s=selection();s.pixelAspect=2;p=split.plan(s,{preset:'side-by-side',fit:'fit'});assert.equal(p.items[0].scale,100);
s=selection();s.clips[1].start=1;assert.throws(()=>split.plan(s,{}),/Alinhe/);
s=selection();s.clips[1].track=0;assert.throws(()=>split.plan(s,{}),/faixa de vídeo diferente/);
assert.throws(()=>split.plan(selection(),{preset:'grid-2x2'}),/Selecione 4/);
assert.throws(()=>split.plan(selection(),{fit:'invented'}),/ajustar ou preencher/);

function collection(items,name='numItems'){Object.defineProperty(items,name,{get(){return this.length;},enumerable:false});return items;}
function property(name,val){let current=JSON.parse(JSON.stringify(val));return {displayName:name,getValue(){return JSON.parse(JSON.stringify(current));},setValue(value){current=JSON.parse(JSON.stringify(value));return true;},isTimeVarying(){return false;}};}
function component(name,properties,matchName){return {displayName:name,matchName:matchName||name,properties:collection(properties)};}
function motion(){return component('Motion',[property('Position',[.5,.5]),property('Scale',100),property('Uniform Scale',true),property('Rotation',0),property('Anchor Point',[.5,.5])],'AE.ADBE Motion');}
function fixture(file){
 const state={clones:0,subclips:0,files:{'/take.mov':{exists:true,size:1000,modified:100,width:1920,height:1080}},sequences:[]};
 function media(id='m1',file='/take.mov',start=0,end=10){return {nodeId:id,name:id,_start:start,_end:end,getMediaPath(){return file;},isOffline(){return !state.files[file]||!state.files[file].exists;},getProjectMetadata(){let f=state.files[file];if(state.attributeMetadata)return '<rdf:Description x:Column.Intrinsic.VideoInfo="'+f.width+' x '+f.height+'"/>';return '<x:Column.Intrinsic.VideoInfo>'+f.width+' x '+f.height+'</x:Column.Intrinsic.VideoInfo>';},getFootageInterpretation(){return {pixelAspectRatio:1};},createSubClip(name,a,b){state.subclips++;return media('sub'+state.subclips,file,Number(a)/254016000000,Number(b)/254016000000);}};}
 function clip(item,kind,start=0,end=10){let c={name:'Take',nodeId:'clip-'+kind,projectItem:item,start:{seconds:start},end:{seconds:end},inPoint:{seconds:item._start},outPoint:{seconds:item._end},isSelected(){return true;},getSpeed(){return 1;},isAdjustmentLayer(){return false;},components:collection(kind==='video'?[motion(),component('Opacity',[property('Opacity',100),property('Blend Mode',18)])]:[component('Volume',[property('Level',1)])])};return c;}
 function track(clips){let t={clips:collection(clips),transitions:collection([]),isLocked(){return false;}};clips.forEach(c=>c.remove=function(){t.clips.splice(t.clips.indexOf(c),1);});return t;}
 function cloneClip(c,kind){let copy=clip(c.projectItem,kind,c.start.seconds,c.end.seconds);copy.inPoint.seconds=c.inPoint.seconds;copy.outPoint.seconds=c.outPoint.seconds;copy.components=collection(c.components.map(comp=>component(comp.displayName,comp.properties.map(pr=>property(pr.displayName,pr.getValue())),comp.matchName)));return copy;}
 function sequence(id,video,audio){let result={sequenceID:id,name:id,timebase:254016000000/30,videoTracks:collection(video,'numTracks'),audioTracks:collection(audio,'numTracks'),getSettings(){return {videoFrameWidth:1920,videoFrameHeight:1080,videoPixelAspectRatio:1};},clone(){state.clones++;let duplicate=sequence('clone'+state.clones,this.videoTracks.map(t=>track(t.clips.map(c=>cloneClip(c,'video')))),this.audioTracks.map(t=>track(t.clips.map(c=>cloneClip(c,'audio')))));state.sequences.push(duplicate);return true;},insertClip(item,time){this.videoTracks[0].clips.push(clip(item,'video',time.seconds,time.seconds+item._end-item._start));this.audioTracks[0].clips.push(clip(item,'audio',time.seconds,time.seconds+item._end-item._start));}};return result;}
 let item=media(),original=sequence('original',[track([clip(item,'video')])],[track([clip(item,'audio')])]);state.sequences.push(original);
 const project={activeSequence:original,sequences:collection(state.sequences,'numSequences'),openSequence(id){this.activeSequence=state.sequences.find(x=>x.sequenceID===id);}};
 function File(file){const f=state.files[file]||{};this.exists=!!f.exists;this.fsName=file;this.length=f.size;this.modified=new Date(f.modified||0);}
 const context=vm.createContext({app:{project,enableQE(){}},File,Time:function(){this.seconds=0;},$:{global:{}},console});
 vm.runInContext(source(file),context,{filename:file});
 return {state,original,project,api:context.$.global,context,media,clip,track,sequence,call(name,payload){return JSON.parse(context.$.global[name](JSON.stringify(payload||{})));}};
}
let f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
let inspected=f.call('captioniaSplitInspect');assert.equal(inspected.ok,true);let prepared=split.plan(inspected,{preset:'side-by-side',fit:'fit'});
let originalAudio=JSON.stringify(f.original.audioTracks[0].clips.map(c=>[c.nodeId,c.start,c.end,c.inPoint,c.outPoint]));
let applied=f.call('captioniaSplitApply',prepared);assert.equal(applied.ok,true);assert.equal(f.state.clones,1);assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[1].getValue(),100);assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components[0].properties[1].getValue(),50);assert.equal(JSON.stringify(f.original.audioTracks[0].clips.map(c=>[c.nodeId,c.start,c.end,c.inPoint,c.outPoint])),originalAudio);
assert.equal(f.call('captioniaSplitRestore',{sequenceID:'original'}).ok,true);
f.original.videoTracks[0].clips[0].start.seconds=1;assert.match(f.call('captioniaSplitApply',prepared).error,/mudou/);assert.equal(f.state.clones,1);
f.original.videoTracks[0].clips[0].start.seconds=0;prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});let failed=f.call('captioniaSplitApply',prepared);assert.equal(failed.ok,false);assert.match(failed.error,/original preservada/);assert.equal(f.project.activeSequence.sequenceID,'original');
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fit'});prepared.items[0].scale=9999;applied=f.call('captioniaSplitApply',prepared);assert.equal(applied.ok,true);assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components[0].properties[1].getValue(),50);
f=fixture('jsx/captionia-split.jsx');f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));f.state.attributeMetadata=true;assert.equal(f.call('captioniaSplitInspect').ok,true);
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});f.project.openSequence=function(){};
let beforeMotion=JSON.stringify(f.original.videoTracks.map(t=>t.clips[0].components[0].properties.map(p=>p.getValue())));applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,false);assert.match(applied.error,/não abriu a cópia/);assert.equal(f.project.activeSequence.sequenceID,'original');assert.equal(JSON.stringify(f.original.videoTracks.map(t=>t.clips[0].components[0].properties.map(p=>p.getValue()))),beforeMotion);
assert.equal(f.state.sequences[1].videoTracks[0].clips[0].components[0].properties[1].getValue(),100);
f=fixture('jsx/captionia-split.jsx');f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});
let cropCalls=0;f.context.qe={project:{getVideoEffectByName(){return {};},getActiveSequence(){return {sequenceID:'original',getVideoTrackAt(){cropCalls++;throw Error('Must not reach source QE track');}};}}};
applied=f.call('captioniaSplitApply',prepared);assert.equal(applied.ok,false);assert.match(applied.error,/adaptador Crop está na cópia/);assert.equal(cropCalls,0);assert.equal(f.original.videoTracks[0].clips[0].components.length,2);

// QE DOM includes Empty gaps in numItems. The real clip must receive Crop,
// even if the gap itself exposes an addVideoEffect function.
f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});
let installedEffects=0;
f.context.qe={project:{getVideoEffectByName(){return {name:'Crop'};},getActiveSequence(){
 const active=f.project.activeSequence;
 return {sequenceID:active.sequenceID,getVideoTrackAt(index){
  const trackClip=active.videoTracks[index].clips[0];
  const item={type:'Clip',start:{ticks:'0'},end:{seconds:10},addVideoEffect(){
   installedEffects++;
   trackClip.components.push(component('Crop',[property('Left',0),property('Right',0),property('Top',0),property('Bottom',0)]));
  }};
  return {numItems:2,getItemAt(i){return i===0?{type:'Empty',addVideoEffect(){throw Error('Never use QE gap');}}:item;}};
 }};
}}};
applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
assert.equal(installedEffects,2,'one Crop effect must be added to each of two clips');
assert.equal(f.original.videoTracks[0].clips[0].components.length,2,'original sequence untouched');
assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components.length,3);

// Normal Scale is represented differently by CEP versions. Do not block
// visually untouched takes; never accept a genuinely changed scale.
for(const neutral of [1,'100%',[100,100],[1,1]]){
 f=fixture('jsx/narrative-beta.jsx');
 f.original.videoTracks[0].clips[0].components[0].properties[1].setValue(neutral);
 assert.equal(f.call('fsNarrativeBetaSnapshot').ok,true,'neutral scale rejected: '+JSON.stringify(neutral));
}
f=fixture('jsx/narrative-beta.jsx');
f.original.videoTracks[0].clips[0].components[0].properties[1].setValue(125);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/escala alterada.*125/);

// The legacy Favorites sub-navigation must move below Sua biblioteca context.
const workspaceSource=source('js/captionia-workspace.js');
assert.match(workspaceSource,/context\.parentNode\.insertBefore\(favSubtabs, main\)/);

f=fixture('jsx/narrative-beta.jsx');let snapshot=f.call('fsNarrativeBetaSnapshot');assert.equal(snapshot.ok,true,snapshot.error);
let cuts=[{id:'S001',start:0,end:2},{id:'S002',start:3,end:5}];
let preview=f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:'stale',cuts});assert.equal(preview.ok,false);assert.equal(f.state.clones,0);assert.equal(f.state.subclips,0);
preview=f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:snapshot.signature,cuts});assert.equal(preview.ok,true,preview.error);assert.equal(f.state.clones,1);assert.equal(f.original.videoTracks[0].clips.length,1);assert.equal(f.original.audioTracks[0].clips.length,1);
let approveArgs={sequenceID:'original',sourceSignature:snapshot.signature,previewId:preview.previewId,previewSignature:preview.previewSignature,layout:preview.layout};
assert.equal(f.call('fsNarrativeBetaValidatePreview',approveArgs).ok,true);
f.project.activeSequence.videoTracks[0].clips[0].projectItem=f.media('changed');assert.match(f.call('fsNarrativeBetaValidatePreview',approveArgs).error,/alterados|não estão alinhados/);
f.state.files['/take.mov'].size=2000;assert.match(f.call('fsNarrativeBetaValidatePreview',approveArgs).error,/original.*mudou/);
// Older Premiere releases do not expose Track.transitions. Missing collection
// is not a reason to reject a safe copied rough cut.
f=fixture('jsx/narrative-beta.jsx');
delete f.original.videoTracks[0].transitions;
delete f.original.audioTracks[0].transitions;
let baseSnapshot=f.call('fsNarrativeBetaSnapshot');
assert.equal(baseSnapshot.ok,true,baseSnapshot.error);
const safeClone=f.call('fsNarrativeBetaCloneForRetake',{sequenceID:'original'});
assert.equal(safeClone.ok,true,safeClone.error);
assert.notEqual(safeClone.previewId,'original');
assert.equal(f.original.videoTracks[0].clips.length,1);
assert.equal(f.original.audioTracks[0].clips.length,1);
assert.equal(f.project.activeSequence.sequenceID,safeClone.previewId);
f=fixture('jsx/narrative-beta.jsx');f.original.videoTracks[0].clips[0].components.push(component('Lumetri Color',[]));assert.match(f.call('fsNarrativeBetaSnapshot').error,/não preserva o efeito/);assert.equal(f.state.clones,0);
f=fixture('jsx/narrative-beta.jsx');f.original.videoTracks[0].clips[0].components[0].properties[0].isTimeVarying=()=>true;assert.match(f.call('fsNarrativeBetaSnapshot').error,/keyframes/);
f=fixture('jsx/narrative-beta.jsx');f.state.files['/take.mov'].exists=false;assert.match(f.call('fsNarrativeBetaSnapshot').error,/offline/);
f=fixture('jsx/narrative-beta.jsx');f.original.videoTracks[0].transitions.push({});assert.match(f.call('fsNarrativeBetaSnapshot').error,/transições/);
f=fixture('jsx/narrative-beta.jsx');f.state.attributeMetadata=true;assert.equal(f.call('fsNarrativeBetaSnapshot').ok,true);
f=fixture('jsx/narrative-beta.jsx');f.original.videoTracks[0].clips[0].projectItem.getProjectMetadata=()=>'<rdf:Description/>';let xmpCalls=0;f.context.XMPMeta=function(){this.getProperty=function(namespace,key){assert.equal(namespace,'http://ns.adobe.com/premierePrivateProjectMetaData/1.0/');assert.equal(key,'Column.Intrinsic.VideoInfo');xmpCalls++;return {value:'1920 x 1080'};};};assert.equal(f.call('fsNarrativeBetaSnapshot').ok,true);assert.ok(xmpCalls>=2);

const store=new Map(),win={};const dom={readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;}};
const context=vm.createContext({window:win,document:dom,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},console,setTimeout,clearTimeout});
vm.runInContext(source('js/narrative-beta.js'),context);const narrative=win.fsNarrativeBeta;
let resp={_fsSeq:'original',words:[{word:'a',start:0,end:.3},{word:'palavra',start:.4,end:.7},{word:'final',start:.8,end:1}]},changed=JSON.parse(JSON.stringify(resp));changed.words[1].word='outra';assert.notEqual(narrative.transcriptFingerprint(resp),narrative.transcriptFingerprint(changed));
assert.throws(()=>narrative.assertTranscriptIdentity(resp,{sequenceID:'other',signature:'x',clips:[{start:0,end:10}]}),/outra sequência/);
assert.throws(()=>narrative.assertTranscriptIdentity(resp,{sequenceID:'original',signature:'x',clips:[{start:5,end:10}]}),/fora dos takes/);
assert.equal(narrative.nearDuplicate('O produto custa 100 reais e chega amanhã','O produto custa 200 reais e chega amanhã'),false);
assert.equal(narrative.nearDuplicate('Eu recomendo este produto para todas as pessoas','Eu não recomendo este produto para todas as pessoas'),false);
assert.equal(narrative.dedupePlan([{id:'1',text:'Ele explica o produto e mostra um exemplo'},{id:'2',text:'Ele explica o produto e mostra outro exemplo'}],[]).cuts.length,2);
narrative.configure({objective:'natural',goalText:'Preservar o raciocínio completo'});assert.equal(narrative.readConfig().objective,'natural');assert.throws(()=>narrative.configure({objective:'aggressive'}),/não foram implementados/);
let payload=JSON.parse(narrative.buildPayload([{id:'S001',text:'Uma fala completa.',start:0,end:2,blocked:false}],{mode:'livre',fidelity:'flexivel',sections:[],goalText:'Preservar raciocínio'},{groups:[]},[]));assert.equal(payload.editingProfile.id,'natural');assert.equal(payload.segments[0].evidence.endsSentence,true);assert.match(payload.objective,/natural/);assert.equal(payload.editorialGoal,'Preservar raciocínio');
console.log('PASS: split layouts, stale selections, clone isolation, audio preservation, host geometry, safe failures, narrative identity/media/effects guards, natural profile and factual dedupe.');
