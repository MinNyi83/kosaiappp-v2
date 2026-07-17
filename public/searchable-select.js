/**
 * searchable-select.js  v1.0
 * Universal progressive-enhancement library for searchable/filterable dropdowns.
 * Wraps any native <select> in-place — native select stays hidden so form
 * submission and existing JS that reads .value both continue working.
 *
 * Usage:
 *   makeSearchable(document.getElementById('my-select'));
 *   makeSearchable(el, { placeholder: 'Filter…', accentColor: '#f59e0b' });
 *
 * Public API on el._ss:
 *   el._ss.open()       – open dropdown
 *   el._ss.close()      – close dropdown
 *   el._ss.sync()       – re-read native select value into text input
 *   el._ss.rebuild()    – rebuild option list from current native options
 *   el._ss.setValue(v)  – programmatically set value + sync display
 */
(function () {
  'use strict';

  // -- Shared click-outside listener (one for entire page) -----------------
  let _outsideActive = false;
  function _ensureOutside() {
    if (_outsideActive) return;
    _outsideActive = true;
    document.addEventListener(
      'click',
      function (e) {
        document.querySelectorAll('.ss-wrapper').forEach(function (w) {
          const dd = w.querySelector('.ss-dropdown');
          if (dd && !w.contains(e.target)) {
            dd.style.display = 'none';
            w.querySelector('.ss-chevron').style.transform = 'translateY(-50%) rotate(0deg)';
            const inp = w.querySelector('.ss-input');
            if (inp) {
              inp.style.borderColor = '';
              inp.style.boxShadow = '';
            }
          }
        });
      },
      true
    );
  }

  // ------------------------------------------------------------------------
  window.makeSearchable = function (selectEl, opts) {
    if (!selectEl || selectEl._searchableInit) return;

    // Skip tiny static lists (< 5 options) unless forced
    if (selectEl.options.length > 0 && selectEl.options.length < 5 && !(opts && opts.force)) return;

    selectEl._searchableInit = true;

    var cfg = Object.assign(
      {
        placeholder: 'Search or select…',
        accentColor: '#6366f1',
      },
      opts || {}
    );

    var accent = cfg.accentColor;

    // -- Hide native select ----------------------------------------------
    var origClass = selectEl.className || '';
    selectEl.style.display = 'none';

    // -- Wrapper --------------------------------------------------------
    var isFullWidth = origClass.indexOf('w-full') !== -1;
    var wrapper = document.createElement('div');
    wrapper.className = 'ss-wrapper';
    if (!isFullWidth) wrapper.classList.add('ss-inline');
    wrapper.style.cssText = isFullWidth
      ? 'position:relative;display:block;width:100%;'
      : 'position:relative;display:inline-block;min-width:' + (selectEl.offsetWidth || 180) + 'px;';

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);

    // -- Input row ------------------------------------------------------
    var row = document.createElement('div');
    row.style.cssText = 'position:relative;';
    wrapper.appendChild(row);

    var input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = cfg.placeholder;
    input.className = 'ss-input ' + origClass;
    input.style.cssText = 'width:100%;padding-right:1.75rem;box-sizing:border-box;display:block;';
    row.appendChild(input);

    // -- Chevron --------------------------------------------------------
    var chevron = document.createElement('span');
    chevron.className = 'ss-chevron';
    chevron.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:9px;height:9px;display:block;"><path d="M6 9l6 6 6-6"/></svg>';
    chevron.style.cssText =
      'position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);color:#64748b;display:flex;align-items:center;cursor:pointer;transition:transform 0.15s;';
    row.appendChild(chevron);

    // -- Dropdown panel -------------------------------------------------
    var dd = document.createElement('div');
    dd.className = 'ss-dropdown';
    dd.style.cssText = [
      'display:none',
      'position:absolute',
      'left:0',
      'right:0',
      'top:calc(100% + 3px)',
      'z-index:9999',
      'max-height:210px',
      'overflow-y:auto',
      'border-radius:0.75rem',
      'border:1px solid rgba(255,255,255,0.1)',
      'background:#0d0f14',
      'box-shadow:0 16px 40px rgba(0,0,0,0.6)',
      'scrollbar-width:thin',
    ].join(';');
    wrapper.appendChild(dd);

    // -- Option building -------------------------------------------------
    function buildList(q) {
      dd.innerHTML = '';
      q = (q || '').trim().toLowerCase();
      var items = Array.from(selectEl.options);
      var count = 0;

      items.forEach(function (opt) {
        var label = opt.text;
        var val = opt.value;
        if (q && label.toLowerCase().indexOf(q) === -1) return;
        count++;

        var item = document.createElement('div');
        item.className = 'ss-opt';
        item.dataset.value = val;
        item.dataset.label = label;

        var isSel = opt.selected && val;
        item.style.cssText = [
          'padding:0.45rem 0.75rem',
          'font-size:0.72rem',
          'cursor:pointer',
          'transition:background 0.1s,color 0.1s',
          'line-height:1.45',
          'color:' + (isSel ? '#fff' : '#94a3b8'),
          isSel ? 'background:' + accent + '22;' : '',
        ].join(';');

        // Highlight matched portion
        if (q) {
          var idx = label.toLowerCase().indexOf(q);
          item.innerHTML =
            '<span>' +
            escapeHtml(label.slice(0, idx)) +
            '<span style="color:#fff;font-weight:700;">' +
            escapeHtml(label.slice(idx, idx + q.length)) +
            '</span>' +
            escapeHtml(label.slice(idx + q.length)) +
            '</span>';
        } else {
          item.textContent = label;
        }

        item.addEventListener('mouseenter', function () {
          if (!item.classList.contains('ss-focused')) {
            item.style.background = accent + '33';
            item.style.color = '#fff';
          }
        });
        item.addEventListener('mouseleave', function () {
          if (!item.classList.contains('ss-focused')) {
            item.style.background = isSel ? accent + '22' : '';
            item.style.color = isSel ? '#fff' : '#94a3b8';
          }
        });
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          commit(val, label);
        });

        dd.appendChild(item);
      });

      if (count === 0) {
        var empty = document.createElement('div');
        empty.style.cssText =
          'padding:0.5rem 0.75rem;font-size:0.68rem;color:#475569;font-style:italic;';
        empty.textContent = 'No results found';
        dd.appendChild(empty);
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function commit(val, label) {
      selectEl.value = val;
      input.value = label;
      close();
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function syncFromNative() {
      var sel = selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex] : null;
      input.value = sel && sel.value ? sel.text : '';
    }

    function open() {
      buildList(input.value);
      dd.style.display = 'block';
      chevron.style.transform = 'translateY(-50%) rotate(180deg)';
      input.style.borderColor = accent;
      input.style.boxShadow = '0 0 0 2px ' + accent + '33';
    }

    function close() {
      dd.style.display = 'none';
      chevron.style.transform = 'translateY(-50%) rotate(0deg)';
      input.style.borderColor = '';
      input.style.boxShadow = '';
      dd.querySelectorAll('.ss-focused').forEach(function (el) {
        el.classList.remove('ss-focused');
        el.style.background = '';
        el.style.color = '#94a3b8';
      });
    }

    function moveFocus(dir) {
      var items = Array.from(dd.querySelectorAll('.ss-opt'));
      var cur = dd.querySelector('.ss-focused');
      var idx = items.indexOf(cur);
      var next = dir === 'down' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
      if (cur) {
        cur.classList.remove('ss-focused');
        cur.style.background = '';
        cur.style.color = '#94a3b8';
      }
      if (items[next]) {
        items[next].classList.add('ss-focused');
        items[next].style.background = accent + '44';
        items[next].style.color = '#fff';
        items[next].scrollIntoView({ block: 'nearest' });
      }
    }

    // -- Input events ----------------------------------------------------
    input.addEventListener('focus', open);

    input.addEventListener('input', function () {
      if (dd.style.display === 'none') open();
      buildList(input.value);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        close();
        input.blur();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (dd.style.display === 'none') open();
        moveFocus('down');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocus('up');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        var f = dd.querySelector('.ss-focused');
        if (f) commit(f.dataset.value, f.dataset.label);
        return;
      }
      if (e.key === 'Tab') {
        close();
      }
    });

    chevron.addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (dd.style.display === 'none') {
        input.focus();
      } else {
        close();
      }
    });

    // -- MutationObserver: react to dynamic option changes ---------------
    new MutationObserver(function () {
      syncFromNative();
      if (dd.style.display !== 'none') buildList(input.value);
    }).observe(selectEl, { childList: true });

    syncFromNative();
    _ensureOutside();

    // -- Public API ------------------------------------------------------
    selectEl._ss = {
      open: open,
      close: close,
      sync: syncFromNative,
      rebuild: function () {
        buildList(input.value);
      },
      setValue: function (v) {
        selectEl.value = v;
        syncFromNative();
      },
    };
  };

  // -- Convenience batch function -------------------------------------------
  window.makeSearchableAll = function (selectors, root, opts) {
    var r = root || document;
    var sels = Array.isArray(selectors) ? selectors : [selectors];
    sels.forEach(function (sel) {
      r.querySelectorAll(sel).forEach(function (el) {
        window.makeSearchable(el, opts);
      });
    });
  };
})();
