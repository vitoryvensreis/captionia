/* Caption IA - precise spoken-word SFX sync calibration.
 * Per-transcript offsets affect newly generated SFX, never existing clips or captions.
 */
(function(w,d){'use strict';
var KEY='captionia_sfx_word_sync_v1_',MAX=15,FPS=[23.976,24,25,29.97,30,50,59.94,60];
function number(x){return typeof x==='number'&&isFinite(x);}
function words(){
 var r=w._fsLastResp,out=[];
 if(!r||!Array.isArray(r.words))return[];
 r.words.forEach(function(x){
  if(x&&String(x.word||x.text||'').trim()&&number(x.start)&&x.start>=0)
   out.push({word:String(x.word||x.text).trim(),start:x.start,end:number(x.end)?x.end:null});
 });
 return out;
}
function hash(str){
 var v=2166136261;for(var i=0;i<str.length;i++){v^=str.charCodeAt(i);v=Math.imul(v,16777619);}
 return (v>>>0).toString(16);
}
function identity(list){
 list=list||words();var r=w._fsLastResp||{};
 return hash(String(r._fsSeq||'sem-seq')+'|'+list.map(function(x){return x.word+'@'+x.start.toFixed(3);}).join('|'));
}
function key(list){return KEY+identity(list);}
function read(list){
 var data;try{data=JSON.parse(localStorage.getItem(key(list))||'{}');}catch(e){data={};}
 var global=Math.round(Number(data.global)||0);
 var fps=Number(data.fps)||30;
 var corrections=Object.create(null);
 Object.keys(data.corrections||{}).forEach(function(k){
  if(!/^(0|[1-9][0-9]*)$/.test(k)||+k>=list.length)return;
  var value=Number(data.corrections[k]);
  if(Number.isInteger(value)&&value>=-MAX&&value<=MAX&&value!==0)corrections[k]=value;
 });
 return {global:Math.max(-MAX,Math.min(MAX,global)),
  fps:FPS.indexOf(fps)>=0?fps:30,corrections:corrections};
}
function write(list,data){
 try{localStorage.setItem(key(list),JSON.stringify(data));}
 catch(e){throw Error('Não foi possível salvar ajustes locais de SFX.');}
}
function apply(times,options){
 options=options||{};
 var list=words();
 if(!list.length)throw Error('Transcrição com tempos por palavra indisponível.');
 if(!Array.isArray(times)||times.length!==list.length)
  throw Error('Lista de palavras mudou. Reabra a calibração de SFX.');
 for(var i=0;i<list.length;i++)
  if(!number(times[i])||Math.abs(times[i]-list[i].start)>0.021)
   throw Error('A transcrição mudou; ajuste de SFX não aplicado.');
 var state=read(list);
 var out=[],affected=0,conflicts=0;
 var timing=w.CaptionIATimebase;
 if(!timing)throw Error('Motor de sincronia não carregado.');
 var frameSize=(typeof options.frameDuration==='number'&&isFinite(options.frameDuration)&&options.frameDuration>0)?options.frameDuration:1/state.fps;
 for(i=0;i<times.length;i++){
  var corr=state.global+Number(state.corrections[i]||0);
  var t=times[i]+corr*frameSize;
  // Os disparos SFX usam trilhas próprias; a distribuição ordena os eventos
  // por tempo e alterna entre duas trilhas sem alterar as palavras originais.
  if(t<0){t=0;conflicts++;}
  if(i&&t<out[i-1]-0.0001)conflicts++;
  out.push(timing.at(t,frameSize));
  if(corr!==0)affected++;
 }
 return {times:out,affected:affected,fps:1/frameSize,global:state.global,
  custom:Object.keys(state.corrections).length,conflicts:conflicts};
}
var ui={};
function elem(tag,text){var e=d.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function hint(text){if(ui.status)ui.status.textContent=text;}
function refresh(){
 var list=words();if(!ui.rows)return;
 ui.rows.textContent='';
 if(!list.length){hint('Ainda não há transcrição com palavras temporizadas. Transcreva um áudio e clique em Atualizar palavras.');return;}
 var state=read(list);
 ui.global.value=String(state.global);ui.fps.value=String(state.fps);
 for(var i=0;i<list.length&&i<1500;i++){
  (function(index){
   var line=elem('div');line.style.cssText='display:flex;align-items:center;gap:8px;border-bottom:1px solid #333a44;padding:4px 0';
   var name=elem('span',(index+1)+'. '+list[index].word+'  ·  '+list[index].start.toFixed(2)+'s');
   name.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
   var val=elem('input');val.type='number';val.min='-15';val.max='15';val.step='1';
   val.value=String(state.corrections[index]||0);val.title='Ajuste adicional em quadros para esta palavra';
   val.style.cssText='width:65px;background:#181e28;color:#edf3fc;border:1px solid #59677a;padding:4px;border-radius:4px';
   val.addEventListener('change',function(){
    var n=Number(val.value);
    if(!Number.isInteger(n)||n< -MAX||n>MAX){hint('Use números inteiros de -15 até +15 quadros.');val.value=String(read(list).corrections[index]||0);return;}
    try{var v=read(list);if(n===0)delete v.corrections[index];else v.corrections[index]=n;write(list,v);hint('Ajuste salvo para "'+list[index].word+'". Refaça somente a etapa SFX para aplicar.');}
    catch(e){hint(e.message);}
   });
   line.appendChild(name);line.appendChild(val);ui.rows.appendChild(line);
  })(i);
 }
 hint(list.length+' palavras carregadas. Negativo: som mais cedo; positivo: mais tarde. Só afeta a próxima geração de SFX.');
}
function setup(){
 var panel=d.getElementById('autoedit-panel');if(!panel)return;
 var section=elem('details');section.style.cssText='margin:8px 0;padding:9px 12px;border:1px solid #334154;border-radius:8px;background:#151b23;color:#dfe8f4;font:12px/1.5 Segoe UI,Arial,sans-serif';
 var summary=elem('summary','Ajustes avançados de sincronia dos efeitos');summary.style.cssText='cursor:pointer;font-weight:600';section.appendChild(summary);
 section.appendChild(elem('p','Opcional: ajuste em quadros somente os efeitos. Valores negativos antecipam o som, positivos atrasam.'));
 var controls=elem('div');controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px';
 var gl=elem('label','Ajuste geral (quadros) ');ui.global=elem('input');ui.global.type='number';ui.global.min='-15';ui.global.max='15';ui.global.step='1';ui.global.value='0';ui.global.style.cssText='width:60px;margin-left:3px;padding:4px;color:#fff;background:#202b36;border:1px solid #5a6573';gl.appendChild(ui.global);controls.appendChild(gl);
 var fpsLabel=elem('label','FPS ');ui.fps=elem('select');
 FPS.forEach(function(v){var o=elem('option',String(v));o.value=String(v);ui.fps.appendChild(o);});ui.fps.value='30';ui.fps.style.cssText='padding:4px;color:#fff;background:#202b36;border:1px solid #5a6573';fpsLabel.appendChild(ui.fps);controls.appendChild(fpsLabel);
 section.appendChild(controls);
 function storeControl(){
  var list=words();if(!list.length){hint('Transcreva antes de calibrar.');return;}
  var n=Number(ui.global.value),f=Number(ui.fps.value);
  if(!Number.isInteger(n)||n< -MAX||n>MAX||FPS.indexOf(f)<0){hint('Ajuste: -15 a +15 quadros, FPS válido.');return;}
  try{var data=read(list);data.global=n;data.fps=f;write(list,data);hint('Ajuste geral salvo. Para aplicar, limpe os SFX antigos e rode somente Efeitos sonoros.');}
  catch(e){hint(e.message);}
 }
 ui.global.addEventListener('change',storeControl);ui.fps.addEventListener('change',storeControl);
 var reload=elem('button','Atualizar palavras');reload.type='button';reload.className='btn-secondary';reload.style.cssText='padding:6px 10px;margin:0 0 8px;border:1px solid #566678;border-radius:5px';
 reload.addEventListener('click',refresh);section.appendChild(reload);
 ui.status=elem('p');ui.status.style.cssText='color:#aebed2;white-space:pre-wrap;margin:4px 0';section.appendChild(ui.status);
 ui.rows=elem('div');ui.rows.style.cssText='max-height:170px;overflow-y:auto;padding-right:4px';section.appendChild(ui.rows);
 var controlsFooter=panel.querySelector('.ae-rodape');
 if(controlsFooter&&controlsFooter.parentNode)controlsFooter.parentNode.insertBefore(section,controlsFooter);
 else panel.appendChild(section);
 refresh();
}
var api={apply:apply,words:words,identity:identity,read:read,write:write,refresh:refresh};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(w)w.CaptionIASfxTiming=api;
// Interface avançada retirada; o motor mantém os ajustes internos para compatibilidade.
})(typeof window!=='undefined'?window:null,typeof document!=='undefined'?document:null);
