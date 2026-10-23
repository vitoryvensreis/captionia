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
function motion(){return component('Motion',[property('Position',[.5,.5]),property('Scale',100),property('Uniform Scale',true),property('Rotation',0),property('Anchor Point',[.5,.5]),property('Corte à esquerda',0),property('Corte à direita',0),property('Corte superior',0),property('Corte inferior',0)],'AE.ADBE Motion');}
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
// Native Crop must actually constrain each pane in its fixed sequence-frame viewport.
let f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
let inspected=f.call('captioniaSplitInspect');assert.equal(inspected.ok,true);
let prepared=split.plan(inspected,{preset:'side-by-side',fit:'fit'});
let originalAudio=JSON.stringify(f.original.audioTracks[0].clips.map(c=>[c.nodeId,c.start,c.end]));
let applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
assert.equal(applied.maskMethod,'native-motion-crop');
assert.equal(applied.panes.length,2);
assert.equal(applied.panes[0].nativeCropAccessible,true);
assert.equal(f.state.clones,1);
assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components[0].properties[1].getValue(),50);
assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[1].getValue(),100);
assert.equal(JSON.stringify(f.original.audioTracks[0].clips.map(c=>[c.nodeId,c.start,c.end])),originalAudio);
assert.equal(f.call('captioniaSplitRestore',{sequenceID:'original'}).ok,true);
f.original.videoTracks[0].clips[0].start.seconds=1;
assert.match(f.call('captioniaSplitApply',prepared).error,/mudou/);
assert.equal(f.state.clones,1);
f.original.videoTracks[0].clips[0].start.seconds=0;
// Front/back halves of a 1920 x 1080 sequence produce an exact 540-pixel-high viewport.
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'top-bottom',fit:'fill'});
applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
assert.equal(applied.fillMethod,'intrinsic-crop');
assert.deepEqual(Array.from(applied.panes,p=>[p.mask.x,p.mask.y,p.mask.width,p.mask.height]),[[0,0,1920,540],[0,540,1920,540]]);
assert.equal(applied.panes[0].crop.top,25);
assert.equal(applied.panes[0].crop.bottom,25);
assert.equal(applied.panes[1].crop.top,25);
assert.equal(applied.panes[1].crop.bottom,25);
const topClip=f.project.activeSequence.videoTracks[0].clips[0];
const bottomClip=f.project.activeSequence.videoTracks[1].clips[0];
assert.deepEqual(Array.from(topClip.components[0].properties[0].getValue()),[.5,.25]);
assert.deepEqual(Array.from(bottomClip.components[0].properties[0].getValue()),[.5,.75]);
const focusMoved=f.call('captioniaSplitReframe',{sequenceID:applied.sequenceID,track:0,index:0,focusX:50,focusY:0,zoom:1.5,columns:1,rows:2,col:0,row:0});
assert.equal(focusMoved.ok,true,focusMoved.error);
assert.equal(focusMoved.mask.height,540);
assert.equal(focusMoved.mask.y,0);
assert.ok(focusMoved.crop.bottom>focusMoved.crop.top,'Image shifts within fixed top crop');
assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[7].getValue(),0,'Original crop unchanged');
assert.equal(f.original.videoTracks[1].clips[0].components[0].properties[7].getValue(),0,'Other original unchanged');
const untouchedBottom=f.project.activeSequence.videoTracks[1].clips[0].components[0].properties[0].getValue();
assert.deepEqual(Array.from(untouchedBottom),[.5,.75],'Moving top must not move bottom');
assert.equal(f.call('captioniaSplitReframe',{sequenceID:'original',track:0,index:0,focusX:50,focusY:50,zoom:1,columns:1,rows:2,col:0,row:0}).ok,false);
const selectionResult=f.call('captioniaSplitSelectPane',{sequenceID:applied.sequenceID,track:0,index:0});
assert.equal(selectionResult.ok,true,selectionResult.error);
assert.equal(selectionResult.nativeCropAccessible,true);
assert.equal(selectionResult.selected,false,'CEP without setSelected should still allow Crop sliders');
// Invalid hosts must refuse to claim a successful masked layout.
f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
const unavailable=f.original.videoTracks[0].clips[0].components[0].properties;
unavailable.splice(5,4);
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'top-bottom',fit:'fill'});
const withoutNativeMask=f.call('captioniaSplitApply',prepared);
assert.equal(withoutNativeMask.ok,false);
assert.match(withoutNativeMask.error,/não disponibiliza os quatro controles nativos/);
assert.equal(f.state.clones,0,'Refuse before cloning without Crop');
// Reject Crop properties scattered across unrelated effect components.
f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
f.original.videoTracks[0].clips[0].components[0].properties.splice(5,4);
f.original.videoTracks[0].clips[0].components.push(component('Crop',[property('Left',0),property('Right',0)]));
f.original.videoTracks[0].clips[0].components.push(component('Crop',[property('Top',0),property('Bottom',0)]));
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'top-bottom',fit:'fill'});
assert.equal(f.call('captioniaSplitApply',prepared).ok,false);
// Quad layout creates exactly four disjoint quarter-frame masks.
f=fixture('jsx/captionia-split.jsx');
for(const label of ['m2','m3','m4'])f.original.videoTracks.push(f.track([f.clip(f.media(label),'video')]));
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'grid-2x2',fit:'fill'});
applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
assert.deepEqual(Array.from(applied.panes,p=>[p.mask.x,p.mask.y,p.mask.width,p.mask.height]),[[0,0,960,540],[960,0,960,540],[0,540,960,540],[960,540,960,540]]);
// Mid-mutation failure must restore the pane's previous Crop+Motion values.
f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'top-bottom',fit:'fill'});
applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
const clipToReject=f.project.activeSequence.videoTracks[0].clips[0];
const beforeReject=clipToReject.components[0].properties.map(prop=>prop.getValue());
const rejecting=clipToReject.components[0].properties[8];
const setter=rejecting.setValue.bind(rejecting);
let failOnce=false;
rejecting.setValue=function(value,flag){if(!failOnce){failOnce=true;return false;}return setter(value,flag);};
const rejected=f.call('captioniaSplitReframe',{sequenceID:applied.sequenceID,track:0,index:0,focusX:60,focusY:30,zoom:1.7,columns:1,rows:2,col:0,row:0});
assert.equal(rejected.ok,false);
assert.match(rejected.error,/estado anterior.*restaurado/);
assert.deepEqual(Array.from(clipToReject.components[0].properties,x=>x.getValue()),beforeReject);
assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[8].getValue(),0);

