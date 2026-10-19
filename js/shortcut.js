/* ================= SHORTCUT KEYBOARD ================= */
const SMALL = window.matchMedia('(max-width: 899px)');
const toolKeys = {
  KeyV: 'select',
  KeyH: 'hand',
  KeyF: 'frame',
  KeyR: 'rectangle',
  KeyO: 'ellipse',
  KeyL: 'line',
  KeyG: 'polygon',
  KeyS: 'star',
  KeyP: 'pen',
  KeyT: 'text',
  KeyI: 'image'
};
const pickTool = window.pickTool = name => $(`#toolbar .tool[data-tool="${name}"]`).trigger('click');
const currentTool = () => $('#toolbar .tool.active').data('tool');
const typing = t => t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable);
const relayout = () => setTimeout(() => $(window).trigger('resize'), 0);

const stepLayer = dir => {
  const $all = $('#layer-list .layer:visible');
  if (!$all.length) return;
  const i = $all.index($all.filter('.selected').first());
  $all.eq(Math.min($all.length - 1, Math.max(0, i < 0 ? (dir > 0 ? 0 : $all.length - 1) : i + dir))).trigger('click')[0]
    .scrollIntoView({
      block: 'nearest'
    });
};
const togglePanel = side => {
  if (SMALL.matches) {
    $('body').toggleClass('show-' + side).removeClass(side === 'left' ? 'show-right' : 'show-left');
  } else {
    $('body').toggleClass('hide-' + side);
    relayout();
  }
};

// Cegah bentrok shortcut browser bawaan & zoom browser bawaan (Ctrl+Plus, Ctrl+Minus, Ctrl+0, Ctrl+Wheel, Ctrl+B, Ctrl+G)
window.addEventListener('keydown', function(e) {
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;

  if (e.code === 'KeyB' || e.code === 'KeyG') {
    e.preventDefault();
  }

  // Tangani shortcut zoom canvas: Ctrl + Plus/Equal, Ctrl + Minus, Ctrl + 0
  if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
    e.preventDefault();
    if (typeof stepZoom === 'function') stepZoom(1);
  } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
    e.preventDefault();
    if (typeof stepZoom === 'function') stepZoom(-1);
  } else if (e.key === '0' || e.code === 'Numpad0' || e.code === 'Digit0') {
    e.preventDefault();
    if (typeof setZoom === 'function') setZoom(100);
  }
}, { capture: true, passive: false });

// Cegah Ctrl + Wheel zoom browser di seluruh window & arahkan ke zoom canvas
window.addEventListener('wheel', function(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    // Jika event terjadi di luar elemen canvas (misal di workspace), tetap jalankan zoom canvas
    if (e.target !== document.getElementById('canvas')) {
      const cvEl = document.getElementById('canvas');
      if (cvEl && typeof getZoom === 'function' && typeof setZoom === 'function') {
        const r = cvEl.getBoundingClientRect();
        const cur = getZoom();
        const dy = e.deltaY;
        let next = Math.round(cur * Math.exp(-dy * 0.002));
        if (next === cur && dy) next = cur + (dy < 0 ? 1 : -1);
        setZoom(next, {
          x: e.clientX - r.left,
          y: e.clientY - r.top
        });
      }
    }
  }
}, { capture: true, passive: false });

