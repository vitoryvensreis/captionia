(function(w){'use strict';
var FILE='license_session.json',diag={provider:'node-aes',path:'',error:''};

function deps(){
  try{
    if(typeof require==='undefined')return null;
    return{fs:require('fs'),path:require('path'),crypto:require('crypto'),os:require('os')};
  }catch(e){diag.error=String(e&&e.message||e);return null;}
}
function filePath(d){
  try{
    var dir='';
    if(w.CaptionIAPaths&&w.CaptionIAPaths.configDir){
      dir=w.CaptionIAPaths.configDir();
    }else{
      var cs=new CSInterface();
      var docs=cs.getSystemPath(SystemPath.MY_DOCUMENTS);
      dir=d.path.join(docs,'editBest','_config');
    }
    if(!dir)return null;
    if(!d.fs.existsSync(dir))d.fs.mkdirSync(dir,{recursive:true});
    var p=d.path.join(dir,FILE);diag.path=p;return p;
  }catch(e){diag.error=String(e&&e.message||e);return null;}
}
function machineKey(d){
  var who='';
  try{who=String(d.os.hostname()||'')+'|'+String(d.os.userInfo().username||'')+'|'+String(d.os.platform()||'');}
  catch(_e){who=String(d.os.hostname()||'')+'|'+String(d.os.platform()||'');}
  return d.crypto.createHash('sha256').update('CaptionIA-License-v1|'+who,'utf8').digest();
}
function encrypt(d,text){
  var iv=d.crypto.randomBytes(12),key=machineKey(d);
  var cipher=d.crypto.createCipheriv('aes-256-gcm',key,iv);
  var enc=Buffer.concat([cipher.update(String(text||''),'utf8'),cipher.final()]);
  var tag=cipher.getAuthTag();
  return{iv:iv.toString('base64'),tag:tag.toString('base64'),data:enc.toString('base64')};
}
function decrypt(d,obj){
  var key=machineKey(d),iv=Buffer.from(String(obj.iv||''),'base64'),tag=Buffer.from(String(obj.tag||''),'base64');
  var decipher=d.crypto.createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(String(obj.data||''),'base64')),decipher.final()]).toString('utf8');
}
function write(d,p,obj){
  var tmp=p+'.tmp';
  d.fs.writeFileSync(tmp,JSON.stringify(obj),'utf8');
  try{d.fs.chmodSync(tmp,0o600);}catch(_e){}
  d.fs.renameSync(tmp,p);
  try{d.fs.chmodSync(p,0o600);}catch(_e2){}
}
var api={
  setRefresh:function(value){
    var d=deps();if(!d)return false;
    var p=filePath(d);if(!p)return false;
    value=String(value||'').trim();
    if(!value)return api.remove();
    try{
      write(d,p,{version:1,provider:'node-aes-256-gcm',payload:encrypt(d,value)});
      diag.error='';return true;
    }catch(e){diag.error='gravar sessão: '+String(e&&e.message||e);return false;}
  },
  getRefresh:function(){
    var d=deps();if(!d)return'';
    var p=filePath(d);if(!p||!d.fs.existsSync(p))return'';
    try{
      var obj=JSON.parse(d.fs.readFileSync(p,'utf8'));
      if(!obj||!obj.payload)return'';
      return decrypt(d,obj.payload);
    }catch(e){diag.error='abrir sessão: '+String(e&&e.message||e);return'';}
  },
  remove:function(){
    var d=deps();if(!d)return false;
    var p=filePath(d);
    try{if(p&&d.fs.existsSync(p))d.fs.unlinkSync(p);diag.error='';return true;}
    catch(e){diag.error=String(e&&e.message||e);return false;}
  },
  diag:function(){return JSON.parse(JSON.stringify(diag));}
};
w.CaptionIALicenseStore=api;
})(window);
