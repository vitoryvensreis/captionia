'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const js=f=>require(path.join(__dirname,'..','js',f));
const time=js('captionia-timebase.js');
const sfx=js('sfx_scheduler.js');
const split=js('captionia-split.js');
const bridge=js('captionia-bridge.js');
const narrative=js('narrative-beta.js').fsNarrativeBeta;

test('real 29.97 timebase snaps to integer frames (not rounded 30)',()=>{
 const d=time.frameDuration(8475667200); // 29.97 fps sequence frame ticks
 assert.ok(Math.abs(d-1/29.969999999999999)<.00005);
 assert.equal(time.frame(1,d),30);
 assert.equal(time.at(1,d),30*d);
});
test('word effects do not inherit block cooldown of 0.85s',()=>{
 const d=1/25;
 const plan=sfx.plan([0,.08,.16,.24],[],{frameDuration:d,mode:'word'});
 assert.equal(plan.times.length,4);
 const blocks=sfx.plan([0,.08,.16,.24],[],{frameDuration:d});
 assert.equal(blocks.times.length,1);
 assert.equal(plan.omittedSpacing,0);
});
test('per-word frame quantization reports same-frame collisions',()=>{
 const d=1/30;
 const p=time.schedule([{start:0,word:'A'},{start:.008,word:'B'},{start:.10,word:'C'}],{frameDuration:d});
 assert.equal(p.events.length,2);
 assert.equal(p.sameFrame,1);
});
test('SFX remapping follows edited preview and drops removed speech',()=>{
 const segments=[{sourceStart:10,sourceEnd:12,destStart:0,destEnd:2},{sourceStart:15,sourceEnd:17,destStart:2,destEnd:4}];
 const p=time.schedule([10.5,13,15.5],{frameDuration:1/25,segments});
 assert.deepEqual(p.events.map(e=>e.time),[.52,2.52]);
 assert.equal(p.omittedByEdit,1);
});
test('2x2 split geometry fits 4 videos without touching the Premiere host',()=>{
 const snapshot={sequenceID:'seq',signature:'stable',width:1080,height:1920,pixelAspect:1,frameDuration:1/30,clips:[]};
 for(let i=0;i<4;i++)snapshot.clips.push({track:i,index:0,nodeId:'node'+i,name:'camera '+i,start:0,end:5,width:1920,height:1080,pixelAspect:1});
 const p=split.plan(snapshot,{preset:'grid-2x2',fit:'fit'});
 assert.equal(p.items.length,4);
 assert.equal(p.items[0].slot.width,540);
 assert.equal(p.items[0].slot.height,960);
 assert.ok(p.items.every(x=>x.scale>0));
});
test('split accepts <= one frame of start/end source rounding but not two',()=>{
 const snapshot={sequenceID:'seq',signature:'stable',width:1920,height:1080,frameDuration:1/30,clips:[
  {track:0,index:0,nodeId:'1',name:'one',start:0,end:5,width:1920,height:1080},
  {track:1,index:0,nodeId:'2',name:'two',start:1/30,end:5,width:1920,height:1080}]};
 assert.equal(split.plan(snapshot,{preset:'side-by-side',fit:'fit'}).items.length,2);
 snapshot.clips[1].start=2/30;
 assert.throws(()=>split.plan(snapshot,{preset:'side-by-side'}),/1 quadro/);
});
test('semantic Retake does not combine contradictory numerals or negations',()=>{
 const arr=[{id:'S001',text:'Não foram investidos 200 reais',blocked:false},
            {id:'S002',text:'Foram investidos 300 reais',blocked:false}];
 const grouped=narrative.verifySemanticGroups({groups:[{ids:['S001','S002'],confidence:.95,recommendedId:'S002'}]},arr);
 assert.equal(grouped.length,0);
});
test('safe bridge rejects unknown host calls (without executing script)',async()=>{
 await assert.rejects(bridge.call('unsafeJS',{}),/não autorizada/);
});
test('safe bridge forwards snapshot with no response content logging',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const script=fs.readFileSync(path.join(__dirname,'..','js','captionia-bridge.js'),'utf8');
 const context={window:{csInterface:{evalScript:(code,callback)=>callback(JSON.stringify({ok:true,sequenceID:'safe'}))}},setTimeout,clearTimeout,Date,JSON,Error,Math,Promise};
 vm.runInNewContext(script,context);
 const answer=await context.window.CaptionIABridge.call('fsNarrativeBetaSnapshot',{});
 assert.equal(answer.sequenceID,'safe');
 assert.ok(!JSON.stringify(context.window.CaptionIABridge.recent()).includes('sequenceID'));
});

test('AutoSFX spoken-word sync has no guessed 3-frame subdivisions',()=>{
 const fs=require('node:fs');const source=fs.readFileSync(path.join(__dirname,'..','js','autosfx.js'),'utf8');
 assert.match(source,/var spoken=\[\]/);
 assert.match(source,/if\(spoken\.length===ao\)/);
 assert.match(source,/ah\(ak\['ini'\],ak\['fim'\]\)/);
 assert.doesNotMatch(source,/ak\['ini'\]\+av\*af/);
});
