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
f.original.videoTracks[0].clips[0].start.seconds=0;prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});let failed=f.call('captioniaSplitApply',prepared);assert.equal(failed.ok,true);assert.equal(failed.degraded,false);assert.equal(failed.fitApplied,'fill');assert.equal(failed.fillMethod,'canvas-edge');assert.match(failed.warning,/sem efeito Crop/);assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[1].getValue(),100);assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components[0].properties[1].getValue(),100);assert.ok(failed.hostTrace.some(s=>s.phase==='split.edge-clip'));f.project.openSequence('original');
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fit'});prepared.items[0].scale=9999;applied=f.call('captioniaSplitApply',prepared);assert.equal(applied.ok,true);assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components[0].properties[1].getValue(),50);
f=fixture('jsx/captionia-split.jsx');f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));f.state.attributeMetadata=true;assert.equal(f.call('captioniaSplitInspect').ok,true);
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});f.project.openSequence=function(){};
let beforeMotion=JSON.stringify(f.original.videoTracks.map(t=>t.clips[0].components[0].properties.map(p=>p.getValue())));applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,false);assert.match(applied.error,/não abriu a cópia/);assert.equal(f.project.activeSequence.sequenceID,'original');assert.equal(JSON.stringify(f.original.videoTracks.map(t=>t.clips[0].components[0].properties.map(p=>p.getValue()))),beforeMotion);
assert.equal(f.state.sequences[1].videoTracks[0].clips[0].components[0].properties[1].getValue(),100);
f=fixture('jsx/captionia-split.jsx');f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});
let cropCalls=0;f.context.qe={project:{getVideoEffectByName(){return {};},getActiveSequence(){return {sequenceID:'original',getVideoTrackAt(){cropCalls++;throw Error('Must not reach source QE track');}};}}};
applied=f.call('captioniaSplitApply',prepared);assert.equal(applied.ok,true,applied.error);assert.equal(cropCalls,0,'The new fill mode must not call the QE adapter');assert.equal(applied.fillMethod,'canvas-edge');assert.equal(f.original.videoTracks[0].clips[0].components.length,2);

// Frame-edge fill must not depend on QE, even when QE simulates a valid Crop effect.
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
assert.equal(installedEffects,0,'canvas edge clipping uses only Motion, no QE Crop');
assert.equal(f.original.videoTracks[0].clips[0].components.length,2,'original sequence untouched');
assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components.length,2);
assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components[0].properties[0].getValue()[0],0,'left clip finishes at split boundary');
assert.equal(f.project.activeSequence.videoTracks[1].clips[0].components[0].properties[0].getValue()[0],1,'right clip begins at split boundary');

// Fill by edge clipping remains deterministic for top-bottom and 2x2 layouts,
// with independent tracks and without the undocumented QE Crop adapter.
f=fixture('jsx/captionia-split.jsx');f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'top-bottom',fit:'fill'});
applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
assert.equal(applied.fillMethod,'canvas-edge');
assert.equal(f.project.activeSequence.videoTracks[0].clips[0].components[0].properties[0].getValue()[1],0);
assert.equal(f.project.activeSequence.videoTracks[1].clips[0].components[0].properties[0].getValue()[1],1);
assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[0].getValue()[1],.5);
f=fixture('jsx/captionia-split.jsx');
for(const label of ['m2','m3','m4'])f.original.videoTracks.push(f.track([f.clip(f.media(label),'video')]));
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'grid-2x2',fit:'fill'});
applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
assert.deepEqual(Array.from(f.project.activeSequence.videoTracks,track=>Array.from(track.clips[0].components[0].properties[0].getValue())),[[.25,.25],[.75,.25],[.25,.75],[.75,.75]]);

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

// Premiere Portuguese localization labels Scale Width as Dimensionar largura.
// Reject genuine transforms, but accept the default 100% in talking-head takes.
f=fixture('jsx/narrative-beta.jsx');
f.original.videoTracks[0].clips[0].components[0].properties.push(property('Dimensionar largura',100));
let ptSnapshot=f.call('fsNarrativeBetaSnapshot');
assert.equal(ptSnapshot.ok,true,ptSnapshot.error);
assert.ok(ptSnapshot.hostTrace.some(s=>s.phase==='motion.property'&&s.detail.includes('dimensionar largura')));
f.original.videoTracks[0].clips[0].components[0].properties.at(-1).setValue(160);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/escala alterada.*Dimensionar largura/);

