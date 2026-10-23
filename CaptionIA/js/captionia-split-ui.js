(function (w, d) {
    'use strict';
    var prepared = null, waiting = false;
    function el(id) { return d.getElementById(id); }
    function message(text, error) { var status = el('td-v2-status'); if (status) { status.textContent = text; status.style.color = error ? 'var(--danger)' : 'var(--text-2)'; } }
    function busy(value) {
        waiting = value;
        ['btn-td-v2-preview', 'td-v2-preset', 'td-v2-fit'].forEach(function (id) { if (el(id)) el(id).disabled = value; });
        if (el('btn-td-v2-apply')) el('btn-td-v2-apply').disabled = value || !prepared;
        if (el('btn-td-v2-restore')) el('btn-td-v2-restore').disabled = value;
    }
    function invalidate() {
        prepared = null;
        if (el('btn-td-v2-apply')) el('btn-td-v2-apply').disabled = true;
        if (el('td-v2-preview')) el('td-v2-preview').textContent = 'Clique em Analisar seleção para preparar este layout.';
    }
    function draw(plan) {
        var container = el('td-v2-preview'); container.textContent = '';
        var ns = 'http://www.w3.org/2000/svg', svg = d.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + plan.width + ' ' + plan.height);
        svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Prévia esquemática do layout');
        svg.style.cssText = 'width:100%;max-height:190px;display:block;border-radius:8px;background:#0e1117';
        var colors = ['#a6c5f8', '#c5f277', '#c8b4ed', '#f1c28f'];
        plan.items.forEach(function (item, index) {
            var rect = d.createElementNS(ns, 'rect'), slot = item.slot;
            rect.setAttribute('x', slot.x + 4); rect.setAttribute('y', slot.y + 4);
            rect.setAttribute('width', Math.max(1, slot.width - 8)); rect.setAttribute('height', Math.max(1, slot.height - 8));
            rect.setAttribute('fill', colors[index % colors.length]); rect.setAttribute('opacity', '.8');
            svg.appendChild(rect);
            var text = d.createElementNS(ns, 'text');
            text.setAttribute('x', slot.x + slot.width / 2); text.setAttribute('y', slot.y + slot.height / 2);
            text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', '#172018'); text.setAttribute('font-size', Math.max(20, Math.min(slot.width, slot.height) * .11));
            text.textContent = 'V' + (Number(item.track) + 1); svg.appendChild(text);
        });
        container.appendChild(svg);
        var list = d.createElement('p'); list.style.cssText = 'font-size:11px;line-height:1.7;margin:10px 0 0;color:var(--text-2)';
        list.textContent = plan.items.map(function (item) { return 'V' + (Number(item.track) + 1) + ' · ' + item.name; }).join('  /  ');
        container.appendChild(list);
    }
    function init() {
        var preview = el('btn-td-v2-preview'), apply = el('btn-td-v2-apply'); if (!preview || !apply) return;
        ['td-v2-preset', 'td-v2-fit'].forEach(function (id) { el(id).addEventListener('change', invalidate); });
        preview.addEventListener('click', function () {
            if (waiting) return;
            invalidate(); busy(true); message('Verificando 2 ou 4 vídeos em faixas diferentes. A prévia abaixo é esquemática; o resultado real aparece no Premiere…');
            w.CaptionIASplit.preview({ preset: el('td-v2-preset').value, fit: el('td-v2-fit').value }).then(function (plan) {
                prepared = plan; draw(plan); message(plan.notice);
            }).catch(function (error) { message(error.message || String(error), true); }).then(function () { busy(false); });
        });
        apply.addEventListener('click', function () {
            if (waiting || !prepared) return;
            busy(true); message('Criando uma cópia da sequência e aplicando o enquadramento…');
            w.CaptionIASplit.apply(prepared).then(function () {
                prepared = null; el('btn-td-v2-restore').hidden = false;
                message('Cópia criada. Confira o enquadramento no Monitor do Programa; a sequência original permanece intacta.');
            }).catch(function (error) { prepared = null; message(error.message || String(error), true); }).then(function () { busy(false); });
        });
        el('btn-td-v2-restore').addEventListener('click', function () {
            if (waiting) return;
            busy(true);
            w.CaptionIASplit.restore().then(function () { message('Sequência original reaberta. A cópia editada continua no projeto.'); }).catch(function (error) { message(error.message || String(error), true); }).then(function () { busy(false); });
        });
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
