'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const vm=require('vm');
const dual=require('../CaptionIA/js/sfx_dual_tracks.js');
const source=fs.readFileSync('CaptionIA/js/autosfx.js','utf8');
const html=fs.readFileSync('CaptionIA/index.html','utf8');
assert.match(source,/R=!!\[\],S='word',q=ae,W\(\)/,'AutoEdit must use exact transcribed words');
assert.match(source,/CaptionIASfxDualTracks\.run\(/,'AutoEdit must call two layer sender');
assert(html.indexOf('js/sfx_dual_tracks.js')<html.indexOf('js/autosfx.js'));

const phrase=[0.10,0.27,0.48,0.77]; // "eu quero ir embora"
assert.deepEqual(dual.split(phrase),[[0.1,0.48],[0.27,0.77]]);
assert.deepEqual(dual.chooseTwo([2,3,4],-1),[3,4]);
assert.deepEqual(dual.chooseTwo([2,3,4],2),[2,4]);
assert.throws(()=>dual.chooseTwo([2],-1),/duas trilhas/);
let calls=[],states={3:0,4:0};
const cs={
 evalScript(command,done){
  if(command.includes('var all=[],free=[]')){
   done(JSON.stringify({ok:true,free:[3,4],all:[]}));
  }else if(command.includes('return JSON.stringify({ok:true,a:')){
   done(JSON.stringify({ok:true,a:states[3],b:states[4]}));
  }else if(command.startsWith('distributeSfxAtTimes(')){
   const data=vm.runInNewContext(command,{
     distributeSfxAtTimes(file,rawTimes,offset,track,rawPaths,rawVolumes,rawEnds){
      return {file,times:JSON.parse(rawTimes),offset,track,paths:JSON.parse(rawPaths),ends:JSON.parse(rawEnds)};
     }
   });
   calls.push(data);
   states[data.track]+=data.times.length;
   done(JSON.stringify({count:data.times.length,pulados:0,cortados:0}));
  }else throw Error('Unexpected ExtendScript request: '+command);
 }
};
dual.run({csInterface:cs,times:phrase,paths:['FS Crisp Snap.wav'],volumes:[-14],frameOffset:0,preferredTrack:-1},function(result){
 assert.equal(result.count,phrase.length);
 assert.equal(result.previstos,phrase.length);
 assert.equal(result.duasCamadas,true);
 assert.equal(result.cortados,0);
 assert.equal(result.track,'A4 + A5');
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0].times,[0.1,0.48]);
 assert.deepEqual(calls[1].times,[0.27,0.77]);
 assert.equal(calls[0].track,3);
 assert.equal(calls[1].track,4);
 assert.deepEqual(calls[0].ends,[]);
 assert.deepEqual(calls[1].ends,[]);
});
let blocked=false;
dual.run({csInterface:{evalScript(cmd,done){if(!cmd.includes('var all=[],free=[]'))throw Error('audio changed without tracks');done(JSON.stringify({ok:true,free:[3]}));}},times:phrase,paths:['snap.wav']},function(result){
 blocked=true;assert.match(result.error,/duas trilhas/);
});
assert(blocked);
console.log('AutoSFX dual track PASS: four words → four sounds, two verified layers, no forced caption trims');
