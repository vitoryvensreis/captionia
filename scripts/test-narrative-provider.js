'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),EventEmitter=require('node:events');
let source=fs.readFileSync(path.join(__dirname,'../CaptionIA/js/narrative-beta.js'),'utf8');
source=source.replace('root.fsAutoEditNarrativa=run;','root.__groqForTests=groq;root.__providerForTests=groqProvider;root.fsAutoEditNarrativa=run;');
async function run(mode,responses){
 const requests=[],events=[];
 const net={request(opts,done){requests.push(opts);const req=new EventEmitter();let body='';req.end=function(value){body=value;events.push(JSON.parse(body));process.nextTick(()=>{
 const item=responses.shift(),resp=new EventEmitter();resp.statusCode=item.status||200;done(resp);process.nextTick(()=>{
 resp.emit('data',Buffer.from(JSON.stringify(item.body||{})));resp.emit('end');});});};req.destroy=function(e){if(e)req.emit('error',e)};return req;}};
 let getKeyCalls=0,refreshes=0,token='cloud-token';
 const store={getItem:k=>k==='captionia_groq_key_mode_v1'?mode:null,setItem(){},removeItem(){}};
 const w={fsSecureKeyStore:{get(){getKeyCalls++;return 'gsk_'+ 'Z'.repeat(45);}},CaptionIALicense:{isAuthorized:()=>true,getAccessToken:()=>token,recheck(){refreshes++;token='fresh-token';return Promise.resolve();}}};
 const ctx={window:w,document:undefined,localStorage:store,require:name=>name==='https'?net:require(name),Buffer,process,console};
 vm.runInNewContext(source,ctx);
 const result=await w.__groqForTests([{role:'system',content:'Editor de vídeo.'},{role:'user',content:'Segmentos S001 e S002'}]);
 return {result,requests,events,getKeyCalls,refreshes};
}
(async()=>{
 const success={ok:true,result:{cuts:[{id:'S001'}]},model:'openai/gpt-oss-120b'};
 const cloud=await run('cloud',[{body:success}]);
 assert.equal(cloud.requests[0].hostname,'caption.escotilhaprodutora.com');
 assert.equal(cloud.requests[0].path,'/api/v1/core/narrative/analyze');
 assert.equal(cloud.requests[0].headers.Authorization,'Bearer cloud-token');
 assert.equal(cloud.getKeyCalls,0,'Cloud must NOT read the personal Groq secret');
 assert.equal(cloud.result.cuts[0].id,'S001');
 assert.deepEqual(Object.keys(cloud.events[0]),['messages']);
 console.log('PASS cloud default: license token, correct API, personal key untouched');
 const personal=await run('personal',[{body:{choices:[{message:{content:JSON.stringify({cuts:[{id:'S001'}]})}}]}}]);
 assert.equal(personal.requests[0].hostname,'api.groq.com');
 assert.equal(personal.requests[0].headers.Authorization,'Bearer gsk_'+ 'Z'.repeat(45));
 assert.equal(personal.getKeyCalls,1);assert.equal(personal.events[0].model,'openai/gpt-oss-120b');
 console.log('PASS personal: direct Groq only after explicit selection');
 const again=await run('cloud',[{status:401,body:{error:'Sessão expirada'}},{body:success}]);
 assert.equal(again.refreshes,1);assert.equal(again.requests[1].headers.Authorization,'Bearer fresh-token');
 console.log('PASS expired cloud token refreshed once');
 let failed=false;try{await run('cloud',[{status:503,body:{error:'Nuvem temporariamente indisponível'}}]);}catch(e){failed=true;assert.match(e.message,/Groq da nuvem: Nuvem temporariamente indisponível/);}
 assert.equal(failed,true);
 console.log('PASS cloud failure does not silently switch to personal key');
})().catch(e=>{console.error(e);process.exit(1)});