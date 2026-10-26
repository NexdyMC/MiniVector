/* ============================================================
   MINIVECTOR - APP INITIALIZATION & EVENT HANDLERS (js/app.js)
   Mencakup: Toolbar setup, mobile drawer toggle, export format & scale,
   serta boolean operations toolbar handlers.
   ============================================================ */

$(function () {
  // Global helpers untuk SVG symbol icon dan text escape yang dibutuhkan popup.js dan komponen lain
  window.ico = n => `<svg class="ico"><use href="#i-${n}"/></svg>`;
  window.esc = s => $('<div>').text(s).html();

  /* ================= TOOLBAR ================= */
  const tools = [
    ['select', 'select', 'Select (V)'],
    ['hand', 'hand', 'Hand (H)'], null,
    ['frame', 'frame', 'Frame (F)'],
    ['rectangle', 'rect', 'Rectangle (R)'],
    ['ellipse', 'ellipse', 'Ellipse (O)'],
    ['line', 'line', 'Line (L)'],
    ['polygon', 'polygon', 'Polygon'],
    ['star', 'star', 'Star'], null,
    ['pen', 'pen', 'Pen (P)'],
    ['pencil', 'pencil', 'Pencil (Shift+P)'],
    ['text', 'text', 'Text (T)'],
    ['image', 'image', 'Image']
  ];
  $('#toolbar').html(tools.map(t => t ?
    `<button class="tool${t[0] === 'select' ? ' active' : ''}" data-tool="${t[0]}" title="${t[2]}" aria-label="${t[2]}">${ico(t[1])}</button>` :
    '<span class="tool-sep"></span>').join(''));
  $('#toolbar').on('click', '.tool', function () {
    const toolName = String($(this).data('tool'));
    $('#toolbar .tool').removeClass('active');
    $(this).addClass('active');

    State.tool = toolName;
    $(document).trigger('tool:change', [toolName]);

    // Jika klik tool 'image', buka modal Image panel agar user bisa memilih/mengunggah gambar
    if (toolName === 'image' && (!window.ImageTool || !window.ImageTool.hasPendingImage())) {
      if (typeof openModal === 'function') {
        openModal('image');
      }
    }
  });

  /* ================= DRAWER (< 900px) ================= */
  const closeDrawers = () => $('body').removeClass('show-left show-right');
  $('#btn-toggle-left').on('click', () => $('body').toggleClass('show-left').removeClass('show-right'));
  $('#btn-toggle-right').on('click', () => $('body').toggleClass('show-right').removeClass('show-left'));
  $('#backdrop').on('click', closeDrawers);
  window.matchMedia('(min-width: 900px)').addEventListener('change', e => {
    if (e.matches) closeDrawers();
  });

  /* ================= EXPORT HANDLER ================= */
  const syncPreview = () => {
    if (window.Exporter && typeof Exporter.updatePreview === 'function') {
      Exporter.updatePreview();
    }
  };

  $('#export-format').on('change', function () {
    const val = $(this).val();
    const fmt = val.toUpperCase();
    const labelMap = { png: 'PNG', jpeg: 'JPEG', webp: 'WEBP', svg: 'SVG', pdf: 'PDF', json: 'JSON' };
    $('#btn-export-text').text(`Export ${labelMap[val] || fmt}`);
    const isRaster = ['PNG', 'JPEG', 'WEBP'].includes(fmt);
    $('#export-dim-grid').toggle(isRaster);
    $('#export-scale-presets').toggle(isRaster);
    syncPreview();
  });

  // Quick Preset Scale Buttons
  $('#export-scale-presets').on('click', 'button[data-scale]', function () {
    const s = parseFloat($(this).data('scale')) || 1;
    $('#export-scale-presets button').removeClass('on');
    $(this).addClass('on');
    $('#export-scale').val(s).trigger('input');
  });

  $('#export-scale').on('input change', function () {
    const val = parseFloat($(this).val()) || 1;
    $('#export-scale-presets button').removeClass('on');
    $(`#export-scale-presets button[data-scale="${val}"]`).addClass('on');
    syncPreview();
  });

  // Kunci rasio saat user mengetik manual di input Width / Height
  $('#export-w').on('input', function () {
    const target = window.Exporter && Exporter._getTargets();
    if (target && target.bounds && target.bounds.width > 0) {
      const ratio = target.bounds.width / target.bounds.height;
      const newW = parseFloat($(this).val()) || 1;
      const newH = Math.round(newW / ratio);
      $('#export-h').val(newH);
      const scale = newW / target.bounds.width;
      $('#export-scale').val(Math.round(scale * 100) / 100);
    }
  });

  $('#export-h').on('input', function () {
    const target = window.Exporter && Exporter._getTargets();
    if (target && target.bounds && target.bounds.height > 0) {
      const ratio = target.bounds.width / target.bounds.height;
      const newH = parseFloat($(this).val()) || 1;
      const newW = Math.round(newH * ratio);
      $('#export-w').val(newW);
      const scale = newH / target.bounds.height;
      $('#export-scale').val(Math.round(scale * 100) / 100);
    }
  });

  $(document).on('selection:change object:change object:add object:remove project:load', syncPreview);
  $('[aria-controls="sec-export"]').on('click', () => setTimeout(syncPreview, 60));

  $('#btn-export').on('click', function () {
    if (!window.Exporter) return;
    const fmt = $('#export-format').val() || 'png';
    const scale = parseFloat($('#export-scale').val()) || 1;

    if (fmt === 'svg') {
      Exporter.svg();
    } else if (fmt === 'pdf') {
      Exporter.pdf();
    } else if (fmt === 'json') {
      Exporter.json();
    } else {
      Exporter.raster(fmt, scale);
    }
  });

  /* ================= BOOLEAN TOOLBAR HANDLERS ================= */
  const updateBooleanToolbar = () => {
    const count = State.selectedIds ? State.selectedIds.length : 0;
    $('#tb-boolean-group').toggle(count >= 2);
  };

  $(document).on('selection:change project:load object:remove', updateBooleanToolbar);
  updateBooleanToolbar();

  $('#btn-bool-union').on('click', () => {
    if (window.BooleanOps) window.BooleanOps.union();
  });
  $('#btn-bool-subtract').on('click', () => {
    if (window.BooleanOps) window.BooleanOps.subtract();
  });
  $('#btn-bool-intersect').on('click', () => {
    if (window.BooleanOps) window.BooleanOps.intersect();
  });
  $('#btn-bool-exclude').on('click', () => {
    if (window.BooleanOps) window.BooleanOps.exclude();
  });
});
