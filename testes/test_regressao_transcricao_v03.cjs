const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../CaptionIA/js/narrative-beta.js'),'utf8');
const storage={},context={window:{},document:undefined,console,require,localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]}};
vm.runInNewContext(code,context);
const engine=context.window.fsNarrativeBeta;
const original={_fsSeq:'ORIGINAL',words:[{word:'Abertura',start:6,end:6.35},{word:'conteúdo',start:10.2,end:10.6},{word:'final',start:.2,end:.65}]};
const cuts=[{id:'A',start:6,end:6.35},{id:'B',start:10.2,end:10.6},{id:'C',start:.2,end:.65}];
const layout=[{id:'A',sourceStart:6,sourceEnd:6.35,destStart:0,destEnd:.3666667},{id:'B',sourceStart:10.2,sourceEnd:10.6,destStart:.3666667,destEnd:.7666667},{id:'C',sourceStart:.2,sourceEnd:.65,destStart:.7666667,destEnd:1.233333}];
context.window._fsLastResp=null; // Reproduz o descarte automático quando a sequência muda.
const out=engine.remapTranscript(original,cuts,layout,'PREVIEW');
assert.equal(out._fsSeq,'PREVIEW');assert.equal(out.words.length,3);
assert.ok(Math.abs(out.words[0].start)<.001);assert.ok(Math.abs(out.words[1].start-.3666667)<.001);
assert.ok(out.words[2].start>=.76);assert.equal(original._fsSeq,'ORIGINAL');
assert.throws(()=>engine.remapTranscript(original,cuts,layout.slice(1),'PREVIEW'));
console.log('PASS narrative regression: original cached, reorder/timebase remap, missing layout rejected');