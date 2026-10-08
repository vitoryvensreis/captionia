const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const elements={},created=[];
function el(tag){
 const o={tagName:tag,style:{},disabled:false,children:[],textContent:'',
 appendChild(x){this.children.push(x);if(x.id)elements[x.id]=x;return x;},
 querySelector(){return this;}};
 created.push(o);return o;
}
elements['transcribe-modal']=el('div');
const doc={readyState:'complete',createElement:el,getElementById(id){return elements[id]||null;}};
let metadataCalled=false;
const w={
 CaptionIACloudCore:{
 getConfig(){return Promise.resolve({features:{caption_plan:true}});},
 planCaptions(words){assert.equal(words.length,2);return Promise.resolve({schema_version:2,segments:[
 {text:'Boa noite',lines:['Boa noite'],start_time:0,end_time:1}]});}
 },
 _fsLastResp:{_fsSeq:'seq1',words:[{word:'Boa',start:0,end:.4},{word:'noite',start:.5,end:1}]},
 premiereSrtData:[{text:'Original',startTime:0,endTime:1}],
 fsConferirDonoTranscricao(cb){cb({seq:'seq1',descartou:false});},
 fsAttachWordTimings(cues,words){metadataCalled=true;assert.equal(words[0].word,'Boa');return cues;}
};
const localStorage={setItem(){}};
const ctx={window:w,document:doc,localStorage,LS_KEYS:{SRT_DATA:'srt'},console,Promise,JSON,Error,Number,isFinite};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('CaptionIA/js/cloud_captions_ui.js','utf8'),ctx);
(async()=>{
 const button=created.find(x=>x.tagName==='button'&&x.textContent==='Prévia na nuvem');
 assert.ok(button);button.onclick();
 await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
 assert.equal(w.premiereSrtData[0].text,'Original');
 assert.equal(elements['cia-cloud-apply'].disabled,false);
 elements['cia-cloud-apply'].onclick();
 assert.equal(w.premiereSrtData[0].text,'Boa noite');
 assert.ok(metadataCalled);
 elements['cia-cloud-revert'].onclick();
 assert.equal(w.premiereSrtData[0].text,'Original');
 console.log('Cloud captions smoke test PASS');
})().catch(e=>{console.error(e);process.exit(1);});
