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
const pickTool = name => $(`#toolbar .tool[data-tool="${name}"]`).trigger('click');
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

let prevTool = null; // untuk Space = hand sementara

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
      case 'KeyF':
        e.preventDefault();
        if (SMALL.matches) $('body').addClass('show-left').removeClass('show-right');
        else $('body').removeClass('hide-left');
        $('#layer-search').trigger('focus').trigger('select');
        return;
    }
    return;
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