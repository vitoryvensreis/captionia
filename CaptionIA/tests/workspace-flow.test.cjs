'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Minimal DOM adapter for navigation policy. Rendering is tested separately in Premiere.
function fixture() {
    const ids = new Map(), selectors = new Map(), clicks = [], keys = new Map(), listeners = {};
    let document;
    class Element {
        constructor(name) { this.name=name;this.hidden=false;this.style={};this.attributes={};this.children=[];this.listeners={};this.isConnected=true;this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),remove:name=>this.classes.delete(name)}; }
        setAttribute(k,v){this.attributes[k]=String(v);}
        getAttribute(k){return this.attributes[k]||null;}
        addEventListener(k,fn){this.listeners[k]=fn;}
        appendChild(el){this.children.push(el);return el;}
        click(){clicks.push(this.name);}
        focus(){document.activeElement=this;}
        contains(el){return el===this||this.children.includes(el);}
        getBoundingClientRect(){return {left:20,top:35,right:220,bottom:80,width:this.name==='bubble'?340:200,height:this.name==='bubble'?220:45};}
        scrollIntoView(){}
        querySelector(selector){if(selector==='.captionia-tour-bubble')return this.bubble;if(selector==='.captionia-tour-highlight')return this.highlight;return null;}
        querySelectorAll(){return this.buttons||[];}
        set innerHTML(value){
            this.html=value;
            if(value.includes('captionia-tour-shade')){this.bubble=new Element('bubble');this.highlight=new Element('highlight');this.children=[this.bubble,this.highlight];}
            if(value.includes('id="captionia-tour-title"')){const title=new Element('title');ids.set('captionia-tour-title',title);this.buttons=[new Element('skip'),new Element('next')];this.children=[title,...this.buttons];}
        }
    }
    ['captionia-home','captionia-context','captionia-home-tab','captionia-view-title','captionia-view-description','captionia-start-edit'].forEach(id=>ids.set(id,new Element(id)));
    const body=new Element('body'), main=new Element('main'), footer=new Element('footer'), opener=new Element('opener');
    const tabs=['all','favorites','autoedit','auto-aplicar','autocut','dinamica','copiar-estilo','sfx-auto'].map(name=>{const tab=new Element('tab:'+name);tab.setAttribute('data-filter',name);selectors.set('.sidebar-tab[data-filter="'+name+'"]',tab);return tab;});
    selectors.set('.app-body',main);selectors.set('.app-footer',footer);selectors.set('[data-dyn="teladividida"]',new Element('split-tab'));
    document={body,activeElement:opener,readyState:'loading',getElementById:id=>ids.get(id)||null,querySelector:s=>s[0]==='#'?ids.get(s.slice(1))||null:selectors.get(s)||null,querySelectorAll:s=>s==='.sidebar-tab'?tabs:[],createElement:name=>new Element(name),addEventListener:(name,fn)=>{listeners[name]=fn;}};
    const window={innerWidth:380,innerHeight:600,localStorage:{getItem:k=>keys.get(k)||null,setItem:(k,v)=>keys.set(k,v)},addEventListener(){},setTimeout:fn=>{fn();},csInterface:{evalScript(){throw Error('A tutorial must never call Premiere');}}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/captionia-workspace.js'),'utf8'),{window,document,MutationObserver:function(){},console});
    return {api:window.CaptionIAWorkspace,document,window,ids,clicks,keys,listeners,main,footer,opener};
}

test('workspace routes only navigate, and the home hides inactive timeline tools',()=>{
    const f=fixture();
    assert.equal(f.api.open('home'),true);assert.equal(f.main.hidden,true);assert.equal(f.footer.hidden,true);
    f.api.open('autocut');assert.equal(f.main.hidden,false);assert.equal(f.footer.hidden,false);
    assert.deepEqual(f.clicks,['tab:autocut']);
    f.api.open('split');assert.deepEqual(f.clicks,['tab:autocut','tab:dinamica','split-tab']);
    assert.equal(f.api.open('unknown'),false);
});

test('tutorial can be skipped, restores focus and can be reopened after dismissal',()=>{
    const f=fixture();f.api.open('autocut');f.api.startTutorial();
    const layer=f.document.body.children[0];assert.equal(layer.hidden,false);
    assert.equal(f.api.getRoute(),'home');
    f.api.endTutorial();assert.equal(layer.hidden,true);assert.equal(f.api.getRoute(),'autocut');
    assert.equal(f.keys.get('captionia_onboarding_v1'),'seen');assert.equal(f.document.activeElement,f.opener);
    f.api.startTutorial();assert.equal(layer.hidden,false);
    f.listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(layer.hidden,true);
    assert.equal(f.api.getRoute(),'autocut');
    assert.ok(f.clicks.every(name=>name.startsWith('tab:')),'tutorial must not click any editing action');
});

test('next tutorial step opens cuts without executing analysis, cutting or transcription',()=>{
    const f=fixture();f.api.startTutorial();const layer=f.document.body.children[0];
    layer.listeners.click({target:{getAttribute:()=> 'next'}});
    assert.equal(f.api.getRoute(),'autocut');
    assert.deepEqual(f.clicks,['tab:autocut']);
    assert.ok(parseFloat(layer.bubble.style.left)>=12);
    assert.ok(parseFloat(layer.bubble.style.top)>=12);
});
