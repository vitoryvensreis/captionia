(function (w, d) {
    'use strict';
    var current = 'home', tourIndex = -1, layer = null, bubble = null, highlight = null;
    var previousFocus = null, previousRoute = 'home', welcomeTimer = null;
    var tutorialKey = 'captionia_onboarding_v1', tourActive = false;
    var routes = {
        all: ['Modelos de legenda', 'Escolha um modelo, defina o modo e aplique às suas legendas.'],
        favorites: ['Sua biblioteca', 'Seus modelos, sons e arquivos favoritos em um só lugar.'],
        autoedit: ['Edição guiada', 'Escolha as etapas. A fala vem primeiro; o acabamento vem depois.'],
        'auto-aplicar': ['Legendas automáticas', 'Gere uma prévia, ajuste os blocos e aplique os modelos.'],
        autocut: ['Cortes e retakes', 'Transcreva, analise as pausas e revise as repetições antes de cortar.'],
        dinamica: ['Imagem e movimento', 'Ajuste enquadramento, tela dividida, movimento e transições.'],
        'copiar-estilo': ['Estilos', 'Copie uma legenda e leve sua identidade visual para as outras.'],
        'sfx-auto': ['Sons', 'Escolha o som e os pontos de entrada antes de distribuir.']
    };
    function byId(id) { return d.getElementById(id); }
    function store(key, value) { try { w.localStorage.setItem(key, value); } catch (_) {} }
    function stored(key) { try { return w.localStorage.getItem(key); } catch (_) { return null; } }
    function escapeText(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function clean(text) { return w.CaptionIABranding && w.CaptionIABranding.cleanVisibleText ? w.CaptionIABranding.cleanVisibleText(text) : text; }
    function updateRoute(name) {
        current = name;
        var home = byId('captionia-home'), body = d.querySelector('.app-body'), footer = d.querySelector('.app-footer');
        var context = byId('captionia-context'), start = byId('captionia-home-tab');
        if (home) home.hidden = name !== 'home';
        if (body) body.hidden = name === 'home';
        if (footer) footer.hidden = name === 'home';
        if (context) context.hidden = name === 'home';
        d.body.classList.toggle('captionia-is-home', name === 'home');
        if (start) { start.classList.toggle('active', name === 'home'); start.setAttribute('aria-current', name === 'home' ? 'page' : 'false'); }
        var tabs = d.querySelectorAll('.sidebar-tab');
        for (var i = 0; i < tabs.length; i++) {
            if (name === 'home') tabs[i].classList.remove('active');
            tabs[i].setAttribute('aria-current', tabs[i].getAttribute('data-filter') === name ? 'page' : 'false');
        }
        var modelFilters=byId('captionia-model-filters');
        if(modelFilters){
            modelFilters.hidden=name!=='all'&&name!=='favorites';
            var filters=modelFilters.querySelectorAll('[data-model-filter]');
            for(var m=0;m<filters.length;m++){
                var selected=filters[m].getAttribute('data-model-filter')===name;
                filters[m].classList.toggle('active',selected);
                filters[m].setAttribute('aria-pressed',selected?'true':'false');
            }
        }
        var text = routes[name];
        if (text) { byId('captionia-view-title').textContent = text[0]; byId('captionia-view-description').textContent = text[1]; }
    }
    function click(selector) { var el = d.querySelector(selector); if (el) el.click(); return !!el; }
    function open(name) {
        if (name === 'home') { updateRoute('home'); return true; }
        if (name === 'split') { open('dinamica'); click('[data-dyn="teladividida"]'); return true; }
        if (name === 'transcribe') { if (current === 'home') open('autocut'); return click('#btn-transcribe'); }
        if (name === 'captions') { open('all'); return click('#btn-captions'); }
        if (!routes[name]) return false;
        updateRoute(name);
        click('.sidebar-tab[data-filter="' + name + '"]');
        return true;
    }
    function svg(type) {
        var paths = {
            edit: '<path d="M13 2 4 13h7l-1 9 10-12h-7z"/>',
            cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4"/>',
            captions: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M6 10h12M6 14h7"/>',
            split: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M12 4v16"/>'
        };
        return '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[type] + '</svg>';
    }
    function homeMarkup() {
        return '<div class="captionia-home-inner">'
            + '<div class="captionia-eyebrow">SEU ESPAÇO DE EDIÇÃO</div><h1>Da fala ao vídeo pronto.</h1>'
            + '<p class="captionia-home-lead">Uma etapa de cada vez. Organize a fala, crie as legendas e dê o seu acabamento.</p>'
            + '<button type="button" class="captionia-primary-card" data-captionia-open="autoedit" id="captionia-start-edit">'
            + '<span class="captionia-card-icon">' + svg('edit') + '</span><span><span class="captionia-eyebrow">FLUXO RECOMENDADO</span>'
            + '<strong>Editar minha sequência</strong><small>Transcrição, cortes, legendas e acabamento. Você escolhe o que entra.</small></span><span class="captionia-card-arrow" aria-hidden="true">→</span></button>'
            + '<div class="captionia-section-label">Ou vá direto ao que precisa</div><div class="captionia-task-grid">'
            + '<button type="button" class="captionia-task-card" data-captionia-open="autocut">' + svg('cut') + '<strong>Cortes e retakes</strong><small>Encontre pausas e revise falas repetidas.</small></button>'
            + '<button type="button" class="captionia-task-card" data-captionia-open="all">' + svg('captions') + '<strong>Legendas e modelos</strong><small>Transforme sua transcrição em legendas com estilo.</small></button>'
            + '<button type="button" class="captionia-task-card" data-captionia-open="split">' + svg('split') + '<strong>Tela dividida</strong><small>Organize duas ou quatro imagens no mesmo quadro.</small></button></div>'
            + '<div class="captionia-section-label">Um fluxo simples</div><div class="captionia-steps" id="captionia-flow-steps">'
            + '<div class="captionia-step"><span class="captionia-step-number">1</span><span><strong>Prepare</strong><small>Abra a sequência e escolha a trilha com a voz.</small></span></div>'
            + '<div class="captionia-step"><span class="captionia-step-number">2</span><span><strong>Organize a fala</strong><small>Transcreva. Revise pausas e retakes.</small></span></div>'
            + '<div class="captionia-step"><span class="captionia-step-number">3</span><span><strong>Crie as legendas</strong><small>Confira o texto e escolha seus modelos.</small></span></div>'
            + '<div class="captionia-step"><span class="captionia-step-number">4</span><span><strong>Finalize</strong><small>Ajuste imagem, movimento e sons.</small></span></div></div>'
            + '<div class="captionia-home-bottom"><p>Comece com uma sequência aberta no Premiere.<br>A montagem prioriza uma fala natural e contínua.</p>'
            + '<button type="button" class="captionia-text-button" data-captionia-tutorial>Conhecer o painel ↗</button></div></div>';
    }
    function mount() {
        d.body.classList.add('captionia-workspace');
        var nav = d.querySelector('.fs-toolbar');
        if (!nav || byId('captionia-home')) return;
        nav.classList.add('captionia-navigation'); nav.setAttribute('aria-label', 'Ferramentas de edição');
        var homeTab = d.createElement('button'); homeTab.id = 'captionia-home-tab'; homeTab.type = 'button';
        homeTab.className = 'captionia-home-tab'; homeTab.textContent = 'Início'; homeTab.addEventListener('click', function () { open('home'); });
        nav.insertBefore(homeTab, nav.firstChild);
        var home = d.createElement('section'); home.id = 'captionia-home'; home.className = 'captionia-home';
        home.setAttribute('aria-label', 'Início'); home.innerHTML = homeMarkup();
        var main = d.querySelector('.app-body'); main.parentNode.insertBefore(home, main);
        var context = d.createElement('div'); context.id = 'captionia-context'; context.className = 'captionia-context';
        context.innerHTML = '<div><h1 id="captionia-view-title"></h1><p id="captionia-view-description"></p></div><button type="button" data-captionia-tutorial>Ajuda guiada</button>';
        main.parentNode.insertBefore(context, main);
        var labels = { all: 'Modelos', autoedit: 'Edição guiada', 'auto-aplicar': 'Legendas', autocut: 'Cortes', dinamica: 'Imagem', 'copiar-estilo': 'Estilos', 'sfx-auto': 'Sons' };
        // Favoritos becomes an in-page filter of Modelos (not a crowded top tab).
        var favoriteTab=nav.querySelector('.sidebar-tab[data-filter="favorites"]');
        var modelTab=nav.querySelector('.sidebar-tab[data-filter="all"]');
        if(favoriteTab&&modelTab){
            var modelFilters=d.createElement('div');modelFilters.id='captionia-model-filters';modelFilters.className='captionia-model-filters';
            modelFilters.innerHTML='<button type="button" data-model-filter="all">Todos os modelos</button><button type="button" data-model-filter="favorites">★ Favoritos</button>';
            context.appendChild(modelFilters);
            modelFilters.addEventListener('click',function(ev){
                var target=ev.target.closest('[data-model-filter]');if(!target)return;
                var mode=target.getAttribute('data-model-filter');
                var tab=mode==='favorites'?favoriteTab:modelTab;
                tab.click();
            });
        }
        var tabs = nav.querySelectorAll('.sidebar-tab');
        for (var i = 0; i < tabs.length; i++) (function (tab) {
            var filter = tab.getAttribute('data-filter'), span = tab.querySelector('span');
            if (span && labels[filter]) span.textContent = labels[filter];
            tab.addEventListener('click', function () { updateRoute(filter); });
        })(tabs[i]);
        var help = d.createElement('button'); help.id = 'captionia-help'; help.type = 'button'; help.className = 'icon-btn';
        help.textContent = '?'; help.title = 'Tutorial guiado'; help.setAttribute('aria-label', 'Abrir tutorial guiado');
        help.setAttribute('data-captionia-tutorial', ''); d.querySelector('.header-actions').appendChild(help);
        var brand = d.querySelector('.header-brand'); if (brand) brand.addEventListener('click', function () { open('home'); });
        var search = byId('global-search');
        if (search) { search.placeholder = 'Buscar modelos…'; search.setAttribute('aria-label', 'Buscar modelos'); search.addEventListener('input', function () { if (current === 'home') open('all'); }); }
        var intro = byId('autocut-intro');
        if (intro) { intro.className = 'captionia-guidance'; intro.innerHTML = '<strong>Primeiro transcreva, depois analise.</strong> Os tempos das palavras ajudam a proteger a fala. Revise os cortes e retakes antes de aplicar.<button type="button" data-captionia-open="transcribe">Transcrever</button>'; }
        var title = d.querySelector('.ae-titulo'), sub = d.querySelector('.ae-sub');
        if (title) title.textContent = 'Seu fluxo de edição';
        if (sub) sub.textContent = 'Priorize a fala natural. Escolha as etapas e revise a montagem antes do acabamento.';
        var run = byId('btn-autoedit-rodar'); if (run) run.textContent = 'Iniciar edição';
        var mode = byId('btn-mode-highlight'); if (mode) mode.textContent = 'Na seleção';
        var trackLabel = d.querySelector('.track-selector-label'); if (trackLabel) trackLabel.textContent = 'Trilha';
        var foot = d.querySelector('.app-footer'); if (foot) foot.setAttribute('aria-label', 'Legendas e destino na timeline');
        updateRoute('home');
        d.addEventListener('click', function (ev) {
            var target = ev.target.closest ? ev.target.closest('[data-captionia-open], [data-captionia-tutorial]') : null;
            if (!target) return;
            if (target.hasAttribute('data-captionia-tutorial')) { ev.preventDefault(); startTour(); }
            else if (target.hasAttribute('data-captionia-open')) { ev.preventDefault(); open(target.getAttribute('data-captionia-open')); }
        });
        sanitizeDisplay();
    }
    var steps = [
        { route: 'home', target: '#captionia-start-edit', title: 'Comece pelo seu objetivo', text: 'A edição guiada reúne as etapas na ordem. Se quiser resolver só uma parte, use os atalhos abaixo.' },
        { route: 'autocut', target: '#btn-transcribe', title: 'Dê contexto à edição', text: 'Abra sua sequência, clique em Transcrever e escolha a trilha com a voz. Os tempos da fala ajudam a proteger as palavras durante os cortes.' },
        { route: 'autocut', target: '#autocut-acoes', title: 'Analise antes de cortar', text: 'Analisar cria a prévia. Confira as pausas e as margens; Cortar silêncios aplica o resultado. Mantenha a cópia de segurança ligada.' },
        { route: 'autocut', target: '#autocut-retake', title: 'Revise as falas repetidas', text: 'Retakes são novas tentativas da mesma fala. Ouça as sugestões e preserve repetições que fazem parte do sentido.' },
        { route: 'all', target: '.app-footer', title: 'Texto primeiro, estilo depois', text: 'Use Legendas para revisar o texto. Escolha um modelo e o modo: Na seleção, Manual ou Automático.' },
        { route: 'split', target: '[data-dyn-sec="teladividida"]', title: 'Cuide do enquadramento', text: 'Na tela dividida, selecione clipes simultâneos em trilhas diferentes. Confira a análise e o arranjo antes de aplicar.' },
        { route: 'autoedit', target: '#autoedit-etapas', title: 'Você escolhe as etapas', text: 'Ative apenas o que precisa. A montagem mantém a fala natural; confira o resultado antes de seguir para movimento e sons.' },
        { route: 'home', target: '#captionia-help', title: 'Pode começar', text: 'Este guia fica sempre no botão ?. Você pode voltar quando quiser. Nenhuma edição foi executada durante o tutorial.' }
    ];
    function ensureTour() {
        if (layer) return;
        layer = d.createElement('div'); layer.className = 'captionia-tour-layer'; layer.hidden = true;
        layer.innerHTML = '<div class="captionia-tour-shade"></div><div class="captionia-tour-highlight"></div><section class="captionia-tour-bubble" role="dialog" aria-modal="true" aria-labelledby="captionia-tour-title" aria-describedby="captionia-tour-text"></section>';
        d.body.appendChild(layer); bubble = layer.querySelector('.captionia-tour-bubble'); highlight = layer.querySelector('.captionia-tour-highlight');
        layer.addEventListener('click', function (ev) {
            var action = ev.target.getAttribute('data-tour');
            if (action === 'skip') endTour(true);
            if (action === 'start') { tourIndex = 0; renderTour(); }
            if (action === 'back') { tourIndex--; renderTour(); }
            if (action === 'next') { if (tourIndex >= steps.length - 1) endTour(true); else { tourIndex++; renderTour(); } }
        });
        d.addEventListener('keydown', function (ev) {
            if (!tourActive) return;
            if (ev.key === 'Escape') { ev.preventDefault(); endTour(true); return; }
            if (ev.key !== 'Tab') return;
            var buttons = bubble.querySelectorAll('button:not([disabled])'); if (!buttons.length) return;
            var first = buttons[0], last = buttons[buttons.length - 1];
            if (ev.shiftKey && (d.activeElement === first || !bubble.contains(d.activeElement))) { ev.preventDefault(); last.focus(); }
            else if (!ev.shiftKey && (d.activeElement === last || !bubble.contains(d.activeElement))) { ev.preventDefault(); first.focus(); }
        }, true);
        w.addEventListener('resize', positionTour);
        d.addEventListener('scroll', positionTour, true);
    }
    function startTour(welcome) {
        ensureTour(); if (tourActive) return;
        previousFocus = d.activeElement; previousRoute = current; tourActive = true; layer.hidden = false;
        tourIndex = welcome ? -1 : 0; renderTour();
    }
    function endTour(remember) {
        if (!tourActive) return;
        tourActive = false; layer.hidden = true;
        if (remember) store(tutorialKey, 'seen');
        open(previousRoute);
        if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus();
    }
    function renderTour() {
        var welcome = tourIndex < 0, step = welcome ? { title: 'Bem-vindo ao Caption IA', text: 'Conheça o fluxo em um guia rápido por balões. Você pode pular agora e reabrir pelo botão ?.' } : steps[tourIndex];
        if (!welcome) open(step.route);
        var progress = '';
        if (!welcome) { progress = '<div class="captionia-tour-progress" aria-hidden="true">'; for (var i = 0; i < steps.length; i++) progress += '<span' + (i <= tourIndex ? ' class="is-done"' : '') + '></span>'; progress += '</div>'; }
        bubble.innerHTML = progress + '<div class="captionia-eyebrow">' + (welcome ? 'UM COMEÇO MAIS SIMPLES' : 'PASSO ' + (tourIndex + 1) + ' DE ' + steps.length) + '</div>'
            + '<h2 id="captionia-tour-title" tabindex="-1">' + escapeText(step.title) + '</h2><p id="captionia-tour-text">' + escapeText(step.text) + '</p>'
            + '<div class="captionia-tour-actions"><button type="button" class="captionia-tour-skip" data-tour="skip">' + (welcome ? 'Pular por enquanto' : 'Ignorar tutorial') + '</button>'
            + (!welcome && tourIndex > 0 ? '<button type="button" class="captionia-tour-back" data-tour="back">Voltar</button>' : '')
            + '<button type="button" class="captionia-tour-next" data-tour="' + (welcome ? 'start' : 'next') + '">' + (welcome ? 'Conhecer o painel' : tourIndex === steps.length - 1 ? 'Concluir' : 'Próximo') + '</button></div>';
        positionTour(); byId('captionia-tour-title').focus();
        w.setTimeout(positionTour, 80);
    }
    function positionTour() {
        if (!tourActive || !bubble) return;
        var step = tourIndex >= 0 ? steps[tourIndex] : null, target = step ? d.querySelector(step.target) : null;
        var rect = target && target.getBoundingClientRect(), width = w.innerWidth, height = w.innerHeight;
        if (target && rect && (rect.top < 0 || rect.bottom > height) && target.scrollIntoView) { target.scrollIntoView({ block: 'nearest' }); rect = target.getBoundingClientRect(); }
        var visible = rect && rect.width > 0 && rect.height > 0;
        highlight.style.display = visible ? 'block' : 'none';
        if (visible) {
            highlight.style.left = Math.max(3, rect.left - 4) + 'px'; highlight.style.top = Math.max(3, rect.top - 4) + 'px';
            highlight.style.width = Math.min(width - Math.max(3, rect.left - 4) - 3, rect.width + 8) + 'px';
            highlight.style.height = Math.min(height - Math.max(3, rect.top - 4) - 3, rect.height + 8) + 'px';
        }
        var b = bubble.getBoundingClientRect(), left = visible ? rect.left : (width - b.width) / 2;
        var top = visible ? rect.bottom + 14 : (height - b.height) / 2;
        if (visible && top + b.height > height - 12) top = rect.top - b.height - 14;
        bubble.style.left = Math.max(12, Math.min(width - b.width - 12, left)) + 'px';
        bubble.style.top = Math.max(12, Math.min(height - b.height - 12, top)) + 'px';
    }
    function tryWelcome() {
        if (tourActive || stored(tutorialKey) || !byId('captionia-home')) return true;
        if (!w.CaptionIALicense || !w.CaptionIALicense.isAuthorized || !w.CaptionIALicense.isAuthorized()) return false;
        if (w.CaptionIAGroqAccess && w.CaptionIAGroqAccess.isReady && !w.CaptionIAGroqAccess.isReady()) return false;
        startTour(true); return true;
    }
    function scheduleWelcome() {
        if (welcomeTimer) return;
        var tries = 0;
        welcomeTimer = w.setInterval(function () { if (tryWelcome() || ++tries >= 120) { w.clearInterval(welcomeTimer); welcomeTimer = null; } }, 1500);
    }
    function sanitizeDisplay() {
        if (!w.CaptionIABranding || !w.CaptionIABranding.sanitizeVisible) return;
        function tooltips(node) {
            if (!node || node.nodeType !== 1) return;
            var targets = [node], descendants = node.querySelectorAll('[title], [aria-label]');
            for (var a = 0; a < descendants.length; a++) targets.push(descendants[a]);
            for (var b = 0; b < targets.length; b++) ['title', 'aria-label'].forEach(function (attribute) {
                var old = targets[b].getAttribute(attribute);
                if (old) { var value = clean(old); if (value !== old) targets[b].setAttribute(attribute, value); }
            });
        }
        w.CaptionIABranding.sanitizeVisible(d.body);
        tooltips(d.body);
        var queued=[],scheduled=false;
        function flush(){
            scheduled=false;
            var nodes=queued;queued=[];
            // One full sweep is cheaper than thousands of isolated passes when changing pages.
            if(nodes.length>100){w.CaptionIABranding.sanitizeVisible(d.body);tooltips(d.body);return;}
            var seen=[];
            for(var i=0;i<nodes.length;i++){
                var node=nodes[i];if(!node||seen.indexOf(node)>=0)continue;
                seen.push(node);
                w.CaptionIABranding.sanitizeVisible(node);
                if(node.nodeType===1)tooltips(node);
            }
        }
        function queue(node){if(!node)return;queued.push(node);if(!scheduled){scheduled=true;if(w.requestAnimationFrame)w.requestAnimationFrame(flush);else w.setTimeout(flush,16);}}
        var observer=new MutationObserver(function(records){
            for(var i=0;i<records.length;i++){
                var record=records[i];
                if(record.type==='characterData')queue(record.target.parentNode);
                if(record.type==='attributes')queue(record.target);
                for(var j=0;j<record.addedNodes.length;j++)queue(record.addedNodes[j]);
            }
        });
        observer.observe(d.body, {childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label']});
    }
    function boot() {
        mount(); scheduleWelcome();
        d.addEventListener('captionia:license-ready', scheduleWelcome);
    }
    w.CaptionIAWorkspace = { open: open, startTutorial: function () { startTour(false); }, endTutorial: function () { endTour(true); }, getRoute: function () { return current; } };
    if (d.readyState === 'complete') boot(); else w.addEventListener('load', boot);
})(window, document);
