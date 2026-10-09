const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../CaptionIA/js/narrative-beta.js'),'utf8');
const localStore={};const stub={getItem:k=>localStore[k],setItem:(k,v)=>localStore[k]=v,removeItem:k=>delete localStore[k]};
const win={fsSecureKeyStore:{get:()=>''}};const ctx={window:win,localStorage:stub,console,document:undefined,require};vm.runInNewContext(source,ctx);const engine=win.fsNarrativeBeta;
function check(desc,fn){try{fn();console.log('PASS',desc)}catch(e){console.log('FAIL',desc,e.message);process.exitCode=1}}
const clips=[{index:0,start:0,end:9},{index:1,start:9,end:18}];
const words=[{word:'Fim',start:0.3,end:0.6},{word:'agora!',start:.65,end:1.1},{word:'Não,',start:1.7,end:1.98},{word:'calma',start:2,end:2.4},{word:'E',start:4.1,end:4.22},{word:'aí',start:4.22,end:4.4},{word:'pessoal',start:4.4,end:4.8},{word:'Conteúdo',start:10,end:10.5},{word:'completo',start:10.55,end:11}];
const seg=engine.groupWords(words,clips);
check('segmentação em pausa depois de fala curta',()=>assert.ok(seg.some(s=>s.text==='Fim agora!')));
check('não inclui silêncio maior que 0,65s',()=>assert.ok(seg.length>=4));
check('falsa partida sinalizada',()=>assert.ok(seg.some(s=>s.blocked)));
check('seleção reordenada permitida',()=>{let p=engine.validate({cuts:[{id:seg[seg.length-1].id,role:'abertura'},{id:seg[0].id,role:'fecho'}]},seg,clips);assert.equal(p.length,2);assert.equal(p[0].start,10)});
check('bloqueia fala descartável',()=>assert.throws(()=>engine.validate({cuts:[{id:seg.find(s=>s.blocked).id}]},seg,clips)));
check('bloqueia ID inexistente',()=>assert.throws(()=>engine.validate({cuts:[{id:'XYZ'}]},seg,clips)));
check('bloqueia IDs repetidos',()=>assert.throws(()=>engine.validate({cuts:[{id:seg[0].id},{id:seg[0].id}]},seg,clips)));
check('bloqueia planos vazios',()=>assert.throws(()=>engine.validate({cuts:[]},seg,clips)));
check('bloqueia intervalos que cruzam dois clipes',()=>assert.throws(()=>engine.validate({cuts:[{id:'cross'}]},[{id:'cross',start:8.8,end:9.2,text:'cross',blocked:false}],clips)));
check('não usa chave local ausente',()=>assert.equal(engine.pending,false));