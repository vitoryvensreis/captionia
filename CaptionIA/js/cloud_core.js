/* Caption IA Cloud Core client.
 * Only interface, API requests and Adobe adapters belong on the client.
 * The cloud modules are opt-in and never mutate the timeline directly.
 */
(function(w){
  'use strict';
  var API_HOST = 'caption.escotilhaprodutora.com';
  function license(){
    if (!w.CaptionIALicense || !w.CaptionIALicense.isAuthorized()) {
      throw new Error('Faça login e valide sua licença para acessar o Cloud Core.');
    }
    return w.CaptionIALicense;
  }
  function api(method,path,body){
    var auth;
    try { auth=license(); } catch(e){ return Promise.reject(e); }
    return auth.apiRequest(method,path,body).catch(function(e){
      if (e && e.status===401 && auth.recheck){
        return auth.recheck().then(function(){
          if(!auth.isAuthorized()) throw new Error('Licença não autorizada.');
          return auth.apiRequest(method,path,body);
        });
      }
      throw e;
    });
  }
  function options(o) { return o && typeof o==='object' ? o : {}; }
  function currentVersion(){
    return (license().getState()||{}).version || '3.4.8';
  }
  function planCaptions(textOrWords,opts){
    opts=options(opts);
    var input={
      aspect_ratio:opts.aspectRatio||'9:16', max_words:opts.maxWords||4,
      max_chars:opts.maxChars||26, font_size:opts.fontSize||72,
      max_duration:opts.maxDuration||3.5,
      client_version:currentVersion()
    };
    if(Array.isArray(textOrWords)) input.words=textOrWords;
    else input.text=String(textOrWords||'');
    return api('POST','/core/captions/plan',input);
  }
  function planEdit(metadata){
    metadata=options(metadata);
    return api('POST','/core/edit/plan',{
      duration:metadata.duration, fps:metadata.fps,
      silences:metadata.silences||[],
      min_silence:metadata.minSilence,
      margin_before:metadata.marginBefore,
      margin_after:metadata.marginAfter,
      client_version:currentVersion()
    });
  }
  function getConfig(){return api('GET','/core/config',null);}
  function listAssets(){return api('GET','/core/assets',null);}
  function downloadAsset(meta){
    meta=options(meta);
    var id=String(meta.id||'');
    if(!/^[a-f0-9]{64}$/.test(id)) return Promise.reject(new Error('Identificador de asset inválido.'));
    var suffix=/\.([a-z0-9]{2,6})$/i.exec(String(meta.label||''));
    var ext=suffix?suffix[1].toLowerCase():'bin';
    if(!/^(mogrt|fsm|fsa|aep|prproj|epr|wav|mp3|m4a|mp4|jpg|jpeg|png|webp|json|bin)$/.test(ext)) ext='bin';
    return getConfig().then(function(cfg){
      if(!cfg.features || !cfg.features.assets) throw new Error('Biblioteca na nuvem ainda não habilitada.');
      var token=license().getAccessToken();
      if(!token) throw new Error('Sessão expirada.');
      var fs,os,path,crypto,https;
      try {
        fs=require('fs'); os=require('os'); path=require('path');
        crypto=require('crypto'); https=require('https');
      } catch(e){ throw new Error('Runtime Node indisponível para transferir assets.'); }
      var directory=path.join(process.platform==='win32'?(process.env.LOCALAPPDATA||os.tmpdir()):path.join(os.homedir(),'Library','Application Support'),'CaptionIA','CloudCache');
      fs.mkdirSync(directory,{recursive:true});
      var dest=path.join(directory,id+'.'+ext);
      if(fs.existsSync(dest) && crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')===id){
        return dest;
      }
      return new Promise(function(resolve,reject){
        var temp=path.join(directory,id+'.'+crypto.randomBytes(5).toString('hex')+'.part');
        var out=null,req=null,finished=false;
        function fail(error){
          if(finished)return;finished=true;
          try{if(out)out.destroy();}catch(_e){}
          try{fs.unlinkSync(temp);}catch(_e2){}
          reject(error instanceof Error?error:new Error(String(error)));
        }
        req=https.request({
          hostname:API_HOST,port:443,
          path:'/api/v1/core/assets/'+id,
          method:'GET',
          headers:{Authorization:'Bearer '+token,Accept:'application/octet-stream'},
          timeout:45000
        },function(response){
          if(response.statusCode!==200){
            response.resume();
            return fail(new Error('Asset indisponível (HTTP '+response.statusCode+').'));
          }
          var max=26*1024*1024, total=0;
          var hash=crypto.createHash('sha256');
          out=fs.createWriteStream(temp,{flags:'wx',mode:0o600});
          out.on('error',fail);
          response.on('error',fail);
          response.on('data',function(chunk){
            total+=chunk.length;
            if(total>max){ response.destroy();fail(new Error('Asset maior que o limite seguro.'));return;}
            hash.update(chunk);
          });
          response.pipe(out);
          out.on('finish',function(){
            if(finished)return;
            try {
              if(hash.digest('hex')!==id) throw new Error('Falha na verificação SHA-256 do asset.');
              if(fs.existsSync(dest))fs.unlinkSync(dest);
              fs.renameSync(temp,dest);
              finished=true;resolve(dest);
            } catch(e){fail(e);}
          });
        });
        req.on('error',fail);
        req.on('timeout',function(){req.destroy(new Error('Tempo esgotado no download.'));});
        req.end();
      });
    });
  }
  function attachCloudAudioPanel(){
    if(document.getElementById('cia-cloud-audio-script')) return;
    var script=document.createElement('script');script.id='cia-cloud-audio-script';
    script.src='js/cloud_audio_panel.js';
    script.onerror=function(){console.warn('[Caption IA] Transcrição Cloud indisponível.');};
    (document.head||document.documentElement).appendChild(script);
  }
  function attachCloudCaptionPanel(){
    if(document.getElementById('cia-cloud-captions-script')) return;
    var script=document.createElement('script');script.id='cia-cloud-captions-script';
    script.src='js/cloud_captions_ui.js';
    script.onerror=function(){console.warn('[Caption IA] Módulo de prévia Cloud Core não carregou.');};
    (document.head||document.documentElement).appendChild(script);
  }
  // O cliente final usa os botões existentes de transcrição; os paineis de preview Cloud eram somente de homologação.
  // O módulo final é carregado pelo index.html. Não injetar interfaces duplicadas.
  w.CaptionIACloudCore=Object.freeze({
    getConfig:getConfig,
    planCaptions:planCaptions,
    planEdit:planEdit,
    listAssets:listAssets,
    downloadAsset:downloadAsset
  });
})(window);
