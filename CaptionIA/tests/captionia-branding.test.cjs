'use strict';
// In-memory migration tests; never starts CEP, reads user Storage, or touches media.
const assert = require('node:assert/strict');
const api = require('../js/captionia-branding.js');
function storage(initial) {
  const values = new Map(Object.entries(initial || {}));
  const reads = [];
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { reads.push(key); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    reads
  };
}
{
  const store = storage({ framespeed_highlight_color: '#ABCDEF', framespeed_support_color: '#000000', captionia_support_color: '#FFFFFF', fs_two_lines: 'true' });
  const result = api.migratePreferences(store);
  assert.equal(result.copied, 2);
  assert.equal(result.retained, 1);
  assert.equal(store.getItem('captionia_highlight_color'), '#ABCDEF');
  assert.equal(store.getItem('captionia_support_color'), '#FFFFFF');
  assert.equal(store.getItem('captionia_two_lines'), 'true');
  assert.equal(store.getItem('framespeed_highlight_color'), '#ABCDEF');
  store.removeItem('captionia_highlight_color');
  api.migratePreferences(store);
  assert.equal(api.getPreference(store, 'framespeed_highlight_color'), null);
  assert.equal(store.getItem('captionia_highlight_color'), null);
}
{
  const store = storage({ framespeed_auth: 'test-placeholder', framespeed_groq_key: 'test-placeholder', framespeed_license_device_uuid: 'test-placeholder', framespeed_transcribe_lang: 'pt' });
  api.migratePreferences(store);
  assert.equal(store.reads.includes('framespeed_auth'), false);
  assert.equal(store.reads.includes('framespeed_groq_key'), false);
  assert.equal(store.reads.includes('framespeed_license_device_uuid'), false);
  assert.equal(store.getItem('captionia_transcribe_lang'), 'pt');
  assert.equal(store.getItem('captionia_groq_key'), null);
  assert.throws(() => api.setPreference(store, 'framespeed_auth', 'test-placeholder'));
}
{
  const store = storage({ framespeed_clientes: JSON.stringify([{ nome: 'Teste', dados: { framespeed_highlight_color: '#111111', captionia_highlight_color: '#222222', framespeed_font_support: 'Arial' } }]) });
  api.migratePreferences(store);
  assert.deepEqual(JSON.parse(store.getItem('captionia_clientes')), [{ nome: 'Teste', dados: { captionia_highlight_color: '#222222', captionia_font_support: 'Arial' } }]);
  const oldPackage = { formato: 'framespeed-estilo-cliente', clientes: [{ nome: 'Teste', dados: { framespeed_support_color: '#333333' } }] };
  const converted = api.normalizeClientPackage(oldPackage);
  assert.equal(converted.formato, 'captionia-estilo-cliente');
  assert.equal(converted.clientes[0].dados.captionia_support_color, '#333333');
  assert.equal(oldPackage.clientes[0].dados.framespeed_support_color, '#333333');
}
{
  const store = storage({ framespeed_sfx_volume: '-12' });
  assert.equal(api.getPreference(store, 'captionia_sfx_volume'), '-12');
  api.setPreference(store, 'framespeed_sfx_volume', '-10');
  assert.equal(store.getItem('captionia_sfx_volume'), '-10');
  assert.equal(store.getItem('framespeed_sfx_volume'), '-12');
  api.removePreference(store, 'captionia_sfx_volume');
  assert.equal(api.getPreference(store, 'captionia_sfx_volume'), null);
  api.migratePreferences(store);
  assert.equal(store.getItem('captionia_sfx_volume'), null);
}
{
  const store = storage({ framespeed_sfx_volume: '-12' });
  const originalWrite = store.setItem;
  store.setItem = function (key, value) {
    if (key === 'captionia_sfx_volume') throw new Error('quota');
    originalWrite.call(store, key, value);
  };
  assert.equal(api.migratePreferences(store).failed, 1);
  assert.equal(store.getItem('framespeed_sfx_volume'), '-12');
  assert.equal(api.getPreference(store, 'captionia_sfx_volume'), '-12');
}
assert.equal(api.displayLabel('FS Bright Click'), 'Caption IA Bright Click');
assert.equal(api.displayLabel('Frame Speed'), 'Caption IA');
assert.equal(api.canonicalKey('fsAnimTexto'), null);
assert.equal(api.cleanVisibleText('Biblioteca FrameSpeed / editBest'), 'Biblioteca Caption IA / Caption IA');
assert.equal(api.cleanVisibleText('C:\\Documents\\editBest\\FS Click.wav'), 'C:\\Documents\\editBest\\FS Click.wav');
{
  const text = (value) => ({ nodeType: 3, nodeValue: value });
  const label = text('FS Bright Click');
  const code = text('fsAnimTexto() / Frame Speed');
  const input = { nodeType: 1, tagName: 'INPUT', value: 'Frame Speed', childNodes: [] };
  const path = text('C:\\Documents\\editBest\\FS Click.wav');
  const root = { nodeType: 1, tagName: 'DIV', title: 'Frame Speed', childNodes: [label, { nodeType: 1, tagName: 'CODE', childNodes: [code] }, input, path] };
  assert.equal(api.sanitizeVisible(root), 1);
  assert.equal(label.nodeValue, 'Caption IA Bright Click');
  assert.equal(code.nodeValue, 'fsAnimTexto() / Frame Speed');
  assert.equal(input.value, 'Frame Speed');
  assert.equal(root.title, 'Frame Speed');
  assert.equal(path.nodeValue, 'C:\\Documents\\editBest\\FS Click.wav');
}
{
  const vm = require('node:vm');
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../js/captionia-branding.js'), 'utf8');
  let storageReads = 0;
  const browser = {};
  Object.defineProperty(browser, 'localStorage', { get() { storageReads++; throw Error('Storage must remain untouched at load'); } });
  vm.runInNewContext(source, { window: browser });
  assert.equal(storageReads, 0);
  assert.equal(typeof browser.CaptionIABranding.cleanVisibleText, 'function');
}
console.log('Caption IA branding: optional migration and display-only contracts passed.');
