'use strict';
/* Pure Node/VM checks. Premiere, disk exports and media deletion are mocked. */
var assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
var root=path.resolve(__dirname,'..'),engine=require(path.join(root,'js/speech-cuts.js'));
var count=0;
function test(name,fn){fn();count++;console.log('OK '+name);}
function audio(values){return {sampleRate:1000,length:values[0].length,numberOfChannels:values.length,getChannelData:function(i){return values[i];}};}
function owner(words){return {_fsSeq:'seq-1',words:words};}
function word(text,start,end){return {word:text,start:start,end:end};}
var identity={seq:'seq-1',fps:30000/1001};
test('anti-phase stereo retains the same RMS energy as mono',function(){
 var a=new Float32Array(100),b=new Float32Array(100);for(var i=0;i<a.length;i++){a[i]=.4*Math.sin(i);b[i]=-a[i];}
 var mono=engine.rmsDb(audio([a])),stereo=engine.rmsDb(audio([a,b]));for(i=0;i<mono.length;i++)assert.ok(Math.abs(mono[i]-stereo[i])<1e-6);
});
test('a whole word inside a silence candidate splits the cut and keeps both margins',function(){
 var resp=owner([word('palavra',2,2.5)]),spans=[{s:1,e:4}],out=engine.guardSilenceCuts(spans,resp,{marginBefore:200,marginAfter:150},identity);
 assert.strictEqual(out.cortes.length,2);out.cortes.forEach(function(s){assert.ok(s.e<=1.8+1e-8||s.s>=2.65-1e-8);assert.ok(Math.abs(s.s*identity.fps-Math.round(s.s*identity.fps))<1e-7);});assert.strictEqual(spans[0].e,4);
});
test('overlapping protected words are merged and fully covered cuts are rejected',function(){
 var out=engine.guardSilenceCuts([{s:1,e:2}],owner([word('um',.9,1.4),word('dois',1.3,2.1)]),{},identity);assert.deepStrictEqual(out.cortes,[]);assert.strictEqual(out.descartados,1);
});
test('wrong sequence and synthetic timestamps cannot masquerade as real word protection',function(){
 var resp=owner([word('fala',1,2)]);assert.throws(function(){engine.guardSilenceCuts([{s:0,e:3}],resp,{}, {seq:'other',fps:30});},/sequência/);resp._fsSintetico=true;assert.strictEqual(engine.owns(resp,'seq-1'),false);
});
test('no transcript produces conservative spans and an explicit limitation',function(){
 var out=engine.guardSilenceCuts([{s:1,e:2}],null,{},identity);assert.strictEqual(out.verified,false);assert.ok(out.warning.indexOf('Transcreva')>=0);assert.ok(out.cortes[0].s>=1.12&&out.cortes[0].e<=1.88);
});
var sentence=['Essa','edição','mantém','a','fala','natural.'];
var seamWords=sentence.map(function(w,i){return word(w,.2+i*.35,.48+i*.35);}).concat(sentence.map(function(w,i){return word(w,2.55+i*.35,2.83+i*.35);}));
var seamIdentity={seq:'seq-1',fps:30,audioClips:[{track:0,start:0,end:2.5},{track:0,start:2.5,end:6}],videoClips:[]};
test('exact repeated phrase across adjacent takes is review-only and preserves the first occurrence',function(){
 var groups=engine.findSeamRepeats(owner(seamWords),seamIdentity,0);assert.strictEqual(groups.length,1);assert.strictEqual(groups[0].descartar[0].ini,2.55);assert.ok(groups[0].aviso);assert.strictEqual(engine.safeAutomaticGroup(groups[0]),false);
});
test('same phrase without an actual take seam is not proposed by the seam detector',function(){
 var one={seq:'seq-1',audioClips:[{track:0,start:0,end:6}]};assert.strictEqual(engine.findSeamRepeats(owner(seamWords),one,0).length,0);
});
test('repeated single-word emphasis is not treated as a seam retake',function(){
 var emph=seamWords.map(function(w){return word('sim',w.start,w.end);});assert.strictEqual(engine.findSeamRepeats(owner(emph),seamIdentity,0).length,0);
});
test('complete repeated sentences need review; incomplete restarts with strong coverage can run automatically',function(){
 var kept={tokens:['essa','edicao','mantem','a','fala','natural'],ini:4,fim:7,completa:true};var rejected={tokens:['essa','edicao','mantem'],ini:1,fim:2,completa:false};var group={takes:[rejected,kept],sugestao:{take:kept},descartar:[rejected]};assert.strictEqual(engine.safeAutomaticGroup(group),true);rejected.completa=true;assert.strictEqual(engine.safeAutomaticGroup(group),false);rejected.completa=false;rejected.tokens=['outra','informacao','complementar'];assert.strictEqual(engine.safeAutomaticGroup(group),false);
});

