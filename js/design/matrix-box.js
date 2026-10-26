/* ================= DESIGN: MATRIX BOX (CORNER RADIUS & BORDER SIDES) ================= */
// Mengelola popover matriks 3x3 untuk pengaturan Corner Radius (4 sudut) dan Border Widths (4 sisi):
// [ Radius TL ]   [ Border Top ]    [ Radius TR ]
// [ Border Left ] [ Mini Box/Sync ] [ Border Right ]
// [ Radius BL ]   [ Border Bottom ] [ Radius BR ]

(function () {
  'use strict';

  let $popover = null;
  let isSyncRadius = false;
  let isSyncBorder = false;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const selected = () => (typeof Geo !== 'undefined' && typeof Geo.selection === 'function')
    ? Geo.selection().filter(f => f && f.obj)
    : [];

  const targets = () => selected().filter(f => f.obj.type === 'rectangle' || f.obj.type === 'frame');

  // Baca 4 radius sudut [tl, tr, br, bl]
  const getRadiusValues = (obj) => {
    const cr = (obj.geometry && obj.geometry.cornerRadius) || (obj.style && obj.style.cornerRadius) || 0;
    if (Array.isArray(cr) && cr.length >= 4) {
      return [cr[0] || 0, cr[1] || 0, cr[2] || 0, cr[3] || 0];
    }
    const val = parseFloat(cr) || 0;
    return [val, val, val, val];
  };

  // Baca 4 ketebalan sisi border { top, right, bottom, left }
  const getBorderValues = (obj) => {
    const s = obj.style || {};
    const defaultSw = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
    if (s.strokeWidths && typeof s.strokeWidths === 'object') {
      return {
        top: s.strokeWidths.top !== undefined ? s.strokeWidths.top : defaultSw,
        right: s.strokeWidths.right !== undefined ? s.strokeWidths.right : defaultSw,
        bottom: s.strokeWidths.bottom !== undefined ? s.strokeWidths.bottom : defaultSw,
        left: s.strokeWidths.left !== undefined ? s.strokeWidths.left : defaultSw
      };
    }
    const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
    const initW = hasStroke ? defaultSw : 0;
    return { top: initW, right: initW, bottom: initW, left: initW };
  };

  const closePopover = () => {
    if ($popover) {
      $popover.remove();
      $popover = null;
      $(document).off('pointerdown.matpop');
    }
  };

  const updatePreviewBox = (tl, tr, br, bl, top, right, bottom, left) => {
    if (!$popover) return;
    const $prev = $popover.find('#mat-mini-preview');
    if (!$prev.length) return;

    $prev.css({
      borderTopLeftRadius: `${Math.min(16, tl)}px`,
      borderTopRightRadius: `${Math.min(16, tr)}px`,
      borderBottomRightRadius: `${Math.min(16, br)}px`,
      borderBottomLeftRadius: `${Math.min(16, bl)}px`,
      borderTopWidth: `${top > 0 ? Math.max(1, Math.min(4, top)) : 0}px`,
      borderRightWidth: `${right > 0 ? Math.max(1, Math.min(4, right)) : 0}px`,
      borderBottomWidth: `${bottom > 0 ? Math.max(1, Math.min(4, bottom)) : 0}px`,
      borderLeftWidth: `${left > 0 ? Math.max(1, Math.min(4, left)) : 0}px`
    });
  };

  const applyChanges = (tl, tr, br, bl, top, right, bottom, left) => {
    const ts = targets();
    if (!ts.length) return;

    ts.forEach(f => {
      const o = f.obj;
      if (!o.geometry) o.geometry = {};
      if (!o.style) o.style = {};

      // Simpan Corner Radius
      o.geometry.cornerRadius = [tl, tr, br, bl];
      o.style.cornerRadius = [tl, tr, br, bl];

      // Simpan Border Widths
      o.style.strokeSides = (top === right && right === bottom && bottom === left) ? 'all' : 'custom';
      o.style.strokeWidths = { top, right, bottom, left };
      // Pastikan ada default strokeWidth utama
      o.style.strokeWidth = Math.max(top, right, bottom, left);

      // Jika ada border > 0 tapi belum ada warna stroke, beri default hitam
      const hasStroke = (o.style.strokes && o.style.strokes.length > 0) || (o.style.stroke && o.style.stroke !== 'none');
      if (!hasStroke && (top > 0 || right > 0 || bottom > 0 || left > 0)) {
        o.style.stroke = '#000000';
        if (typeof Paint !== 'undefined' && typeof Paint.uid === 'function') {
          o.style.strokes = [{
            id: Paint.uid(),
            type: 'SOLID',
            color: '#000000',
            opacity: 1,
            visible: true
          }];
        }
      }
    });

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    updatePreviewBox(tl, tr, br, bl, top, right, bottom, left);
  };

  const openMatrixPopover = (anchorEl) => {
    closePopover();
    const ts = targets();
    if (!ts.length) return;

    const firstObj = ts[0].obj;
    const [initTl, initTr, initBr, initBl] = getRadiusValues(firstObj);
    const { top: initT, right: initR, bottom: initB, left: initL } = getBorderValues(firstObj);

    const popHtml = `
    <div class="matrix-box-popover" id="matrix-box-popover">
      <div class="matrix-popover-head">
        <span><i class="fa-solid fa-vector-square" style="margin-right:6px; color:#0d99ff;"></i>Corner & Border Matrix</span>
        <button type="button" class="matrix-pop-close" id="matrix-pop-close">&times;</button>
      </div>

      <!-- 3x3 Grid Matrix -->
      <div class="matrix-grid-3x3">
        <!-- Row 1: TL Radius | Top Border | TR Radius -->
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Radius Top-Left (Sudut Kiri Atas)">
            <i class="fa-regular fa-square" style="border-top:2px solid #0d99ff; border-left:2px solid #0d99ff;"></i>
            <input type="number" id="mat-rad-tl" value="${initTl}" min="0" max="999" step="1">
          </div>
        </div>
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Border Top (Sisi Atas)">
            <i class="fa-solid fa-arrow-up"></i>
            <input type="number" id="mat-bdr-t" value="${initT}" min="0" max="100" step="1">
          </div>
        </div>
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Radius Top-Right (Sudut Kanan Atas)">
            <i class="fa-regular fa-square" style="border-top:2px solid #0d99ff; border-right:2px solid #0d99ff;"></i>
            <input type="number" id="mat-rad-tr" value="${initTr}" min="0" max="999" step="1">
          </div>
        </div>

        <!-- Row 2: Left Border | Mini Preview Box & Sync | Right Border -->
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Border Left (Sisi Kiri)">
            <i class="fa-solid fa-arrow-left"></i>
            <input type="number" id="mat-bdr-l" value="${initL}" min="0" max="100" step="1">
          </div>
        </div>
        <div class="matrix-cell">
          <div class="matrix-center-cell" id="mat-center-cell" title="Klik untuk Sync/Tautkan Semua Nilai">
            <div class="matrix-mini-preview" id="mat-mini-preview"></div>
            <button type="button" class="matrix-sync-btn" id="mat-sync-toggle">
              <i class="fa-solid fa-link"></i> Sync
            </button>
          </div>
        </div>
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Border Right (Sisi Kanan)">
            <i class="fa-solid fa-arrow-right"></i>
            <input type="number" id="mat-bdr-r" value="${initR}" min="0" max="100" step="1">
          </div>
        </div>

        <!-- Row 3: BL Radius | Bottom Border | BR Radius -->
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Radius Bottom-Left (Sudut Kiri Bawah)">
            <i class="fa-regular fa-square" style="border-bottom:2px solid #0d99ff; border-left:2px solid #0d99ff;"></i>
            <input type="number" id="mat-rad-bl" value="${initBl}" min="0" max="999" step="1">
          </div>
        </div>
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Border Bottom (Sisi Bawah)">
            <i class="fa-solid fa-arrow-down"></i>
            <input type="number" id="mat-bdr-b" value="${initB}" min="0" max="100" step="1">
          </div>
        </div>
        <div class="matrix-cell">
          <div class="matrix-cell-in" style="touch-action:none;" title="Radius Bottom-Right (Sudut Kanan Bawah)">
            <i class="fa-regular fa-square" style="border-bottom:2px solid #0d99ff; border-right:2px solid #0d99ff;"></i>
            <input type="number" id="mat-rad-br" value="${initBr}" min="0" max="999" step="1">
          </div>
        </div>
      </div>
    </div>`;

    $popover = $(popHtml).appendTo('body');
    updatePreviewBox(initTl, initTr, initBr, initBl, initT, initR, initB, initL);

    // Posisikan popover di samping tombol anchor
    const btnRect = anchorEl ? anchorEl.getBoundingClientRect() : { right: window.innerWidth - 300, top: 200 };
    let popLeft = btnRect.left - 300;
    let popTop = btnRect.top - 20;

    if (popLeft < 10) popLeft = btnRect.right + 10;
    if (popTop + 240 > window.innerHeight) popTop = window.innerHeight - 250;

    $popover.css({
      left: `${Math.max(10, popLeft)}px`,
      top: `${Math.max(10, popTop)}px`
    });

    // Close Button
    $popover.find('#matrix-pop-close').on('click', closePopover);

    // Baca nilai dari input sekarang
    const readCurrentValues = () => {
      const tl = Math.max(0, parseFloat($popover.find('#mat-rad-tl').val()) || 0);
      const tr = Math.max(0, parseFloat($popover.find('#mat-rad-tr').val()) || 0);
      const br = Math.max(0, parseFloat($popover.find('#mat-rad-br').val()) || 0);
      const bl = Math.max(0, parseFloat($popover.find('#mat-rad-bl').val()) || 0);

      const t = Math.max(0, parseFloat($popover.find('#mat-bdr-t').val()) || 0);
      const r = Math.max(0, parseFloat($popover.find('#mat-bdr-r').val()) || 0);
      const b = Math.max(0, parseFloat($popover.find('#mat-bdr-b').val()) || 0);
      const l = Math.max(0, parseFloat($popover.find('#mat-bdr-l').val()) || 0);

      return { tl, tr, br, bl, t, r, b, l };
    };

    // Input handlers dengan sync logic
    $popover.find('#mat-rad-tl, #mat-rad-tr, #mat-rad-br, #mat-rad-bl').on('input change', function () {
      const val = Math.max(0, parseFloat($(this).val()) || 0);
      if (isSyncRadius) {
        $popover.find('#mat-rad-tl, #mat-rad-tr, #mat-rad-br, #mat-rad-bl').val(val);
      }
      const vals = readCurrentValues();
      applyChanges(vals.tl, vals.tr, vals.br, vals.bl, vals.t, vals.r, vals.b, vals.l);
    });

    $popover.find('#mat-bdr-t, #mat-bdr-r, #mat-bdr-b, #mat-bdr-l').on('input change', function () {
      const val = Math.max(0, parseFloat($(this).val()) || 0);
      if (isSyncBorder) {
        $popover.find('#mat-bdr-t, #mat-bdr-r, #mat-bdr-b, #mat-bdr-l').val(val);
      }
      const vals = readCurrentValues();
      applyChanges(vals.tl, vals.tr, vals.br, vals.bl, vals.t, vals.r, vals.b, vals.l);
    });

    // Toggle Sync di Center Cell
    $popover.find('#mat-center-cell').on('click', function (e) {
      isSyncRadius = !isSyncRadius;
      isSyncBorder = isSyncRadius;
      $popover.find('#mat-sync-toggle').toggleClass('active', isSyncRadius);

      if (isSyncRadius) {
        const vals = readCurrentValues();
        // Samakan semua sudut ke nilai TL, dan semua sisi ke nilai Top
        $popover.find('#mat-rad-tl, #mat-rad-tr, #mat-rad-br, #mat-rad-bl').val(vals.tl);
        $popover.find('#mat-bdr-t, #mat-bdr-r, #mat-bdr-b, #mat-bdr-l').val(vals.t);
        applyChanges(vals.tl, vals.tl, vals.tl, vals.tl, vals.t, vals.t, vals.t, vals.t);
      }
    });

    // Drag header popover
    let mv = null;
    const head = $popover.find('.matrix-popover-head')[0];
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('#matrix-pop-close')) return;
      head.setPointerCapture(e.pointerId);
      const r = $popover[0].getBoundingClientRect();
      mv = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    });
    head.addEventListener('pointermove', e => {
      if (!mv || mv.id !== e.pointerId) return;
      $popover.css({
        left: clamp(e.clientX - mv.dx, 10, window.innerWidth - $popover.outerWidth() - 10),
        top: clamp(e.clientY - mv.dy, 10, window.innerHeight - $popover.outerHeight() - 10)
      });
    });
    const endMove = e => {
      if (mv && mv.id === e.pointerId) mv = null;
    };
    head.addEventListener('pointerup', endMove);
    head.addEventListener('pointercancel', endMove);

    // Close saat klik di luar
    setTimeout(() => {
      $(document).on('pointerdown.matpop', e => {
        if (!$(e.target).closest('#matrix-box-popover, #btn-corner-matrix, #btn-stroke-matrix').length) {
          closePopover();
        }
      });
    }, 10);
  };

  // Event Listeners tombol pemicu
  $(document).on('click', '#btn-corner-matrix', function (e) {
    e.stopPropagation();
    if ($popover) closePopover();
    else openMatrixPopover(this);
  });

  $(document).on('click', '#btn-stroke-matrix', function (e) {
    e.stopPropagation();
    if ($popover) closePopover();
    else openMatrixPopover(this);
  });

  // Tutup bila seleksi berubah
  $(document).on('selection:change project:load object:remove', () => {
    closePopover();
  });

  window.MatrixBoxDesign = {
    open: openMatrixPopover,
    close: closePopover
  };
})();
