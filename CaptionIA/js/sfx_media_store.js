/* Caption IA - persistent SFX source for Premiere.
 * Keeps licensed local sounds addressable after CEP plugin updates.
 * Does not delete or rewrite users' original files or existing projects.
 */
(function(root){
'use strict';
var extensions={'.wav':1,'.mp3':1,'.m4a':1,'.aac':1,'.ogg':1,'.flac':1,'.aif':1,'.aiff':1};
var maxSize=100*1024*1024;
function deps(){
 if(typeof require!=='function')throw Error('Acesso aos arquivos locais não está disponível no painel Adobe.');
 return {fs:require('fs'),path:require('path'),crypto:require('crypto'),os:require('os')};
}
function storeRoot(options,d){
 var explicit=options&&options.storeRoot;
 if(explicit)return explicit;
 var osdir=typeof process!=='undefined'&&process.env&&process.env.LOCALAPPDATA;
 if(!osdir)osdir=d.path.join(d.os.homedir(),'AppData','Local');
 return d.path.join(osdir,'CaptionIA','Media','SFX');
}
function bundledRoot(options,d){
 var base=(options&&options.extensionRoot)||
  (typeof secureExtensionPath!=='undefined'&&secureExtensionPath)||
  (typeof extensionPath!=='undefined'&&extensionPath)||'';
 if(!base)throw Error('Pasta da extensão Caption IA indisponível.');
 return d.path.join(base,'templates');
}
function validSource(source,d) {
 if(typeof source!=='string'||!source.trim())throw Error('Caminho SFX ausente.');
 var path=d.path.resolve(source);
 if(!extensions[d.path.extname(path).toLowerCase()])throw Error('Formato SFX não suportado: '+d.path.basename(path));
 var stat=d.fs.statSync(path);
 if(!stat.isFile()||stat.size<44||stat.size>maxSize)throw Error('Arquivo SFX vazio ou maior que 100 MB: '+d.path.basename(path));
 return path;
}
function bundleIndex(dir,d,depth,list){
 if(depth>6||!d.fs.existsSync(dir))return list;
 var items=d.fs.readdirSync(dir,{withFileTypes:true});
 for(var i=0;i<items.length;i++){
  var entry=items[i],full=d.path.join(dir,entry.name);
  if(entry.isDirectory()){bundleIndex(full,d,depth+1,list);continue;}
  if(entry.isFile()&&extensions[d.path.extname(entry.name).toLowerCase()])list.push(full);
 }
 return list;
}
function matchMissingPath(path,options,d){
 // Only substitute built-in sounds by their exact basename.
 // Never guess a user's missing audio file merely from a similar name.
 var name=d.path.basename(path||'');
 if(!name||!extensions[d.path.extname(name).toLowerCase()])return null;
 var root=bundledRoot(options,d),list=bundleIndex(root,d,0,[]);
 var matches=list.filter(function(p){return d.path.basename(p).toLowerCase()===name.toLowerCase();});
 if(matches.length===1)return matches[0];
 if(matches.length>1){
  var relative=String(path).replace(/\\/g,'/').toLowerCase();
  var exact=matches.filter(function(p){
   var n=d.path.relative(root,p).replace(/\\/g,'/').toLowerCase();
   return relative.endsWith('/'+n);
  });
  if(exact.length===1)return exact[0];
 }
 return null;
}
function stageSource(source,options){
 var d=deps(),root=storeRoot(options,d),original=source;
 try { original=validSource(original,d); }
 catch(e){
  if(e.code!=='ENOENT'&&e.code!=='ENOTDIR')throw e;
  var match=matchMissingPath(source,options,d);
  if(!match)throw Error('SFX não encontrado: '+d.path.basename(String(source||''))+'. Localize o arquivo original no mix.');
  original=validSource(match,d);
 }
 d.fs.mkdirSync(root,{recursive:true});
 // Keep an already staged media path stable across repeated generations.
 // Do not prepend another hash to cache files when the plugin reloads.
 var rel=d.path.relative(root,original);
 if(rel&&rel!=='..'&&!rel.startsWith('..'+d.path.sep)&&!d.path.isAbsolute(rel))return original;
 var checksum=d.crypto.createHash('sha256');
 var fd=d.fs.openSync(original,'r'),buffer=Buffer.allocUnsafe(1024*512);
 try{
  var n;
  while((n=d.fs.readSync(fd,buffer,0,buffer.length,null))>0)checksum.update(buffer.subarray(0,n));
 }finally{d.fs.closeSync(fd);}
 var hash=checksum.digest('hex').slice(0,20);
 var ext=d.path.extname(original).toLowerCase();
 var basename=d.path.basename(original,ext).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,65)||'audio';
 var dest=d.path.join(root,hash+'-'+basename+ext);
 if(!d.fs.existsSync(dest)){
  // Atomic copy. Never touch existing cache file or original file.
  var tmp=dest+'.'+d.crypto.randomBytes(6).toString('hex')+'.tmp';
  try{d.fs.copyFileSync(original,tmp,d.fs.constants.COPYFILE_EXCL);d.fs.renameSync(tmp,dest);}
  finally{if(d.fs.existsSync(tmp))d.fs.unlinkSync(tmp);}
 }
 if(d.fs.statSync(dest).size!==d.fs.statSync(original).size)
  throw Error('Falha ao manter cópia estável do SFX: '+d.path.basename(original));
 return dest;
}
function prepareMix(items,options){
 if(!Array.isArray(items))throw Error('Mix de efeitos inválido.');
 var errors=[],resolved=[];
 for(var i=0;i<items.length;i++){
  var source=items[i];
  if(!source||typeof source.path!=='string') {errors.push('SFX '+(i+1)+': caminho inválido');continue;}
  try {
   var fixed=stageSource(source.path,options);
   var entry={};
   for(var key in source)if(Object.prototype.hasOwnProperty.call(source,key))entry[key]=source[key];
   entry.path=fixed;
   entry.missing=false;
   resolved.push(entry);
  }catch(e){errors.push((source.name||('SFX '+(i+1)))+': '+e.message);}
 }
 return {items:resolved,errors:errors,storage:storeRoot(options,deps())};
}
var api=Object.freeze({prepareMix:prepareMix,stageSource:stageSource,matchMissingPath:matchMissingPath});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.CaptionIASfxMedia=api;
})(typeof window!=='undefined'?window:null);
