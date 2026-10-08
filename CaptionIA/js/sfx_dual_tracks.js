/* Caption IA — two-layer SFX delivery for each recognized spoken word.
 * Uses the existing compiled Adobe host function on two DISTINCT empty audio
 * tracks, so short SFX tails don't collide on every adjacent word.
 * Cria trilhas com QE somente quando necessário; valida o resultado antes de editar.
 */
(function(root){
'use strict';
function decode(x){
  try { return JSON.parse(String(x||'')); } catch(e) { return {error:'Resposta inesperada do Premiere: '+String(x||'').slice(0,140)}; }
}
function probeScript(){
  return '(function(){try{var s=app.project.activeSequence;if(!s)return JSON.stringify({error:"Abra uma sequência."});' +
    'var all=[],free=[];for(var i=0;i<s.audioTracks.numTracks;i++){' +
      'var tr=s.audioTracks[i],locked=false;' +
      'try{locked=!!tr.isLocked();}catch(e){}' +
      'var count=tr.clips.numItems;' +
      'all.push({index:i,count:count,locked:locked});' +
      'if(count===0&&!locked)free.push(i);' +
    '}return JSON.stringify({ok:true,free:free,all:all});' +
  '}catch(e){return JSON.stringify({error:String(e)});}})()';
}
function addTracksScript() {
  // QE is not part of Adobe's public API. Invoke only when missing tracks and
  // inspect the actual public sequence immediately afterwards.
  return '(function(){try{' +
    'var before=app.project.activeSequence;if(!before)return JSON.stringify({error:"Sem sequência ativa."});' +
    'var old=before.audioTracks.numTracks,sequenceID=String(before.sequenceID||"");' +
    'app.enableQE();var q=qe.project.getActiveSequence();' +
    'if(!q||typeof q.addTracks!=="function")return JSON.stringify({error:"Este Premiere não oferece criação automática de trilhas."});' +
    'q.addTracks(0,0,2,old);' +
    'var now=app.project.activeSequence;' +
    'if(String(now.sequenceID||"")!==sequenceID)return JSON.stringify({error:"Sequência mudou durante a criação das trilhas."});' +
    'return JSON.stringify({ok:true,old:old,newCount:now.audioTracks.numTracks});' +
  '}catch(e){return JSON.stringify({error:"Não foi possível criar trilhas de áudio: "+String(e)});}})()';
}
function countsScript(a,b){
  return '(function(){try{var s=app.project.activeSequence,offline=0,unknown=0,paths=[];' +
    'var pair=['+a+','+b+'];for(var k=0;k<pair.length;k++){' +
      'var tr=s.audioTracks[pair[k]];for(var i=0;i<tr.clips.numItems;i++){' +
        'var clip=tr.clips[i],item=clip?clip.projectItem:null;' +
        'if(!item){unknown++;continue;}' +
        'try{if(typeof item.isOffline==="function"&&item.isOffline()){offline++;continue;}}catch(ex){}' +
        'try{if(typeof item.getMediaPath==="function"){' +
           'var p=item.getMediaPath();if(p&&typeof File!=="undefined"&&!File(p).exists){offline++;paths.push(String(p));}' +
        '}}catch(ex2){unknown++;}' +
      '}}' +
    'return JSON.stringify({ok:true,a:s.audioTracks['+a+'].clips.numItems,b:s.audioTracks['+b+'].clips.numItems,offline:offline,unknown:unknown,paths:paths.slice(0,3)});' +
  '}catch(e){return JSON.stringify({error:String(e)});}})()';
}
function chooseTwo(free,preferred){
  if(!Array.isArray(free))throw Error('Resposta inválida ao consultar trilhas de áudio.');
  var indices=free.filter(function(n){return Number.isInteger(n)&&n>=0&&n<256;}).sort(function(a,b){return a-b;});
  if(Number.isInteger(preferred)&&preferred>=0){
    if(indices.indexOf(preferred)<0)throw Error('A'+(preferred+1)+' não está vazia/desbloqueada. Escolha duas trilhas vazias para o SFX.');
    var others=indices.filter(function(n){return n!==preferred;});
    if(!others.length)throw Error('Adicione mais uma trilha de áudio vazia para alternar os SFX.');
    return [preferred,others[others.length-1]];
  }
  if(indices.length<2){
    throw Error('Preciso de duas trilhas de áudio vazias e desbloqueadas. No Premiere: Sequência > Adicionar trilhas > 2 trilhas de áudio. Não apague as trilhas com voz, música ou SFX antigos.');
  }
  return indices.slice(-2);
}
function split(times){
  if(!Array.isArray(times)||!times.length)throw Error('Não há palavras temporizadas para gerar SFX.');
  var indexed=times.map(function(time,i){
    if(typeof time!=='number'||!isFinite(time)||time<0||time>21600)throw Error('Timecode de palavra inválido.');
    return {time:time,at:i};
  });
  indexed.sort(function(a,b){return a.time-b.time||a.at-b.at;});
  var layers=[[],[]];
  indexed.forEach(function(it,i){layers[i%2].push(it.time);});
  return layers;
}
function run(options,finish){
  var finished=false;
  function done(v){if(finished)return;finished=true;finish(v);}
  try{
    options=options||{};
    var cs=options.csInterface;
    if(!cs||typeof cs.evalScript!=='function')throw Error('Ponte Adobe indisponível.');
    var layers=split(options.times);
    var paths=options.paths||[];
    if(!Array.isArray(paths)||!paths.length)throw Error('Selecione ao menos um arquivo SFX.');
    var volumes=options.volumes||[];
    var offset=Number.isInteger(options.frameOffset)?options.frameOffset:0;
    var preferred=Number.isInteger(options.preferredTrack)?options.preferredTrack:-1;
    cs.evalScript(probeScript(),function(raw){
      var discovered=decode(raw);
      if(discovered.error){done({error:discovered.error});return;}
      function proceed(snapshot){
      var targets;
      try{targets=chooseTwo(snapshot.free,preferred);}catch(e){done({error:e.message});return;}
      var responses=[],firstLayerCount=layers[0].length;
      function dispatch(layer){
        if(layer>=2){validateFinal();return;}
        if(!layers[layer].length){responses.push({count:0,cortados:0,pulados:0});dispatch(layer+1);return;}
        var command='distributeSfxAtTimes('+
          JSON.stringify(String(paths[0]))+','+
          JSON.stringify(JSON.stringify(layers[layer]))+','+
          offset+','+targets[layer]+','+
          JSON.stringify(JSON.stringify(paths))+','+
          JSON.stringify(JSON.stringify(volumes))+','+
          JSON.stringify('[]')+')';
        cs.evalScript(command,function(result){
          var data=decode(result);
          if(data.error){done({error:'Camada '+(layer+1)+' falhou: '+data.error+
            (layer>0?' A primeira camada foi inserida; revise a timeline antes de repetir.':'')});return;}
          if(data.trilhaMudou){
            done({error:'Premiere redirecionou o áudio para outra trilha. Interrompi para evitar sobrescritas. Confira o projeto.'});
            return;
          }
          responses.push(data);
          if(layer===0){
            // Make sure the compiled host REALLY honored the selected target.
            cs.evalScript(countsScript(targets[0],targets[1]),function(x){
              var count=decode(x);
              if(count.offline){
                done({error:'O Premiere inseriu '+count.offline+' SFX com mídia offline. Verifique a origem do áudio (\u0022Link Media\u0022) antes de repetir.'});return;
              }
              if(count.error||!count.a||count.b){
                done({error:'Não consegui confirmar separação das duas camadas. Primeira chamada já pode ter inserido áudio; não execute novamente sem conferir a timeline.'});
                return;
              }
              dispatch(1);
            });
          } else dispatch(2);
        });
      }
      function validateFinal(){
        cs.evalScript(countsScript(targets[0],targets[1]),function(x){
          var check=decode(x);
          if(check.offline){
            done({error:'Detectei '+check.offline+' SFX sem arquivo conectado no Premiere. A distribuição foi interrompida: religue ou remova somente esses SFX antes de tentar novamente.'});return;
          }
          if(check.error||!check.a||(layers[1].length&&!check.b)){
            done({error:'Não consegui validar a segunda trilha. Confira A'+(targets[0]+1)+' e A'+(targets[1]+1)+' antes de repetir.'});
            return;
          }
          var first=responses[0]||{},second=responses[1]||{};
          done({
            count:Number(first.count||0)+Number(second.count||0),
            cortados:Number(first.cortados||0)+Number(second.cortados||0),
            pulados:Number(first.pulados||0)+Number(second.pulados||0),
            volumeFalha:Number(first.volumeFalha||0)+Number(second.volumeFalha||0),
            track:'A'+(targets[0]+1)+' + A'+(targets[1]+1),
            sounds:paths.length,
            duasCamadas:true,
            previstos:layers[0].length+layers[1].length,
            mediaOffline:0,
            mediaUnchecked:check.unknown||0,
            detalhes:'Disparos alternados: '+layers[0].length+' em A'+(targets[0]+1)+
              ' e '+layers[1].length+' em A'+(targets[1]+1)+'. Sem limites por legenda.'
          });
        });
      }
      dispatch(0);
      }
      // Build missing layers before the first SFX is inserted.
      var need=discovered.free.length<2;
      if(preferred>=0 && discovered.free.indexOf(preferred)<0){
        done({error:'A trilha escolhida está ocupada ou bloqueada. Selecione uma trilha livre ou use Automático.'});return;
      }
      if(!need){proceed(discovered);return;}
      cs.evalScript(addTracksScript(),function(createdRaw){
        var created=decode(createdRaw);
        if(created.error){done({error:created.error});return;}
        cs.evalScript(probeScript(),function(recheckRaw){
          var recheck=decode(recheckRaw);
          if(recheck.error||recheck.free.length<2){
            done({error:'A criação automática de trilhas não foi confirmada. Nenhum SFX novo foi inserido. '+(recheck.error||'Adicione duas trilhas vazias manualmente.')});return;
          }
          proceed(recheck);
        });
      });
    });
  }catch(e){done({error:e.message||String(e)});}
}
var api=Object.freeze({run:run,split:split,chooseTwo:chooseTwo,probeScript:probeScript,addTracksScript:addTracksScript});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.CaptionIASfxDualTracks=api;
})(typeof window!=='undefined'?window:null);
