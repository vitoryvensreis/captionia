'use strict';const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto'),path=require('path'),{EventEmitter}=require('events');
const base=path.join(__dirname,'../CaptionIA/js');const source=n=>fs.readFileSync(path.join(base,n),'utf8');
const narrative=source('narrative-beta.js'), transcribe=source('cloud_audio_panel.js'),storeCode=source('secure_storage.js'),gate=source('groq_access.js'),autoedit=source('autoedit.js');
const main=source('main.js'),manifest=fs.readFileSync(path.join(base,'../CSXS/manifest.xml'),'utf8');
assert.match(main,/CURRENT_VERSION='3\.4\.9'/);assert.match(manifest,/ExtensionBundleVersion="3\.4\.9"/);
assert.match(storeCode,/credentials-'\+ownerHash/);assert.match(storeCode,/function accountName/);assert.match(storeCode,/setOwner:function/);assert.doesNotMatch(storeCode,/w\.fsSecureKeyStore=api;try\{api\.migrate\(\)/);
for(const [label,src] of [['transcription',transcribe],['narrative',narrative]]){
 assert.ok(!src.includes('caption.escotilhaprodutora.com'),label+' still uses cloud groq');assert.ok(!src.includes('/api/v1/core/narrative/analyze')&&!src.includes('/api/v1/core/transcription'),label+' cloud route');assert.ok(src.includes('api.groq.com'),label+' missing direct Groq');
}
assert.ok(transcribe.includes('CaptionIACloudCore.planCaptions'),'legenda server planning remains');assert.ok(autoedit.includes('CaptionIAGroqAccess.ensureReady'),'AutoEdit preflight');
assert.ok(narrative.includes('CaptionIAGroqAccess.isReady'),'Narrative preflight');
assert.ok(!transcribe.includes('Groq da nuvem (padrão)'));
assert.ok(!narrative.includes("personal?'api.groq.com'"));
const events={};let current='one',currentKey='gsk_'+('a'.repeat(30)),status=200,shouldContainModels=true;
const userKeys={'one':currentKey};
const mockStore={setOwner:(u)=>{current=String(u);return true;},get:()=>userKeys[current]||'',set:k=>{userKeys[current]=k;return true;},remove:()=>{delete userKeys[current];return true;}};
function fakeHttps(){return {request:(opts,callback)=>{
 const request=new EventEmitter();request.setTimeout=()=>{};request.destroy=e=>{if(e)request.emit('error',e)};request.end=()=>{
 const resp=new EventEmitter();resp.statusCode=status;resp.headers={};callback(resp);
 const body=status===200?{data:shouldContainModels?[{id:'openai/gpt-oss-120b'},{id:'whisper-large-v3'}]:[{id:'whisper-large-v3'}]}:{error:{message:'test'}};
 process.nextTick(()=>{resp.emit('data',Buffer.from(JSON.stringify(body)));resp.emit('end');});
 };return request;
 }};}
const license={isAuthorized:()=>true,getState:()=>({user:{id:current}})};
const doc={readyState:'loading',body:null,addEventListener:(event,cb)=>{events[event]=cb;},getElementById:()=>null};
const ctx={window:{fsSecureKeyStore:mockStore,CaptionIALicense:license},document:doc,localStorage:{},Buffer,Date,Math,Promise,Error,isFinite,Number,String,setInterval:()=>1,clearInterval:()=>{},console,
 require:n=>n==='https'?fakeHttps():require(n)};
vm.runInNewContext(gate,ctx,{filename:'groq_access.js'});
const access=ctx.window.CaptionIAGroqAccess;
async function mainTest(){
 await access.onLicense({detail:{user:{id:'one'}}}); await new Promise(r=>setImmediate(r));
 assert.equal(access.isReady(),true,'valid credential unlocks');
 access.observe({'x-ratelimit-limit-tokens':'8000','x-ratelimit-remaining-tokens':'3000','x-ratelimit-reset-tokens':'5s'},'openai/gpt-oss-120b',200);
 assert.equal(access.quota().remainingTokens,3000);assert.equal(access.quota().limitTokens,8000);
 assert.ok(access.quota().resetAt>Date.now());
 // Switching accounts must not expose the first account's credentials.
 access.onLicense({detail:{user:{id:'two'}}});await new Promise(r=>setImmediate(r));
 assert.equal(access.isReady(),false,'new account without key must remain locked');assert.equal(mockStore.get(),'');
 userKeys.two='gsk_'+('b'.repeat(30));status=200;await access.verify(true);assert.equal(access.isReady(),true);
 status=401;await access.verify(true);assert.equal(access.isReady(),false,'revoked key locks account');
 status=200;shouldContainModels=false;await access.verify(true);assert.equal(access.isReady(),false,'missing model locks account');
 shouldContainModels=true;await access.verify(true);assert.equal(access.isReady(),true);
 access.onLogout();assert.equal(access.isReady(),false);
 console.log('PASS v3.4.9: provider direct, private key per user, model access, 401, limit headers, logout, license and AutoEdit guards');
}
mainTest().catch(err=>{console.error('FAIL',err);process.exitCode=1});