(function(w,d){'use strict';
var info,consent,busy=false;
function show(x){if(info)info.textContent=x;}
function transcribe(file,token,lang){
 return new Promise(function(ok,fail){
  try{
   var fs=require('fs'),https=require('https'),path=require('path'),crypto=require('crypto');
   var ext=path.extname(file).toLowerCase(),size=fs.statSync(file).size;
   if(!/^\.(mp3|wav|m4a|ogg|flac|mp4|webm)$/.test(ext)||size<100||size>24000000)throw Error('Áudio inválido ou maior que 24 MB.');
   var boundary='cia'+crypto.randomBytes(9).toString('hex');
   var fields='--'+boundary+'\r\nContent-Disposition: form-data; name="consent"\r\n\r\nyes\r\n';
   fields+='--'+boundary+'\r\nContent-Disposition: form-data; name="language"\r\n\r\n'+lang+'\r\n';
   fields+='--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="audio'+ext+'"\r\nContent-Type: application/octet-stream\r\n\r\n';
   var body=Buffer.concat([Buffer.from(fields),fs.readFileSync(file),Buffer.from('\r\n--'+boundary+'--\r\n')]);
   var req=https.request({hostname:'caption.escotilhaprodutora.com',path:'/api/v1/core/transcription',method:'POST',timeout:195000,
    headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':body.length}},function(r){
      var chunks=[],bytes=0;
      r.on('data',function(c){bytes+=c.length;if(bytes>2097152){req.destroy(Error('Resposta muito grande.'));return;}chunks.push(c);});
      r.on('error',fail);
      r.on('end',function(){try{
       var obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));
       if(r.statusCode!==200||!obj.ok||!Array.isArray(obj.words)||!obj.words.length)throw Error(obj.error||'Resposta inválida');
       ok(obj);
      }catch(e){fail(e);}});
   });
   req.on('error',fail);req.on('timeout',function(){req.destroy(Error('Timeout na nuvem.'));});req.end(body);
  }catch(e){fail(e);}
 });
}
function start(){
 if(busy)return;if(!consent.checked){show('Autorize o envio de áudio primeiro.');return;}
 if(!w.fsConferirDonoTranscricao||!w.fsEscolherArquivos){show('Integração Adobe indisponível.');return;}
 busy=true;show('Validando licença e sequência...');
 w.fsConferirDonoTranscricao(function(c){
  if(!c||!c.seq){busy=false;show('Abra uma sequência.');return;}
  var seq=String(c.seq);
  w.CaptionIACloudCore.getConfig().then(function(cfg){
   if(!cfg.features||!cfg.features.cloud_transcription)throw Error('Transcrição na nuvem desativada.');
   return new Promise(function(resolve,reject){w.fsEscolherArquivos({titulo:'Selecionar áudio',varios:false,tipos:['mp3','wav','m4a','ogg','flac','mp4','webm']},
    function(a,e){if(!a)reject(Error(e||'Erro ao selecionar arquivo.'));else resolve(a[0]||null);});});
  }).then(function(file){
   if(!file)return;
   var token=w.CaptionIALicense.getAccessToken(),node=d.getElementById('transcribe-lang');
   if(!token)throw Error('Licença expirada.');
   show('Transcrevendo no servidor...');
   return transcribe(file,token,node?String(node.value||''):'').then(function(result){
    return new Promise(function(resolve,reject){w.fsConferirDonoTranscricao(function(now){
     if(!now||String(now.seq)!==seq)reject(Error('Sequência mudou; descartei a transcrição.'));
     else resolve(result);
    });});
   }).then(function(result){
    result._fsSeq=seq;result._fsQuando=Date.now();w._fsLastResp=result;
    try{localStorage.setItem('framespeed_last_resp',JSON.stringify(result));}catch(e){}
    show('✓ '+result.words.length+' palavras. Clique em Prévia na nuvem para preparar legendas.');
   });
  }).catch(function(e){show('Erro: '+(e.message||e));}).then(function(){busy=false;},function(){busy=false;});
 });
}
function init(){
 var modal=d.getElementById('transcribe-modal');if(!modal)return;
 var box=d.createElement('div');box.style.cssText='padding:12px;margin:12px;border:1px solid #555';
 var h=d.createElement('strong');h.textContent='Transcrição Cloud (opcional)';box.appendChild(h);
 var lbl=d.createElement('label');lbl.style.display='block';consent=d.createElement('input');consent.type='checkbox';lbl.appendChild(consent);
 lbl.appendChild(d.createTextNode(' Autorizo enviar áudio ao Caption IA/Groq.'));box.appendChild(lbl);
 var btn=d.createElement('button');btn.type='button';btn.textContent='Transcrever na nuvem';btn.onclick=start;box.appendChild(btn);
 info=d.createElement('p');box.appendChild(info);(modal.querySelector('.modal-box')||modal).appendChild(box);
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