// Motion in Portuguese Premiere may expose boolean Uniform Scale as 'Dimensionar uniformemente'.
f=fixture('jsx/narrative-beta.jsx');
f.original.videoTracks[0].clips[0].components[0].properties.push(property('Dimensionar uniformemente',true));
let localized=f.call('fsNarrativeBetaSnapshot');
assert.equal(localized.ok,true,localized.error);
assert.ok(localized.hostTrace.some(x=>x.phase==='motion.property'&&x.detail.includes('dimensionar uniformemente')));
f.original.videoTracks[0].clips[0].components[0].properties.at(-1).setValue(false);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/Escala uniforme desativada/);

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
// Premiere audio Volume controls are localized and may expose neutral gain as 1 or 0 dB.
// Unknown/nonneutral values must not be silently discarded when making subclips.
for(const [label,normal,changed] of [
 ['Volume',1,0.5],
 ['Volume do clipe','1.0',1.4],
 ['Nível de volume',1,1.3],
 ['Nível de áudio',1,2],
 ['Volume do canal',1,0],
 ['Canal esquerdo',1,0.4],
 ['Canal direito','1',1.2],
 ['Channel 1',1,0.7],
 ['Bypass',false,true],
 ['Desvio',0,1],
 ['Mudo',false,true],
 ['Silenciar','false','true'],
 ['Panorâmica',0,0.7],
 ['Pan',0,0.5]
]){
 f=fixture('jsx/narrative-beta.jsx');
 const prop=property(label,normal);
 f.original.audioTracks[0].clips[0].components[0].properties.push(prop);
 const snap=f.call('fsNarrativeBetaSnapshot');
 assert.equal(snap.ok,true,'Áudio padrão deve passar '+label+': '+snap.error);
 assert.ok(snap.hostTrace.some(v=>v.phase==='audio.property'&&v.detail.toLowerCase().includes(label.toLowerCase().replace('í','i').replace('í','i').slice(0,5))),'Trace should include native audio label '+label);
 prop.setValue(changed);
 assert.equal(f.call('fsNarrativeBetaSnapshot').ok,false,'Áudio alterado deve ser bloqueado: '+label);
}
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].components=collection([component('Channel Volume',[property('Canal 1',1),property('Canal 2',1)])]);
assert.equal(f.call('fsNarrativeBetaSnapshot').ok,true,'Dois canais neutros devem ser aceitos');
f.original.audioTracks[0].clips[0].components[0].properties[1].setValue(0.5);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/Volume do take alterado/);
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].components[0].properties.push(property('Ajuste novo desconhecido',0));
const audioUnknown=f.call('fsNarrativeBetaSnapshot');
assert.equal(audioUnknown.ok,false,'Parâmetro desconhecido segue bloqueado');
assert.match(audioUnknown.error,/Ajuste de áudio não reconhecido.*Ajuste novo desconhecido/);
assert.ok(audioUnknown.hostTrace.some(v=>v.phase==='audio.unknown'));
f=fixture('jsx/narrative-beta.jsx');
const animatedAudio=property('Volume',1);animatedAudio.isTimeVarying=()=>true;
f.original.audioTracks[0].clips[0].components[0].properties.push(animatedAudio);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/keyframes/);

// Real Premiere PT-BR regression 23/10: native Volume/Volume=false is a
// boolean control field. It must not be interpreted as zero gain/muted audio.
f=fixture('jsx/narrative-beta.jsx');
const nativeVolume=f.original.audioTracks[0].clips[0].components[0];
nativeVolume.properties.unshift(property('Volume',false));
const nativeAudioSnapshot=f.call('fsNarrativeBetaSnapshot');
assert.equal(nativeAudioSnapshot.ok,true,nativeAudioSnapshot.error);
assert.ok(nativeAudioSnapshot.hostTrace.some(x=>x.phase==='audio.volume-flag'));
assert.ok(nativeAudioSnapshot.hostTrace.some(x=>x.phase==='audio.property'&&x.detail.includes('volume = false')));
nativeVolume.properties[0].setValue(true);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/Estado booleano de Volume alterado/);
nativeVolume.properties[0].setValue(false);
nativeVolume.properties[1].setValue(0.5);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/Volume do take alterado/);
// Without an independently verified Level/Nivel, a false flag alone is NOT enough.
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].components[0].properties=collection([property('Volume',false)]);
const noGain=f.call('fsNarrativeBetaSnapshot');
assert.equal(noGain.ok,false);
assert.match(noGain.error,/não foi possível confirmar Nível\/Level/);
assert.ok(noGain.hostTrace.some(x=>x.phase==='audio.level-unverified'));
// Some Premiere CEP versions expose zero dB as 0.177827941 (15 dB offset).
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].components[0].properties=collection([property('Volume',false),property('Level',0.17782793939114)]);
assert.equal(f.call('fsNarrativeBetaSnapshot').ok,true,'0 dB native level with neutral Volume=false must pass');
f.original.audioTracks[0].clips[0].components[0].properties[1].setValue(0.25);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/Volume do take alterado/);
// Gain values with no explicit Level identity must not be treated as a 0 dB offset.
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].components[0].properties=collection([property('Volume',0.17782793939114)]);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/Volume do take alterado/);

