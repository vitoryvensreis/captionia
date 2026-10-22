'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

test('all shipped scripts and inline scripts parse without executing the extension', () => {
    for (const file of fs.readdirSync(path.join(root, 'js')).filter(n => n.endsWith('.js'))) {
        new vm.Script(fs.readFileSync(path.join(root, 'js', file), 'utf8'), { filename: file });
    }
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc=/.test(match[1])) new vm.Script(match[2], { filename: 'index-inline' });
    }
});

test('HTML references exist, IDs are unique and the speech planner loads before cuts', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="((?:js|css)\/[^"?]+)(?:\?[^"]*)?"/gi)) {
        assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'duplicate IDs break existing event handlers');
    assert.ok(html.indexOf('js/speech-cuts.js') < html.indexOf('js/autocut.js'));
    assert.ok(html.includes('js/captionia-workspace.js'));
    assert.ok(html.includes('js/captionia-split-ui.js'));
});

test('compiled Premiere executor remains byte-for-byte unchanged', () => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'jsx/hostscript.jsxbin'))).digest('hex');
    assert.equal(hash, 'b7d39c14c221297549bc794e89aef20efe98ab6ff809b1837f55bdbfd33cf09f');
});

test('development configuration stops automatic replacement without disabling licensing', () => {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/captionia-config.js'), 'utf8'), context);
    assert.equal(context.window.CaptionIADevelopment.autoUpdates, false);
    assert.equal(context.window.CaptionIALicense, undefined);
    const updater = fs.readFileSync(path.join(root, 'js/updater.js'), 'utf8');
    assert.match(updater, /function checkNow\(\)\{\s+if\(w\.CaptionIADevelopment&&w\.CaptionIADevelopment\.autoUpdates===false\)return Promise\.resolve\(false\);/);
});