test('configured pause minimum still applies after removing protected words',function(){
 var out=engine.guardSilenceCuts([{s:1,e:3}],owner([word('fala',1.8,2.2)]),{minDur:.8,marginBefore:100,marginAfter:100},identity);assert.deepStrictEqual(out.cortes,[]);
});
test('real word timestamps may use the text field',function(){
 var out=engine.guardSilenceCuts([{s:1,e:3}],owner([{text:'fala',start:1.8,end:2.2}]),{},identity);assert.strictEqual(out.verified,true);out.cortes.forEach(function(s){assert.ok(s.e<=1.74+1e-8||s.s>=2.29-1e-8);});
});
test('a single repeated content word at a real take seam is suggested for manual review',function(){
 var groups=engine.findSeamRepeats(owner([word('resultado',2.05,2.45),word('resultado',2.55,2.95),word('final.',3.05,3.45)]),seamIdentity,0);assert.strictEqual(groups.length,1);assert.ok(groups[0].manualReview&&groups[0].aviso);assert.ok(groups[0].confidence<1);assert.strictEqual(engine.safeAutomaticGroup(groups[0]),false);assert.strictEqual(groups[0].descartar[0].texto,'resultado');
});
test('two to four repeated words at an actual seam also remain review-only',function(){
 var groups=engine.findSeamRepeats(owner([word('resultado',1.65,1.95),word('final',2.05,2.45),word('resultado',2.55,2.85),word('final',2.95,3.35)]),seamIdentity,0);assert.strictEqual(groups.length,1);assert.strictEqual(groups[0].descartar[0].n,2);assert.strictEqual(groups[0].autoSafe,undefined);assert.strictEqual(engine.safeAutomaticGroup(groups[0]),false);
});
test('muito muito bom within one take is preserved by the seam detector',function(){
 var noSeam={seq:'seq-1',audioClips:[{track:0,start:0,end:6}]};assert.strictEqual(engine.findSeamRepeats(owner([word('muito',1,1.4),word('muito',1.5,1.9),word('bom',2,2.4)]),noSeam,0).length,0);
});
test('short grammatical words at a seam are never deletion proposals',function(){
 ['é','de'].forEach(function(text){assert.strictEqual(engine.findSeamRepeats(owner([word(text,2.05,2.45),word(text,2.55,2.95)]),seamIdentity,0).length,0);});
});