// End-to-end Premiere mock with PT-BR default audio switch variants.
for(const family of ['Volume','Channel Volume','Volume do canal']){
 f=fixture('jsx/narrative-beta.jsx');
 const nativeAudio=f.original.audioTracks[0].clips[0];
 nativeAudio.components=collection([component(family,[property('Volume',false),property('Level',1)])]);
 const snap=f.call('fsNarrativeBetaSnapshot');
 assert.equal(snap.ok,true,'Default '+family+' should pass: '+snap.error);
 assert.ok(snap.hostTrace.some(x=>x.phase==='audio.volume-flag'));
 assert.ok(snap.hostTrace.some(x=>x.phase==='snapshot.build'&&x.detail.includes('3.6.5-dev-r3')));
 const preview=f.call('fsNarrativeBetaPreview',{
  sequenceID:'original',sourceSignature:snap.signature,
  cuts:[{id:'safe1',start:0,end:2},{id:'safe2',start:2.5,end:5}]
 });
 assert.equal(preview.ok,true,'Safe '+family+' should cut: '+preview.error);
 assert.equal(f.state.subclips,2);
 assert.equal(f.original.videoTracks[0].clips.length,1);
 assert.equal(f.original.audioTracks[0].clips.length,1);
 const approved=f.call('fsNarrativeBetaValidatePreview',{
  sequenceID:'original',sourceSignature:snap.signature,
  previewId:preview.previewId,previewSignature:preview.previewSignature,layout:preview.layout
 });
 assert.equal(approved.ok,true,'Safe '+family+' should validate: '+approved.error);
}
// Neutral Level may be on a separate native Volume component.
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].components=collection([
 component('Channel Volume',[property('Volume',false)]),
 component('Volume',[property('Level',1)])
]);
assert.equal(f.call('fsNarrativeBetaSnapshot').ok,true,'Cross-component neutral gain');
f.original.audioTracks[0].clips[0].components[1].properties[0].setValue(0.5);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/Volume do take alterado/);
f=fixture('jsx/narrative-beta.jsx');
f.original.audioTracks[0].clips[0].components=collection([component('Channel Volume',[property('Volume',false)])]);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/não foi possível confirmar Nível\/Level neutro/);

// Regression from real Premiere PT-BR logs, 23 Oct 2026.
f=fixture('jsx/narrative-beta.jsx');
f.original.videoTracks[0].clips[0].components[0].properties.push(property('Filtro anti-cintilação',0));
let flicker=f.call('fsNarrativeBetaSnapshot');
assert.equal(flicker.ok,true,flicker.error);
assert.ok(flicker.hostTrace.some(x=>x.phase==='motion.property'&&x.detail.includes('filtro anti-cintilacao')));
f.original.videoTracks[0].clips[0].components[0].properties.at(-1).setValue(3);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/rotação\/filtro de Movimento alterado/);

// Real-world Premiere PT-BR 23/10: Crop is exposed inside Motion as "Corte à esquerda = 0".
// All 4 neutral sides must pass; a nonzero/animated/unknown crop must still block.
for (const [side,neutral] of [
 ['Corte à esquerda',0],['Corte à direita','0'],['Corte superior','0,0'],['Corte inferior','0%'],
 ['Crop Left',0],['Crop Right','0.00'],['Crop Top',0],['Crop Bottom',0]
]) {
 f=fixture('jsx/narrative-beta.jsx');
 const cropProperty=property(side,neutral);
 f.original.videoTracks[0].clips[0].components[0].properties.push(cropProperty);
 const neutralSnapshot=f.call('fsNarrativeBetaSnapshot');
 assert.equal(neutralSnapshot.ok,true,side+': '+neutralSnapshot.error);
 assert.ok(neutralSnapshot.hostTrace.some(x=>x.phase==='motion.property'&&x.detail.includes(' = ')));
 cropProperty.setValue('7.5%');
 assert.match(f.call('fsNarrativeBetaSnapshot').error,/Corte\/Recorte de Movimento alterado/,side+' must block nonzero crop');
}
f=fixture('jsx/narrative-beta.jsx');
let animCrop=property('Corte à esquerda',0);animCrop.isTimeVarying=()=>true;
f.original.videoTracks[0].clips[0].components[0].properties.push(animCrop);
assert.match(f.call('fsNarrativeBetaSnapshot').error,/keyframes/);
f=fixture('jsx/narrative-beta.jsx');
f.original.videoTracks[0].clips[0].components[0].properties.push(property('Corte diagonal',0));
assert.match(f.call('fsNarrativeBetaSnapshot').error,/não reconhecido/);

