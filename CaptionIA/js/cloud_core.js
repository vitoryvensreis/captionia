/* Caption IA Cloud Core bridge: native editor operations remain local.
 * No API keys, model prompts, algorithms or private assets are shipped here.
 */
(function(w){
  'use strict';
  function request(path, data){
    if(!w.CaptionIALicense || !w.CaptionIALicense.isAuthorized()){
      return Promise.reject(new Error('Licença ativa necessária para usar o motor na nuvem.'));
    }
    return w.CaptionIALicense.apiRequest('POST',path,data);
  }
  w.CaptionIACloudCore = Object.freeze({
    planCaptions: function(text, options){
      options=options||{};
      return request('/core/captions/plan', {
        text: String(text||''),
        aspect_ratio: options.aspectRatio||'9:16',
        max_words: options.maxWords||5,
        max_chars: options.maxChars||26,
        font_size: options.fontSize||72,
        client_version: (w.CaptionIALicense.getState()||{}).version||'3.4.0'
      });
    }
  });
})(window);
