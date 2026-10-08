'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = path.join(root, 'CaptionIA');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log('OK:', msg);
}
function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function walk(dir, out) {
  out = out || [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const required = [
  'CaptionIA/index.html',
  'CaptionIA/CSXS/manifest.xml',
  'CaptionIA/js/main.js',
  'CaptionIA/js/wordhighlight.js',
  'CaptionIA/js/template_contract.js',
  'CaptionIA/js/secure_storage.js',
  'CaptionIA/js/license_storage.js',
  'CaptionIA/js/auth.js',
  'CaptionIA/js/updater.js',
  'CaptionIA/css/theme_site.css',
  'CaptionIA/jsx/hostscript.jsxbin',
  'INSTALAR_CAPTION_IA.bat',
  'INSTALAR_CAPTION_IA.ps1',
  'INSTALAR_CAPTION_IA_MAC.command',
  'installer/CaptionIA.iss'
];
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) fail('arquivo obrigatório ausente: ' + rel);
}
if (process.exitCode) process.exit(process.exitCode);

const main = read(path.join(app, 'js', 'main.js'));
const manifest = read(path.join(app, 'CSXS', 'manifest.xml'));
const html = read(path.join(app, 'index.html'));

const vm = main.match(/CURRENT_VERSION='([^']+)'/);
const vb = manifest.match(/ExtensionBundleVersion="([^"]+)"/);
const ve = manifest.match(/<Extension Id="com\.editbest\.panel" Version="([^"]+)"/);
if (!vm) fail('CURRENT_VERSION não encontrado em main.js');
if (!vb) fail('ExtensionBundleVersion não encontrado no manifest.xml');
if (!ve) fail('versão da extensão não encontrada no manifest.xml');
if (vm && vb && vm[1] !== vb[1]) fail('versão diverge: main.js=' + vm[1] + ' manifest=' + vb[1]);
if (vm && ve && vm[1] !== ve[1]) fail('versão diverge: main.js=' + vm[1] + ' extension=' + ve[1]);
if (vm && vb && ve && vm[1] === vb[1] && vm[1] === ve[1]) ok('versão consistente: ' + vm[1]);

const scriptRefs = [];
html.replace(/<script\s+src="([^"]+)"/g, (_, src) => { scriptRefs.push(src); return _; });
for (const src of scriptRefs) {
  if (/^(https?:|\/\/)/i.test(src)) continue;
  const p = path.join(app, src.split('?')[0]);
  if (!fs.existsSync(p)) fail('script referenciado no HTML não existe: ' + src);
}
ok(scriptRefs.length + ' scripts do index.html conferidos');

const jsDir = path.join(app, 'js');
const jsFiles = walk(jsDir).filter(p => /\.js$/i.test(p));
let parsed = 0;
for (const p of jsFiles) {
  if (path.basename(p).toLowerCase() === 'csinterface.js') continue;
  try {
    new Function(read(p));
    parsed++;
  } catch (e) {
    fail('sintaxe inválida em ' + path.relative(root, p) + ': ' + e.message);
  }
}
ok(parsed + ' JavaScripts validados sintaticamente');

const templateJsons = walk(path.join(app, 'templates')).filter(p => path.basename(p).toLowerCase() === 'template.json');
let contracts = 0;
for (const p of templateJsons) {
  let m;
  try { m = JSON.parse(read(p)); }
  catch (e) { fail('template.json inválido: ' + path.relative(root, p) + ': ' + e.message); continue; }
  contracts++;
  if (!m.schema) fail('template.json sem schema: ' + path.relative(root, p));
  if (m.engine === 'word-highlight' || m.type === 'karaoke') {
    if (!m.maxWords || m.maxWords < 1) fail('Karaoke sem maxWords: ' + path.relative(root, p));
    if (!m.parameters || !m.parameters.text || !m.parameters.wordTimings) fail('Karaoke sem parâmetros CAPTION_TEXT/WORD_TIMINGS: ' + path.relative(root, p));
    const dir = path.dirname(p);
    if (!fs.readdirSync(dir).some(n => /\.mogrt$/i.test(n))) fail('Karaoke sem .mogrt na mesma pasta: ' + path.relative(root, p));
  }
}
ok(contracts + ' contrato(s) template.json validados');

