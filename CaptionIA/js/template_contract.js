(function(w){'use strict';
var cache={},diag={errors:[]};
function clamp(n,min,max,def){n=parseInt(n,10);if(isNaN(n))return def;return Math.max(min,Math.min(max,n));}
function normalize(raw){
  if(!raw||typeof raw!=='object')return null;
  var type=String(raw.type||'').toLowerCase(),engine=String(raw.engine||'').toLowerCase();
  if(!engine&&type==='karaoke')engine='word-highlight';
  var out={
    schema:clamp(raw.schema,1,99,1),
    name:typeof raw.name==='string'?raw.name:'',
    type:type,
    engine:engine,
    lineCount:clamp(raw.lineCount,1,6,0),
    maxWords:clamp(raw.maxWords,1,64,0),
    requiresWordTiming:!!raw.requiresWordTiming,
    colors:raw.colors&&typeof raw.colors==='object'?raw.colors:{},
    parameters:raw.parameters&&typeof raw.parameters==='object'?raw.parameters:{}
  };
  if(out.engine==='word-highlight'||out.type==='karaoke')out.requiresWordTiming=true;
  return out;
}
function validate(raw){
  var e=[],m=normalize(raw);
  if(!m)return['metadata ausente ou inválida'];
  if(m.engine&&['word-highlight','default'].indexOf(m.engine)<0)e.push('engine desconhecido: '+m.engine);
  if(m.engine==='word-highlight'){
    if(!m.maxWords)e.push('maxWords obrigatório para word-highlight');
    if(!m.parameters.text)e.push('parameters.text obrigatório para word-highlight');
    if(!m.parameters.wordTimings)e.push('parameters.wordTimings obrigatório para word-highlight');
  }
  return e;
}
function read(dir){
  try{
    if(typeof require==='undefined'||!dir)return null;
    var fs=require('fs'),path=require('path'),p=path.join(dir,'template.json');
    if(!fs.existsSync(p))return null;
    var st=fs.statSync(p),key=p+'|'+st.size+'|'+st.mtimeMs;
    if(cache.hasOwnProperty(key))return cache[key];
    var raw=JSON.parse(fs.readFileSync(p,'utf8')),errors=validate(raw),meta=normalize(raw);
    if(errors.length){
      diag.errors.push({path:p,errors:errors});
      try{console.warn('[Caption IA] template.json inválido em '+p+': '+errors.join('; '));}catch(e){}
    }
    meta=meta||null;
    cache[key]=meta;
    return meta;
  }catch(e){
    diag.errors.push({path:String(dir||''),errors:[String(e&&e.message||e)]});
    try{console.warn('[Caption IA] falha ao ler template.json:',e);}catch(x){}
    return null;
  }
}
function isWordHighlight(meta,fallbackText){
  meta=normalize(meta);
  if(meta&&(meta.engine==='word-highlight'||meta.type==='karaoke'))return true;
  return /(captionia[_ -]?word[_ -]?highlight|word[_ -]?highlight|karaoke)/i.test(String(fallbackText||''));
}
w.fsTemplateContract={normalize:normalize,validate:validate,read:read,isWordHighlight:isWordHighlight,diag:function(){return JSON.parse(JSON.stringify(diag));}};
})(window);