// CEP builds exposing four native crop controls support a post-split focus change.
// No crop method is fabricated when native controls are missing.
f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
for(let t of f.original.videoTracks){
 const props=t.clips[0].components[0].properties;
 for(let name of ['Crop Left','Crop Right','Crop Top','Crop Bottom'])props.push(property(name,0));
}
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});
applied=f.call('captioniaSplitApply',prepared);
assert.equal(applied.ok,true,applied.error);
assert.equal(applied.panes.length,2);
let adjusted=f.call('captioniaSplitReframe',{sequenceID:applied.sequenceID,track:0,index:0,focusX:25,focusY:50,zoom:1.2,columns:2,rows:1,col:0,row:0});
assert.equal(adjusted.ok,true,adjusted.error);
assert.equal(adjusted.cropMethod,'intrinsic');
assert.ok(adjusted.crop.left < adjusted.crop.right);
assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[1].getValue(),100,'original motion must stay untouched');
assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[5].getValue(),0,'original Crop must stay untouched');
assert.equal(f.call('captioniaSplitReframe',{sequenceID:'original',track:0,index:0,focusX:50,focusY:50,zoom:1,columns:2,rows:1,col:0,row:0}).ok,false,'not allowed to mutate original');

// A Crop that fails mid-operation must restore all previously written values.
const cloned=f.project.activeSequence.videoTracks[0].clips[0], cropProps=cloned.components[0].properties;
const beforeReframe=cropProps.map(prop=>prop.getValue());
const bottomProp=cropProps[8], bottomSetter=bottomProp.setValue.bind(bottomProp);
let rejectedOnce=false;
bottomProp.setValue=function(value,flag){
 if(!rejectedOnce){rejectedOnce=true;return false;}
 return bottomSetter(value,flag);
};
let rejected=f.call('captioniaSplitReframe',{sequenceID:applied.sequenceID,track:0,index:0,focusX:75,focusY:50,zoom:1.4,columns:2,rows:1,col:0,row:0});
assert.equal(rejected.ok,false,'Crop setter refusal must cancel the reframe');
assert.match(rejected.error,/estado anterior.*restaurado/);
assert.deepEqual(Array.from(cropProps,prop=>prop.getValue()),Array.from(beforeReframe),'Crop and Motion must be rolled back');
assert.equal(f.original.videoTracks[0].clips[0].components[0].properties[5].getValue(),0,'original remains untouched after rollback');

// Split properties across unrelated components are NOT a writable Crop.
f=fixture('jsx/captionia-split.jsx');
f.original.videoTracks.push(f.track([f.clip(f.media('m2'),'video')]));
prepared=split.plan(f.call('captioniaSplitInspect'),{preset:'side-by-side',fit:'fill'});
applied=f.call('captioniaSplitApply',prepared);
const disjoint=f.project.activeSequence.videoTracks[0].clips[0];
disjoint.components.push(component('Crop',[property('Left',0),property('Right',0)]));
disjoint.components.push(component('Crop',[property('Top',0),property('Bottom',0)]));
const unavailable=f.call('captioniaSplitReframe',{sequenceID:applied.sequenceID,track:0,index:0,focusX:50,focusY:50,zoom:1.2,columns:2,rows:1,col:0,row:0});
assert.equal(unavailable.ok,false,'Crop properties spread across distinct effects must be rejected');
assert.match(unavailable.error,/não expõe Crop/);
assert.equal(disjoint.components[2].properties[0].getValue(),0,'unrecognized Crop must not be modified'); 


console.log('PASS: split layouts, stale selections, clone isolation, audio preservation, host geometry, safe failures, narrative identity/media/effects guards, natural profile and factual dedupe.');