const textFiles = walk(root).filter(p => /\.(js|html|xml|md|txt|bat|command|json)$/i.test(p) && !p.includes(path.join('.git', path.sep)));
for (const p of textFiles) {
  let s = '';
  try { s = read(p); } catch (_) { continue; }
  if (/C:\\Users\\[A-Za-z0-9._-]+\\/i.test(s)) fail('caminho absoluto de usuário Windows em ' + path.relative(root, p));
  if (/\/Users\/[A-Za-z0-9._-]+\//.test(s)) fail('caminho absoluto de usuário macOS em ' + path.relative(root, p));
}
ok('sem caminhos absolutos de desenvolvedor');

const all = walk(app);
const templates = all.filter(p => /\.(mogrt|fsm|aegraphic|fsa|aep)$/i.test(p)).length;
const audio = all.filter(p => /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(p)).length;
console.log('INFO: templates=' + templates + ' audio=' + audio + ' arquivos=' + all.length);

if (fs.existsSync(path.join(root, 'scripts', 'test-cloud-panel.js'))) {
  try {
    const cp = require('child_process');
    const output = cp.execFileSync(process.execPath, [path.join(root, 'scripts', 'test-cloud-panel.js')], {
      cwd: root, encoding: 'utf8', timeout: 8000
    });
    ok('Cloud captions UI smoke: ' + output.trim());
  } catch (e) {
    fail('Cloud captions UI smoke falhou: ' + String((e.stdout || '') + (e.stderr || '') + e.message).slice(0, 1200));
  }
}

if (fs.existsSync(path.join(root, 'scripts', 'test-autosfx-scheduler.js'))) {
  try {
    const cp = require('child_process');
    const output = cp.execFileSync(process.execPath, [path.join(root, 'scripts', 'test-autosfx-scheduler.js')], {
      cwd: root, encoding: 'utf8', timeout: 8000
    });
    ok('AutoSFX safe scheduling: ' + output.trim());
  } catch (e) {
    fail('Regressão AutoSFX: ' + String((e.stdout || '') + (e.stderr || '') + e.message).slice(0, 1200));
  }
}

if (fs.existsSync(path.join(root, 'scripts', 'test-autosfx-dual-tracks.js'))) {
  try {
    const cp = require('child_process');
    const output = cp.execFileSync(process.execPath, [path.join(root, 'scripts', 'test-autosfx-dual-tracks.js')], {
      cwd: root, encoding: 'utf8', timeout: 8000
    });
    ok('AutoSFX two-layer words: ' + output.trim());
  } catch (e) {
    fail('Teste AutoSFX duas camadas falhou: ' + String((e.stdout || '') + (e.stderr || '') + e.message).slice(0, 1200));
  }
}

if (fs.existsSync(path.join(root,'scripts','test-sfx-diagnostics.js'))) {
  try {
    const cp=require('child_process');
    const output=cp.execFileSync(process.execPath,[path.join(root,'scripts','test-sfx-diagnostics.js')],{
      cwd:root,encoding:'utf8',timeout:8000
    });
    ok('AutoSFX read-only track diagnostic: '+output.trim());
  }catch(e){
    fail('Teste de diagnóstico AutoSFX falhou: '+String((e.stdout||'')+(e.stderr||'')+e.message).slice(0,1500));
  }
}

if (fs.existsSync(path.join(root, 'scripts', 'test-autosfx-timing.js'))) {
  try {
    const cp = require('child_process');
    const output = cp.execFileSync(process.execPath, [path.join(root, 'scripts', 'test-autosfx-timing.js')], {
      cwd: root, encoding: 'utf8', timeout: 8000
    });
    ok('AutoSFX timing calibration: ' + output.trim());
  } catch (e) {
    fail('AutoSFX timing regression: ' + String((e.stdout || '') + (e.stderr || '') + e.message).slice(0, 1300));
  }
}

if (fs.existsSync(path.join(root,'scripts','test-groq-byok.js'))) {
  try {
    const cp=require('child_process');
    const output=cp.execFileSync(process.execPath,[path.join(root,'scripts','test-groq-byok.js')],{
      cwd:root,encoding:'utf8',timeout:8000
    });
    ok('Groq personal key smoke: '+output.trim());
  } catch(e) {
    fail('Regressão Groq: '+String((e.stdout||'')+(e.stderr||'')+e.message).slice(0,1500));
  }
}

if (fs.existsSync(path.join(root, 'scripts', 'test-cloud-release.js'))) {
  try {
    const cp=require('child_process');
    const out=cp.execFileSync(process.execPath,[path.join(root,'scripts','test-cloud-release.js')],{
      cwd:root,encoding:'utf8',timeout:8000
    });
    ok('Cloud release security smoke: '+out.trim());
  }catch(e){
    fail('Release cloud incompleto: '+String((e.stdout||'')+(e.stderr||'')+e.message).slice(0,1500));
  }
}

if (fs.existsSync(path.join(root,'scripts','test-sfx-media-store.js'))) {
  try {
    const cp=require('child_process');
    const message=cp.execFileSync(process.execPath,[path.join(root,'scripts','test-sfx-media-store.js')],{
      cwd:root,encoding:'utf8',timeout:12000
    });
    ok('SFX persistent media validation: '+message.trim());
  }catch(e){
    fail('Persistência de SFX falhou: '+String((e.stdout||'')+(e.stderr||'')+e.message).slice(0,1600));
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log('VALIDAÇÃO CONCLUÍDA');
