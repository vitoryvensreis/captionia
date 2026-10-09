'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
let source=fs.readFileSync('CaptionIA/js/narrative-beta.js','utf8');
source=source.replace('root.fsAutoEditNarrativa=run;','root.__groqForTests=groq;root.fsAutoEditNarrativa=run;');
async function run(status){
 const reqs=[],observed=[];
 const net={request(opts,done){
  reqs.push(opts);const req=new EventEmitter();
  req.end=()=>process.nextTick(()=>{const resp=new EventEmitter();resp.statusCode=status;resp.headers={};done(resp);
   process.nextTick(()=>{const body=status===200?{ok:true,result:{cuts:[{id:'S001'}]},rate_limit:{'x-ratelimit-remaining-tokens':'7000'}}:{error:'Credencial recusada'};resp.emit('data',Buffer.from(JSON.stringify(body)));resp.emit('end');});
  });req.destroy=e=>{if(e)req.emit('error',e)};return req;
 }};
 const license={getAccessToken(){return 'license-token'}};
 const w={CaptionIALicense:license,CaptionIAGroqAccess:{isReady:()=>true,observe(...args){observed.push(args)}}};
 const context={window:w,document:undefined,localStorage:{getItem(){return null;}},require:n=>n==='https'?net:require(n),Buffer,process,console};
 vm.runInNewContext(source,context);
 try{return {result:await w.__groqForTests([{role:'system',content:'editor'},{role:'user',content:'texto'}]),reqs,observed};}
 catch(error){return {error,reqs,observed};}
}
(async()=>{
 const ok=await run(200);assert.equal(ok.reqs[0].hostname,'caption.escotilhaprodutora.com');
 assert.equal(ok.reqs[0].path,'/api/v1/groq/narrative/analyze');
 assert.equal(ok.reqs[0].headers.Authorization,'Bearer license-token');
 assert.equal(ok.result.cuts[0].id,'S001');assert.equal(ok.observed[0][0].rate_limit['x-ratelimit-remaining-tokens'],'7000');
 const bad=await run(403);assert.equal(bad.error.status,403);assert.equal(bad.reqs.length,1);
 console.log('PASS secure narrative gateway, no Groq secret and no fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
