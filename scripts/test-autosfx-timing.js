'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const store=new Map();
global.localStorage={
 getItem(k){return store.has(k)?store.get(k):null;},
 setItem(k,v){store.set(k,String(v));}
};
global.window={_fsLastResp:null};
const cal=require('../CaptionIA/js/sfx_timing_calibration.js');
const source=fs.readFileSync('CaptionIA/js/autosfx.js','utf8');
const html=fs.readFileSync('CaptionIA/index.html','utf8');
assert(/window\.CaptionIASfxTiming\.apply\(a0(?:,|\))/.test(source),'Calibração deve ser aplicada aos tempos dos SFX');
assert(html.indexOf('js/sfx_timing_calibration.js')<html.indexOf('js/autosfx.js'));
const guard=fs.readFileSync('CaptionIA/js/autocut_warp_guard.js','utf8');
const dual=require('../CaptionIA/js/sfx_dual_tracks.js');
assert(html.indexOf('js/autocut_warp_guard.js')>html.indexOf('js/autocut.js'));
assert(html.indexOf('js/autocut_warp_guard.js')<html.indexOf('js/autoedit.js'));
assert(guard.includes('Warp Stabilizer')&&!guard.includes('fx.remove()'),'Preflight nunca pode remover efeitos automaticamente');
assert(typeof dual.addTracksScript==='function');
assert(dual.addTracksScript().includes('addTracks'));
assert(!fs.readFileSync('CaptionIA/js/sfx_timing_calibration.js','utf8').includes("document.addEventListener('DOMContentLoaded',setup)"));


assert.throws(()=>cal.apply([0.2]),/Transcrição/);

global.window._fsLastResp={
  _fsSeq:'sequence-123',
  words:[
    {word:'eu',start:0.2,end:0.4},
    {word:'quero',start:0.5,end:0.7},
    {word:'ir',start:0.8,end:1.0},
    {word:'embora',start:1.1,end:1.4}
  ]
};
const times=[0.2,0.5,0.8,1.1];
let a=cal.apply(times);
assert.deepEqual(a.times,times);
const list=cal.words();
const state=cal.read(list);
state.global=-2;
state.fps=30;
state.corrections[2]=3;
cal.write(list,state);
a=cal.apply(times);
assert.equal(a.affected,4);
assert(Math.abs(a.times[0]-(0.2-2/30))<1e-7);
assert(Math.abs(a.times[1]-(0.5-2/30))<1e-7);
assert(Math.abs(a.times[2]-(0.8+1/30))<1e-7);
assert(Math.abs(a.times[3]-(1.1-2/30))<1e-7);
assert.throws(()=>cal.apply([0.2,0.5,0.8]),/mudou/);
assert.throws(()=>cal.apply([0.2,0.55,0.8,1.1]),/mudou/);

const swapped=cal.read(list);
swapped.global=0;
swapped.corrections[1]=15;
swapped.corrections[2]=-15;
cal.write(list,swapped);
const resolved=cal.apply(times);
assert.equal(resolved.times.length,times.length);
assert(resolved.conflicts>=1,'Inversões precisam ser contabilizadas');
assert(resolved.times[1]>resolved.times[2],'Conflito não deve forçar a fala a mudar de ordem');
const tracks=dual.split(resolved.times);
assert.equal(tracks[0].length+tracks[1].length,times.length,'Todos os disparos válidos precisam permanecer');
assert(tracks[0].every((v,i,a)=>i===0||v>=a[i-1]),'Eventos na camada A desordenados');
assert(tracks[1].every((v,i,a)=>i===0||v>=a[i-1]),'Eventos na camada B desordenados');
const otherKey=cal.identity(list);
global.window._fsLastResp.words[0].word='nós';
assert.notEqual(cal.identity(cal.words()),otherKey);
assert.equal(cal.read(cal.words()).global,0);
assert.equal(Object.keys(cal.read(cal.words()).corrections).length,0);
console.log('AutoSFX sync PASS: individual word offsets, global frames, sequence isolation and ordering');
