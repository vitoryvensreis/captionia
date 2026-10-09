'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
let source=fs.readFileSync('CaptionIA/js/narrative-beta.js','utf8');
source=source.replace('root.fsAutoEditNarrativa=run;','root.__groqForTests=groq;root.fsAutoEditNarrativa=run;');
async function run(status){
 const requests=[];let touched=0,observed=0;
 const net={request(opts,done){requests.push(opts);const req=new EventEmitter();
 req.end=()=>process.nextTick(()=>{const resp=new EventEmitter();resp.statusCode=status;resp.headers={};done(resp);process.nextTick(()=>{const body=status===200?{choices:[{message:{content:JSON.stringify({cuts:[{id:'S001'}]})}}]}:{error:{message:'invalid test key'}};resp.emit('data',Buffer.from(JSON.stringify(body)));resp.emit('end');});});
 req.destroy=e=>{if(e)req.emit('error',e)};return req;}};
 const w={fsSecureKeyStore:{get(){touched++;return 'gsk_'+'Z'.repeat(45);}},CaptionIAGroqAccess:{isReady:()=>true,observe(){observed++;}}};
 const ctx={window:w,document:undefined,localStorage:{getItem(){return null}},require:n=>n==='https'?net:require(n),Buffer,process,console};
 vm.runInNewContext(source,ctx);
 try{const value=await w.__groqForTests([{role:'user',content:'Organize roteiro'}]);return {value,requests,touched,observed};}
 catch(error){return {error,requests,touched,observed};}
}
(async()=>{
 const ok=await run(200);assert.equal(ok.requests[0].hostname,'api.groq.com');
 assert.equal(ok.requests[0].path,'/openai/v1/chat/completions');
 assert.equal(ok.requests[0].headers.Authorization,'Bearer gsk_'+'Z'.repeat(45));
 assert.equal(ok.touched,1);assert.equal(ok.value.cuts[0].id,'S001');assert.equal(ok.observed,1);
 const invalid=await run(401);assert.equal(invalid.error.status,401);
 assert.equal(invalid.requests.length,1,'No cloud fallback on invalid personal key');
 console.log('PASS narrative: personal-only Groq, no cloud fallback, quota observations');
})().catch(e=>{console.error(e);process.exitCode=1});