$(document).on('keydown', function(e) {
  // Popup terbuka: hanya Esc / ? / Tab yang aktif
  if (modalOpen()) {
    if (e.key === 'Escape' || (e.key === '?' && $('#modal-help').hasClass('open') && !typing(e.target))) {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'Tab') trapTab(e);
    return;
  }
  if (typing(e.target) && e.key !== 'Escape') return;
  const ctrl = e.ctrlKey || e.metaKey;

  if (e.key === '?') {
    e.preventDefault();
    openModal('help');
    return;
  }
  if (e.key === 'Escape') {
    if (window.CropUI && window.CropUI.isOpen()) {
      $('#crop-btn-cancel').trigger('click');
      return;
    }
    if (drag && drag.started) {
      endDrag(false);
      return;
    }
    if ($('body').is('.show-left,.show-right')) {
      closeDrawers();
      return;
    }
    if (typing(e.target)) {
      e.target.blur();
      return;
    }
    pickTool('select');
    return;
  }
  if (e.key === 'Enter') {
    if (window.CropUI && window.CropUI.isOpen()) {
      $('#crop-btn-apply').trigger('click');
      return;
    }
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl && !e.altKey) {
    e.preventDefault();
    if (typeof window.deleteSelected === 'function') {
      window.deleteSelected();
    } else if (typeof deleteSelected === 'function') {
      deleteSelected();
    }
    return;
  }

  if (ctrl && !e.altKey) {
    switch (e.code) {
      case 'KeyZ':
        e.preventDefault();
        $(e.shiftKey ? '#btn-redo' : '#btn-undo').trigger('click');
        return;
      case 'KeyY':
        e.preventDefault();
        $('#btn-redo').trigger('click');
        return;
      case 'KeyS':
        e.preventDefault();
        $('#btn-save').trigger('click');
        return;
      case 'KeyC':
        if (window.Clipboard) {
          e.preventDefault();
          window.Clipboard.copy();
        }
        return;
      case 'KeyV':
        if (window.Clipboard) {
          e.preventDefault();
          window.Clipboard.paste();
        }
        return;
      case 'KeyD':
        if (window.Clipboard) {
          e.preventDefault();
          window.Clipboard.duplicate();
        }
        return;
      case 'KeyG':
      case 'KeyB':
        e.preventDefault();
        e.stopPropagation();
        if (window.Grouping) {
          if (e.shiftKey) {
            window.Grouping.ungroup();
          } else {
            window.Grouping.group();
          }
        }
        return;
      case 'KeyF':
        e.preventDefault();
        if (SMALL.matches) $('body').addClass('show-left').removeClass('show-right');
        else $('body').removeClass('hide-left');
        $('#layer-search').trigger('focus').trigger('select');
        return;
    }
    return;
  }

  if (ctrl && e.altKey) {
    if (window.BooleanOps) {
      if (e.code === 'KeyU') {
        e.preventDefault();
        window.BooleanOps.union();
        return;
      }
      if (e.code === 'KeyS') {
        e.preventDefault();
        window.BooleanOps.subtract();
        return;
      }
      if (e.code === 'KeyI') {
        e.preventDefault();
        window.BooleanOps.intersect();
        return;
      }
      if (e.code === 'KeyE') {
        e.preventDefault();
        window.BooleanOps.exclude();
        return;
      }
    }
  }

  if (e.altKey && !ctrl) {
    const acts = {
      KeyN: () => $('#btn-new').trigger('click'),
      KeyD: () => $('#btn-drive').trigger('click'),
      KeyI: () => $('#btn-import').trigger('click'),
      KeyL: () => togglePanel('left'),
      KeyR: () => togglePanel('right'),
      ArrowUp: () => nudgeLayer(-1),
      ArrowDown: () => nudgeLayer(1),
      Digit1: () => {
        if (SMALL.matches) $('body').addClass('show-right').removeClass('show-left');
        else $('body').removeClass('hide-right');
        $('#tab-design').trigger('click');
      },
      Digit2: () => {
        if (SMALL.matches) $('body').addClass('show-right').removeClass('show-left');
        else $('body').removeClass('hide-right');
        $('#tab-code').trigger('click');
      }
    };
    if (acts[e.code]) {
      e.preventDefault();
      acts[e.code]();
    }
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat && currentTool() !== 'hand') {
      prevTool = currentTool();
      pickTool('hand');
    }
    return;
  }
  if (e.shiftKey && e.code === 'KeyP') {
    e.preventDefault();
    pickTool('pencil');
    return;
  }
  if (e.shiftKey && e.code === 'Digit0') {
    e.preventDefault();
    setZoom(100);
    return;
  }
  if (e.shiftKey && e.code === 'Digit1') {
    e.preventDefault();
    fitZoom();
    return;
  }
  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    stepZoom(1);
    return;
  }
  if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    stepZoom(-1);
    return;
  }
  // Nudge / Menggeser objek yang sedang diseleksi dengan tombol panah (Arrow keys)
  if (State.selectedIds && State.selectedIds.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;

    if (typeof Geo !== 'undefined' && typeof Geo.selection === 'function') {
      const sel = Geo.selection();
      sel.forEach(f => {
        if (f.obj && f.obj.transform) {
          f.obj.transform.x = Math.round((f.obj.transform.x + dx) * 100) / 100;
          f.obj.transform.y = Math.round((f.obj.transform.y + dy) * 100) / 100;
        }
      });
    } else {
      State.selectedIds.forEach(id => {
        const found = typeof findObjectWithParent === 'function' ? findObjectWithParent(id) : null;
        if (found && found.obj && found.obj.transform) {
          found.obj.transform.x = Math.round((found.obj.transform.x + dx) * 100) / 100;
          found.obj.transform.y = Math.round((found.obj.transform.y + dy) * 100) / 100;
        }
      });
    }

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();

    // Debounce pencatatan riwayat agar tidak merekam setiap 1px secara berulang saat tombol panah ditekan terus
    clearTimeout(window._nudgeTimer);
    window._nudgeTimer = setTimeout(() => {
      if (window.History && typeof window.History.record === 'function') {
        window.History.record();
      }
    }, 300);
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    stepLayer(1);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    stepLayer(-1);
    return;
  }
  if (!e.shiftKey && toolKeys[e.code]) {
    e.preventDefault();
    pickTool(toolKeys[e.code]);
  }
});

$(document).on('keyup', function(e) {
  if (e.code === 'Space' && prevTool) {
    pickTool(prevTool);
    prevTool = null;
  }
});
$(window).on('blur', () => {
  if (prevTool) {
    pickTool(prevTool);
    prevTool = null;
  }
});