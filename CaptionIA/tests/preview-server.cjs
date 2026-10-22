/* Isolated browser fixture. Never connects to Premiere or the Caption IA API. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.CAPTIONIA_PREVIEW_PORT || 8766);
const events = [];
const mock = `
window.__captioniaFixture=true;
window.SystemPath={EXTENSION:'extension',MY_DOCUMENTS:'documents'};
window.CSInterface=function(){this.hostEnvironment={appName:'PPRO',appVersion:'26.0',appUILocale:'pt_BR',appSkinInfo:{panelBackgroundColor:{color:{red:20,green:23,blue:30}}}};};
CSInterface.THEME_COLOR_CHANGED_EVENT='theme';
CSInterface.prototype.getSystemPath=function(p){return p==='extension'?'/fixture':'/documents';};
CSInterface.prototype.getHostEnvironment=function(){return this.hostEnvironment;};
CSInterface.prototype.addEventListener=function(){};
CSInterface.prototype.openURLInDefaultBrowser=function(){};
CSInterface.prototype.getOSInformation=function(){return 'Windows';};
window.__fixtureSequence='fixture-sequence';
CSInterface.prototype.evalScript=function(script,done){
 var value={ok:true,items:[],tracks:[],video:[],audio:[],clips:[],caps:[],regioes:[],seq:window.__fixtureSequence,sequenceID:window.__fixtureSequence,fps:30,tpfSeg:1/30,clipes:0};
 if(/getActiveSequenceUniqueId/.test(script))value=window.__fixtureSequence;
 else if(/getTemplateStructure/.test(script))value=[{name:'Modelos de legenda',subcategories:[{name:'Duas linhas',templates:[{name:'Editorial',folderPath:'example',mogrtFile:'example.mogrt',lineCount:2,previewFile:'',thumbFile:'',isUser:false},{name:'Destaque',folderPath:'example2',mogrtFile:'example2.mogrt',lineCount:2,previewFile:'',thumbFile:'',isUser:false}]}]}];
 else if(/getFont|FontList/.test(script))value=[];
 else if(/\\$\\.evalFile/.test(script))value='OK';
 else if(/captioniaSplitInspect/.test(script))value={ok:true,sequenceID:window.__fixtureSequence,signature:'fixture-split',width:1920,height:1080,pixelAspect:1,frameDuration:1/30,clips:[{name:'Camera A',track:0,index:0,nodeId:'a',start:0,end:10,width:1920,height:1080,pixelAspect:1},{name:'Camera B',track:1,index:0,nodeId:'b',start:0,end:10,width:1920,height:1080,pixelAspect:1}]};
 setTimeout(function(){if(done)done(typeof value==='string'?value:JSON.stringify(value));},0);
};
window.CaptionIALicense={isAuthorized:function(){return true;},getAccessToken:function(){return '';},getState:function(){return{authorized:true};},apiRequest:function(){return Promise.reject(Error('Serviço externo desativado na prévia de interface.'));}};
window.CaptionIAGroqAccess={isReady:function(){return true;},observe:function(){},quota:function(){return{};}};
window.alert=function(text){fetch('/__fixture__/events',{method:'POST',body:JSON.stringify({type:'alert',message:String(text)})});};
window.addEventListener('error',function(event){fetch('/__fixture__/events',{method:'POST',body:JSON.stringify({type:'error',message:event.message||'resource error',filename:event.filename||''})});});
window.addEventListener('unhandledrejection',function(event){fetch('/__fixture__/events',{method:'POST',body:JSON.stringify({type:'rejection',message:String(event.reason&&event.reason.message||event.reason)})});});
`;
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/__fixture__/events') {
        if (req.method === 'POST') { let data = ''; req.on('data', chunk => { if(data.length<10000)data+=chunk; }); req.on('end', () => { try { events.push(JSON.parse(data)); } catch (_) {} res.end('ok'); }); }
        else { res.setHeader('Content-Type','application/json');res.end(JSON.stringify(events)); }
        return;
    }
    if (pathname === '/__fixture__/mock.js') { res.setHeader('Content-Type', types['.js']); res.end(mock); return; }
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname)); } catch (_) { res.writeHead(400); res.end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
        let content = fs.readFileSync(file);
        if (path.basename(file) === 'index.html') {
            content = content.toString('utf8').replace('<script src="js/CSInterface.js"></script>', '<script src="/__fixture__/mock.js"></script>');
            content = content.replace(/<script src="js\/(auth|groq_access|license_storage|secure_storage|updater)\.js"><\/script>/g, '<!-- Service excluded in isolated fixture -->');
        }
        res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream'); res.end(content);
    } catch (_) { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log('Caption IA UI fixture: http://127.0.0.1:' + port));
