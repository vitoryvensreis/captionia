(function(){'use strict';
var BUSY=false;

function el(id){return document.getElementById(id);}
function status(msg,tipo){
  var n=el('captions-insert-status')||el('statusMessage');
  if(!n)return;
  n.textContent=msg||'';
  n.className='transcribe-status'+(tipo?' transcribe-status--'+tipo:'');
}
function clean(t){
  t=String(t==null?'':t);
  try{if(typeof window.fsCleanCaptionText==='function')t=window.fsCleanCaptionText(t);}catch(e){}
  return t.replace(/\r\n?/g,'\n').replace(/^\s+|\s+$/g,'');
}
function norm(t){
  t=String(t==null?'':t).toLowerCase().replace(/[.,!?…:;"'»«()\[\]–—\-]/g,'').replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'');
  try{t=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
  return t;
}
function tokenList(t){
  t=String(t||'').replace(/\r\n?/g,'\n').replace(/\n/g,' ').replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'');
  return t?t.split(' '):[];
}
function expandWords(words){
  var out=[];
  for(var i=0;i<(words||[]).length;i++){
    var w=words[i];
    if(!w||typeof w.start!=='number')continue;
    var raw=String(w.text!=null?w.text:(w.word!=null?w.word:'')).replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'');
    if(!raw)continue;
    var p=raw.split(/\s+/),end=typeof w.end==='number'&&w.end>=w.start?w.end:w.start+0.08,step=Math.max(0.001,(end-w.start)/p.length);
    for(var j=0;j<p.length;j++)out.push({text:p[j],word:p[j],start:w.start+j*step,end:j===p.length-1?end:w.start+(j+1)*step});
  }
  return out;
}
function canRun(){
  try{
    if(window._fsLastResp&&window._fsLastResp.words&&window._fsLastResp.words.length)return true;
    var caps=window.premiereSrtData||[];
    for(var i=0;i<caps.length;i++)if(caps[i]&&caps[i].words&&caps[i].words.length)return true;
  }catch(e){}
  return false;
}
function isKaraoke(tpl){
  if(!tpl)return false;
  if(tpl.isWordHighlight===true||tpl.wordHighlight===true)return true;
  var s=typeof tpl==='string'?tpl:[tpl.name,tpl.folderPath,tpl.templateFolder,tpl.mogrtFile,tpl.aepFile].join(' ');
  s=String(s||'').toLowerCase();
  return s.indexOf('captionia_word_highlight')>=0||s.indexOf('word highlight')>=0||s.indexOf('word_highlight')>=0||s.indexOf('word-highlight')>=0||s.indexOf('karaoke')>=0;
}
function realWordsFor(block){
  if(block&&block.words&&block.words.length)return expandWords(block.words);
  var raw=null;
  try{raw=window._fsLastResp&&window._fsLastResp.words;}catch(e){}
  if(!raw||!raw.length)return[];
  var all=expandWords(raw),out=[],s=Number(block.startTime)||0,e=Number(block.endTime)||s;
  for(var i=0;i<all.length;i++)if(all[i].end>s-0.04&&all[i].start<e+0.04)out.push(all[i]);
  return out;
}
function alignWords(text,block){
  var want=tokenList(text),cand=realWordsFor(block);
  if(!want.length||!cand.length)return[];
  var a=[],b=[],i,j,k;
  for(i=0;i<want.length;i++)a.push(norm(want[i]));
  for(i=0;i<cand.length;i++)b.push(norm(cand[i].text));
  if(cand.length===want.length)return cand;
  for(i=0;i<=cand.length-want.length;i++){
    var ok=true;
    for(j=0;j<want.length;j++)if(a[j]!==b[i+j]){ok=false;break;}
    if(ok)return cand.slice(i,i+want.length);
  }
  return[];
}
function timingString(cap,words){
  var arr=[],dur=Math.max(0.05,(Number(cap.endTime)||0)-(Number(cap.startTime)||0));
  for(var i=0;i<words.length;i++){
    var s=Math.max(0,words[i].start-cap.startTime),e=Math.max(s+0.01,words[i].end-cap.startTime);
    if(e>dur)e=dur;
    if(e<=s)e=Math.min(dur,s+0.01);
    arr.push(s.toFixed(3)+','+e.toFixed(3));
  }
  return arr.join(';');
}
function twoLines(text){
  text=String(text||'').replace(/\r\n?/g,'\n').replace(/^\s+|\s+$/g,'');
  if(text.indexOf('\n')>=0)return text.replace(/\n+/g,'\r');
  var w=tokenList(text);
  if(w.length<=6&&text.length<=32)return text;
  var total=text.length,acc=0,best=1,diff=999999;
  for(var i=1;i<w.length;i++){
    acc+=w[i-1].length+(i>1?1:0);
    var d=Math.abs(acc-total/2);
    if(d<diff){diff=d;best=i;}
  }
  return w.slice(0,best).join(' ')+'\r'+w.slice(best).join(' ');
}
function prepare(src,maxWords){maxWords=parseInt(maxWords,10)||16;if(maxWords<1)maxWords=16;if(maxWords>64)maxWords=64;
  src=src||[];
  var out=[],errors=[];
  for(var i=0;i<src.length;i++){
    var c=src[i];
    if(!c||typeof c.startTime!=='number'||typeof c.endTime!=='number'||!(c.endTime>c.startTime))continue;
    var text=clean(c.text),tokens=tokenList(text),words=alignWords(text,c);
    if(!words.length){errors.push('Legenda '+(i+1)+': sem timing real por palavra ou texto não alinhado.');continue;}
    if(tokens.length!==words.length){errors.push('Legenda '+(i+1)+': '+tokens.length+' palavra(s) no texto e '+words.length+' timing(s).');continue;}
    if(words.length>maxWords){errors.push('Legenda '+(i+1)+': '+words.length+' palavras. Este Karaoke aceita até '+maxWords+' por bloco.');continue;}
    out.push({text:text,startTime:c.startTime,endTime:c.endTime,captionText:twoLines(text),wordTimings:timingString(c,words),words:words});
  }
  return{blocks:out,errors:errors,total:src.length};
}
function basePath(){
  return typeof secureExtensionPath!=='undefined'&&secureExtensionPath?secureExtensionPath:(typeof extensionPath!=='undefined'?extensionPath:'');
}
function resolvePath(opt){
  opt=opt||{};
  if(opt.absolutePath)return String(opt.absolutePath).replace(/\\/g,'/');
  try{
    if(opt.templateFolder&&opt.mogrtFile&&typeof require!=='undefined'){
      var path=require('path'),root=opt.isUser?path.join(csInterface.getSystemPath(SystemPath.MY_DOCUMENTS),'editBest'):path.join(basePath(),'templates');
      return path.join(root,opt.templateFolder,opt.mogrtFile).replace(/\\/g,'/');
    }
  }catch(e){}
  return (basePath()+'/presets/CAPTIONIA_WORD_HIGHLIGHT.mogrt').replace(/\\/g,'/');
}
function prefs(){
  var p={stylesEnabled:false,highlightColor:'',supportColor:'',karaokeActiveTextColor:''};
  try{
    if(typeof window.fsGetUserPreferences==='function')p=window.fsGetUserPreferences()||p;
    else{
      p.stylesEnabled=localStorage.getItem('framespeed_styles_enabled')==='true';
      p.highlightColor=localStorage.getItem('framespeed_highlight_color')||'';
      p.supportColor=localStorage.getItem('framespeed_support_color')||'';
      p.karaokeActiveTextColor=localStorage.getItem('framespeed_karaoke_active_text_color')||'#000000';
    }
  }catch(e){}
  return p;
}
function patchScript(track,blocks,style){
  var data=[];
  for(var i=0;i<blocks.length;i++)data.push({s:blocks[i].startTime,caption:blocks[i].captionText,timings:blocks[i].wordTimings});
  var P={track:track,data:data,style:style||{}};
  return "(function(){try{var P="+JSON.stringify(P)+",seq=app.project.activeSequence;if(!seq)return JSON.stringify({ok:false,error:'Sem sequencia ativa'});var ti=P.track;if(ti<0||ti>=seq.videoTracks.numTracks)return JSON.stringify({ok:false,error:'Trilha de video invalida'});var tr=seq.videoTracks[ti];function sec(t){try{return Number(t.seconds);}catch(e){return Number(t)||0;}}function prop(c,n){if(!c||!c.properties)return null;try{if(c.properties.getParamForDisplayName){var p=c.properties.getParamForDisplayName(n);if(p)return p;}}catch(e){}try{for(var i=0;i<c.properties.numItems;i++){var q=c.properties[i];if(q&&String(q.displayName)===n)return q;}}catch(e2){}return null;}function text(p,v){if(!p)return false;try{var x=p.getValue();if(typeof x==='string'){try{var o=JSON.parse(x);if(o&&typeof o==='object'){o.textEditValue=String(v);p.setValue(JSON.stringify(o),1);return true;}}catch(j){}}}catch(g){}try{p.setValue(String(v),1);return true;}catch(h){}return false;}function rgb(h){h=String(h||'').replace('#','');if(!/^[0-9a-fA-F]{6}$/.test(h))return null;return[parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}function color(p,h){if(!h)return 0;if(!p)return 0;var c=rgb(h);if(!c)return 0;try{if(p.setColorValue){p.setColorValue(255,c[0],c[1],c[2],1);return 1;}}catch(e){}try{p.setValue([1,c[0]/255,c[1]/255,c[2]/255],1);return 1;}catch(e2){}return 0;}var patched=0,missing=0,colors=0;for(var d=0;d<P.data.length;d++){var best=null,bm=null,bd=999;for(var j=0;j<tr.clips.numItems;j++){var clip=tr.clips[j],delta=Math.abs(sec(clip.start)-P.data[d].s);if(delta>0.22||delta>=bd)continue;try{var m=clip.getMGTComponent();if(m&&prop(m,'CAPTION_TEXT')&&prop(m,'WORD_TIMINGS')){best=clip;bm=m;bd=delta;}}catch(ig){}}if(!best||!bm){missing++;continue;}var a=text(prop(bm,'CAPTION_TEXT'),P.data[d].caption),b=text(prop(bm,'WORD_TIMINGS'),P.data[d].timings);if(P.style.background)colors+=color(prop(bm,'Background Color'),P.style.background);if(P.style.inactive)colors+=color(prop(bm,'Inactive Text Color'),P.style.inactive);if(P.style.active)colors+=color(prop(bm,'Active Text Color'),P.style.active);if(a&&b)patched++;else missing++;}return JSON.stringify({ok:true,patched:patched,missing:missing,colors:colors});}catch(e){return JSON.stringify({ok:false,error:String(e)});}})()";
}
function patch(track,blocks,style,tryN,done){
  csInterface.evalScript(patchScript(track,blocks,style),function(raw){
    var r=null;try{r=JSON.parse(raw);}catch(e){}
    if(r&&r.ok&&r.missing===0){done(r);return;}
    if(tryN<2){setTimeout(function(){patch(track,blocks,style,tryN+1,done);},180);return;}
    done(r||{ok:false,error:'Resposta inesperada: '+String(raw).substring(0,140)});
  });
}
function record(track,blocks){
  try{
    // The same WORD_TIMINGS values written into the MOGRT are used for SFX.
    // This in-memory map is scoped to the current transcript, not a stale cached project.
    var sequence=String(window._fsLastResp&&window._fsLastResp._fsSeq||'');
    if(sequence){
      var events=[];
      blocks.forEach(function(block){
        var absolute=Number(block.startTime);
        if(!isFinite(absolute)||!block.wordTimings)return;
        var entries=String(block.wordTimings).split(';'),onsets=[];
        entries.forEach(function(entry){
          var match=/^([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?)$/.exec(entry.trim());
          if(match)onsets.push(absolute+Number(match[1]));
        });
        events.push({start:absolute,end:Number(block.endTime),onsets:onsets});
      });
      window.CaptionIAVisualOnsets={
        sequenceID:sequence,
        getForBlock:function(start,end,count){
          var current=String(window._fsLastResp&&window._fsLastResp._fsSeq||'');
          if(current!==sequence)return null;
          for(var i=0;i<events.length;i++){
            var item=events[i];
            if(Math.abs(item.start-start)<.06&&Math.abs(item.end-end)<.09&&item.onsets.length===count)
              return item.onsets.slice();
          }
          return null;
        }
      };
    }

    var old=null;try{old=JSON.parse(localStorage.getItem('framespeed_blocos_inseridos')||'null');}catch(e){}
    var times=old&&old.tipo==='word-highlight'&&old.trilha===track&&old.tempos?old.tempos.slice():[];
    for(var i=0;i<blocks.length;i++)if(times.indexOf(blocks[i].startTime)<0)times.push(blocks[i].startTime);
    localStorage.setItem('framespeed_blocos_inseridos',JSON.stringify({trilha:track,tempos:times,quando:Date.now(),tipo:'word-highlight'}));
    var b=el('btn-captions-tirar');if(b)b.style.display='';
  }catch(e){}
}
function applyBlocks(src,opt,done){
  opt=opt||{};done=typeof done==='function'?done:function(){};
  if(BUSY){done({ok:false,error:'Karaoke já está sendo aplicado.'});return;}
  if(typeof csInterface==='undefined'){done({ok:false,error:'csInterface indisponível.'});return;}
  var path=resolvePath(opt),prep=prepare(src,opt.maxWords||16);
  if(!prep.blocks.length){done({ok:false,error:prep.total?'Karaoke precisa de timestamps reais por palavra. Transcreva pelo Caption IA.':'Nenhuma legenda carregada.',details:prep.errors});return;}
  if(prep.errors.length){done({ok:false,error:'Não apliquei para evitar dessincronização. '+prep.errors.slice(0,3).join(' '),details:prep.errors});return;}
  var sel=el('captions-track'),track=typeof opt.trackIndex==='number'?opt.trackIndex:(sel?parseInt(sel.value,10):-1);
  if(isNaN(track))track=-1;
  var host=[],i;
  for(i=0;i<prep.blocks.length;i++)host.push({text:prep.blocks[i].text,startTime:prep.blocks[i].startTime,endTime:prep.blocks[i].endTime});
  var json=JSON.stringify(host),p=prefs(),style={};
  if(p&&p.stylesEnabled){style.background=p.highlightColor||'';style.inactive=p.supportColor||'';style.active=p.karaokeActiveTextColor||'#000000';}
  if(opt.colors){if(opt.colors.background!==undefined)style.background=opt.colors.background;if(opt.colors.inactive!==undefined)style.inactive=opt.colors.inactive;if(opt.colors.active!==undefined)style.active=opt.colors.active;}
  BUSY=true;
  if(!opt.silent)status('Karaoke: inserindo 0/'+host.length+'...','work');
  function finish(res){
    BUSY=false;
    if(res&&res.ok&&!res.missing&&opt.record!==false&&typeof res.trackIndex==='number')record(res.trackIndex,prep.blocks);
    if(!opt.silent){
      if(res&&res.ok)status('✓ '+res.patched+' Karaoke(s) sincronizados'+(res.colors?' · '+res.colors+' cor(es) aplicadas':'')+'.','ok');
      else status((res&&res.error)||'Erro ao inserir Karaoke.','err');
    }
    done(res);
  }
  function step(idx,ti){
    var call='insertCaptionBlocks('+JSON.stringify(path)+', '+JSON.stringify(json)+', '+ti+', '+idx+', 4, null, null, null)';
    csInterface.evalScript(call,function(raw){
      var r=null;try{r=JSON.parse(raw);}catch(e){}
      if(!r||r.error){var code=r&&r.error?r.error:'erro desconhecido';finish({ok:false,error:'Erro ao inserir Karaoke: '+code,code:code});return;}
      if(r.done){
        var tr=typeof r.trackIndex==='number'?r.trackIndex:ti;
        if(!opt.silent)status('Karaoke: sincronizando palavras...','work');
        patch(tr,prep.blocks,style,0,function(pr){
          if(!pr||!pr.ok){finish({ok:false,error:'MOGRT entrou, mas CAPTION_TEXT/WORD_TIMINGS não foram configurados: '+(pr&&pr.error?pr.error:'erro desconhecido')});return;}
          finish({ok:true,patched:pr.patched,missing:pr.missing||0,colors:pr.colors||0,trackIndex:tr,blocks:prep.blocks.length});
        });
        return;
      }
      if(!opt.silent)status('Karaoke: inserindo '+Math.min(r.nextIdx||0,host.length)+'/'+host.length+'...','work');
      setTimeout(function(){step(r.nextIdx,typeof r.trackIndex==='number'?r.trackIndex:ti);},10);
    });
  }
  step(0,track);
}
function apply(opt){
  var src=window.premiereSrtData&&window.premiereSrtData.length?window.premiereSrtData:[];
  applyBlocks(src,opt||{},function(){});
}
function recolorScript(opt){
  return "(function(){try{var O="+JSON.stringify(opt||{})+",seq=app.project.activeSequence;if(!seq)return JSON.stringify({ok:false,error:'Sem sequencia ativa'});function prop(c,n){if(!c||!c.properties)return null;try{if(c.properties.getParamForDisplayName){var p=c.properties.getParamForDisplayName(n);if(p)return p;}}catch(e){}try{for(var i=0;i<c.properties.numItems;i++){var q=c.properties[i];if(q&&String(q.displayName)===n)return q;}}catch(e2){}return null;}function rgb(h){h=String(h||'').replace('#','');if(!/^[0-9a-fA-F]{6}$/.test(h))return null;return[parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}function setc(p,h){if(!h||!p)return 0;var c=rgb(h);if(!c)return 0;try{if(p.setColorValue){p.setColorValue(255,c[0],c[1],c[2],1);return 1;}}catch(e){}try{p.setValue([1,c[0]/255,c[1]/255,c[2]/255],1);return 1;}catch(e2){}return 0;}var clips=0,colors=0;for(var t=0;t<seq.videoTracks.numTracks;t++){var tr=seq.videoTracks[t];for(var j=0;j<tr.clips.numItems;j++){var clip=tr.clips[j];if(O.scope!=='todas'){var selected=false;try{selected=!!clip.isSelected();}catch(es){}if(!selected)continue;}var m=null;try{m=clip.getMGTComponent();}catch(em){}if(!m||!prop(m,'CAPTION_TEXT')||!prop(m,'WORD_TIMINGS'))continue;var n=0;n+=setc(prop(m,'Background Color'),O.background);n+=setc(prop(m,'Inactive Text Color'),O.inactive);n+=setc(prop(m,'Active Text Color'),O.active);if(n){clips++;colors+=n;}}}return JSON.stringify({ok:true,clips:clips,colors:colors});}catch(e){return JSON.stringify({ok:false,error:String(e)});}})()";
}
function recolor(opt,done){
  done=typeof done==='function'?done:function(){};
  if(typeof csInterface==='undefined'){done({ok:false,error:'csInterface indisponível.'});return;}
  csInterface.evalScript(recolorScript(opt||{}),function(raw){var r=null;try{r=JSON.parse(raw);}catch(e){}done(r||{ok:false,error:'Resposta inesperada: '+String(raw).substring(0,140)});});
}
function bind(){var b=el('btn-captions-word-highlight');if(b)b.addEventListener('click',function(){apply({});});}

window.fsIsWordHighlightTemplate=isKaraoke;
window.fsWordHighlightCanRun=canRun;
window.fsWordHighlightPrepare=prepare;
window.fsWordHighlightApply=apply;
window.fsWordHighlightApplyBlocks=applyBlocks;
window.fsWordHighlightRecolor=recolor;

if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bind);else bind();
}());