'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function loadCloudSave() {
    const values = new Map([
        ['framespeed_resp_original', '{"words":[{"word":"antiga"}]}'],
        ['framespeed_cortes_total', '7'],
        ['framespeed_audio_regions', '[{"s":90,"e":100}]']
    ]);
    const storage = { setItem(k, v) { values.set(k, String(v)); }, getItem(k) { return values.get(k) || null; }, removeItem(k) { values.delete(k); } };
    const window = { _fsAudioRegions: [{s:90,e:100}], _fsRespOriginal: {old:true}, _fsCortesTotal: 7 };
    const document = { readyState: 'loading', addEventListener() {} };
    let source = fs.readFileSync(path.join(root, 'js/cloud_audio_panel.js'), 'utf8');
    // Expose the existing private function in the test VM only.
    source = source.replace('function init(){', 'w.testSave=save;function init(){');
    vm.runInNewContext(source, { window, document, localStorage:storage, Promise, Date, Array, Number, isFinite });
    return { window, values };
}

test('new cloud transcription replaces previous cut history and persists current audio regions', () => {
    const {window, values} = loadCloudSave();
    const words = {words:[{word:'nova',start:1,end:1.3}]};
    window.testSave(words, 'sequence-A', [{text:'nova',startTime:1,endTime:1.3}], [{s:0,e:4}]);
    assert.equal(window._fsLastResp._fsSeq, 'sequence-A');
    assert.equal(window._fsRespOriginal, null);
    assert.equal(window._fsCortesTotal, 0);
    assert.equal(values.has('framespeed_resp_original'), false);
    assert.equal(values.has('framespeed_cortes_total'), false);
    assert.deepEqual(JSON.parse(values.get('framespeed_audio_regions')), [{s:0,e:4}]);
});

test('file transcription cannot inherit timeline regions or restore history from a previous run', () => {
    const {window, values} = loadCloudSave();
    window.testSave({words:[{word:'arquivo',start:0,end:.5}]}, 'sequence-B', [], null);
    assert.equal(window._fsAudioRegions, null);
    assert.equal(values.has('framespeed_audio_regions'), false);
    assert.equal(values.has('framespeed_resp_original'), false);
});

test('invalid audio regions are discarded before the legacy speech filter sees them', () => {
    const {window, values} = loadCloudSave();
    window.testSave({words:[]}, 'sequence-A', [], [{s:NaN,e:2},{s:3,e:2},{s:-1,e:2},{s:0,e:4}]);
    assert.deepEqual(JSON.parse(values.get('framespeed_audio_regions')), [{s:0,e:4}]);
});

test('failed Groq verification retries at most once per minute instead of once per second', async () => {
    let now = 1000000000000, requests = 0;
    const intervals = [];
    const window = { addEventListener() {}, CaptionIALicense: { isAuthorized:()=>true, apiRequest:()=>{requests++;return Promise.resolve({connected:false});} } };
    const document = { readyState:'loading', addEventListener(){}, getElementById(){return null;} };
    let source = fs.readFileSync(path.join(root, 'js/groq_access.js'), 'utf8');
    source = source.replace('})(window,document);', "owner='fixture';show=function(){};refreshPanel=function(){};setChecking=function(value){checking=value;};})(window,document);");
    vm.runInNewContext(source, {window,document,Promise,Date:{now:()=>now},setInterval:fn=>{intervals.push(fn);},setTimeout(){},console});
    const tick = intervals[0];
    tick(); for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(requests,1);
    for(let i=1;i<60;i++){now+=1000;tick();for(let j=0;j<5;j++)await Promise.resolve();}
    assert.equal(requests,1);
    now+=1000;tick();for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(requests,2);
});

test('frame duration refresh follows 30 to 60 fps and clears stale values when the host fails', () => {
    const source = fs.readFileSync(path.join(root, 'js/transcription.js'), 'utf8');
    const start = source.indexOf('var aD=0x0;function captioniaRefreshFrame(');
    const end = source.indexOf("window['fsMedirDerivaCorte']", start);
    assert.ok(start >= 0 && end > start);
    let seconds = 1/30, failure = false;
    const context = { setTimeout, clearTimeout, JSON, Number,
        csInterface:{evalScript(script, done){
            assert.equal(script,'fsFrameDaSequencia()');
            done(failure ? 'EvalScript error.' : JSON.stringify({ok:true,tpfSeg:seconds}));
        }} };
    vm.runInNewContext(source.slice(start,end)+';this.refresh=captioniaRefreshFrame;this.frame=function(){return aD;};',context);
    let completed = 0;
    context.refresh(()=>{completed++;}); assert.equal(context.frame(),1/30);
    seconds=1/60; context.refresh(()=>{completed++;}); assert.equal(context.frame(),1/60);
    failure=true; context.refresh(()=>{completed++;}); assert.equal(context.frame(),0);
    assert.equal(completed,3);
});
