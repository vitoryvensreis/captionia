/* Caption IA — produção: transcrição GROQ somente no servidor.
 * Os dois botões existentes passam pelo endpoint autenticado.
 * O hostscript.jsxbin permanece intacto: exportação de áudio usa a ponte Adobe já homologada.
 */
(function(w,d){'use strict';
var busy=false,consent=null,status=null,MAX=24000000;
function el(id){return d.getElementById(id);}
function say(message,error){
 if(status){status.textContent=String(message||'');status.style.color=error?'#ffb5ad':'#cbd9ea';}
}
function updateBusy(v){
 busy=!!v;
 ['btn-transcribe-timeline','btn-transcribe-file'].forEach(function(id){var btn=el(id);if(btn)btn.disabled=busy;});
}
function host(script){
 return new Promise(function(resolve,reject){
  if(!w.csInterface||typeof w.csInterface.evalScript!=='function'){reject(Error('Ponte Adobe indisponível.'));return;}
  w.csInterface.evalScript(script,function(raw){
   try{
    var obj=JSON.parse(String(raw||''));
    if(obj.error)throw Error(String(obj.error));
    resolve(obj);
   }catch(e){reject(Error('Premiere: '+e.message));}
  });
 });
}
function owner(){
 return new Promise(function(resolve,reject){
  if(typeof w.fsConferirDonoTranscricao!=='function'){reject(Error('Verificação de sequência indisponível.'));return;}
  w.fsConferirDonoTranscricao(function(s){
   if(s&&s.seq)resolve(String(s.seq));else reject(Error('Abra uma sequência do Premiere.'));
  });
 });
}
function pick(){
 return new Promise(function(resolve,reject){
  if(typeof w.fsEscolherArquivos!=='function'){reject(Error('Seletor de áudio indisponível.'));return;}
  w.fsEscolherArquivos({titulo:'Áudio para transcrição segura',varios:false,tipos:['mp3','wav','m4a','ogg','flac','mp4','webm']},function(files,err){
   if(!files||!files.length){reject(Error(err||'Seleção de arquivo cancelada.'));return;}
   resolve({file:files[0],temporary:false});
  });
 });
}
function exportTimeline(){
 var root=typeof w.secureExtensionPath==='string'&&w.secureExtensionPath?w.secureExtensionPath:
          typeof w.extensionPath==='string'?w.extensionPath:'';
 if(!root)return Promise.reject(Error('Pasta do plugin não encontrada para exportar áudio.'));
 var path=require('path'),fs=require('fs');
 var preset=path.join(root,'presets','fs_audio_leve.epr');
 if(!fs.existsSync(preset))preset=path.join(root,'presets','fs_audio.epr');
 if(!fs.existsSync(preset))return Promise.reject(Error('Preset de exportação de áudio ausente.'));
 var selector=el('transcribe-track'),track=selector?parseInt(selector.value,10):-1;
 if(!isFinite(track)||track< -1)track=-1;
 say('Analisando a timeline...');
 return host('fsRegioesDeAudio('+track+')').then(function(regions){
  if(regions.ok&&regions.clipes===0)throw Error('Não há áudio na trilha selecionada.');
  if(regions.alvoMudo)throw Error('A trilha selecionada está silenciada.');
  say('Exportando áudio leve da sequência...');
  return host('fsExportAudioTrilha('+JSON.stringify(preset.replace(/\\/g,'/'))+',0,'+track+')');
 }).then(function(result){
  if(!result.path)throw Error('Premiere não retornou o áudio exportado.');
  return {file:result.path,temporary:true};
 });
}
function upload(file,token,lang){
 return new Promise(function(resolve,reject){
  try{
   var fs=require('fs'),https=require('https'),path=require('path'),crypto=require('crypto');
   var ext=path.extname(file).toLowerCase(),size=fs.statSync(file).size;
   if(!/^\.(mp3|wav|m4a|ogg|flac|mp4|webm)$/.test(ext)||size<100||size>MAX)
    throw Error('Áudio deve ter entre 100 bytes e 24 MB (MP3, WAV, M4A, OGG, FLAC, MP4 ou WEBM).');
   var boundary='cia'+crypto.randomBytes(12).toString('hex');
   function field(name,value){
    return Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"\r\n\r\n'+value+'\r\n');
   }
   var chunks=[field('consent','yes'),field('language',lang)];
   chunks.push(Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="audio'+ext+'"\r\nContent-Type: application/octet-stream\r\n\r\n'));
   chunks.push(fs.readFileSync(file));
   chunks.push(Buffer.from('\r\n--'+boundary+'--\r\n'));
   var body=Buffer.concat(chunks);
   var settled=false;
   function fail(err){if(!settled){settled=true;reject(err);}}
   var req=https.request({
    hostname:'caption.escotilhaprodutora.com',port:443,path:'/api/v1/core/transcription',
    method:'POST',timeout:195000,
    headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':body.length}
   },function(r){
    var response=[],bytes=0;
    r.on('data',function(chunk){bytes+=chunk.length;if(bytes>2*1024*1024){req.destroy(Error('Resposta do servidor excedeu o limite.'));return;}response.push(chunk);});
    r.on('error',fail);
    r.on('end',function(){
     if(settled)return;
     try{
      var data=JSON.parse(Buffer.concat(response).toString('utf8'));
      if(r.statusCode!==200||!data.ok||!Array.isArray(data.words)||!data.words.length)
       throw Error(data.error||'Transcrição indisponível (HTTP '+r.statusCode+').');
      settled=true;resolve(data);
     }catch(e){fail(e);}
    });
   });
   req.on('error',fail);
   req.on('timeout',function(){req.destroy(Error('Tempo esgotado durante a transcrição.'));});
   req.end(body);
  }catch(e){reject(e);}
 });
}
function captions(words){
 var input=words.map(function(x){return{text:String(x.word||x.text||'').trim(),start:Number(x.start),end:Number(x.end)};});
 if(!input.length||input.some(function(x){return !x.text||!isFinite(x.start)||!isFinite(x.end)||x.start<0||x.end<=x.start;}))
  return Promise.reject(Error('O serviço retornou palavras com tempos inválidos.'));
 var num=el('transcribe-words-per'),wordLimit=num?parseInt(num.value,10):3;
 if(!wordLimit||wordLimit<1)wordLimit=3;
 return w.CaptionIACloudCore.planCaptions(input,{maxWords:Math.min(6,wordLimit),maxChars:30,aspectRatio:'9:16'}).then(function(plan){
  if(!plan||!Array.isArray(plan.segments)||!plan.segments.length)throw Error('Servidor não retornou blocos de legendas.');
  var cues=plan.segments.map(function(segment){
   return{text:Array.isArray(segment.lines)?segment.lines.join('\n'):String(segment.text||''),
    startTime:Number(segment.start_time),endTime:Number(segment.end_time)};
  });
  for(var i=0;i<cues.length;i++)
   if(!cues[i].text||!isFinite(cues[i].startTime)||!isFinite(cues[i].endTime)||cues[i].endTime<=cues[i].startTime)
    throw Error('Blocos da API contêm tempos inválidos.');
  if(typeof w.fsAttachWordTimings==='function')
   cues=w.fsAttachWordTimings(cues,input.map(function(x){return{word:x.text,start:x.start,end:x.end};}))||cues;
  return cues;
 });
}
function save(result,seq,cues){
 result._fsSeq=seq;result._fsQuando=Date.now();
 w._fsLastResp=result;w._fsRespOriginal=null;w._fsCortesTotal=0;
 try{localStorage.setItem('framespeed_last_resp',JSON.stringify(result));}catch(e){}
 w.premiereSrtData=cues;
 try{
  var key=typeof w.LS_KEYS!=='undefined'&&w.LS_KEYS.SRT_DATA?w.LS_KEYS.SRT_DATA:'framespeed_srt_data';
  localStorage.setItem(key,JSON.stringify(cues));
 }catch(e){}
 try{if(typeof w.saveSrtToLocalCache==='function')w.saveSrtToLocalCache(cues);}catch(e){}
 try{if(typeof w.updateSRTButtonVisualState==='function')w.updateSRTButtonVisualState();}catch(e){}
}
function execute(mode){
 if(busy)return Promise.reject(Error('Já existe uma transcrição em andamento.'));
 if(!consent||!consent.checked)return Promise.reject(Error('Marque a autorização de envio de áudio antes de transcrever.'));
 if(!w.CaptionIACloudCore||!w.CaptionIALicense||!w.CaptionIALicense.isAuthorized())
  return Promise.reject(Error('Faça login com uma licença ativa para usar a transcrição.'));
 updateBusy(true);say('Verificando sua licença e a sequência...');
 var seq,fileInfo;
 return owner().then(function(id){seq=id;return w.CaptionIACloudCore.getConfig();}).then(function(cfg){
  if(!cfg.features||!cfg.features.cloud_transcription||!cfg.features.caption_plan)
   throw Error('O servidor ainda não habilitou transcrição e legendas em nuvem.');
  return mode==='timeline'?exportTimeline():pick();
 }).then(function(info){
  fileInfo=info;
  var token=w.CaptionIALicense.getAccessToken(),lang=(el('transcribe-lang')||{}).value||'';
  if(!token)throw Error('Licença sem sessão válida. Faça login novamente.');
  say('Transcrevendo no servidor...');return upload(info.file,token,String(lang).trim());
 }).then(function(result){
  say('Preparando as legendas na nuvem...');
  return captions(result.words).then(function(cues){return{result:result,cues:cues};});
 }).then(function(bundle){
  return owner().then(function(now){
   if(now!==seq)throw Error('Sequência mudou durante a transcrição. Resultado descartado.');
   save(bundle.result,seq,bundle.cues);
   say('✓ '+bundle.result.words.length+' palavras e '+bundle.cues.length+' legendas preparadas. Abra Legendas para escolher os templates.');
   return{words:bundle.result.words.length,captions:bundle.cues.length};
  });
 }).then(function(value){return value;}).finally(function(){
  // Somente o arquivo TEMPORÁRIO exportado pelo nosso próprio comando é removido.
  if(fileInfo&&fileInfo.temporary)try{require('fs').unlinkSync(fileInfo.file);}catch(e){}
  updateBusy(false);
 });
}
function run(mode,callback){
 execute(mode).then(function(v){if(callback)callback({ok:true,resumo:v.words+' palavras, '+v.captions+' legendas (GROQ Cloud)'});})
 .catch(function(err){say('Erro: '+(err&&err.message||err),true);if(callback)callback({ok:false,erro:String(err&&err.message||err)});});
}
function init(){
 var modal=el('transcribe-modal');if(!modal)return;
 // A implementação legada permanece fisicamente para compatibilidade interna,
 // mas sua caixa de chave e chamadas diretas ao Groq não podem ser usadas no produto.
 ['openai-key-input','btn-key-colar','transcribe-provider','transcribe-api-advanced'].forEach(function(id){
  var field=el(id);if(!field)return;
  var wrapper=field.closest&&field.closest('.form-field');
  if(wrapper)wrapper.style.display='none';else field.style.display='none';
 });
 var actions=modal.querySelector('.modal-actions');
 var section=d.createElement('div');section.style.cssText='margin:12px 0;padding:12px;background:#171e29;border:1px solid #3f5167;border-radius:8px;color:#dce7f4;font:12px/1.5 Segoe UI,Arial,sans-serif';
 var line=d.createElement('label');line.style.cssText='display:flex;align-items:flex-start;gap:8px';
 consent=d.createElement('input');consent.type='checkbox';consent.style.marginTop='3px';
 var text=d.createElement('span');text.textContent='Autorizo o envio do áudio para a Caption IA e para o provedor GROQ, exclusivamente para transcrição. A chave de IA fica no servidor.';
 line.appendChild(consent);line.appendChild(text);section.appendChild(line);
 status=d.createElement('p');status.style.cssText='margin:9px 0 0;color:#cbd9ea;white-space:pre-wrap';section.appendChild(status);
 if(actions&&actions.parentNode)actions.parentNode.insertBefore(section,actions);
 else (modal.querySelector('.modal-box')||modal).appendChild(section);
 var oldStatus=el('transcribe-status');if(oldStatus)oldStatus.style.display='none';
 var timeline=el('btn-transcribe-timeline'),file=el('btn-transcribe-file');
 if(timeline){timeline.textContent='Transcrever da timeline · Nuvem';}
 if(file){file.textContent='Selecionar áudio · Nuvem';}
 // Captura antes dos listeners legados (que exigem gsk_ local).
 modal.addEventListener('click',function(event){
  var target=event.target,action=null;
  while(target&&target!==modal&&!action){
   if(target.id==='btn-transcribe-timeline')action='timeline';
   else if(target.id==='btn-transcribe-file')action='file';
   else target=target.parentNode;
  }
  if(action){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();run(action);}
 },true);
 // O maestro AutoEdit usa esta API, então a mesma rota Cloud atende a etapa Transcrever.
 w.fsAutoEditTranscrever=function(done){run('timeline',done);};
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
