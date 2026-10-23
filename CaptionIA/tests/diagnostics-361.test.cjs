'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/captionia-diagnostics.js'),'utf8');
function instance(store){
 const root={localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}}};
 const document={readyState:'loading',addEventListener:function(){},querySelector:function(){return null}};
 const ctx=vm.createContext({window:root,document,console,setTimeout,URL,Blob,Date});vm.runInContext(source,ctx);return root.CaptionIADiagnostics;
}
test('bounded diagnostic events persist and redact tokens, emails and Windows paths',()=>{
 const store={};const a=instance(store);
 a.record('premiere.captioniaSplitApply','failed',{code:'QE_CROP',detail:'token gsk_ABCDEFGHIJKLMNOP1234567890 user vitor@example.com C:\\Users\\vitor\\secret\\test.log'});
 const events=JSON.parse(JSON.stringify(a.recent()));assert.equal(events.length,1);assert.equal(events[0].action,'premiere.captioniaSplitApply');
 const payload=JSON.stringify(events);assert.doesNotMatch(payload,/gsk_ABC|vitor@example.com|secret\\\\test/);
 const b=instance(store);assert.equal(b.recent().length,1);
 for(let i=0;i<170;i++)b.record('narrative.step','ok',{phase:'plan'});
 assert.equal(b.recent().length,120);
});
test('does not persist arbitrary payload keys',()=>{
 const store={},api=instance(store);
 api.record('groq.request','info',{transcription:'this is customer speech',api_key:'SECRET',detail:'done'});
 const json=store.captionia_diagnostics_v1;
 assert.doesNotMatch(json,/this is customer speech|api_key|SECRET/);
});
