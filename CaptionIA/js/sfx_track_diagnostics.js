/* Caption IA — read-only AudioTrack preflight for AutoEdit.
 * Does not insert/delete clips or create tracks. Makes SFX routing observable.
 */
(function(window,document){'use strict';
function node(tag,text){var x=document.createElement(tag);if(text)x.textContent=text;return x;}
function init(){
 var parent=document.getElementById('autoedit-panel');
 if(!parent||!window.CaptionIASfxDualTracks)return;
 var header=node('section');
 header.style.cssText='border:1px solid rgba(255,255,255,.18);background:#151a20;border-radius:8px;padding:12px;margin:8px 0;color:#dbe4ed;font:12px/1.5 Arial,sans-serif';
 var title=node('strong','AutoSFX — verificar duas trilhas');
 var description=node('p','Verificação somente leitura. Não altera seus áudios. A4/A5 só podem ser usadas se estiverem vazias.');
 description.style.cssText='margin:4px 0 9px;color:#aab4c0';
 var button=node('button','Verificar trilhas antes de gerar SFX');
 button.type='button';button.className='btn-secondary';button.style.cssText='padding:7px 10px;border-radius:5px;cursor:pointer';
 var result=node('pre');result.style.cssText='white-space:pre-wrap;color:#cbd5e1;margin:9px 0 0;max-height:200px;overflow:auto';
 header.appendChild(title);header.appendChild(description);header.appendChild(button);header.appendChild(result);
 var controls=parent.querySelector('.ae-rodape')||parent;
 if(controls.parentNode)controls.parentNode.insertBefore(header,controls);
 else parent.appendChild(header);
 button.addEventListener('click',function(){
  if(!window.csInterface||typeof window.csInterface.evalScript!=='function'){result.textContent='Ponte Premiere não disponível.';return;}
  button.disabled=true;result.textContent='Lendo as trilhas da sequência...';
  window.csInterface.evalScript(window.CaptionIASfxDualTracks.probeScript(),function(raw){
   button.disabled=false;
   try{
    var data=JSON.parse(String(raw));
    if(data.error)throw Error(data.error);
    if(!Array.isArray(data.all))throw Error('Resposta do Premiere sem dados de trilhas.');
    var rows=['AudioTrack da sequência ativa:'];
    data.all.forEach(function(track){
     var name='A'+(Number(track.index)+1);
     rows.push(name+': '+(track.locked?'TRAVADA':Number(track.count)>0?'OCUPADA ('+track.count+' clipes)':'LIVRE'));
    });
    rows.push('');
    try {
      var pair=window.CaptionIASfxDualTracks.chooseTwo(data.free,-1);
      rows.push('PRONTA PARA TESTE: A'+(pair[0]+1)+' + A'+(pair[1]+1));
      rows.push('O SFX por palavra será alternado nessas trilhas.');
    }catch(err){
      rows.push('BLOQUEADO: '+err.message);
      rows.push('Adicione duas trilhas de áudio estéreo vazias. Preserve voz, música e SFX antigos.');
    }
    result.textContent=rows.join('\n');
   }catch(err){result.textContent='Não consegui verificar trilhas: '+err.message;}
  });
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