// Editing intent comes from timed words, never from Adobe component labels.
for(const scale of [1,125,'100%',[100,100]]){
 f=fixture('jsx/narrative-beta.jsx');
 f.original.videoTracks[0].clips[0].components[0].properties[1].setValue(scale);
 const snap=f.call('fsNarrativeBetaSnapshot');
 assert.equal(snap.ok,true,'Motion Scale must not block transcription-based editing');
 assert.ok(snap.hostTrace.some(x=>x.phase==='snapshot.transcript-only'));
 assert.match(snap.effectNotice,/efeitos.*não são copiados/);
}
// The legacy Favorites sub-navigation must move below Sua biblioteca context.
const workspaceSource=source('js/captionia-workspace.js');
assert.match(workspaceSource,/context\.parentNode\.insertBefore\(favSubtabs, main\)/);

f=fixture('jsx/narrative-beta.jsx');let snapshot=f.call('fsNarrativeBetaSnapshot');assert.equal(snapshot.ok,true,snapshot.error);
let cuts=[{id:'S001',start:0,end:2},{id:'S002',start:3,end:5}];
let preview=f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:'stale',cuts});assert.equal(preview.ok,false);assert.equal(f.state.clones,0);assert.equal(f.state.subclips,0);
preview=f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:snapshot.signature,cuts});assert.equal(preview.ok,true,preview.error);assert.equal(f.state.clones,1);assert.equal(f.original.videoTracks[0].clips.length,1);assert.equal(f.original.audioTracks[0].clips.length,1);
let approveArgs={sequenceID:'original',sourceSignature:snapshot.signature,previewId:preview.previewId,previewSignature:preview.previewSignature,layout:preview.layout};
assert.equal(f.call('fsNarrativeBetaValidatePreview',approveArgs).ok,true);
const previewMedia=f.project.activeSequence.videoTracks[0].clips[0].projectItem;f.project.activeSequence.videoTracks[0].clips[0].projectItem=f.media('changed');assert.match(f.call('fsNarrativeBetaValidatePreview',approveArgs).error,/alterados|não estão alinhados|fora de sincronismo/);f.project.activeSequence.videoTracks[0].clips[0].projectItem=previewMedia;
f.state.files['/take.mov'].size=2000;assert.equal(f.call('fsNarrativeBetaValidatePreview',approveArgs).ok,true,'No filesystem size dependency');
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
// Real-world regression: controls may be non-neutral; the plan must still use
// the existing transcribed times without inspecting Volume or Motion.
f=fixture('jsx/narrative-beta.jsx');
const changedVideo=f.original.videoTracks[0].clips[0],changedAudio=f.original.audioTracks[0].clips[0];
changedVideo.components.push(component('Lumetri Color',[property('Saturation',145)]));
changedVideo.components[0].properties.push(property('Corte à esquerda',15));
changedAudio.components[0].properties.push(property('Volume',false));
changedAudio.components[0].properties.push(property('Nível',0.5));
const onlyTranscript=f.call('fsNarrativeBetaSnapshot');
assert.equal(onlyTranscript.ok,true,onlyTranscript.error);
assert.ok(onlyTranscript.hostTrace.every(x=>x.phase!=='motion.property'&&x.phase!=='audio.property'));
const simplePreview=f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:onlyTranscript.signature,cuts:[{id:'S001',start:0,end:2},{id:'S002',start:3,end:5}]});
assert.equal(simplePreview.ok,true,simplePreview.error);assert.equal(f.state.clones,1);assert.equal(f.state.subclips,2);
assert.match(simplePreview.effectNotice,/efeitos.*não são copiados/);
assert.equal(changedVideo.components.at(-1).properties[0].getValue(),145,'Original effects unchanged');
assert.equal(changedAudio.components[0].properties.at(-1).getValue(),0.5,'Original gain unchanged');
assert.equal(f.call('fsNarrativeBetaValidatePreview',{sequenceID:'original',sourceSignature:onlyTranscript.signature,previewId:simplePreview.previewId,previewSignature:simplePreview.previewSignature,layout:simplePreview.layout}).ok,true);
f=fixture('jsx/narrative-beta.jsx');
const originalSnap=f.call('fsNarrativeBetaSnapshot');
f.original.videoTracks[0].clips[0].start.seconds=1;
assert.match(f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:originalSnap.signature,cuts:[{id:'S001',start:1,end:2}]}).error,/intervalos da timeline original mudaram|remapeamento incompatível/);
assert.equal(f.state.clones,0);
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].start.seconds=.5;f.original.audioTracks[0].clips[0].end.seconds=10.5;
assert.match(f.call('fsNarrativeBetaSnapshot').error,/fora de sincronismo/);
f=fixture('jsx/narrative-beta.jsx');
const offlineSnap=f.call('fsNarrativeBetaSnapshot');
f.original.videoTracks[0].clips[0].projectItem.isOffline=()=>true;
assert.match(f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:offlineSnap.signature,cuts:[{id:'S001',start:0,end:2}]}).error,/offline/);
assert.equal(f.state.clones,0);

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
// End-to-end mocked Premiere, including the localized errors from field tests.
for(const family of ['Volume','Channel Volume','Volume do canal']){
 f=fixture('jsx/narrative-beta.jsx');
 f.original.videoTracks[0].clips[0].components[0].properties.push(property('Corte à esquerda',7));
 f.original.audioTracks[0].clips[0].components=collection([component(family,[property('Volume',false),property('Level',0.5)])]);
 const snap=f.call('fsNarrativeBetaSnapshot');
 assert.equal(snap.ok,true,snap.error);
 assert.ok(snap.hostTrace.some(x=>x.phase==='snapshot.transcript-only'));
 const edited=f.call('fsNarrativeBetaPreview',{sequenceID:'original',sourceSignature:snap.signature,cuts:[{id:'safe1',start:0,end:2},{id:'safe2',start:3,end:5}]});
 assert.equal(edited.ok,true,edited.error);assert.equal(f.state.subclips,2);
 assert.equal(f.original.videoTracks[0].clips.length,1);
 assert.equal(f.original.audioTracks[0].clips.length,1);
 assert.equal(f.call('fsNarrativeBetaValidatePreview',{sequenceID:'original',sourceSignature:snap.signature,previewId:edited.previewId,previewSignature:edited.previewSignature,layout:edited.layout}).ok,true);
}

// Authorization regression: bridge allows both per-pane operations (not arbitrary JSX).
const bridgeText=source('js/captionia-bridge.js');
assert.match(bridgeText,/captioniaSplitSelectPane:1/);
assert.match(bridgeText,/captioniaSplitReframe:1/);
assert.match(bridgeText,/Operação Adobe não autorizada/);
console.log('PASS: split layouts, stale selections, clone isolation, audio preservation, host geometry, safe failures, narrative identity/media/effects guards, natural profile and factual dedupe.');
