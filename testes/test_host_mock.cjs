const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../CaptionIA/jsx/narrative-beta.jsx','utf8');
let sequences=[],active;
function collection(items){return new Proxy(items,{get(target,key){if(key==='numItems')return target.length;return target[key]}})}
function item(name){return {nodeId:name,createSubClip(label,begin,end){return {nodeId:name+'_sub_'+label,name:label,duration:(Number(end)-Number(begin))/254016000000}}}}
function clip(src,start,end){return {projectItem:src,name:src.nodeId,start:{seconds:start},end:{seconds:end},inPoint:{seconds:0},outPoint:{seconds:end-start},getSpeed(){return 1},isAdjustmentLayer(){return false},remove(){let i=this._parent.indexOf(this);this._parent.splice(i,1)}}}
function track(clips){let c=collection(clips);clips.forEach(x=>x._parent=c);return {clips:c}}
function tracks(x){x.numTracks=x.length;return x}
function mkSeq(id,parts){const seq={sequenceID:id,name:id,videoTracks:tracks([track(parts.map(a=>clip(a.item,a.s,a.e)))]),audioTracks:tracks([track(parts.map(a=>clip(a.item,a.s,a.e)))]),clone(){const copy=mkSeq('clone'+(sequences.length+1),parts);sequences.push(copy);active=copy;return true},insertClip(src,t,v,a){for(const tr of [seq.videoTracks[v],seq.audioTracks[a]]){const c=clip(src,t.seconds,t.seconds+src.duration);c._parent=tr.clips;tr.clips.push(c)}return true}};return seq}
const first=item('final'),second=item('intro'),third=item('content');
const original=mkSeq('original',[{item:first,s:0,e:4},{item:second,s:4,e:8},{item:third,s:8,e:14}]);
sequences.push(original);active=original;
const project={get activeSequence(){return active},sequences:new Proxy(sequences,{get(target,k){return k==='numSequences'?target.length:target[k]}}),openSequence(id){active=sequences.find(x=>x.sequenceID===id);if(!active)throw Error('not found')}};
const env={app:{project},JSON,Math,Date,Error,isFinite,Number,String,Time:function(){this.seconds=0},$:{global:{}}};vm.runInNewContext(source,env);
const api=env.$.global;const snap=JSON.parse(api.fsNarrativeBetaSnapshot());assert.equal(snap.ok,true);assert.equal(snap.clips.length,3);
const res=JSON.parse(api.fsNarrativeBetaPreview(JSON.stringify({sequenceID:'original',cuts:[{id:'intro',start:4.1,end:7.9},{id:'content',start:8.1,end:13.9},{id:'final',start:.1,end:3.9}]})));
assert.equal(res.ok,true,res.error);assert.equal(original.videoTracks[0].clips.numItems,3);assert.equal(original.audioTracks[0].clips.numItems,3);assert.equal(active.videoTracks[0].clips.numItems,3);assert.equal(active.audioTracks[0].clips.numItems,3);assert.ok(active.videoTracks[0].clips[0].projectItem.nodeId.startsWith('intro'));
assert.equal(JSON.parse(api.fsNarrativeBetaRestore(JSON.stringify({sequenceID:'original'}))).ok,true);assert.equal(active.sequenceID,'original');
console.log('PASS mock Premiere: clone, insert video/audio, reordering, preserve original, restore');