/* ================= CODE PANEL CONTROLLER (js/code/layout.js) ================= */
// Mengelola antarmuka (UI/UX) pada tab "Code" di sidebar kanan.
// Menampilkan kontrol kategori statis (Layout, Dimensions, Appearance)
// dan kategori dinamis (Position, Fill, Stroke, Effects),
// serta live preview CSS & Tailwind.

$(function () {
  'use strict';

  const BASE_FONT_SIZE = 16; // 1rem = 16px standar browser

  const r2 = n => Math.round(n * 100) / 100;

  // Helper mengambil objek terpilih utama
  const getSelectedObject = () => {
    if (!State.selectedIds || State.selectedIds.length === 0) return null;
    const id = State.selectedIds[0];
    
    // Cari objek rekursif
    const findObj = (list) => {
      for (const o of list) {
        if (o.id === id) return o;
        if (Array.isArray(o.children) && o.children.length > 0) {
          const res = findObj(o.children);
          if (res) return res;
        }
      }
      return null;
    };
    return findObj(State.objects);
  };

  const syncCodeView = () => {
    const obj = getSelectedObject();
    const $viewCode = $('#view-code');

    if (!$viewCode.length || $viewCode.prop('hidden')) return;

    if (!obj) {
      $('#code-inspector-empty').show();
      $('#code-inspector-content').hide();
      $('#code-css').text('/* Silakan pilih objek di kanvas */');
      $('#code-tailwind').text('<!-- Silakan pilih objek di kanvas -->');
      return;
    }

    $('#code-inspector-empty').hide();
    $('#code-inspector-content').show();

    // 1. Sinkronisasi Snippets Kode
    if (window.CodeCSS && typeof window.CodeCSS.generate === 'function') {
      $('#code-css').text(window.CodeCSS.generate(obj));
    }
    if (window.CodeTailwind && typeof window.CodeTailwind.generate === 'function') {
      $('#code-tailwind').text(window.CodeTailwind.generate(obj));
    }

    // 2. Sinkronisasi UI Dimensions (Width & Height)
    const t = obj.transform || {};
    const c = obj.code = obj.code || {};
    c.sizing = c.sizing || {};
    c.sizing.width = c.sizing.width || { unit: 'px', value: t.width || 120 };
    c.sizing.height = c.sizing.height || { unit: 'px', value: t.height || 80 };

    const unitW = c.sizing.width.unit || 'px';
    const unitH = c.sizing.height.unit || 'px';
    $('#code-unit-w').val(unitW);
    $('#code-unit-h').val(unitH);

    // Tampilkan nilai di input sesuai unit
    let dispW = t.width || 0;
    if (unitW === 'rem' || unitW === 'em') dispW = r2((t.width || 0) / BASE_FONT_SIZE);
    else if (unitW === '%') dispW = 100;
    else dispW = Math.round(t.width || 0);

    let dispH = t.height || 0;
    if (unitH === 'rem' || unitH === 'em') dispH = r2((t.height || 0) / BASE_FONT_SIZE);
    else if (unitH === '%') dispH = 100;
    else dispH = Math.round(t.height || 0);

    $('#code-prop-w').val(dispW);
    $('#code-prop-h').val(dispH);

    // Pilih option Tailwind yang cocok untuk Width
    const wVal = Math.round(t.width || 0);
    const $selectW = $('#code-select-w');
    if (unitW === '%') {
      $selectW.val('full');
    } else if ($selectW.find(`option[data-px="${wVal}"]`).length) {
      $selectW.val(wVal);
    } else {
      $selectW.val('custom');
    }

    // Pilih option Tailwind yang cocok untuk Height
    const hVal = Math.round(t.height || 0);
    const $selectH = $('#code-select-h');
    if (unitH === '%') {
      $selectH.val('full');
    } else if ($selectH.find(`option[data-px="${hVal}"]`).length) {
      $selectH.val(hVal);
    } else {
      $selectH.val('custom');
    }

    // 2b. Sinkronisasi Border Radius
    const geom = obj.geometry || {};
    const sty = obj.style || {};
    const rawCr = geom.cornerRadius !== undefined ? geom.cornerRadius : sty.cornerRadius;
    let radPx = 0;
    if (Array.isArray(rawCr)) radPx = rawCr[0] || 0;
    else if (rawCr !== undefined) radPx = parseFloat(rawCr) || 0;

    $('#code-prop-radius').val(radPx);
    const $selectRad = $('#code-select-radius');
    if ($selectRad.find(`option[data-px="${radPx}"]`).length) {
      $selectRad.val(radPx);
    } else {
      $selectRad.val('custom');
    }

    // 2c. Sinkronisasi Border & Sides
    const defaultSw = sty.strokeWidth !== undefined ? sty.strokeWidth : 0;
    const hasStroke = (sty.strokes && sty.strokes.length > 0) || (sty.stroke && sty.stroke !== 'none');
    let bdrW = hasStroke ? defaultSw : 0;
    if (sty.strokeSides === 'custom' && sty.strokeWidths) {
      bdrW = Math.max(sty.strokeWidths.top || 0, sty.strokeWidths.right || 0, sty.strokeWidths.bottom || 0, sty.strokeWidths.left || 0);
    }
    $('#code-prop-border-width').val(bdrW);

    const $selectBdr = $('#code-select-border-width');
    if ($selectBdr.find(`option[data-px="${bdrW}"]`).length) {
      $selectBdr.val(bdrW);
    } else {
      $selectBdr.val('custom');
    }

    // Border side toggle buttons (All / T / R / B / L)
    const sides = sty.strokeSides || 'all';
    $('.code-bdr-side-btn').removeClass('on');
    if (sides === 'all') {
      $('.code-bdr-side-btn[data-side="all"]').addClass('on');
    } else if (sty.strokeWidths) {
      if ((sty.strokeWidths.top || 0) > 0) $('.code-bdr-side-btn[data-side="top"]').addClass('on');
      if ((sty.strokeWidths.right || 0) > 0) $('.code-bdr-side-btn[data-side="right"]').addClass('on');
      if ((sty.strokeWidths.bottom || 0) > 0) $('.code-bdr-side-btn[data-side="bottom"]').addClass('on');
      if ((sty.strokeWidths.left || 0) > 0) $('.code-bdr-side-btn[data-side="left"]').addClass('on');
    }

    // Border style
    const isDashed = Array.isArray(sty.strokeDashes) && sty.strokeDashes.length > 0;
    $('#code-select-border-style').val(isDashed ? 'dashed' : 'solid');

    // 3. Sinkronisasi Tag HTML
    $('#code-html-tag').val(c.htmlTag || (obj.type === 'text' ? 'p' : 'div'));

    // 4. Sinkronisasi Kategori Dinamis: Position (Absolute)
    c.position = c.position || { isAbsolute: false };
    const isAbs = !!c.position.isAbsolute;
    $('#code-sec-position-body').toggle(isAbs);
    $('#code-btn-toggle-position').toggleClass('on', isAbs).attr('title', isAbs ? 'Hapus Absolute Position' : 'Tambah Absolute Position');
    $('#code-btn-toggle-position i').attr('class', isAbs ? 'fa-solid fa-minus' : 'fa-solid fa-plus');

    if (isAbs) {
      $('#code-pos-top').val(c.position.top !== null && c.position.top !== undefined ? c.position.top : '');
      $('#code-pos-left').val(c.position.left !== null && c.position.left !== undefined ? c.position.left : '');
      $('#code-pos-zindex').val(c.position.zIndex || 1);
    }

    // 5. Sinkronisasi Layout Flex (Jika Objek bertipe Frame)
    if (obj.type === 'frame') {
      $('#code-sec-layout').show();
      const l = obj.layout = obj.layout || { display: 'flex', direction: 'column', gap: 8 };
      $(`[data-code-act="flex-dir"][data-dir="${l.direction || 'column'}"]`).addClass('on').siblings().removeClass('on');
      
      const gapVal = (l.gap !== undefined ? l.gap : 8);
      $('#code-layout-gap').val(gapVal);
      const $selectGap = $('#code-select-gap');
      if ($selectGap.find(`option[data-px="${gapVal}"]`).length) {
        $selectGap.val(gapVal);
      } else {
        $selectGap.val('custom');
      }

      $('#code-select-justify').val(l.justifyContent || 'flex-start');
      $('#code-select-align').val(l.alignItems || 'flex-start');
    } else {
      $('#code-sec-layout').hide();
    }

    // 5b. Sinkronisasi Export Format (html, react, vue)
    const curFmt = c.exportFormat || 'html';
    $('#code-export-format-seg button').removeClass('on');
    $(`#code-export-format-seg button[data-format="${curFmt}"]`).addClass('on');
    const labelMap = {
      html: 'Tailwind CSS (HTML)',
      react: 'Tailwind CSS (React JSX)',
      vue: 'Tailwind CSS (Vue SFC)'
    };
    $('#code-tailwind-label').text(labelMap[curFmt] || 'Tailwind CSS');

    // 6. Sinkronisasi Typography & Text Formatting (Khusus Teks)
    if (obj.type === 'text') {
      $('#code-sec-typography').show();
      const fs = obj.fontSize || 16;
      $('#code-prop-fontsize').val(fs);
      const $selectFs = $('#code-select-fontsize');
      if ($selectFs.find(`option[data-px="${fs}"]`).length) {
        $selectFs.val(fs);
      } else {
        $selectFs.val('custom');
      }

      $('#code-select-fontweight').val(String(obj.fontWeight || '400'));

      const ta = obj.textAlign || 'left';
      $('#code-text-align-seg button').removeClass('on');
      $(`#code-text-align-seg button[data-align="${ta}"]`).addClass('on');

      $('#code-select-leading').val(obj.leadingPreset || 'normal');
      $('#code-select-tracking').val(obj.trackingPreset || 'normal');
    } else {
      $('#code-sec-typography').hide();
    }
  };

  // Event Listeners:
  // --- A. Ganti Unit Satuan Width (px, rem, em, %) ---
  $(document).on('change', '#code-unit-w', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    obj.code = obj.code || {};
    obj.code.sizing = obj.code.sizing || {};
    obj.code.sizing.width = obj.code.sizing.width || {};
    obj.code.sizing.width.unit = this.value;
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- B. Ganti Unit Satuan Height (px, rem, em, %) ---
  $(document).on('change', '#code-unit-h', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    obj.code = obj.code || {};
    obj.code.sizing = obj.code.sizing || {};
    obj.code.sizing.height = obj.code.sizing.height || {};
    obj.code.sizing.height.unit = this.value;
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- C. Ganti Pilihan Dropdown Tailwind Width ---
  $(document).on('change', '#code-select-w', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;

    const val = $(this).val();
    obj.code = obj.code || {};
    obj.code.sizing = obj.code.sizing || {};
    obj.code.sizing.width = obj.code.sizing.width || {};

    if (val === 'full') {
      obj.code.sizing.width.unit = '%';
    } else if (val !== 'custom' && val !== 'auto') {
      const px = parseInt(val, 10);
      if (!isNaN(px)) {
        obj.code.sizing.width.unit = 'px';
        if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
          Geo.setSize(obj, px, obj.transform.height);
        } else {
          obj.transform.width = px;
        }
      }
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- D. Ganti Pilihan Dropdown Tailwind Height ---
  $(document).on('change', '#code-select-h', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;

    const val = $(this).val();
    obj.code = obj.code || {};
    obj.code.sizing = obj.code.sizing || {};
    obj.code.sizing.height = obj.code.sizing.height || {};

    if (val === 'full') {
      obj.code.sizing.height.unit = '%';
    } else if (val !== 'custom' && val !== 'auto') {
      const px = parseInt(val, 10);
      if (!isNaN(px)) {
        obj.code.sizing.height.unit = 'px';
        if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
          Geo.setSize(obj, obj.transform.width, px);
        } else {
          obj.transform.height = px;
        }
      }
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- E. Input Angka Width Manual ---
  $(document).on('change', '#code-prop-w', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    const inputVal = Math.max(0, parseFloat(this.value) || 0);
    const unit = $('#code-unit-w').val() || 'px';

    let px = inputVal;
    if (unit === 'rem' || unit === 'em') px = Math.round(inputVal * BASE_FONT_SIZE);
    px = Math.max(1, px);

    if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
      Geo.setSize(obj, px, obj.transform.height);
    } else {
      obj.transform.width = px;
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- F1. Ganti Dropdown Preset Tailwind Radius ---
  $(document).on('change', '#code-select-radius', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = $(this).val();
    if (val !== 'custom') {
      const px = parseFloat(val) || 0;
      obj.geometry = obj.geometry || {};
      if (obj.type === 'rectangle' || obj.type === 'frame') {
        obj.geometry.cornerRadius = [px, px, px, px];
      } else {
        obj.geometry.cornerRadius = px;
      }
      $(document).trigger('object:change');
      if (typeof requestRender === 'function') requestRender();
      syncCodeView();
    }
  });

  // --- F2. Input Angka Radius Manual ---
  $(document).on('input change', '#code-prop-radius', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const px = Math.max(0, parseFloat(this.value) || 0);
    obj.geometry = obj.geometry || {};
    if (obj.type === 'rectangle' || obj.type === 'frame') {
      obj.geometry.cornerRadius = [px, px, px, px];
    } else {
      obj.geometry.cornerRadius = px;
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // --- F. Input Angka Height Manual ---
  $(document).on('change', '#code-prop-h', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    const inputVal = Math.max(0, parseFloat(this.value) || 0);
    const unit = $('#code-unit-h').val() || 'px';

    let px = inputVal;
    if (unit === 'rem' || unit === 'em') px = Math.round(inputVal * BASE_FONT_SIZE);
    px = Math.max(1, px);

    if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
      Geo.setSize(obj, obj.transform.width, px);
    } else {
      obj.transform.height = px;
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- G. Ganti Tag HTML ---
  $(document).on('change', '#code-html-tag', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.code = obj.code || {};
    obj.code.htmlTag = this.value;
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- H. Toggle Dinamis: Tambah / Hapus Position Absolute ---
  $(document).on('click', '#code-btn-toggle-position', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isAbsolute: false };
    obj.code.position.isAbsolute = !obj.code.position.isAbsolute;
    if (obj.code.position.isAbsolute) {
      obj.code.position.top = obj.transform ? Math.round(obj.transform.y) : 0;
      obj.code.position.left = obj.transform ? Math.round(obj.transform.x) : 0;
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- Border Width Input di Code Mode ---
  $(document).on('input change', '#code-prop-border-width', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = Math.max(0, parseInt($(this).val(), 10) || 0);
    obj.style = obj.style || {};
    obj.style.strokeWidth = val;
    if (obj.style.strokeSides === 'custom' && obj.style.strokeWidths) {
      const sw = obj.style.strokeWidths;
      if (sw.top > 0) sw.top = val;
      if (sw.right > 0) sw.right = val;
      if (sw.bottom > 0) sw.bottom = val;
      if (sw.left > 0) sw.left = val;
    }
    if (val > 0 && (!obj.style.stroke || obj.style.stroke === 'none')) {
      obj.style.stroke = '#000000';
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // --- Border Width Tailwind Preset Dropdown ---
  $(document).on('change', '#code-select-border-width', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = this.value;
    if (val === 'custom') return;
    const px = parseInt(val, 10) || 0;
    obj.style = obj.style || {};
    obj.style.strokeWidth = px;
    if (obj.style.strokeSides === 'custom' && obj.style.strokeWidths) {
      const sw = obj.style.strokeWidths;
      if (sw.top > 0) sw.top = px;
      if (sw.right > 0) sw.right = px;
      if (sw.bottom > 0) sw.bottom = px;
      if (sw.left > 0) sw.left = px;
    }
    if (px > 0 && (!obj.style.stroke || obj.style.stroke === 'none')) {
      obj.style.stroke = '#000000';
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // --- Border Side Toggle Buttons (All, T, R, B, L) ---
  $(document).on('click', '.code-bdr-side-btn', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const side = $(this).data('side');
    obj.style = obj.style || {};
    const curW = obj.style.strokeWidth || 1;

    if (side === 'all') {
      obj.style.strokeSides = 'all';
      delete obj.style.strokeWidths;
    } else {
      obj.style.strokeSides = 'custom';
      obj.style.strokeWidths = obj.style.strokeWidths || {
        top: curW, right: curW, bottom: curW, left: curW
      };
      // Toggle sisi
      obj.style.strokeWidths[side] = (obj.style.strokeWidths[side] > 0) ? 0 : curW;
    }

    if (curW > 0 && (!obj.style.stroke || obj.style.stroke === 'none')) {
      obj.style.stroke = '#000000';
    }

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // --- Border Style Dropdown (solid, dashed, dotted) ---
  $(document).on('change', '#code-select-border-style', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.style = obj.style || {};
    if (this.value === 'dashed') {
      obj.style.strokeDashes = [6, 4];
    } else if (this.value === 'dotted') {
      obj.style.strokeDashes = [2, 2];
    } else {
      delete obj.style.strokeDashes;
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // --- TYPOGRAPHY CONTROLLERS (Khusus Teks di Code Mode) ---
  // Helper mengukur ulang teks jika font size / line height berubah
  const updateTextObjectDimensions = (obj) => {
    if (typeof window.measureTextDimensions === 'function') {
      const dims = window.measureTextDimensions(
        obj.content || obj.text || 'Text',
        obj.fontSize || 16,
        obj.fontFamily || 'Inter, sans-serif',
        obj.fontWeight || '400',
        obj.lineHeight || null,
        obj.letterSpacing || 0,
        !!obj.italic
      );
      if (dims && obj.transform) {
        if (obj.resizing !== 'fixed') {
          obj.transform.width = dims.width;
        }
        obj.transform.height = dims.height;
      }
    }
  };

  // Font Size input
  $(document).on('input change', '#code-prop-fontsize', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    const px = Math.max(6, Math.min(256, parseFloat($(this).val()) || 16));
    obj.fontSize = px;
    if (!obj.lineHeightCustom) obj.lineHeight = px * 1.25;
    updateTextObjectDimensions(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Font Size Tailwind Preset Dropdown
  $(document).on('change', '#code-select-fontsize', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    if (this.value === 'custom') return;
    const px = parseFloat(this.value) || 16;
    obj.fontSize = px;
    if (!obj.lineHeightCustom) obj.lineHeight = px * 1.25;
    updateTextObjectDimensions(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Font Weight Dropdown
  $(document).on('change', '#code-select-fontweight', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    obj.fontWeight = this.value;
    updateTextObjectDimensions(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Text Alignment Buttons (left, center, right)
  $(document).on('click', '#code-text-align-seg button', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    const align = $(this).data('align');
    obj.textAlign = align;
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Leading (Line Height) Dropdown
  $(document).on('change', '#code-select-leading', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    const preset = this.value;
    obj.leadingPreset = preset;
    const fs = obj.fontSize || 16;
    const multipliers = {
      none: 1,
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2
    };
    if (multipliers[preset]) {
      obj.lineHeightCustom = true;
      obj.lineHeight = Math.round(fs * multipliers[preset]);
    } else {
      obj.lineHeightCustom = false;
      obj.lineHeight = fs * 1.25;
    }
    updateTextObjectDimensions(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Tracking (Letter Spacing) Dropdown
  $(document).on('change', '#code-select-tracking', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    const preset = this.value;
    obj.trackingPreset = preset;
    const fs = obj.fontSize || 16;
    const emOffsets = {
      tighter: -0.05,
      tight: -0.025,
      normal: 0,
      wide: 0.025,
      wider: 0.05,
      widest: 0.1
    };
    if (emOffsets[preset] !== undefined) {
      obj.letterSpacing = Math.round(fs * emOffsets[preset] * 10) / 10;
    } else {
      obj.letterSpacing = 0;
    }
    updateTextObjectDimensions(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // --- FLEXBOX / AUTO-LAYOUT CONTROLLERS (Khusus Frame di Code Mode) ---
  // Helper memicu relayout frame
  const applyFrameLayout = (frame) => {
    if (window.LayoutEngine && typeof window.LayoutEngine.applyAutoLayout === 'function') {
      window.LayoutEngine.applyAutoLayout(frame);
    }
    if (typeof syncAutoLayoutUI === 'function') {
      syncAutoLayoutUI();
    }
  };

  // Direction (Row vs Col)
  $(document).on('click', '[data-code-act="flex-dir"]', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'frame') return;
    const dir = $(this).data('dir');
    obj.layout = obj.layout || { display: 'flex' };
    obj.layout.display = 'flex';
    obj.layout.direction = dir;
    applyFrameLayout(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Justify Content
  $(document).on('change', '#code-select-justify', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'frame') return;
    obj.layout = obj.layout || { display: 'flex' };
    obj.layout.display = 'flex';
    obj.layout.justifyContent = this.value;
    applyFrameLayout(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Align Items
  $(document).on('change', '#code-select-align', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'frame') return;
    obj.layout = obj.layout || { display: 'flex' };
    obj.layout.display = 'flex';
    obj.layout.alignItems = this.value;
    applyFrameLayout(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Gap Input (px)
  $(document).on('input change', '#code-layout-gap', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'frame') return;
    const px = Math.max(0, parseInt($(this).val(), 10) || 0);
    obj.layout = obj.layout || { display: 'flex' };
    obj.layout.gap = px;
    applyFrameLayout(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Gap Tailwind Preset Select
  $(document).on('change', '#code-select-gap', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'frame') return;
    if (this.value === 'custom') return;
    const px = parseInt(this.value, 10) || 0;
    obj.layout = obj.layout || { display: 'flex' };
    obj.layout.gap = px;
    applyFrameLayout(obj);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // --- EXPORT FORMAT SELECTOR (HTML, React JSX, Vue) ---
  $(document).on('click', '#code-export-format-seg button', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const format = $(this).data('format');
    obj.code = obj.code || {};
    obj.code.exportFormat = format;
    $(document).trigger('object:change');
    syncCodeView();
  });

  // --- I. Copy Code Buttons ---
  $(document).on('click', '[data-copy-target]', function () {
    const targetId = $(this).data('copy-target');
    const text = $(`#${targetId}`).text();
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text).then(() => {
        const $btn = $(this);
        const originalHtml = $btn.html();
        $btn.html('<i class="fa-solid fa-check"></i> Copied');
        setTimeout(() => $btn.html(originalHtml), 1500);
      });
    }
  });

  // Sinkronisasi saat tab code dibuka atau data berubah
  $('#tab-code').on('click', () => setTimeout(syncCodeView, 40));
  $(document).on('selection:change object:change project:load', () => {
    if (!$('#view-code').prop('hidden')) {
      syncCodeView();
    }
  });

  window.syncCodeView = syncCodeView;
});
