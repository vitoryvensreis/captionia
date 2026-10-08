'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const scheduler=require('../CaptionIA/js/sfx_scheduler.js');
const source=fs.readFileSync('CaptionIA/js/autosfx.js','utf8');
assert.match(source,/R=!!\[\],S='word',q=ae,W\(\)/,'AutoEdit must select spoken-word trigger mode');
assert.match(source,/CaptionIASfxDualTracks\.run\(/,'AutoEdit must use verified dual-track host calls');

const crowded=Array.from({length:46},(_,i)=>i*0.24);
const a=scheduler.plan(crowded,crowded.map(t=>t+0.20),{fps:30,minGapSeconds:0.85});
assert(a.times.length<=13,'dense 11s interval should use far fewer than 46 SFX');
assert(a.times.length>=8,'should keep a useful set of accents');
assert.deepEqual(a.fins,[],'AutoEdit should not force trim at caption end');
for(let i=1;i<a.times.length;i++){
  assert(a.times[i]-a.times[i-1]>=0.84,'SFX must not be too close');
}
assert.equal(a.received,46);
assert(a.omittedSpacing>=30);

const b=scheduler.plan([2.213,0,0.2,1.111,1.3,2.213,NaN,-5],null,{fps:30});
assert.deepEqual(b.times,[0,1.111,2.213],'preserve positions and remove clustered events');
assert.equal(b.omittedInvalid,2);
assert(b.omittedDuplicate>=1);
assert.deepEqual(scheduler.plan([],[],{}).times,[]);
assert.deepEqual(scheduler.plan([0,1],[0.01,1.5],{fps:30}).times,[1]);
console.log('AutoSFX scheduler PASS: original '+a.received+', planned '+a.times.length+', no caption-end trims');
