/* Caption IA — transcrição: Nuvem por padrão + chave Groq pessoal opcional.
 * O modo Nuvem usa o endpoint autenticado do Caption IA.
 * O modo "Minha chave Groq" envia o áudio diretamente para a Groq com a chave
 * salva localmente no cofre do usuário; a chave nunca é enviada ao Caption IA.
 * O hostscript.jsxbin permanece intacto: a exportação de áudio usa a ponte Adobe já homologada.
 */
(function(w,d){'use strict';
var busy=false,status=null,MAX=24000000;
var MODE_KEY='captionia_transcription_source';
var LEGACY_KEY='framespeed_groq_key';
var mode='cloud',cloudBtn=null,keyBtn=null,keyWrap=null,keyInput=null,keyHint=null;

function el(id){return d.getElementById(id);}
function say(message,error){
 if(!status)status=el('transcribe-status');
 if(status){status.textContent=String(message||'');status.className='transcribe-status'+(error?' transcribe-status--err':'');}
}
function updateBusy(v){
 busy=!!v;
 ['btn-transcribe-timeline','btn-transcribe-file'].forEach(function(id){var btn=el(id);if(btn)btn.disabled=busy;});
 if(cloudBtn)cloudBtn.disabled=busy;
 if(keyBtn)keyBtn.disabled=busy;
 if(keyInput)keyInput.disabled=busy;
}
function currentMode(){return mode==='personal'?'personal':'cloud';}
function loadMode(){
 try{var saved=localStorage.getItem(MODE_KEY)||'';return saved==='personal'?'personal':'cloud';}
 catch(e){return'cloud';}
}
function saveMode(value){try{localStorage.setItem(MODE_KEY,value);}catch(e){}}
function readKey(){
 var value='';
 try{if(w.fsSecureKeyStore&&typeof w.fsSecureKeyStore.get==='function')value=w.fsSecureKeyStore.get()||'';}catch(e){}
 if(!value)try{value=localStorage.getItem(LEGACY_KEY)||'';}catch(e2){}
 value=String(value||'').trim();
 return /^gsk_[A-Za-z0-9_-]{20,}$/.test(value)?value:'';
}
function saveKey(value){
 value=String(value||'').trim();
 if(!/^gsk_[A-Za-z0-9_-]{20,}$/.test(value))return false;
 try{
  if(w.fsSecureKeyStore&&typeof w.fsSecureKeyStore.set==='function'){
   if(!w.fsSecureKeyStore.set(value))return false;
   try{localStorage.removeItem(LEGACY_KEY);}catch(e){}
   return w.fsSecureKeyStore.get()===value;
  }
  localStorage.setItem(LEGACY_KEY,value);
  return localStorage.getItem(LEGACY_KEY)===value;
 }catch(e2){return false;}
}
function clipboard(){
 try{
  var cp=require('child_process'),isMac=(navigator.platform||'').toLowerCase().indexOf('mac')!==-1;
  var out=isMac?cp.execSync('pbpaste',{timeout:3000}).toString('utf8'):
                    cp.execSync('powershell -NoProfile -Command Get-Clipboard',{timeout:5000}).toString('utf8');
  return String(out||'').trim();
 }catch(e){return null;}
}
function setMode(value){
 mode=value==='personal'?'personal':'cloud';saveMode(mode);
 if(cloudBtn)cloudBtn.className=mode==='cloud'?'caps-pill on':'caps-pill';
 if(keyBtn)keyBtn.className=mode==='personal'?'caps-pill on':'caps-pill';
 if(keyWrap)keyWrap.style.display=mode==='personal'?'':'none';
 var timeline=el('btn-transcribe-timeline'),file=el('btn-transcribe-file');
 if(timeline)timeline.textContent=mode==='cloud'?'Transcrever da timeline · Nuvem':'Transcrever da timeline · Minha chave';
 if(file)file.textContent=mode==='cloud'?'Selecionar áudio · Nuvem':'Selecionar áudio · Minha chave';
 if(mode==='personal'&&keyInput&&!keyInput.value)keyInput.value=readKey();
 if(keyHint){
  keyHint.textContent=mode==='cloud'?
   'Padrão: o áudio é processado pela infraestrutura do Caption IA e pela Groq. Não há quota diária do plugin.':
   'Sua chave fica salva somente neste computador e o áudio é enviado diretamente para a Groq.';
 }
 say('');
}
function buildSourceUi(modal){
 var body=modal.querySelector('.modal-body')||modal.querySelector('.modal-box')||modal;
 var field=d.createElement('div');field.className='form-field';field.id='cia-transcribe-source';
 var label=d.createElement('label');label.textContent='Fonte da transcrição';field.appendChild(label);
 var pills=d.createElement('span');pills.className='guia-pills';
 cloudBtn=d.createElement('button');cloudBtn.type='button';cloudBtn.className='caps-pill';cloudBtn.textContent='Nuvem (padrão)';cloudBtn.title='Usa a infraestrutura Caption IA com Groq no servidor';
 keyBtn=d.createElement('button');keyBtn.type='button';keyBtn.className='caps-pill';keyBtn.textContent='Minha chave Groq';keyBtn.title='Usa uma chave Groq pessoal salva neste computador';
 pills.appendChild(cloudBtn);pills.appendChild(keyBtn);field.appendChild(pills);
 keyWrap=d.createElement('div');keyWrap.style.cssText='display:none;margin-top:8px';
 var row=d.createElement('div');row.style.cssText='display:flex;gap:6px;align-items:center';
 keyInput=d.createElement('input');keyInput.type='password';keyInput.id='cia-groq-key';keyInput.placeholder='gsk_...';keyInput.autocomplete='off';keyInput.spellcheck=false;keyInput.style.cssText='flex:1;min-width:0';
 var paste=d.createElement('button');paste.type='button';paste.className='btn-secondary';paste.textContent='Colar';paste.style.cssText='flex:0 0 auto';
 row.appendChild(keyInput);row.appendChild(paste);keyWrap.appendChild(row);field.appendChild(keyWrap);
 keyHint=d.createElement('span');keyHint.className='transcribe-hint';keyHint.style.display='block';keyHint.style.marginTop='6px';field.appendChild(keyHint);
 cloudBtn.addEventListener('click',function(){setMode('cloud');});
 keyBtn.addEventListener('click',function(){setMode('personal');});
 keyInput.addEventListener('change',function(){
  var value=String(keyInput.value||'').trim();
  if(!value){say('Informe sua chave Groq para usar o modo personalizado.',true);return;}
  if(!saveKey(value)){say('A chave deve começar com gsk_ e não pôde ser salva.',true);return;}
  say('Chave Groq salva com segurança neste computador.');
 });
 paste.addEventListener('click',function(){
  var value=clipboard();
  if(value===null){say('Não consegui ler a área de transferência. Digite a chave manualmente.',true);return;}
  if(!value){say('A área de transferência está vazia.',true);return;}
  keyInput.value=value;
  if(!saveKey(value)){say('A chave colada não parece uma chave Groq válida (gsk_...).',true);return;}
  say('Chave Groq colada e salva neste computador.');
 });
 var first=body.querySelector('.form-field');
 if(first&&first.parentNode===body)body.insertBefore(field,first);else body.insertBefore(field,body.firstChild||null);
}
function host(script){
 return new Promise(function(resolve,reject){
  if(!w.csInterface||typeof w.csInterface.evalScript!=='function'){reject(Error('Ponte Adobe indisponível.'));return;}
  w.csInterface.evalScript(script,function(raw){
   try{var obj=JSON.parse(String(raw||''));if(obj.error)throw Error(String(obj.error));resolve(obj);}
   catch(e){reject(Error('Premiere: '+e.message));}
  });
 });
}
function owner(){
 return new Promise(function(resolve,reject){
  if(typeof w.fsConferirDonoTranscricao!=='function'){reject(Error('Verificação de sequência indisponível.'));return;}
  w.fsConferirDonoTranscricao(function(s){if(s&&s.seq)resolve(String(s.seq));else reject(Error('Abra uma sequência do Premiere.'));});
 });
}
function pick(){
 return new Promise(function(resolve,reject){
  if(typeof w.fsEscolherArquivos!=='function'){reject(Error('Seletor de áudio indisponível.'));return;}
  w.fsEscolherArquivos({titulo:'Áudio para transcrição',varios:false,tipos:['mp3','wav','m4a','ogg','flac','mp4','webm']},function(files,err){
   if(!files||!files.length){reject(Error(err||'Seleção de arquivo cancelada.'));return;}
   resolve({file:files[0],temporary:false});
  });
 });
}
function exportTimeline(){
 var root=typeof w.secureExtensionPath==='string'&&w.secureExtensionPath?w.secureExtensionPath:typeof w.extensionPath==='string'?w.extensionPath:'';
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
 }).then(function(result){if(!result.path)throw Error('Premiere não retornou o áudio exportado.');return{file:result.path,temporary:true};});
}
function fileInfo(file){
 var fs=require('fs'),path=require('path');
 var ext=path.extname(file).toLowerCase(),size=fs.statSync(file).size;
 var mime={'.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.ogg':'audio/ogg','.flac':'audio/flac','.webm':'audio/webm'};
 if(!mime[ext]||size<100||size>MAX)throw Error('Áudio deve ter entre 100 bytes e 24 MB (MP3, WAV, M4A, OGG, FLAC, MP4 ou WEBM).');
 return{ext:ext,size:size,mime:mime[ext]};
}
function multipart(file,fields,auth,hostName,pathName){
 return new Promise(function(resolve,reject){
  try{
   var fs=require('fs'),https=require('https'),crypto=require('crypto'),info=fileInfo(file);
   var boundary='cia'+crypto.randomBytes(12).toString('hex');
   function field(name,value){return Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"\r\n\r\n'+String(value)+'\r\n');}
   var chunks=[];
   Object.keys(fields||{}).forEach(function(name){var value=fields[name];if(value!==undefined&&value!==null&&String(value)!=='')chunks.push(field(name,value));});
   chunks.push(Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="audio'+info.ext+'"\r\nContent-Type: '+info.mime+'\r\n\r\n'));
   chunks.push(fs.readFileSync(file));chunks.push(Buffer.from('\r\n--'+boundary+'--\r\n'));
   var body=Buffer.concat(chunks),settled=false;
   function fail(err){if(!settled){settled=true;reject(err instanceof Error?err:Error(String(err)));}}
   var headers={'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':body.length,'Accept':'application/json'};
   if(auth)headers.Authorization='Bearer '+auth;
   var req=https.request({hostname:hostName,port:443,path:pathName,method:'POST',timeout:195000,headers:headers},function(r){
    var response=[],bytes=0;
    r.on('data',function(chunk){bytes+=chunk.length;if(bytes>2*1024*1024){req.destroy(Error('Resposta do servidor excedeu o limite seguro.'));return;}response.push(chunk);});
    r.on('error',fail);
    r.on('end',function(){
     if(settled)return;
     var raw=Buffer.concat(response).toString('utf8'),data={};
     try{data=JSON.parse(raw||'{}');}catch(e){return fail(Error('Resposta de transcrição inválida (HTTP '+r.statusCode+').'));}
     if(r.statusCode<200||r.statusCode>=300){
      var msg='Transcrição indisponível (HTTP '+r.statusCode+').';
      if(hostName==='api.groq.com'&&(r.statusCode===401||r.statusCode===403))msg='Chave Groq inválida, expirada ou sem permissão.';
      else if(hostName==='api.groq.com'&&r.statusCode===429)msg='A Groq limitou esta chave/conta. Tente novamente ou volte para Nuvem.';
      else if(data&&data.error)msg=typeof data.error==='string'?data.error:(data.error.message||msg);
      return fail(Error(msg));
     }
     if(data.ok===false)return fail(Error(data.error||'Transcrição indisponível.'));
     if(!Array.isArray(data.words)||!data.words.length)return fail(Error('A transcrição não retornou palavras temporizadas.'));
     settled=true;resolve(data);
    });
   });
   req.on('error',fail);req.on('timeout',function(){req.destroy(Error('Tempo esgotado durante a transcrição.'));});req.end(body);
  }catch(e){reject(e);}
 });
}
function uploadCloud(file,token,lang){
 return multipart(file,{language:lang},token,'caption.escotilhaprodutora.com','/api/v1/core/transcription');
}
function uploadPersonal(file,key,lang){
 return multipart(file,{
  model:'whisper-large-v3',response_format:'verbose_json','timestamp_granularities[]':'word',temperature:'0',language:lang
 },key,'api.groq.com','/openai/v1/audio/transcriptions').then(function(data){
  data.provider='groq-personal';data.model=data.model||'whisper-large-v3';return data;
 });
}
function captions(words){
 var input=words.map(function(x){return{text:String(x.word||x.text||'').trim(),start:Number(x.start),end:Number(x.end)};});
 if(!input.length||input.some(function(x){return!x.text||!isFinite(x.start)||!isFinite(x.end)||x.start<0||x.end<=x.start;}))return Promise.reject(Error('O serviço retornou palavras com tempos inválidos.'));
 var num=el('transcribe-words-per'),wordLimit=num?parseInt(num.value,10):3;if(!wordLimit||wordLimit<1)wordLimit=3;
 return w.CaptionIACloudCore.planCaptions(input,{maxWords:Math.min(6,wordLimit),maxChars:30,aspectRatio:'9:16'}).then(function(plan){
  if(!plan||!Array.isArray(plan.segments)||!plan.segments.length)throw Error('Servidor não retornou blocos de legendas.');
  var cues=plan.segments.map(function(segment){return{text:Array.isArray(segment.lines)?segment.lines.join('\n'):String(segment.text||''),startTime:Number(segment.start_time),endTime:Number(segment.end_time)};});
  for(var i=0;i<cues.length;i++)if(!cues[i].text||!isFinite(cues[i].startTime)||!isFinite(cues[i].endTime)||cues[i].endTime<=cues[i].startTime)throw Error('Blocos da API contêm tempos inválidos.');
  if(typeof w.fsAttachWordTimings==='function')cues=w.fsAttachWordTimings(cues,input.map(function(x){return{word:x.text,start:x.start,end:x.end};}))||cues;
  return cues;
 });
}
function save(result,seq,cues){
 result._fsSeq=seq;result._fsQuando=Date.now();w._fsLastResp=result;w._fsRespOriginal=null;w._fsCortesTotal=0;
 try{localStorage.setItem('framespeed_last_resp',JSON.stringify(result));}catch(e){}
 w.premiereSrtData=cues;
 try{var key=typeof w.LS_KEYS!=='undefined'&&w.LS_KEYS.SRT_DATA?w.LS_KEYS.SRT_DATA:'framespeed_srt_data';localStorage.setItem(key,JSON.stringify(cues));}catch(e2){}
 try{if(typeof w.saveSrtToLocalCache==='function')w.saveSrtToLocalCache(cues);}catch(e3){}
 try{if(typeof w.updateSRTButtonVisualState==='function')w.updateSRTButtonVisualState();}catch(e4){}
}
function execute(action){
 if(busy)return Promise.reject(Error('Já existe uma transcrição em andamento.'));
 if(!w.CaptionIACloudCore||!w.CaptionIALicense||!w.CaptionIALicense.isAuthorized())return Promise.reject(Error('Faça login com uma licença ativa para usar a transcrição.'));
 var source=currentMode(),personalKey='';
 if(source==='personal'){
  personalKey=String((keyInput&&keyInput.value)||readKey()||'').trim();
  if(!/^gsk_[A-Za-z0-9_-]{20,}$/.test(personalKey))return Promise.reject(Error('Informe uma chave Groq válida (gsk_...) ou volte para Nuvem.'));
  if(!saveKey(personalKey))return Promise.reject(Error('Não consegui guardar sua chave Groq neste computador.'));
 }
 updateBusy(true);say('Verificando sua licença e a sequência...');
 var seq,file;
 return owner().then(function(id){seq=id;return w.CaptionIACloudCore.getConfig();}).then(function(cfg){
  if(!cfg.features||!cfg.features.caption_plan)throw Error('O servidor ainda não habilitou o planejamento de legendas em nuvem.');
  if(source==='cloud'&&!cfg.features.cloud_transcription)throw Error('O servidor ainda não habilitou a transcrição em nuvem.');
  return action==='timeline'?exportTimeline():pick();
 }).then(function(info){
  file=info;var lang=String((el('transcribe-lang')||{}).value||'').trim();
  if(source==='personal'){
   say('Transcrevendo diretamente com sua chave Groq...');return uploadPersonal(info.file,personalKey,lang);
  }
  var token=w.CaptionIALicense.getAccessToken();if(!token)throw Error('Licença sem sessão válida. Faça login novamente.');
  say('Transcrevendo na nuvem...');return uploadCloud(info.file,token,lang);
 }).then(function(result){
  say('Preparando as legendas na nuvem...');return captions(result.words).then(function(cues){return{result:result,cues:cues};});
 }).then(function(bundle){
  return owner().then(function(now){
   if(now!==seq)throw Error('Sequência mudou durante a transcrição. Resultado descartado.');
   save(bundle.result,seq,bundle.cues);
   say('✓ '+bundle.result.words.length+' palavras e '+bundle.cues.length+' legendas preparadas. Abra Legendas para escolher os templates.');
   return{words:bundle.result.words.length,captions:bundle.cues.length};
  });
 }).finally(function(){if(file&&file.temporary)try{require('fs').unlinkSync(file.file);}catch(e){}updateBusy(false);});
}
function run(action,callback){
 execute(action).then(function(v){if(callback)callback({ok:true,resumo:v.words+' palavras, '+v.captions+' legendas ('+(currentMode()==='personal'?'Groq pessoal':'Groq Cloud')+')'});})
 .catch(function(err){say('Erro: '+(err&&err.message||err),true);if(callback)callback({ok:false,erro:String(err&&err.message||err)});});
}
function init(){
 var modal=el('transcribe-modal');if(!modal)return;
 // A interface antiga de provedores continua no pacote por compatibilidade interna,
 // mas o produto expõe apenas Nuvem (padrão) e chave Groq pessoal.
 ['openai-key-input','btn-key-colar','transcribe-servicos','transcribe-custom','transcribe-provider','transcribe-api-advanced'].forEach(function(id){
  var field=el(id);if(!field)return;var wrapper=field.closest&&field.closest('.form-field');if(wrapper)wrapper.style.display='none';else field.style.display='none';
 });
 status=el('transcribe-status');if(status)status.style.display='';
 buildSourceUi(modal);mode=loadMode();setMode(mode);
 modal.addEventListener('click',function(event){
  var target=event.target,action=null;
  while(target&&target!==modal&&!action){if(target.id==='btn-transcribe-timeline')action='timeline';else if(target.id==='btn-transcribe-file')action='file';else target=target.parentNode;}
  if(action){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();run(action);}
 },true);
 w.fsAutoEditTranscrever=function(done){run('timeline',done);};
 var legacyLegendas=w.fsAutoEditLegendas;
 if(typeof legacyLegendas==='function'){
  w.fsAutoEditLegendas=function(done){
   if(typeof w.fsConferirDonoTranscricao!=='function'){done({ok:false,erro:'Sequência não verificada.'});return;}
   w.fsConferirDonoTranscricao(function(s){
    if(!s||!s.seq){done({ok:false,erro:'Abra uma sequência.'});return;}
    var existing=w._fsLastResp;
    if(existing&&String(existing._fsSeq)===String(s.seq)&&Array.isArray(existing.words)&&existing.words.length){legacyLegendas(done);return;}
    run('timeline',function(value){if(value&&value.ok)legacyLegendas(done);else done(value||{ok:false,erro:'Transcrição indisponível.'});});
   });
  };
 }
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