function track(clips){var list=clips.slice();list.numItems=list.length;return {clips:list};}
function hostFixture(){
 var calls={removed:0},component={displayName:'Warp Stabilizer',matchName:'ADBE Warp Stabilizer',remove:function(){calls.removed++;}},components=[component];components.numItems=1;
 var c={name:'Take',projectItem:{nodeId:'media-1'},start:{seconds:0,ticks:'0'},end:{seconds:6,ticks:String(6*254016000000)},inPoint:{ticks:'0'},outPoint:{ticks:String(6*254016000000)},getSpeed:function(){return 1;},components:components};
 var v=[track([c])],a=[track([c])];v.numTracks=1;a.numTracks=1;
 return {calls:calls,clip:c,app:{project:{activeSequence:{sequenceID:'seq-1',timebase:String(254016000000/30),videoTracks:v,audioTracks:a}}}};
}
async function bridgeTests(){
 var host=hostFixture(),info=await new Promise(function(resolve){engine.readSequence({evalScript:function(script,done){done(vm.runInNewContext(script,{app:host.app}));}},resolve);});assert.ok(info.ok);assert.strictEqual(info.warpClips.length,1);assert.strictEqual(host.calls.removed,0);count++;console.log('OK read-only sequence fingerprint also detects Warp');
 var win={},doc={readyState:'loading',addEventListener:function(){}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/autocut_warp_guard.js'),'utf8'),{window:win,document:doc});var result=JSON.parse(vm.runInNewContext(win.CaptionIAWarpGuard.buildScript(),{app:host.app}));assert.strictEqual(result.ok,false);assert.strictEqual(host.calls.removed,0);count++;console.log('OK Warp rejection never calls remove');
 var repeatWin={CaptionIASpeechCuts:engine};engine.setContext(seamIdentity,0);vm.runInNewContext(fs.readFileSync(path.join(root,'js/repeticoes.js'),'utf8'),{window:repeatWin});var detected=repeatWin.fsRepeticoes.analisar(owner(seamWords),null);assert.ok(detected.grupos.length);assert.ok(detected.grupos.every(function(g){return g.autoSafe||g.aviso;}));count++;console.log('OK existing Retake consumes the new review policy');
 await autocutIntegration();
}
async function autocutIntegration(){
 var host=hostFixture();host.clip.components=[];host.clip.components.numItems=0;
 var applied=[],remapped=[],ready=[],elements={},storage={};
 function element(id){return {id:id,value:'',style:{},disabled:false,checked:false,textContent:'',className:'',handlers:{},parentNode:{appendChild:function(){}},addEventListener:function(type,fn){this.handlers[type]=fn;},querySelectorAll:function(){return [];},appendChild:function(){},setAttribute:function(){},classList:{add:function(){},remove:function(){},toggle:function(){}}};}
 ['autocut-tab','btn-autocut-analyze','btn-autocut-apply','autocut-status'].forEach(function(id){elements[id]=element(id);});
 var data=new Float32Array(6000);for(var i=0;i<data.length;i++)data[i]=(i<1000||i>=4000)?.5*Math.sin(i):0;
 var fakeFs={readFileSync:function(){return Buffer.from('mock audio');},unlinkSync:function(){},writeFileSync:function(){}};
 var win={CaptionIASpeechCuts:engine,_fsLastResp:owner([word('fala',2,2.4)]),fsRemapearTranscricao:function(spans){remapped.push(spans);return {palavras:1};}};
 var bridge={evalScript:function(script,done){setTimeout(function(){var output;if(script.indexOf('fsAutocutExport(')===0)output=JSON.stringify({path:'/mock.wav',offset:0,rangeStart:0,rangeEnd:6});else if(script.indexOf('fsRegioesDeAudio(')===0)output=JSON.stringify({ok:true,regioes:[{s:0,e:6}]});else output=vm.runInNewContext(script,{app:host.app,fsTrilhasAudio:function(){return JSON.stringify({ok:true,trilhas:[{i:0,clipes:1,mudo:false}]});},fsAutocutApply:function(raw){var spans=JSON.parse(raw);applied.push(spans);return JSON.stringify({cuts:spans.length,removed:spans.length,shifted:0,backupId:'-1',seqId:'seq-1'});}});done(output);},0);}};
 var ctx={window:win,document:{readyState:'loading',getElementById:function(id){return elements[id]||null;},querySelectorAll:function(){return [];},addEventListener:function(type,fn){ready.push(fn);},createElement:function(tag){return element(tag);}},csInterface:bridge,nodeFs:fakeFs,Buffer:Buffer,localStorage:{getItem:function(k){return storage[k]||null;},setItem:function(k,v){storage[k]=v;},removeItem:function(k){delete storage[k];}},require:function(n){if(n==='fs')return fakeFs;if(n==='os')return {tmpdir:function(){return '/mock';}};if(n==='path')return path;throw Error('Mocked require '+n);},setTimeout:setTimeout,clearTimeout:clearTimeout,setInterval:setInterval,clearInterval:clearInterval,Float32Array:Float32Array,Uint8Array:Uint8Array,console:console,isPremiere:true,extensionPath:"/mock-extension"};
 win.AudioContext=function(){this.decodeAudioData=function(_,success){success(audio([data]));};this.close=function(){};};
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/autocut.js'),'utf8'),ctx);ready.forEach(function(fn){fn();});
 function wait(){return new Promise(function(resolve){setTimeout(resolve,35);});}
 elements['btn-autocut-analyze'].handlers.click();await wait();
 host.clip.outPoint.ticks=String(5.9*254016000000);elements['btn-autocut-apply'].handlers.click();await wait();assert.strictEqual(applied.length,0);assert.ok(elements['autocut-status'].textContent.indexOf('mudou')>=0);count++;console.log('OK real AutoCut hook blocks a timeline changed after analysis');
 elements['btn-autocut-analyze'].handlers.click();await wait();elements['btn-autocut-apply'].handlers.click();await wait();assert.strictEqual(applied.length,1,elements['autocut-status'].textContent);assert.ok(applied[0].length>=1);applied[0].forEach(function(s){assert.ok(s.e<=1.8+1e-7||s.s>=2.6-1e-7);});assert.strictEqual(remapped.length,1);assert.deepStrictEqual(JSON.parse(JSON.stringify(remapped[0])),applied[0]);count++;console.log('OK actual AutoCut bridge receives the protected frame-aligned spans and remaps those same spans');
 var autoResult=await new Promise(function(resolve,reject){var timer=setTimeout(function(){reject(Error('AutoEdit callback did not complete'));},1500);win.fsAutoEditCorte(function(result){clearTimeout(timer);resolve(result);});});assert.ok(autoResult.ok,autoResult.erro);assert.strictEqual(applied.length,2);assert.ok(autoResult.resumo.indexOf(applied[1].length+' silêncios cortados')===0);count++;console.log('OK AutoEdit waits for asynchronous ownership preflight and reports the cuts actually protected');
}
bridgeTests().then(function(){console.log('Passed '+count+' meaningful checks; no Premiere or real media operations.');}).catch(function(e){console.error(e.stack||e);process.exitCode=1;});
