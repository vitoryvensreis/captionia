(function(w,d){'use strict';
var plan=null,original=null,applied=null,words=[];
function id(x){return d.getElementById(x);}
function label(msg){id('cia-cloud-status').textContent=msg;}
function save(data){w.premiereSrtData=data;try{localStorage.setItem(typeof LS_KEYS!=='undefined'&&LS_KEYS.SRT_DATA?LS_KEYS.SRT_DATA:'framespeed_srt_data',JSON.stringify(data));}catch(e){}try{if(w.saveSrtToLocalCache)w.saveSrtToLocalCache(data);}catch(e){}try{if(w.updateSRTButtonVisualState)w.updateSRTButtonVisualState();}catch(e){}}
function setup(){
var modal=id('transcribe-modal');if(!modal||!w.CaptionIACloudCore)return;
var panel=d.createElement('section');panel.style.cssText='margin:12px 0;padding:14px;border:1px solid #464f5b;border-radius:8px;color:#e5e7eb;background:#181b20;font:12px/1.5 Segoe UI,Arial,sans-serif';
var head=d.createElement('strong');head.textContent='Cloud Core · Legendas';panel.appendChild(head);
var hint=d.createElement('p');hint.textContent='Prévia sem editar a timeline. Envia apenas palavras e tempos ao servidor.';panel.appendChild(hint);
var b=d.createElement('button');b.type='button';b.textContent='Prévia na nuvem';b.onclick=preview;b.style.cssText='display:inline-block;margin:6px 8px 6px 0;padding:7px 10px;border:1px solid #59677a;border-radius:6px;background:#2b394e;color:#f4f6fb;cursor:pointer;';panel.appendChild(b);
var a=d.createElement('button');a.type='button';a.textContent='Aplicar ao rascunho';a.disabled=true;a.id='cia-cloud-apply';a.onclick=apply;a.style.cssText='display:inline-block;margin:6px 8px 6px 0;padding:7px 10px;border:1px solid #59677a;border-radius:6px;background:#2b394e;color:#f4f6fb;cursor:pointer;';panel.appendChild(a);
var r=d.createElement('button');r.type='button';r.textContent='Restaurar rascunho';r.disabled=true;r.id='cia-cloud-revert';r.onclick=revert;r.style.cssText='display:inline-block;margin:6px 8px 6px 0;padding:7px 10px;border:1px solid #59677a;border-radius:6px;background:#2b394e;color:#f4f6fb;cursor:pointer;';panel.appendChild(r);
var out=d.createElement('pre');out.id='cia-cloud-status';out.style.cssText='white-space:pre-wrap;max-height:160px;overflow:auto;line-height:1.5;margin:10px 0 0;color:#cdd9e4;font-size:12px';panel.appendChild(out);
(modal.querySelector('.modal-box')||modal).appendChild(panel);
}
function preview(){
plan=null;id('cia-cloud-apply').disabled=true;label('Validando sequência e licença...');
if(!w.fsConferirDonoTranscricao){label('Verificação de sequência indisponível.');return;}
w.fsConferirDonoTranscricao(function(state){
try{
var source=w._fsLastResp;
if(!state||!state.seq||state.descartou||!source||String(source._fsSeq)!==String(state.seq))throw Error('Transcrição não corresponde à sequência aberta.');
words=(source.words||[]).map(function(x){return{text:String(x.word||x.text||'').trim(),start:Number(x.start),end:Number(x.end)};});
if(!words.length||words.some(function(x){return !x.text||!isFinite(x.start)||!isFinite(x.end)||x.start<0||x.end<=x.start;}))throw Error('Palavras temporizadas inválidas.');
w.CaptionIACloudCore.getConfig().then(function(config){if(!config.features||!config.features.caption_plan)throw Error('Cloud Core ainda desativado.');return w.CaptionIACloudCore.planCaptions(words,{aspectRatio:'9:16',maxWords:4,maxChars:26});}).then(function(data){
if(!data||data.schema_version!==2||!Array.isArray(data.segments)||!data.segments.length)throw Error('Resposta inesperada.');
plan=data;id('cia-cloud-apply').disabled=false;
label('Prévia: '+data.segments.length+' legendas. Nenhuma alteração na timeline.\n'+data.segments.slice(0,8).map(function(s){return s.text;}).join('\n'));
}).catch(function(error){var detail=String((error&&error.message)||error||'Erro desconhecido');if((error&&error.status===404)||/endpoint n[aã]o encontrado/i.test(detail)){label('O servidor Caption IA ainda não tem o Cloud Core publicado. É necessário atualizar a API do site antes de usar a prévia. Nenhuma legenda foi alterada.');}else{label('Falha na prévia: '+detail);}});
}catch(error){label(error.message);}
});
}
function apply(){if(!plan)return;try{
var last=-1;var cues=plan.segments.map(function(s){var t=Number(s.start_time),end=Number(s.end_time);if(!isFinite(t)||!isFinite(end)||end<=t||t<last-0.03)throw Error('Tempos inconsistentes.');last=t;return{text:Array.isArray(s.lines)?s.lines.join('\n'):String(s.text),startTime:t,endTime:end};});
if(w.fsAttachWordTimings)cues=w.fsAttachWordTimings(cues,words.map(function(t){return{word:t.text,start:t.start,end:t.end};}))||cues;
original=JSON.parse(JSON.stringify(w.premiereSrtData||[]));save(cues);applied=JSON.stringify(cues);plan=null;
id('cia-cloud-apply').disabled=true;id('cia-cloud-revert').disabled=false;
label('Rascunho atualizado. Revise na aba Legendas antes de aplicar no Premiere.');
}catch(error){label('Nada alterado: '+error.message);}}
function revert(){if(!original)return;if(JSON.stringify(w.premiereSrtData||[])!==applied){label('Rascunho alterado após aplicação: restauração bloqueada para não perder seu trabalho.');return;}save(original);original=null;applied=null;id('cia-cloud-revert').disabled=true;label('Rascunho anterior restaurado.');}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',setup);else setup();
})(window,document);
