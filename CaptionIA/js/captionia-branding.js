/* Caption IA display helpers and OPTIONAL future preference migration.
 * Loading this file never reads or writes Storage, media, or host state.
 * Existing host names, preference keys, and media paths remain contracts.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.CaptionIABranding = api;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var LEGACY = 'framespeed_', CURRENT = 'captionia_';
  var STATE_KEY = 'captionia_preferences_migration_v1';
  var SHORT_ALIASES = {
    fs_clean_lower: 'captionia_clean_lower',
    fs_clean_punct: 'captionia_clean_punct',
    fs_clean_upper: 'captionia_clean_upper',
    fs_res_mode: 'captionia_res_mode',
    fs_srt_legacy: 'captionia_srt_legacy',
    fs_two_lines: 'captionia_two_lines',
    fs_update_visto: 'captionia_update_visto',
    fs_mega_brain: 'captionia_mega_brain'
  };
  var has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  // Licensing and credentials belong to their existing dedicated secure stores.
  // The generic preference migration does not even read their values.
  function protectedKey(key) {
    return /(?:^|_)(?:auth|license|licenca|token|secret|password|credential|credentials|api_key|groq_key)(?:_|$)/i.test(String(key));
  }
  function canonicalKey(key) {
    key = String(key);
    if (protectedKey(key)) return null;
    if (has(SHORT_ALIASES, key)) return SHORT_ALIASES[key];
    if (key.indexOf(LEGACY) === 0 && key.length > LEGACY.length)
      return CURRENT + key.slice(LEGACY.length);
    if (key.indexOf(CURRENT) === 0 && key.length > CURRENT.length) return key;
    return null;
  }
  function legacyKey(key) {
    var canonical = canonicalKey(key);
    if (!canonical) return null;
    for (var alias in SHORT_ALIASES)
      if (has(SHORT_ALIASES, alias) && SHORT_ALIASES[alias] === canonical) return alias;
    return LEGACY + canonical.slice(CURRENT.length);
  }
  function readState(storage) {
    try {
      var parsed = JSON.parse(storage.getItem(STATE_KEY) || '{}');
      return parsed && parsed.version === 1 && parsed.seen && typeof parsed.seen === 'object'
        ? parsed : { version: 1, seen: {} };
    } catch (ignored) { return { version: 1, seen: {} }; }
  }
  function writeState(storage, state) {
    storage.setItem(STATE_KEY, JSON.stringify(state));
  }
  function unsafeProperty(key) {
    return key === '__proto__' || key === 'prototype' || key === 'constructor';
  }
  function normalizeClientData(data) {
    var output = {}, key, canonical;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return output;
    // Canonical entries take precedence if an exported profile contains both.
    for (key in data) {
      if (!has(data, key) || unsafeProperty(key)) continue;
      canonical = canonicalKey(key);
      if (canonical === key) output[key] = data[key];
    }
    for (key in data) {
      if (!has(data, key) || unsafeProperty(key)) continue;
      canonical = canonicalKey(key);
      if (canonical && !has(output, canonical)) output[canonical] = data[key];
    }
    return output;
  }
  function normalizeClientPackage(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.clientes)) return null;
    if (value.formato !== 'captionia-estilo-cliente' && value.formato !== 'framespeed-estilo-cliente') return null;
    return {
      formato: 'captionia-estilo-cliente',
      versao: 2,
      plugin: typeof value.plugin === 'string' ? value.plugin : '',
      exportadoEm: typeof value.exportadoEm === 'string' ? value.exportadoEm : '',
      clientes: value.clientes.filter(function (entry) {
        return entry && typeof entry.nome === 'string' && entry.nome.trim() &&
          entry.dados && typeof entry.dados === 'object' && !Array.isArray(entry.dados);
      }).map(function (entry) {
        return { nome: entry.nome, dados: normalizeClientData(entry.dados) };
      })
    };
  }
  function normalizedValue(key, value) {
    if (key !== 'captionia_clientes') return value;
    try {
      var clients = JSON.parse(value);
      if (!Array.isArray(clients)) return value;
      return JSON.stringify(clients.map(function (entry) {
        if (!entry || typeof entry !== 'object') return entry;
        return { nome: entry.nome, dados: normalizeClientData(entry.dados) };
      }));
    } catch (ignored) { return value; }
  }
  function migratePreferences(storage) {
    var result = { copied: 0, retained: 0, skipped: 0, failed: 0 };
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return result;
    var state = readState(storage), keys = [], index, key, canonical, dirty = false;
    // Snapshot before writing: key enumeration remains stable for native Storage.
    for (index = 0; index < storage.length; index++) keys.push(storage.key(index));
    for (index = 0; index < keys.length; index++) {
      key = keys[index];
      if (typeof key !== 'string' || (key.indexOf(LEGACY) !== 0 && !has(SHORT_ALIASES, key))) continue;
      canonical = canonicalKey(key);
      if (!canonical || unsafeProperty(key) || has(state.seen, key)) { result.skipped++; continue; }
      try {
        if (storage.getItem(canonical) !== null) result.retained++;
        else {
          var value = storage.getItem(key);
          if (value === null) continue;
          storage.setItem(canonical, normalizedValue(canonical, value));
          result.copied++;
        }
        state.seen[key] = true;
        dirty = true;
      } catch (ignored) { result.failed++; }
    }
    if (dirty) {
      try { writeState(storage, state); } catch (ignored) { result.failed++; }
    }
    return result;
  }
  function getPreference(storage, key) {
    var canonical = canonicalKey(key);
    if (!canonical) return null;
    var value = storage.getItem(canonical), legacy = legacyKey(canonical);
    if (value !== null) return value;
    // A migrated preference deliberately removed later must stay removed.
    if (has(readState(storage).seen, legacy)) return null;
    value = storage.getItem(legacy);
    return value === null ? null : normalizedValue(canonical, value);
  }
  function setPreference(storage, key, value) {
    var canonical = canonicalKey(key);
    if (!canonical) throw new Error('Esta chave exige o armazenamento dedicado do Caption IA.');
    storage.setItem(canonical, normalizedValue(canonical, String(value)));
  }
  function removePreference(storage, key) {
    var canonical = canonicalKey(key);
    if (!canonical) throw new Error('Esta chave exige o armazenamento dedicado do Caption IA.');
    storage.removeItem(canonical);
    var state = readState(storage);
    state.seen[legacyKey(canonical)] = true;
    writeState(storage, state);
  }
  function hasPath(value) {
    return /(?:[A-Za-z]:[\\/]|\\\\|file:\/\/|https?:\/\/|\b(?:Documents|Documentos)[\\/]|(?:^|\s)~\/)/i.test(value);
  }
  function cleanVisibleText(value) {
    // Text labels only. Never use this result as a host command or identifier.
    var text = String(value == null ? '' : value);
    if (hasPath(text)) return text;
    return text.replace(/\bframe[\s_-]*speed\b/gi, 'Caption IA')
      .replace(/\beditbest\b/gi, 'Caption IA')
      .replace(/\bFS(?=\s+\S)/g, 'Caption IA');
  }
  function sanitizeVisible(rootNode) {
    // Deliberately no observer, attributes, values, HTML writes, or file access.
    // Ignore user-editable fields and code/diagnostic blocks, including paths.
    var changed = 0;
    function visit(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        var before = String(node.nodeValue || ''), after = cleanVisibleText(before);
        if (before !== after) { node.nodeValue = after; changed++; }
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
      if (/^(INPUT|TEXTAREA|SCRIPT|STYLE|PRE|CODE)$/i.test(node.tagName || '') || node.isContentEditable) return;
      var children = node.childNodes || [];
      for (var index = 0; index < children.length; index++) visit(children[index]);
    }
    visit(rootNode);
    return changed;
  }
  return Object.freeze({
    canonicalKey: canonicalKey,
    legacyKey: legacyKey,
    isProtectedKey: protectedKey,
    migratePreferences: migratePreferences,
    getPreference: getPreference,
    setPreference: setPreference,
    removePreference: removePreference,
    normalizeClientData: normalizeClientData,
    normalizeClientPackage: normalizeClientPackage,
    displayLabel: cleanVisibleText,
    cleanVisibleText: cleanVisibleText,
    sanitizeVisible: sanitizeVisible
  });
});
