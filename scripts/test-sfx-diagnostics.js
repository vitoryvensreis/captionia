'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const dual=require('../CaptionIA/js/sfx_dual_tracks.js');
const src=fs.readFileSync('CaptionIA/js/sfx_track_diagnostics.js','utf8');
const elements={};
function make(tag){
 const el={tag,style:{},children:[],textContent:'',disabled:false,
 appendChild(ch){this.children.push(ch);ch.parentNode=this;return ch;},
 addEventListener(event,cb){this['_'+event]=cb;},
 querySelector(selector){return selector==='.ae-rodape'?elements.footer:null;},
 insertBefore(ch,other){this.children.splice(this.children.indexOf(other),0,ch);ch.parentNode=this;}
 };
 return el;
}
elements.parent=make('div');elements.footer=make('footer');elements.parent.appendChild(elements.footer);
const document={readyState:'complete',createElement:make,getElementById(x){return x==='autoedit-panel'?elements.parent:null;}};
const host={
 evalScript(code,cb){
  assert(code.includes('var all=[],free=[]'));
  cb(JSON.stringify({ok:true,free:[5,6],
    all:[
      {index:0,count:1,locked:false},
      {index:3,count:18,locked:false},
      {index:4,count:1,locked:false},
      {index:5,count:0,locked:false},
      {index:6,count:0,locked:false}
    ]}));
 }
};
const w={CaptionIASfxDualTracks:dual,csInterface:host};
vm.runInNewContext(src,{window:w,document,console,Error,JSON,Number,Array});
assert(elements.parent.children.length===2);
const panel=elements.parent.children[0];
const button=panel.children.find(c=>c.tag==='button');
const result=panel.children.find(c=>c.tag==='pre');
assert(button);
button._click();
assert.match(result.textContent,/A4: OCUPADA/);
assert.match(result.textContent,/A5: OCUPADA/);
assert.match(result.textContent,/PRONTA PARA TESTE: A6 \+ A7/);
assert.equal(button.disabled,false);
console.log('AutoSFX diagnostic PASS: occupied A4/A5 visible; empty A6/A7 selected without timeline edits');
