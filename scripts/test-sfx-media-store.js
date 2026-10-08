'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const store=require('../CaptionIA/js/sfx_media_store.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'captionia-media-test-'));
try{
 const app=path.join(root,'plugin-v343');
 const audioDir=path.join(app,'templates','SFX LETTERING');
 const stable=path.join(root,'profile','CaptionIA','Media','SFX');
 fs.mkdirSync(audioDir,{recursive:true});
 const snap=path.join(audioDir,'FS Crisp Snap.wav');
 const content=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(120,0x35)]);
 fs.writeFileSync(snap,content);
 const opts={extensionRoot:app,storeRoot:stable};
 const oldVersion=path.join(root,'DELETED-OLD-PLUGIN','templates','SFX LETTERING','FS Crisp Snap.wav');
 const m=store.prepareMix([{path:oldVersion,name:'FS Crisp Snap'}],opts);
 assert.equal(m.errors.length,0);
 assert.equal(m.items.length,1);
 assert(fs.existsSync(m.items[0].path));
 assert(m.items[0].path.startsWith(stable));
 assert.deepEqual(fs.readFileSync(m.items[0].path),content);
 assert.equal(m.items[0].missing,false);
 assert(fs.existsSync(snap),'não deve remover arquivo original');

 // Reinstalling or replacing the plugin must not invalidate persistent media.
 fs.rmSync(app,{recursive:true});
 const migrated=store.stageSource(m.items[0].path,opts);
 assert.equal(migrated,m.items[0].path);
 assert(fs.existsSync(migrated));
 const absent=store.prepareMix([{path:path.join(root,'missing','user_custom.wav'),name:'custom'}],opts);
 assert.equal(absent.items.length,0);
 assert.equal(absent.errors.length,1);
 assert.match(absent.errors[0],/Localize|SFX não encontrado/);

 const empty=path.join(root,'empty.wav');
 fs.writeFileSync(empty,Buffer.alloc(10));
 assert.throws(()=>store.stageSource(empty,opts),/vazio/);
 const invalid=path.join(root,'hack.exe');
 fs.writeFileSync(invalid,Buffer.alloc(100));
 assert.throws(()=>store.stageSource(invalid,opts),/suportado/);

 console.log('SFX media store PASS: old paths migrated, version-independent cache, offline media rejected');
}finally{
 fs.rmSync(root,{recursive:true,force:true});
}
