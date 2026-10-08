(function(w,d){'use strict';

var CURRENT_VERSION='3.4.0';
var SITE='https://caption.escotilhaprodutora.com';
var CHECK_EVERY_MS=6*60*60*1000;
var checking=false;
var timer=null;

function deps(){
  try{
    if(typeof require==='undefined')return null;
    return{
      fs:require('fs'),
      path:require('path'),
      os:require('os'),
      crypto:require('crypto'),
      https:require('https'),
      url:require('url'),
      zlib:require('zlib')
    };
  }catch(_e){return null;}
}
function version(v){return String(v||'').replace(/^v/i,'').trim();}
function compare(a,b){
  var aa=version(a).split(/[.+-]/),bb=version(b).split(/[.+-]/);
  for(var i=0;i<3;i++){
    var x=parseInt(aa[i]||'0',10)||0,y=parseInt(bb[i]||'0',10)||0;
    if(x>y)return 1;if(x<y)return-1;
  }
  return 0;
}
function normalizePath(p){
  p=String(p||'');
  try{p=decodeURIComponent(p);}catch(_e){}
  p=p.replace(/^file:\/\/\/([A-Za-z]:)/i,'$1').replace(/^file:\/\//i,'');
  return p.replace(/\//g,(typeof process!=='undefined'&&process.platform==='win32')?'\\':'/');
}
function extensionPath(){
  try{return normalizePath(new CSInterface().getSystemPath(SystemPath.EXTENSION));}
  catch(_e){return'';}
}
function absoluteUrl(raw){
  raw=String(raw||'');
  if(/^https:\/\//i.test(raw))return raw;
  if(raw.charAt(0)!=='/')raw='/'+raw;
  return SITE+raw;
}
function trusted(raw){
  var nd=deps();if(!nd)return false;
  try{
    var p=nd.url.parse(absoluteUrl(raw));
    return p.protocol==='https:'&&String(p.hostname||'').toLowerCase()==='caption.escotilhaprodutora.com';
  }catch(_e){return false;}
}
function toast(title,text,type,sticky){
  var old=d.getElementById('cia-update-toast');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
  var el=d.createElement('div');
  el.id='cia-update-toast';
  el.className='cia-update-toast'+(type?' '+type:'');
  el.innerHTML='<div class="cia-update-icon">↻</div><div class="cia-update-copy"><b></b><span></span></div>'
    +(sticky?'':'<button type="button" class="cia-update-close">×</button>');
  el.querySelector('b').textContent=title||'Caption IA';
  el.querySelector('span').textContent=text||'';
  d.body.appendChild(el);
  var btn=el.querySelector('.cia-update-close');
  if(btn)btn.onclick=function(){if(el.parentNode)el.parentNode.removeChild(el);};
  if(!sticky)setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},8000);
  return el;
}
function toastText(text){
  var el=d.getElementById('cia-update-toast');
  if(el){var s=el.querySelector('span');if(s)s.textContent=text||'';}
}
function mkdirp(fs,pathMod,dir){
  if(fs.existsSync(dir))return;
  var parent=pathMod.dirname(dir);
  if(parent&&parent!==dir)mkdirp(fs,pathMod,parent);
  try{fs.mkdirSync(dir);}catch(e){if(!fs.existsSync(dir))throw e;}
}
function rmrf(fs,pathMod,target){
  if(!target||!fs.existsSync(target))return;
  var st=fs.lstatSync(target);
  if(st.isDirectory()){
    fs.readdirSync(target).forEach(function(n){rmrf(fs,pathMod,pathMod.join(target,n));});
    fs.rmdirSync(target);
  }else fs.unlinkSync(target);
}
function download(rawUrl,dest,token,expectedSize,onProgress,redirects){
  redirects=redirects||0;
  return new Promise(function(resolve,reject){
    var nd=deps();if(!nd){reject(new Error('Node.js do CEP indisponível.'));return;}
    var url=absoluteUrl(rawUrl);
    if(!trusted(url)){reject(new Error('Servidor de atualização não autorizado.'));return;}
    if(redirects>4){reject(new Error('Redirecionamentos demais.'));return;}

    var p=nd.url.parse(url);
    var req=nd.https.request({
      protocol:p.protocol,hostname:p.hostname,port:p.port,path:p.path,method:'GET',
      headers:{Authorization:'Bearer '+token,Accept:'application/zip','User-Agent':'CaptionIA/'+CURRENT_VERSION}
    },function(res){
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){
        res.resume();
        download(res.headers.location,dest,token,expectedSize,onProgress,redirects+1).then(resolve,reject);
        return;
      }
      if(res.statusCode!==200){res.resume();reject(new Error('Download falhou (HTTP '+res.statusCode+').'));return;}
      var total=parseInt(res.headers['content-length']||expectedSize||'0',10)||0,got=0,last=-1;
      var out=nd.fs.createWriteStream(dest);
      res.on('data',function(chunk){
        got+=chunk.length;
        if(total>0&&onProgress){
          var pct=Math.floor(got*100/total);
          if(pct>=last+5){last=pct;onProgress(Math.min(100,pct));}
        }
      });
      res.pipe(out);
      out.on('finish',function(){out.close(function(){resolve(got);});});
      out.on('error',reject);
    });
    req.on('error',reject);
    req.setTimeout(120000,function(){req.destroy(new Error('Tempo esgotado ao baixar atualização.'));});
    req.end();
  });
}
function hashFile(file){
  return new Promise(function(resolve,reject){
    var nd=deps();if(!nd){reject(new Error('Crypto indisponível.'));return;}
    var h=nd.crypto.createHash('sha256'),s=nd.fs.createReadStream(file);
    s.on('data',function(c){h.update(c);});
    s.on('end',function(){resolve(h.digest('hex'));});
    s.on('error',reject);
  });
}
function readExactly(fs,fd,length,position){
  var buf=Buffer.alloc(length),offset=0;
  while(offset<length){
    var n=fs.readSync(fd,buf,offset,length-offset,position+offset);
    if(n<=0)throw new Error('ZIP truncado.');
    offset+=n;
  }
  return buf;
}
function extractZip(zipFile,outRoot){
  var nd=deps();if(!nd)throw new Error('Node.js indisponível.');
  var fs=nd.fs,pathMod=nd.path,zlib=nd.zlib,fd=fs.openSync(zipFile,'r');
  try{
    var size=fs.fstatSync(fd).size;
    var tailLen=Math.min(size,65557),tail=readExactly(fs,fd,tailLen,size-tailLen),eocd=-1;
    for(var i=tail.length-22;i>=0;i--){
      if(tail.readUInt32LE(i)===0x06054b50){eocd=i;break;}
    }
    if(eocd<0)throw new Error('ZIP sem diretório central.');
    var entries=tail.readUInt16LE(eocd+10),cdSize=tail.readUInt32LE(eocd+12),cdOffset=tail.readUInt32LE(eocd+16);
    if(entries>10000||cdSize>32*1024*1024)throw new Error('ZIP fora dos limites permitidos.');
    var cd=readExactly(fs,fd,cdSize,cdOffset),pos=0,total=0;
    mkdirp(fs,pathMod,outRoot);
    for(var e=0;e<entries;e++){
      if(pos+46>cd.length||cd.readUInt32LE(pos)!==0x02014b50)throw new Error('ZIP central inválido.');
      var flags=cd.readUInt16LE(pos+8),method=cd.readUInt16LE(pos+10);
      var compSize=cd.readUInt32LE(pos+20),uncompSize=cd.readUInt32LE(pos+24);
      var nameLen=cd.readUInt16LE(pos+28),extraLen=cd.readUInt16LE(pos+30),commentLen=cd.readUInt16LE(pos+32);
      var localOffset=cd.readUInt32LE(pos+42);
      var name=cd.slice(pos+46,pos+46+nameLen).toString('utf8').replace(/\\/g,'/');
      pos+=46+nameLen+extraLen+commentLen;
      if(flags&1)throw new Error('ZIP criptografado não é aceito.');
      if(name.indexOf('CaptionIA/')!==0)continue;
      var rel=name.slice('CaptionIA/'.length);
      if(!rel)continue;
      var parts=rel.split('/');
      if(parts.some(function(x){return x==='..'||x===''&&rel.charAt(rel.length-1)!=='/';}))throw new Error('Caminho inválido dentro do ZIP.');
      var dest=pathMod.resolve(outRoot,rel);
      var rootPrefix=pathMod.resolve(outRoot)+pathMod.sep;
      if(dest!==pathMod.resolve(outRoot)&&dest.indexOf(rootPrefix)!==0)throw new Error('ZIP tentou sair do diretório permitido.');
      if(name.charAt(name.length-1)==='/'){mkdirp(fs,pathMod,dest);continue;}
      total+=uncompSize;if(total>1536*1024*1024)throw new Error('ZIP expandido excede o limite seguro.');
      if(compSize>512*1024*1024||uncompSize>1024*1024*1024)throw new Error('Arquivo do ZIP excede o limite seguro.');
      var local=readExactly(fs,fd,30,localOffset);
      if(local.readUInt32LE(0)!==0x04034b50)throw new Error('Cabeçalho local do ZIP inválido.');
      var localNameLen=local.readUInt16LE(26),localExtraLen=local.readUInt16LE(28);
      var dataOffset=localOffset+30+localNameLen+localExtraLen;
      var compressed=readExactly(fs,fd,compSize,dataOffset),data;
      if(method===0)data=compressed;
      else if(method===8)data=zlib.inflateRawSync(compressed);
      else throw new Error('Método de compressão ZIP não suportado: '+method);
      if(data.length!==uncompSize)throw new Error('Tamanho descompactado divergente.');
      mkdirp(fs,pathMod,pathMod.dirname(dest));
      fs.writeFileSync(dest,data);
    }
  }finally{fs.closeSync(fd);}
}
function validatePayload(root,releaseVersion){
  var nd=deps(),manifest=nd.path.join(root,'CSXS','manifest.xml');
  if(!nd.fs.existsSync(manifest)||!nd.fs.existsSync(nd.path.join(root,'index.html'))||!nd.fs.existsSync(nd.path.join(root,'js','main.js'))){
    throw new Error('Pacote de atualização incompleto.');
  }
  var xml=nd.fs.readFileSync(manifest,'utf8'),m=xml.match(/ExtensionBundleVersion="([^"]+)"/);
  if(!m||version(m[1])!==version(releaseVersion))throw new Error('Versão do pacote não corresponde à release.');
}
function walkFiles(fs,pathMod,root,out){
  out=out||[];
  fs.readdirSync(root).forEach(function(name){
    var full=pathMod.join(root,name),st=fs.lstatSync(full);
    if(st.isDirectory())walkFiles(fs,pathMod,full,out);else if(st.isFile())out.push(full);
  });
  return out;
}
function sameFile(nd,a,b){
  if(!nd.fs.existsSync(b))return false;
  var sa=nd.fs.statSync(a),sb=nd.fs.statSync(b);
  if(sa.size!==sb.size)return false;
  var ha=nd.crypto.createHash('sha256').update(nd.fs.readFileSync(a)).digest('hex');
  var hb=nd.crypto.createHash('sha256').update(nd.fs.readFileSync(b)).digest('hex');
  return ha===hb;
}
function applyUpdate(payload,releaseVersion,workRoot){
  var nd=deps();if(!nd)throw new Error('Node.js indisponível.');
  var target=extensionPath();
  if(!target||!nd.fs.existsSync(target))throw new Error('Instalação atual do Caption IA não encontrada.');
  var backup=nd.path.join(workRoot,'backup'),changed=[];
  mkdirp(nd.fs,nd.path,backup);

  try{
    var files=walkFiles(nd.fs,nd.path,payload,[]);
    for(var i=0;i<files.length;i++){
      var src=files[i],rel=nd.path.relative(payload,src),dst=nd.path.join(target,rel);
      if(sameFile(nd,src,dst))continue;
      var existed=nd.fs.existsSync(dst),bak=nd.path.join(backup,rel);
      if(existed){
        mkdirp(nd.fs,nd.path,nd.path.dirname(bak));
        nd.fs.copyFileSync(dst,bak);
      }
      mkdirp(nd.fs,nd.path,nd.path.dirname(dst));
      nd.fs.copyFileSync(src,dst);
      changed.push({dst:dst,bak:bak,existed:existed});
    }
    validatePayload(target,releaseVersion);
  }catch(err){
    for(var j=changed.length-1;j>=0;j--){
      var item=changed[j];
      try{
        if(item.existed){
          mkdirp(nd.fs,nd.path,nd.path.dirname(item.dst));
          nd.fs.copyFileSync(item.bak,item.dst);
        }else if(nd.fs.existsSync(item.dst))nd.fs.unlinkSync(item.dst);
      }catch(_e){}
    }
    throw err;
  }
}
function installRelease(release){
  var nd=deps();if(!nd)return Promise.reject(new Error('Atualizador indisponível neste ambiente.'));
  var token=w.CaptionIALicense&&w.CaptionIALicense.getAccessToken?w.CaptionIALicense.getAccessToken():'';
  if(!token)return Promise.reject(new Error('Sessão da licença indisponível.'));
  var work=nd.path.join(nd.os.tmpdir(),'CaptionIA-update-'+version(release.version)+'-'+Date.now());
  var zip=nd.path.join(work,'update.zip'),payload=nd.path.join(work,'payload');
  mkdirp(nd.fs,nd.path,work);
  toast('Atualização '+release.version,'Baixando…','loading',true);
  return download(release.download_url,zip,token,release.file_size,function(p){toastText('Baixando… '+p+'%');})
    .then(function(bytes){
      if(release.file_size&&bytes!==Number(release.file_size))throw new Error('Tamanho do pacote não confere.');
      toastText('Validando integridade…');return hashFile(zip);
    })
    .then(function(hash){
      if(!release.sha256||String(hash).toLowerCase()!==String(release.sha256).toLowerCase())throw new Error('SHA-256 da atualização não confere.');
      toastText('Preparando arquivos…');extractZip(zip,payload);validatePayload(payload,release.version);
      toastText('Aplicando atualização…');applyUpdate(payload,release.version,work);
      try{rmrf(nd.fs,nd.path,work);}catch(_e){}
      toast('Atualização '+release.version+' instalada','Feche e abra o Premiere para carregar a nova versão.','ready',true);
      return true;
    })
    .catch(function(err){
      try{rmrf(nd.fs,nd.path,work);}catch(_e){}
      toast('Atualização não concluída',String(err&&err.message||err),'error',false);
      throw err;
    });
}
function checkNow(){
  if(checking)return Promise.resolve(false);
  if(!w.CaptionIALicense||!w.CaptionIALicense.isAuthorized||!w.CaptionIALicense.isAuthorized())return Promise.resolve(false);
  checking=true;
  return w.CaptionIALicense.apiRequest('GET','/releases/latest',null).then(function(data){
    checking=false;
    if(!data||!data.available||!data.release)return false;
    var release=data.release;
    if(compare(release.version,CURRENT_VERSION)<=0)return false;
    if(!release.download_url||!release.sha256)return false;
    return installRelease(release);
  }).catch(function(_err){checking=false;return false;});
}
function schedule(){
  if(timer)clearInterval(timer);
  timer=setInterval(function(){checkNow();},CHECK_EVERY_MS);
}
function boot(){
  d.addEventListener('captionia:license-ready',function(){setTimeout(checkNow,2500);schedule();});
  setTimeout(function(){
    if(w.CaptionIALicense&&w.CaptionIALicense.isAuthorized&&w.CaptionIALicense.isAuthorized()){checkNow();schedule();}
  },5000);
}

w.CaptionIAUpdater={checkNow:checkNow,currentVersion:CURRENT_VERSION};
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})(window,document);
