/* ================= CODE PANEL CONTROLLER (js/code/layout.js) ================= */
// Mengelola antarmuka (UI/UX) pada tab "Code" di sidebar kanan.
// Menampilkan kontrol kategori statis (Layout, Dimensions, Appearance)
// dan kategori dinamis (Position, Fill, Stroke, Effects),
// serta live preview CSS & Tailwind.

$(function () {
  'use strict';
  /* ================= MODERN CUSTOM DROPDOWN SELECT HANDLER ================= */
  const closeAllCustomSelects = () => {
    $('#view-code .mv-custom-select-wrap').removeClass('open');
    $('#view-code .mv-custom-select-trigger').removeClass('active').attr('aria-expanded', 'false');
  };

  // Toggle buka/tutup menu custom select di tab Code
  $(document).on('click', '#view-code .mv-custom-select-trigger', function (e) {
    e.stopPropagation();
    const $trigger = $(this);
    const $wrap = $trigger.closest('.mv-custom-select-wrap');
    const isOpen = $wrap.hasClass('open');

    // Tutup dropdown lainnya
    $('.mv-custom-select-wrap').not($wrap).removeClass('open');
    $('.mv-custom-select-trigger').not($trigger).removeClass('active').attr('aria-expanded', 'false');

    if (!isOpen) {
      $wrap.addClass('open');
      $trigger.addClass('active').attr('aria-expanded', 'true');
    } else {
      $wrap.removeClass('open');
      $trigger.removeClass('active').attr('aria-expanded', 'false');
    }
  });

  // Pilih item dari menu custom select di tab Code
  $(document).on('click', '#view-code .mv-custom-select-item', function (e) {
    e.stopPropagation();
    const $item = $(this);
    const val = $item.data('val');
    const text = $item.text();
    const $wrap = $item.closest('.mv-custom-select-wrap');
    const $trigger = $wrap.find('.mv-custom-select-trigger');
    const wrapId = $wrap.attr('id') || '';
    const selectId = wrapId.replace('wrap-', '');

    $wrap.find('.mv-custom-select-item').removeClass('selected');
    $item.addClass('selected');
    $trigger.find('span').text(text);
    $wrap.removeClass('open');
    $trigger.removeClass('active').attr('aria-expanded', 'false');

    // Trigger change pada select asli yang tersembunyi
    const $select = $('#' + selectId);
    if ($select.length) {
      $select.val(val).trigger('change');
    }
  });

  // Tutup jika klik sembarang di luar
  $(document).on('click', function () {
    closeAllCustomSelects();
  });

  // Helper untuk update label & selected item custom select dari luar
  const setCustomSelectVal = (selectId, val) => {
    const $wrap = $('#wrap-' + selectId);
    if (!$wrap.length) return;
    const $menu = $wrap.find('.mv-custom-select-menu');
    let $item = $menu.find(`.mv-custom-select-item[data-val="${val}"]`);
    if (!$item.length) {
      // coba cari match via data-px jika ada
      $item = $menu.find(`.mv-custom-select-item[data-px="${val}"]`);
    }
    if ($item.length) {
      $wrap.find('.mv-custom-select-item').removeClass('selected');
      $item.addClass('selected');
      $wrap.find('.mv-custom-select-trigger > span').text($item.text());
    }
    $('#' + selectId).val(val);
  };


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


  // Helper mencari parent frame dari suatu object
  const getParentFrameOf = (obj) => {
    if (!obj || !window.State || !window.State.objects) return null;
    const search = (list, parent = null) => {
      for (const item of list) {
        if (item.id === obj.id) return parent;
        if (item.children && Array.isArray(item.children)) {
          const res = search(item.children, item);
          if (res) return res;
        }
      }
      return null;
    };
    return search(window.State.objects);
  };

  // Helper sinkronisasi koordinat inset dari posisi transform aktual objek
  const updateObjectInsetsFromTransform = (obj) => {
    if (!obj || !obj.transform) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || {};
    const pos = obj.code.position;
    if (!pos.isActive && !pos.isAbsolute) return;

    const parent = getParentFrameOf(obj);
    const t = obj.transform;
    const curX = Math.round(t.x || 0);
    const curY = Math.round(t.y || 0);
    const curW = Math.round(t.width || 0);
    const curH = Math.round(t.height || 0);

    const parentW = parent && parent.transform ? Math.round(parent.transform.width || 0) : 0;
    const parentH = parent && parent.transform ? Math.round(parent.transform.height || 0) : 0;

    // Cek anchor mana yang aktif
    const hasTop = pos.top !== '' && pos.top !== null && pos.top !== undefined;
    const hasRight = pos.right !== '' && pos.right !== null && pos.right !== undefined;
    const hasBottom = pos.bottom !== '' && pos.bottom !== null && pos.bottom !== undefined;
    const hasLeft = pos.left !== '' && pos.left !== null && pos.left !== undefined;

    // Jika belum ada yang di-set atau default, set top & left
    if (!hasTop && !hasRight && !hasBottom && !hasLeft) {
      pos.top = curY;
      pos.left = curX;
      return;
    }

    // Jika Top aktif, update Top
    if (hasTop) {
      pos.top = curY;
    }
    // Jika Left aktif, update Left
    if (hasLeft) {
      pos.left = curX;
    }
    // Jika Right aktif dan ada parent frame, update Right = parentW - (curX + curW)
    if (hasRight && parentW > 0) {
      pos.right = Math.max(0, parentW - (curX + curW));
    }
    // Jika Bottom aktif dan ada parent frame, update Bottom = parentH - (curY + curH)
    if (hasBottom && parentH > 0) {
      pos.bottom = Math.max(0, parentH - (curY + curH));
    }
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
    setCustomSelectVal('code-unit-w', unitW);
    setCustomSelectVal('code-unit-h', unitH);

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
    if (unitW === '%') {
      setCustomSelectVal('code-select-w', 'full');
    } else if ($('#menu-code-select-w').find(`.mv-custom-select-item[data-px="${wVal}"]`).length) {
      setCustomSelectVal('code-select-w', wVal);
    } else {
      setCustomSelectVal('code-select-w', 'custom');
    }

    // Pilih option Tailwind yang cocok untuk Height
    const hVal = Math.round(t.height || 0);
    if (unitH === '%') {
      setCustomSelectVal('code-select-h', 'full');
    } else if ($('#menu-code-select-h').find(`.mv-custom-select-item[data-px="${hVal}"]`).length) {
      setCustomSelectVal('code-select-h', hVal);
    } else {
      setCustomSelectVal('code-select-h', 'custom');
    }

    // 2b. Sinkronisasi Border Radius
    const geom = obj.geometry || {};
    const sty = obj.style || {};
    const rawCr = geom.cornerRadius !== undefined ? geom.cornerRadius : sty.cornerRadius;
    let radPx = 0;
    if (Array.isArray(rawCr)) radPx = rawCr[0] || 0;
    else if (rawCr !== undefined) radPx = parseFloat(rawCr) || 0;

    $('#code-prop-radius').val(radPx);
    if ($('#menu-code-select-radius').find(`.mv-custom-select-item[data-px="${radPx}"]`).length) {
      setCustomSelectVal('code-select-radius', radPx);
    } else {
      setCustomSelectVal('code-select-radius', 'custom');
    }

    // 2c. Sinkronisasi Border & Sides
    const defaultSw = sty.strokeWidth !== undefined ? sty.strokeWidth : 0;
    const hasStroke = (sty.strokes && sty.strokes.length > 0) || (sty.stroke && sty.stroke !== 'none');
    let bdrW = hasStroke ? defaultSw : 0;
    if (sty.strokeSides === 'custom' && sty.strokeWidths) {
      bdrW = Math.max(sty.strokeWidths.top || 0, sty.strokeWidths.right || 0, sty.strokeWidths.bottom || 0, sty.strokeWidths.left || 0);
    }
    $('#code-prop-border-width').val(bdrW);
    if ($('#menu-code-select-border-width').find(`.mv-custom-select-item[data-px="${bdrW}"]`).length) {
      setCustomSelectVal('code-select-border-width', bdrW);
    } else {
      setCustomSelectVal('code-select-border-width', 'custom');
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
    setCustomSelectVal('code-select-border-style', isDashed ? 'dashed' : 'solid');

    // 2d. Sinkronisasi Background & Fill (Solid vs Gradient vs None)
    const activeFills = Array.isArray(sty.fills) ? sty.fills.filter(f => f && f.visible !== false) : [];
    const topFill = activeFills.length > 0 ? activeFills[activeFills.length - 1] : (sty.fill && sty.fill !== 'none' ? { type: 'SOLID', color: sty.fill } : null);
    const hasFill = !!topFill;

    $('#code-sec-background-body').toggle(hasFill);
    $('#code-btn-toggle-fill').toggleClass('on', hasFill).attr('title', hasFill ? 'Hapus Fill' : 'Tambah Fill');
    $('#code-btn-toggle-fill i').attr('class', hasFill ? 'fa-solid fa-minus' : 'fa-solid fa-plus');

    if (hasFill) {
      const fillType = topFill.type === 'GRADIENT_LINEAR' ? 'gradient' : 'solid';
      $('#code-fill-type-seg button').removeClass('on');
      $(`#code-fill-type-seg button[data-fill-type="${fillType}"]`).addClass('on');

      if (fillType === 'solid') {
        $('#code-fill-solid-controls').show();
        $('#code-fill-gradient-controls').hide();

        const curCol = topFill.color || '#3B82F6';
        $('#code-fill-color-picker').val(curCol.startsWith('#') && curCol.length === 7 ? curCol : '#3b82f6');
        $('#code-fill-color-hex').val(curCol.replace('#', '').toUpperCase());

        const matchedItem = $(`#menu-code-select-tailwind-color .mv-custom-select-item[data-val="${curCol.toLowerCase()}"]`);
        if (matchedItem.length) {
          setCustomSelectVal('code-select-tailwind-color', curCol.toLowerCase());
        } else {
          setCustomSelectVal('code-select-tailwind-color', 'custom');
        }
      } else {
        // Gradient Mode
        $('#code-fill-solid-controls').hide();
        $('#code-fill-gradient-controls').show();

        // Degree calculation
        let deg = 90;
        if (typeof Paint !== 'undefined' && typeof Paint.linearAngle === 'function') {
          deg = Math.round((Paint.linearAngle(topFill) + 90) % 360);
        } else if (topFill.start && topFill.end) {
          const st = topFill.start, en = topFill.end;
          deg = Math.round((Math.atan2(en.y - st.y, en.x - st.x) * 180 / Math.PI + 450) % 360);
        }
        $('#code-gradient-angle').val(deg);

        const matchedDirItem = $(`#menu-code-select-gradient-dir .mv-custom-select-item[data-val="${deg}"]`);
        if (matchedDirItem.length) {
          setCustomSelectVal('code-select-gradient-dir', deg);
        } else {
          setCustomSelectVal('code-select-gradient-dir', 'custom');
        }

        // Stops rendering
        const stops = (Array.isArray(topFill.stops) ? topFill.stops : [])
          .filter(st => st && isFinite(st.offset))
          .sort((a, b) => a.offset - b.offset);

        $('#code-gradient-stops-count').text(stops.length);

        // Preview bar CSS
        const stopCssList = stops.map(st => `${st.color || '#000'} ${Math.round(st.offset * 100)}%`);
        if (stopCssList.length > 0) {
          $('#code-gradient-preview-bar').css('background', `linear-gradient(90deg, ${stopCssList.join(', ')})`);
        }

        // Render stop items
        const $stopsList = $('#code-gradient-stops-list');
        $stopsList.empty();

        stops.forEach((st, idx) => {
          const pct = Math.round(st.offset * 100);
          const col = st.color || '#000000';
          const $row = $(`
            <div class="code-gradient-stop-row" data-index="${idx}" style="display:flex;align-items:center;gap:6px;padding:3px 4px;background:rgba(255,255,255,0.03);border:1px solid var(--c-line);border-radius:4px;">
              <input type="color" class="code-stop-color-input" value="${col}" style="width:20px;height:20px;border:none;border-radius:3px;cursor:pointer;padding:0;background:transparent;">
              <span style="font-size:11px;font-family:monospace;flex:1;color:#fff;">${col.toUpperCase()}</span>
              <label class="fg-in" style="width:58px;height:22px;padding:0 4px;" title="Offset percentage">
                <input type="number" class="code-stop-offset-input" value="${pct}" min="0" max="100" step="1" style="font-size:10.5px;">
                <span class="end" style="font-size:10px;">%</span>
              </label>
              ${stops.length > 2 ? `<button type="button" class="fg-ib code-btn-remove-stop" title="Hapus titik warna" style="width:22px;height:22px;color:#ef4444;"><i class="fa-solid fa-trash-can" style="font-size:10px;"></i></button>` : ''}
            </div>
          `);
          $stopsList.append($row);
        });
      }
    }


    // 3. Sinkronisasi Tag HTML
    setCustomSelectVal('code-html-tag', c.htmlTag || (obj.type === 'text' ? 'p' : 'div'));

    // 4. Sinkronisasi Kategori Dinamis: Position (2x2 Compact Grid Inset with Quick Anchor Bar)
    c.position = c.position || { isActive: false, isAbsolute: false, type: 'absolute' };
    const isPosActive = !!(c.position.isActive || c.position.isAbsolute);
    if (isPosActive) {
      updateObjectInsetsFromTransform(obj);
    }
    $('#code-sec-position-body').toggle(isPosActive);
    $('#code-btn-toggle-position').toggleClass('on', isPosActive).attr('title', isPosActive ? 'Nonaktifkan Positioning' : 'Aktifkan Positioning');
    $('#code-btn-toggle-position i').attr('class', isPosActive ? 'fa-solid fa-minus' : 'fa-solid fa-plus');

    if (isPosActive) {
      const pType = c.position.type || (c.position.isAbsolute ? 'absolute' : 'relative');
      setCustomSelectVal('code-position-type', pType);

      $('#code-pos-top').val(c.position.top !== null && c.position.top !== undefined ? c.position.top : '');
      $('#code-pos-right').val(c.position.right !== null && c.position.right !== undefined ? c.position.right : '');
      $('#code-pos-bottom').val(c.position.bottom !== null && c.position.bottom !== undefined ? c.position.bottom : '');
      $('#code-pos-left').val(c.position.left !== null && c.position.left !== undefined ? c.position.left : '');

      const curZ = c.position.zIndex !== undefined && c.position.zIndex !== null ? c.position.zIndex : 1;
      $('#code-pos-zindex').val(curZ);
      $('#code-pos-zindex-presets button').removeClass('on');
      $(`#code-pos-zindex-presets button[data-z="${curZ}"]`).addClass('on');
    }

    // 4b. Sinkronisasi Effects & Shadow
    const effects = sty.effects || [];
    const activeShadow = effects.find(e => e && e.visible !== false && (e.type === 'drop-shadow' || e.type === 'inner-shadow'));
    const isShadowActive = !!activeShadow;

    $('#code-sec-effects-body').toggle(isShadowActive);
    $('#code-btn-toggle-shadow').toggleClass('on', isShadowActive).attr('title', isShadowActive ? 'Hapus Box Shadow' : 'Tambah Box Shadow');
    $('#code-btn-toggle-shadow i').attr('class', isShadowActive ? 'fa-solid fa-minus' : 'fa-solid fa-plus');

    if (isShadowActive) {
      $('#code-shadow-x').val(typeof activeShadow.x === 'number' ? activeShadow.x : 0);
      $('#code-shadow-y').val(typeof activeShadow.y === 'number' ? activeShadow.y : 4);
      $('#code-shadow-blur').val(typeof activeShadow.blur === 'number' ? activeShadow.blur : 8);
      $('#code-shadow-spread').val(typeof activeShadow.spread === 'number' ? activeShadow.spread : 0);
      $('#code-shadow-color').val(activeShadow.color || '#000000');
      $('#code-shadow-opacity').val(Math.round((typeof activeShadow.opacity === 'number' ? activeShadow.opacity : 0.25) * 100));

      // Match preset dropdown
      const isInner = activeShadow.type === 'inner-shadow';
      const sx = activeShadow.x || 0;
      const sy = activeShadow.y || 0;
      const sb = activeShadow.blur || 0;

      if (isInner) {
        setCustomSelectVal('code-select-shadow', 'inner');
      } else if (sx === 0 && sy === 1 && sb === 2) {
        setCustomSelectVal('code-select-shadow', 'sm');
      } else if (sx === 0 && sy === 1 && sb === 3) {
        setCustomSelectVal('code-select-shadow', 'base');
      } else if (sx === 0 && sy === 4 && sb === 6) {
        setCustomSelectVal('code-select-shadow', 'md');
      } else if (sx === 0 && sy === 10 && sb === 15) {
        setCustomSelectVal('code-select-shadow', 'lg');
      } else if (sx === 0 && sy === 20 && sb === 25) {
        setCustomSelectVal('code-select-shadow', 'xl');
      } else if (sx === 0 && sy === 25 && sb === 50) {
        setCustomSelectVal('code-select-shadow', '2xl');
      } else {
        setCustomSelectVal('code-select-shadow', 'custom');
      }
    } else {
      setCustomSelectVal('code-select-shadow', 'none');
    }


    // 4b2. Sinkronisasi Interactive States (:hover, :active, :focus)
    const states = c.states || {};
    const configuredCount = ['hover', 'active', 'focus'].filter(k => states[k] && Object.keys(states[k]).length > 0).length;
    if (configuredCount > 0) {
      $('#code-states-active-badge').text(`${configuredCount} configured`).show();
    } else {
      $('#code-states-active-badge').hide();
    }

    // Default target state select to 'default' if not set or restore
    let currentSelectedState = $('#code-select-state').val() || 'default';
    setCustomSelectVal('code-select-state', currentSelectedState);

    const isNonDefault = currentSelectedState !== 'default';
    const curStateData = isNonDefault ? (states[currentSelectedState] || {}) : {};
    const hasProps = isNonDefault && Object.keys(curStateData).length > 0;

    $('#code-state-summary-banner').toggle(hasProps);
    if (hasProps) {
      $('#code-state-summary-title').text(`:${currentSelectedState} configured`);
      const diffs = [];
      if (curStateData.scale && curStateData.scale != 1) diffs.push(`Scale ${curStateData.scale}x`);
      if (curStateData.fill) diffs.push(`Fill ${curStateData.fill}`);
      if (curStateData.textColor) diffs.push(`Text ${curStateData.textColor}`);
      if (curStateData.shadow && curStateData.shadow !== 'inherit') diffs.push(`Shadow ${curStateData.shadow}`);
      if (curStateData.opacity !== undefined && curStateData.opacity !== '') diffs.push(`Opacity ${curStateData.opacity}%`);
      $('#code-state-summary-diff').text(diffs.join(' • ') || 'Configured');
    }

    // Sinkronisasi data di dalam Modal Popup State Properties
    if (isNonDefault) {
      $('#state-modal-title').text(`Configure State: :${currentSelectedState}`);
      $('#modal-state-fill-hex').val(curStateData.fill ? curStateData.fill.replace('#', '') : '');
      if (curStateData.fill && curStateData.fill.startsWith('#')) {
        $('#modal-state-fill-picker').val(curStateData.fill);
      }
      $('#modal-state-text-hex').val(curStateData.textColor ? curStateData.textColor.replace('#', '') : '');
      if (curStateData.textColor && curStateData.textColor.startsWith('#')) {
        $('#modal-state-text-picker').val(curStateData.textColor);
      }
      $('#modal-state-scale').val(curStateData.scale !== undefined ? curStateData.scale : 1.0);
      $('.btn-state-scale-preset').removeClass('on');
      $(`.btn-state-scale-preset[data-scale="${curStateData.scale || 1.0}"]`).addClass('on');
      $('#modal-state-opacity').val(curStateData.opacity !== undefined ? curStateData.opacity : '');
      setCustomSelectVal('modal-state-shadow', curStateData.shadow || 'inherit');
      setCustomSelectVal('modal-state-transition', curStateData.transition || '200');
    }

    // 4c. Sinkronisasi Output Settings (Custom Class, Component Name, Preferences)
    const defaultClass = (obj.name || obj.type || 'element')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');

    $('#code-custom-class').val(c.customClass || defaultClass);
    
    const defaultComp = (obj.name || 'Component').replace(/[^a-zA-Z0-9]/g, '');
    const validDefaultComp = defaultComp ? (defaultComp.charAt(0).toUpperCase() + defaultComp.slice(1)) : 'Component';
    $('#code-component-name').val(c.componentName || validDefaultComp);

    $('#code-pref-inline-style').prop('checked', !!c.inlineStyle);
    $('#code-pref-comments').prop('checked', !!c.includeComments);

    // Element Opacity Sync
    const curOpacity = (sty.opacity !== undefined && sty.opacity !== null) ? sty.opacity : 1;
    const curOpacityPct = Math.round(curOpacity * 100);
    $('#code-element-opacity').val(curOpacityPct);
    if ($('#menu-code-select-opacity').find(`.mv-custom-select-item[data-val="${curOpacityPct}"]`).length) {
      setCustomSelectVal('code-select-opacity', curOpacityPct);
    } else {
      setCustomSelectVal('code-select-opacity', 100);
    }


    // 5. Sinkronisasi Layout Flex (Jika Objek bertipe Frame)
    if (obj.type === 'frame') {
      $('#code-sec-layout').show();
      const l = obj.layout = obj.layout || { display: 'flex', direction: 'column', gap: 8 };
      $(`[data-code-act="flex-dir"][data-dir="${l.direction || 'column'}"]`).addClass('on').siblings().removeClass('on');
      
      const gapVal = (l.gap !== undefined ? l.gap : 8);
      $('#code-layout-gap').val(gapVal);
      if ($('#menu-code-select-gap').find(`.mv-custom-select-item[data-px="${gapVal}"]`).length) {
        setCustomSelectVal('code-select-gap', gapVal);
      } else {
        setCustomSelectVal('code-select-gap', 'custom');
      }

      setCustomSelectVal('code-select-justify', l.justifyContent || 'flex-start');
      setCustomSelectVal('code-select-align', l.alignItems || 'flex-start');
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
      if ($('#menu-code-select-fontsize').find(`.mv-custom-select-item[data-px="${fs}"]`).length) {
        setCustomSelectVal('code-select-fontsize', fs);
      } else {
        setCustomSelectVal('code-select-fontsize', 'custom');
      }

      setCustomSelectVal('code-select-fontweight', String(obj.fontWeight || '400'));

      const ta = obj.textAlign || 'left';
      $('#code-text-align-seg button').removeClass('on');
      $(`#code-text-align-seg button[data-align="${ta}"]`).addClass('on');

      const tc = obj.textCase || 'none';
      $('#code-text-case-seg button').removeClass('on');
      $(`#code-text-case-seg button[data-case="${tc}"]`).addClass('on');

      const lt = obj.listType || 'none';
      $('#code-text-list-seg button').removeClass('on');
      $(`#code-text-list-seg button[data-list="${lt}"]`).addClass('on');

      setCustomSelectVal('code-select-leading', obj.leadingPreset || 'normal');
      setCustomSelectVal('code-select-tracking', obj.trackingPreset || 'normal');
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
  $(document).on('input change', '#code-prop-w', function () {
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
  $(document).on('input change', '#code-prop-h', function () {
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

  // --- H. Toggle Dinamis: Tambah / Hapus Position ---
  $(document).on('click', '#code-btn-toggle-position', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: false, isAbsolute: false, type: 'absolute' };
    const curActive = !!(obj.code.position.isActive || obj.code.position.isAbsolute);
    obj.code.position.isActive = !curActive;
    obj.code.position.isAbsolute = !curActive; // backward compatible
    if (!curActive) {
      obj.code.position.type = obj.code.position.type || 'absolute';
      obj.code.position.top = obj.transform ? Math.round(obj.transform.y) : 0;
      obj.code.position.left = obj.transform ? Math.round(obj.transform.x) : 0;
      obj.code.position.right = '';
      obj.code.position.bottom = '';
      obj.code.position.zIndex = obj.code.position.zIndex || 1;
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // Ganti Position Type (static, relative, absolute, fixed, sticky)
  $(document).on('change', '#code-position-type', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true };
    const prevType = obj.code.position.type;
    const newType = this.value;
    obj.code.position.type = newType;
    obj.code.position.isAbsolute = (newType === 'absolute');

    // Jika objek berada di dalam frame Auto-Layout (flex / grid):
    // Mengubah ke 'absolute' mengeluarkannya dari normal flow flex (tidak mendorong saudara lainnya).
    // Mengubah ke 'relative' atau 'static' mengembalikannya ke alur flex & memicu penataan ulang layout.
    const parent = getParentFrameOf(obj);
    if (parent && parent.type === 'frame' && window.LayoutEngine) {
      window.LayoutEngine.applyAutoLayout(parent);
    }

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Quick Anchor Bar Click Handlers
  $(document).on('click', '.code-quick-anchor-bar .anchor-btn', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const anchor = $(this).data('anchor');
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true, isAbsolute: true, type: 'absolute' };
    obj.code.position.isActive = true;
    obj.code.position.isAbsolute = (obj.code.position.type === 'absolute');

    // Reset all insets first
    obj.code.position.top = '';
    obj.code.position.right = '';
    obj.code.position.bottom = '';
    obj.code.position.left = '';

    const parent = getParentFrameOf(obj);
    const parentW = parent && parent.transform ? Math.round(parent.transform.width) : 800;
    const parentH = parent && parent.transform ? Math.round(parent.transform.height) : 600;
    const curW = Math.round(obj.transform.width || 100);
    const curH = Math.round(obj.transform.height || 100);

    switch (anchor) {
      case 'tl':
        obj.code.position.top = 0;
        obj.code.position.left = 0;
        obj.transform.x = 0;
        obj.transform.y = 0;
        break;
      case 'tc':
        obj.code.position.top = 0;
        obj.transform.y = 0;
        break;
      case 'tr':
        obj.code.position.top = 0;
        obj.code.position.right = 0;
        obj.transform.x = Math.max(0, parentW - curW);
        obj.transform.y = 0;
        break;
      case 'cl':
        obj.code.position.left = 0;
        obj.transform.x = 0;
        break;
      case 'fill':
        obj.code.position.top = 0;
        obj.code.position.right = 0;
        obj.code.position.bottom = 0;
        obj.code.position.left = 0;
        obj.transform.x = 0;
        obj.transform.y = 0;
        obj.transform.width = parentW;
        obj.transform.height = parentH;
        break;
      case 'cr':
        obj.code.position.right = 0;
        obj.transform.x = Math.max(0, parentW - curW);
        break;
      case 'bl':
        obj.code.position.bottom = 0;
        obj.code.position.left = 0;
        obj.transform.x = 0;
        obj.transform.y = Math.max(0, parentH - curH);
        break;
      case 'bc':
        obj.code.position.bottom = 0;
        obj.transform.y = Math.max(0, parentH - curH);
        break;
      case 'br':
        obj.code.position.bottom = 0;
        obj.code.position.right = 0;
        obj.transform.x = Math.max(0, parentW - curW);
        obj.transform.y = Math.max(0, parentH - curH);
        break;
    }

    $('.code-quick-anchor-bar .anchor-btn').removeClass('active');
    $(this).addClass('active');

    $(document).trigger('object:change');
    syncCodeView();
  });

  // Two-way Inset Coordinates Input Handlers (Top, Right, Bottom, Left)
  // Mengetik nilai akan langsung menggerakkan posisi objek di kanvas (terhadap frame induk)
  $(document).on('input change', '#code-pos-top', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true, type: 'absolute' };
    const val = this.value === '' ? '' : (parseFloat(this.value) || 0);
    obj.code.position.top = val;
    if (val !== '') {
      obj.transform.y = val;
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  $(document).on('input change', '#code-pos-right', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true, type: 'absolute' };
    const val = this.value === '' ? '' : (parseFloat(this.value) || 0);
    obj.code.position.right = val;
    if (val !== '') {
      const parent = getParentFrameOf(obj);
      if (parent && parent.transform) {
        obj.transform.x = Math.round(parent.transform.width - (obj.transform.width + val));
      }
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  $(document).on('input change', '#code-pos-bottom', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true, type: 'absolute' };
    const val = this.value === '' ? '' : (parseFloat(this.value) || 0);
    obj.code.position.bottom = val;
    if (val !== '') {
      const parent = getParentFrameOf(obj);
      if (parent && parent.transform) {
        obj.transform.y = Math.round(parent.transform.height - (obj.transform.height + val));
      }
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  $(document).on('input change', '#code-pos-left', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.transform) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true, type: 'absolute' };
    const val = this.value === '' ? '' : (parseFloat(this.value) || 0);
    obj.code.position.left = val;
    if (val !== '') {
      obj.transform.x = val;
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Z-Index Input and Preset Buttons
  $(document).on('input change', '#code-pos-zindex', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true, type: 'absolute' };
    const val = this.value === '' ? 1 : (parseInt(this.value, 10) || 0);
    obj.code.position.zIndex = val;
    $('#code-pos-zindex-presets button').removeClass('on');
    $(`#code-pos-zindex-presets button[data-z="${val}"]`).addClass('on');
    $(document).trigger('object:change');
    syncCodeView();
  });

  $(document).on('click', '#code-pos-zindex-presets button', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const z = parseInt($(this).data('z'), 10);
    obj.code = obj.code || {};
    obj.code.position = obj.code.position || { isActive: true, type: 'absolute' };
    obj.code.position.zIndex = z;
    $('#code-pos-zindex').val(z);
    $('#code-pos-zindex-presets button').removeClass('on');
    $(this).addClass('on');
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

  // Text Case Segment (none, uppercase, lowercase, capitalize)
  $(document).on('click', '#code-text-case-seg button', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    const textCase = $(this).data('case');
    obj.textCase = textCase;
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Text List Segment (none, bullet, numbered)
  $(document).on('click', '#code-text-list-seg button', function () {
    const obj = getSelectedObject();
    if (!obj || obj.type !== 'text') return;
    const listType = $(this).data('list');
    obj.listType = listType;
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
  
  
  // ============================================================
  // BACKGROUND & GRADIENT EVENT HANDLERS
  // ============================================================
  // Helper to ensure style.fills array
  const getTopFillOfObj = (obj, createIfMissing = true) => {
    if (!obj) return null;
    obj.style = obj.style || {};
    if (!Array.isArray(obj.style.fills)) {
      if (obj.style.fill && obj.style.fill !== 'none') {
        obj.style.fills = [{ id: 'fill_1', type: 'SOLID', visible: true, opacity: 1, color: obj.style.fill }];
      } else if (createIfMissing) {
        obj.style.fills = [{ id: 'fill_1', type: 'SOLID', visible: true, opacity: 1, color: '#3B82F6' }];
      } else {
        obj.style.fills = [];
      }
    }
    if (obj.style.fills.length === 0 && createIfMissing) {
      obj.style.fills.push({ id: 'fill_1', type: 'SOLID', visible: true, opacity: 1, color: '#3B82F6' });
    }
    return obj.style.fills[obj.style.fills.length - 1];
  };

  // Toggle Fill On/Off
  $(document).on('click', '#code-btn-toggle-fill', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.style = obj.style || {};
    if (Array.isArray(obj.style.fills) && obj.style.fills.length > 0) {
      const top = obj.style.fills[obj.style.fills.length - 1];
      top.visible = !top.visible;
      if (!top.visible) {
        obj.style.fill = 'none';
      } else {
        obj.style.fill = top.color || '#3B82F6';
      }
    } else {
      obj.style.fills = [{ id: 'fill_1', type: 'SOLID', visible: true, opacity: 1, color: '#3B82F6' }];
      obj.style.fill = '#3B82F6';
    }
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Switch Fill Type (Solid / Gradient / None)
  $(document).on('click', '#code-fill-type-seg button', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const type = $(this).data('fill-type');
    obj.style = obj.style || {};

    if (type === 'none') {
      if (Array.isArray(obj.style.fills)) {
        obj.style.fills.forEach(f => f.visible = false);
      }
      obj.style.fill = 'none';
    } else if (type === 'solid') {
      const top = getTopFillOfObj(obj, true);
      top.type = 'SOLID';
      top.visible = true;
      top.color = top.color || '#3B82F6';
      obj.style.fill = top.color;
    } else if (type === 'gradient') {
      const top = getTopFillOfObj(obj, true);
      top.type = 'GRADIENT_LINEAR';
      top.visible = true;
      if (!Array.isArray(top.stops) || top.stops.length < 2) {
        top.stops = [
          { offset: 0, color: '#3B82F6', opacity: 1 },
          { offset: 1, color: '#8B5CF6', opacity: 1 }
        ];
      }
      if (!top.start) top.start = { x: 0, y: 0.5 };
      if (!top.end) top.end = { x: 1, y: 0.5 };
      obj.style.fill = top.stops[0].color;
    }

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Solid Color Pickers
  $(document).on('input change', '#code-fill-color-picker', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = this.value;
    const top = getTopFillOfObj(obj, true);
    top.type = 'SOLID';
    top.color = val;
    top.visible = true;
    obj.style.fill = val;
    $('#code-fill-color-hex').val(val.replace('#', '').toUpperCase());

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  $(document).on('change', '#code-fill-color-hex', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    let hex = this.value.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return;
    const col = '#' + hex;

    const top = getTopFillOfObj(obj, true);
    top.type = 'SOLID';
    top.color = col;
    top.visible = true;
    obj.style.fill = col;
    $('#code-fill-color-picker').val(col);

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Tailwind Color Palette Dropdown Select
  $(document).on('change', '#code-select-tailwind-color', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = this.value;
    if (val === 'custom') return;

    const top = getTopFillOfObj(obj, true);
    top.type = 'SOLID';
    top.color = val;
    top.visible = true;
    obj.style.fill = val;

    $('#code-fill-color-picker').val(val);
    $('#code-fill-color-hex').val(val.replace('#', '').toUpperCase());

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Gradient Angle Input
  const applyGradientAngle = (deg) => {
    const obj = getSelectedObject();
    if (!obj) return;
    const top = getTopFillOfObj(obj, false);
    if (!top || top.type !== 'GRADIENT_LINEAR') return;

    // Convert CSS degrees to internal Paint angle
    // CSS: 90deg is to right. Paint: 0deg is to right.
    const paintAngle = (deg - 90 + 360) % 360;
    if (typeof Paint !== 'undefined' && typeof Paint.setLinearAngle === 'function') {
      Paint.setLinearAngle(top, paintAngle);
    } else {
      const r = paintAngle * Math.PI / 180;
      top.start = { x: 0.5 - Math.cos(r) * 0.5, y: 0.5 - Math.sin(r) * 0.5 };
      top.end = { x: 0.5 + Math.cos(r) * 0.5, y: 0.5 + Math.sin(r) * 0.5 };
    }

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  };

  $(document).on('input change', '#code-gradient-angle', function () {
    const deg = Math.max(0, Math.min(360, parseInt(this.value, 10) || 0));
    applyGradientAngle(deg);
  });

  $(document).on('change', '#code-select-gradient-dir', function () {
    const val = this.value;
    if (val === 'custom') return;
    const deg = parseInt(val, 10) || 90;
    $('#code-gradient-angle').val(deg);
    applyGradientAngle(deg);
  });

  // Add Stop Button (supports up to 6+ colors)
  $(document).on('click', '#code-btn-add-gradient-stop', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const top = getTopFillOfObj(obj, false);
    if (!top || top.type !== 'GRADIENT_LINEAR') return;
    top.stops = top.stops || [];

    // Calculate middle offset for new stop
    const count = top.stops.length;
    let newOffset = 0.5;
    if (count >= 2) {
      newOffset = Math.round(((top.stops[count - 2].offset + top.stops[count - 1].offset) / 2) * 100) / 100;
    }

    // Default vibrant color from palette
    const rainbowColors = ['#10B981', '#06B6D4', '#F59E0B', '#EC4899', '#EF4444', '#6366F1'];
    const pickColor = rainbowColors[count % rainbowColors.length];

    top.stops.push({
      offset: newOffset,
      color: pickColor,
      opacity: 1
    });

    top.stops.sort((a, b) => a.offset - b.offset);

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Edit Single Stop Color
  $(document).on('input change', '.code-stop-color-input', function () {
    const idx = $(this).closest('.code-gradient-stop-row').data('index');
    const obj = getSelectedObject();
    if (!obj) return;
    const top = getTopFillOfObj(obj, false);
    if (!top || !top.stops || !top.stops[idx]) return;

    top.stops[idx].color = this.value;
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Edit Single Stop Offset (%)
  $(document).on('input change', '.code-stop-offset-input', function () {
    const idx = $(this).closest('.code-gradient-stop-row').data('index');
    const obj = getSelectedObject();
    if (!obj) return;
    const top = getTopFillOfObj(obj, false);
    if (!top || !top.stops || !top.stops[idx]) return;

    const pct = Math.max(0, Math.min(100, parseInt(this.value, 10) || 0));
    top.stops[idx].offset = pct / 100;
    top.stops.sort((a, b) => a.offset - b.offset);

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Remove Stop Button
  $(document).on('click', '.code-btn-remove-stop', function () {
    const idx = $(this).closest('.code-gradient-stop-row').data('index');
    const obj = getSelectedObject();
    if (!obj) return;
    const top = getTopFillOfObj(obj, false);
    if (!top || !top.stops || top.stops.length <= 2) return;

    top.stops.splice(idx, 1);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // ============================================================
  // EFFECTS & BOX SHADOW EVENT HANDLERS
  // ============================================================
  // Toggle Shadow On/Off
  $(document).on('click', '#code-btn-toggle-shadow', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.style = obj.style || {};
    obj.style.effects = obj.style.effects || [];

    const existingIdx = obj.style.effects.findIndex(e => e && (e.type === 'drop-shadow' || e.type === 'inner-shadow'));
    if (existingIdx !== -1) {
      // Hapus shadow
      obj.style.effects.splice(existingIdx, 1);
    } else {
      // Tambah drop-shadow default ala Tailwind shadow-md
      obj.style.effects.push({
        id: 'fx_' + Math.random().toString(36).slice(2, 8),
        type: 'drop-shadow',
        visible: true,
        x: 0,
        y: 4,
        blur: 6,
        spread: 0,
        color: '#000000',
        opacity: 0.15
      });
    }

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Ganti Preset Tailwind Shadow
  $(document).on('change', '#code-select-shadow', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = this.value;
    obj.style = obj.style || {};
    obj.style.effects = obj.style.effects || [];

    const existingIdx = obj.style.effects.findIndex(e => e && (e.type === 'drop-shadow' || e.type === 'inner-shadow'));

    if (val === 'none') {
      if (existingIdx !== -1) obj.style.effects.splice(existingIdx, 1);
    } else if (val !== 'custom') {
      const presets = {
        sm: { type: 'drop-shadow', x: 0, y: 1, blur: 2, spread: 0, color: '#000000', opacity: 0.05 },
        base: { type: 'drop-shadow', x: 0, y: 1, blur: 3, spread: 0, color: '#000000', opacity: 0.1 },
        md: { type: 'drop-shadow', x: 0, y: 4, blur: 6, spread: 0, color: '#000000', opacity: 0.1 },
        lg: { type: 'drop-shadow', x: 0, y: 10, blur: 15, spread: 0, color: '#000000', opacity: 0.1 },
        xl: { type: 'drop-shadow', x: 0, y: 20, blur: 25, spread: 0, color: '#000000', opacity: 0.1 },
        '2xl': { type: 'drop-shadow', x: 0, y: 25, blur: 50, spread: 0, color: '#000000', opacity: 0.25 },
        inner: { type: 'inner-shadow', x: 0, y: 2, blur: 4, spread: 0, color: '#000000', opacity: 0.06 }
      };

      const presetData = presets[val];
      if (presetData) {
        if (existingIdx !== -1) {
          Object.assign(obj.style.effects[existingIdx], presetData, { visible: true });
        } else {
          obj.style.effects.push({
            id: 'fx_' + Math.random().toString(36).slice(2, 8),
            visible: true,
            ...presetData
          });
        }
      }
    }

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  // Edit Manual Shadow Coordinates (X, Y, Blur, Spread, Color, Alpha)
  const updateCustomShadow = () => {
    const obj = getSelectedObject();
    if (!obj) return;
    obj.style = obj.style || {};
    obj.style.effects = obj.style.effects || [];

    let activeShadow = obj.style.effects.find(e => e && (e.type === 'drop-shadow' || e.type === 'inner-shadow'));
    if (!activeShadow) {
      activeShadow = {
        id: 'fx_' + Math.random().toString(36).slice(2, 8),
        type: 'drop-shadow',
        visible: true,
        x: 0,
        y: 4,
        blur: 8,
        spread: 0,
        color: '#000000',
        opacity: 0.25
      };
      obj.style.effects.push(activeShadow);
    }

    activeShadow.x = parseFloat($('#code-shadow-x').val()) || 0;
    activeShadow.y = parseFloat($('#code-shadow-y').val()) || 0;
    activeShadow.blur = Math.max(0, parseFloat($('#code-shadow-blur').val()) || 0);
    activeShadow.spread = parseFloat($('#code-shadow-spread').val()) || 0;
    activeShadow.color = $('#code-shadow-color').val() || '#000000';
    activeShadow.opacity = Math.max(0, Math.min(100, parseFloat($('#code-shadow-opacity').val()) || 25)) / 100;
    activeShadow.visible = true;

    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  };

  $(document).on('input change', '#code-shadow-x, #code-shadow-y, #code-shadow-blur, #code-shadow-spread, #code-shadow-color, #code-shadow-opacity', updateCustomShadow);


  // ================= INTERACTIVE STATES MODAL & POPUP HANDLERS =================
  const getOrCreateStateObj = (obj, stateKey) => {
    obj.code = obj.code || {};
    obj.code.states = obj.code.states || {};
    obj.code.states[stateKey] = obj.code.states[stateKey] || {};
    return obj.code.states[stateKey];
  };

  const openStateModal = () => {
    const curState = $('#code-select-state').val() || 'default';
    if (curState === 'default') {
      // Jika masih default, alihkan otomatis ke :hover
      setCustomSelectVal('code-select-state', 'hover');
    }
    syncCodeView();
    if (typeof openModal === 'function') {
      openModal('state-properties');
    } else {
      $('#modal-state-properties').addClass('show');
    }
  };

  $(document).on('click', '#btn-open-state-popup, #btn-trigger-edit-state', function () {
    openStateModal();
  });

  $(document).on('change', '#code-select-state', function () {
    const curState = $(this).val();
    if (curState !== 'default') {
      openStateModal();
    } else {
      syncCodeView();
    }
  });

  // Modal Category Tabs (Colors | Size & Scale | Effects)
  $(document).on('click', '#state-modal-tab-seg button', function () {
    const tab = $(this).data('tab');
    $('#state-modal-tab-seg button').removeClass('on');
    $(this).addClass('on');
    $('.state-modal-tab-content').hide();
    $(`#state-tab-${tab}`).show();
  });

  // State Fill Color in Modal
  $(document).on('input change', '#modal-state-fill-picker', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    const hex = $(this).val();
    $('#modal-state-fill-hex').val(hex.replace('#', ''));
    const stObj = getOrCreateStateObj(obj, curState);
    stObj.fill = hex;
    $(document).trigger('object:change');
    syncCodeView();
  });

  $(document).on('change', '#modal-state-fill-hex', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    let hex = $(this).val().trim();
    const stObj = getOrCreateStateObj(obj, curState);
    if (!hex) {
      delete stObj.fill;
    } else {
      if (!hex.startsWith('#')) hex = '#' + hex;
      stObj.fill = hex;
      $('#modal-state-fill-picker').val(hex);
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // State Text Color in Modal
  $(document).on('input change', '#modal-state-text-picker', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    const hex = $(this).val();
    $('#modal-state-text-hex').val(hex.replace('#', ''));
    const stObj = getOrCreateStateObj(obj, curState);
    stObj.textColor = hex;
    $(document).trigger('object:change');
    syncCodeView();
  });

  $(document).on('change', '#modal-state-text-hex', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    let hex = $(this).val().trim();
    const stObj = getOrCreateStateObj(obj, curState);
    if (!hex) {
      delete stObj.textColor;
    } else {
      if (!hex.startsWith('#')) hex = '#' + hex;
      stObj.textColor = hex;
      $('#modal-state-text-picker').val(hex);
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // State Scale & Presets in Modal
  $(document).on('input change', '#modal-state-scale', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    const val = parseFloat($(this).val()) || 1.0;
    const stObj = getOrCreateStateObj(obj, curState);
    stObj.scale = val;
    $('.btn-state-scale-preset').removeClass('on');
    $(`.btn-state-scale-preset[data-scale="${val}"]`).addClass('on');
    $(document).trigger('object:change');
    syncCodeView();
  });

  $(document).on('click', '.btn-state-scale-preset', function () {
    const s = parseFloat($(this).data('scale')) || 1.0;
    $('#modal-state-scale').val(s).trigger('input');
  });

  // State Opacity in Modal
  $(document).on('input change', '#modal-state-opacity', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    const val = $(this).val().trim();
    const stObj = getOrCreateStateObj(obj, curState);
    if (val === '') {
      delete stObj.opacity;
    } else {
      stObj.opacity = Math.max(0, Math.min(100, parseInt(val, 10)));
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // State Shadow Preset in Modal
  $(document).on('change', '#modal-state-shadow', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    const val = $(this).val();
    const stObj = getOrCreateStateObj(obj, curState);
    if (val === 'inherit') {
      delete stObj.shadow;
    } else {
      stObj.shadow = val;
    }
    $(document).trigger('object:change');
    syncCodeView();
  });

  // State Transition Duration in Modal
  $(document).on('change', '#modal-state-transition', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const curState = $('#code-select-state').val();
    if (curState === 'default') return;
    const val = $(this).val();
    const stObj = getOrCreateStateObj(obj, curState);
    stObj.transition = val;
    $(document).trigger('object:change');
    syncCodeView();
  });

  // Reset State Button in Modal
  $(document).on('click', '#btn-modal-reset-state', function () {
    const obj = getSelectedObject();
    if (!obj || !obj.code || !obj.code.states) return;
    const curState = $('#code-select-state').val();
    if (curState !== 'default') {
      delete obj.code.states[curState];
      if (Object.keys(obj.code.states).length === 0) {
        delete obj.code.states;
      }
      $(document).trigger('object:change');
      syncCodeView();
      if (typeof closeModal === 'function') closeModal();
    }
  });

  // Element Opacity Handlers
  $(document).on('input change', '#code-element-opacity', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = Math.max(0, Math.min(100, parseFloat($(this).val()) || 100));
    obj.style = obj.style || {};
    obj.style.opacity = val / 100;
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncCodeView();
  });

  $(document).on('change', '#code-select-opacity', function () {
    const obj = getSelectedObject();
    if (!obj) return;
    const val = parseFloat(this.value);
    if (!isNaN(val)) {
      obj.style = obj.style || {};
      obj.style.opacity = Math.max(0, Math.min(1, val / 100));
      $(document).trigger('object:change');
      if (typeof requestRender === 'function') requestRender();
      syncCodeView();
    }
  });

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


  /* ================= CODE EXPORT MODAL LOGIC (INTERACTIVE PREVIEW & EDITOR) ================= */
  let currentModalFormat = 'html';
  let currentModalStyle = 'tailwind';
  let modalPreviewZoom = 1;

  const updateModalGutters = (lineCount) => {
    let guttersHtml = '';
    for (let i = 1; i <= Math.max(1, lineCount); i++) {
      guttersHtml += `${i}<br>`;
    }
    $('#code-modal-gutters').html(guttersHtml);
  };

  const syncExportModal = () => {
    const obj = getSelectedObject();
    if (!obj) {
      $('#code-export-target-name').text('No Layer Selected');
      $('#code-preview-dimen-meta').html('<i class="fa-solid fa-ruler-combined" style="margin-right:4px;"></i> 0 × 0 px');
      $('#code-preview-type-meta').html('<i class="fa-solid fa-shapes" style="margin-right:4px;"></i> None');
      $('#code-preview-rendered-box').empty().html('<div style="color:var(--c-mute);padding:24px;text-align:center;font-size:12px;">Pilih objek di kanvas untuk mengekspor kode</div>');
      $('#code-modal-snippet').text('// Belum ada objek yang dipilih');
      updateModalGutters(1);
      $('#code-modal-lines-count').text('0 lines');
      $('#code-modal-bytes-count').text('0 B');
      return;
    }

    const t = obj.transform || { width: 100, height: 100 };
    const w = Math.round(t.width || 0);
    const h = Math.round(t.height || 0);
    const name = obj.name || (obj.type ? obj.type.charAt(0).toUpperCase() + obj.type.slice(1) : 'Layer');

    $('#code-export-target-name').text(name);
    $('#code-preview-dimen-meta').html(`<i class="fa-solid fa-ruler-combined" style="margin-right:4px;"></i> ${w} × ${h} px`);
    $('#code-preview-type-meta').html(`<i class="fa-solid fa-shapes" style="margin-right:4px;"></i> ${obj.type ? obj.type.toUpperCase() : 'LAYER'}`);

    // 1. Sinkronisasi Segmented Controls
    $('#code-modal-format-seg button').removeClass('on');
    $(`#code-modal-format-seg button[data-format="${currentModalFormat}"]`).addClass('on');

    $('#code-modal-style-seg button').removeClass('on');
    $(`#code-modal-style-seg button[data-style="${currentModalStyle}"]`).addClass('on');

    // 2. Generate Code Snippet
    let snippet = '';
    const isStandalone = $('#code-modal-opt-standalone').is(':checked');
    const withComments = $('#code-modal-opt-comments').is(':checked');

    if (currentModalStyle === 'tailwind') {
      // Pastikan format objek sinkron sementara untuk generator
      const prevFmt = obj.code && obj.code.exportFormat;
      obj.code = obj.code || {};
      obj.code.exportFormat = currentModalFormat;
      snippet = (window.CodeTailwind && typeof window.CodeTailwind.generate === 'function')
        ? window.CodeTailwind.generate(obj)
        : '';
      if (prevFmt) obj.code.exportFormat = prevFmt;
    } else {
      snippet = (window.CodeCSS && typeof window.CodeCSS.generate === 'function')
        ? window.CodeCSS.generate(obj)
        : '';
    }

    // Optional Standalone Wrap & Comments
    let headerComment = '';
    if (withComments) {
      if (currentModalFormat === 'html' || currentModalStyle === 'css') {
        headerComment = `<!-- Exported from MiniVector: ${name} (${w}x${h}px) -->\n`;
        if (currentModalStyle === 'css') {
          headerComment = `/* Exported from MiniVector: ${name} (${w}x${h}px) */\n`;
        }
      } else {
        headerComment = `// Exported from MiniVector: ${name} (${w}x${h}px)\n`;
      }
    }

    if (isStandalone) {
      if (currentModalFormat === 'html') {
        snippet = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n  <script src="https://cdn.tailwindcss.com"><\/script>\n</head>\n<body class="bg-gray-900 min-h-screen flex items-center justify-center p-8">\n  ${snippet.split('\n').join('\n  ')}\n</body>\n</html>`;
      } else if (currentModalFormat === 'react') {
        snippet = `import React from 'react';\n\n${snippet}`;
      }
    }

    if (headerComment) {
      snippet = headerComment + snippet;
    }

    $('#code-modal-snippet').text(snippet);

    // Update lines & bytes
    const lines = snippet ? snippet.split('\n').length : 0;
    updateModalGutters(lines);
    $('#code-modal-lines-count').text(`${lines} line${lines === 1 ? '' : 's'}`);
    const byteSize = new Blob([snippet]).size;
    $('#code-modal-bytes-count').text(byteSize > 1024 ? (byteSize / 1024).toFixed(1) + ' KB' : byteSize + ' B');

    // Update filename badge
    const ext = currentModalStyle === 'css' ? 'css' : (currentModalFormat === 'react' ? 'jsx' : (currentModalFormat === 'vue' ? 'vue' : 'html'));
    const iconClass = currentModalStyle === 'css' ? 'fa-brands fa-css3-alt' : (currentModalFormat === 'react' ? 'fa-brands fa-react' : (currentModalFormat === 'vue' ? 'fa-brands fa-vuejs' : 'fa-brands fa-html5'));
    const iconColor = currentModalStyle === 'css' ? '#264de4' : (currentModalFormat === 'react' ? '#61dafb' : (currentModalFormat === 'vue' ? '#42b883' : '#e34f26'));
    $('#code-modal-filename').html(`<i class="${iconClass}" style="margin-right:6px;color:${iconColor};"></i>${name.replace(/\s+/g, '')}.${ext}`);

    // 3. Render Live Component Preview on Canvas stage
    renderLiveModalPreview(obj);
  };

  /**
   * Helper rekursif membangun preview elemen DOM nyata untuk ditampilkan di panggung modal.
   */
  const buildLiveElement = (obj, isChildOfFreeFrame = false) => {
    if (!obj || obj.visible === false) return null;

    const t = obj.transform || { width: 100, height: 100, x: 0, y: 0 };
    const w = Math.round(t.width || 0);
    const h = Math.round(t.height || 0);
    const sty = obj.style || {};
    const c = obj.code || {};
    const l = obj.layout || {};

    // 1. Background
    let bg = 'transparent';
    const fills = Array.isArray(sty.fills) ? sty.fills.filter(f => f && f.visible !== false) : [];
    if (fills.length > 0) {
      const topFill = fills[fills.length - 1];
      if (topFill.type === 'SOLID') {
        bg = topFill.color || '#D9D9D9';
      } else if (topFill.type === 'GRADIENT_LINEAR' && typeof Paint !== 'undefined' && typeof Paint.previewCss === 'function') {
        bg = Paint.previewCss(topFill);
      }
    } else if (sty.fill && sty.fill !== 'none') {
      bg = sty.fill;
    }

    // 2. Border
    let border = '';
    const bw = sty.strokeWidth !== undefined ? sty.strokeWidth : 0;
    const bc = sty.stroke || '#000000';
    if (bw > 0 && bc !== 'none') {
      border = `${bw}px solid ${bc}`;
    }

    // 3. Corner Radius
    let br = '0px';
    const geom = obj.geometry || {};
    const cr = geom.cornerRadius || sty.cornerRadius;
    if (Array.isArray(cr)) {
      br = `${cr[0] || 0}px ${cr[1] || 0}px ${cr[2] || 0}px ${cr[3] || 0}px`;
    } else if (parseFloat(cr) > 0) {
      br = `${parseFloat(cr)}px`;
    }

    // 4. Box Shadow
    let boxShadow = '';
    if (Array.isArray(sty.effects) && sty.effects.length > 0) {
      const activeShadows = sty.effects
        .filter(e => e && e.visible !== false && (e.type === 'drop-shadow' || e.type === 'inner-shadow'))
        .map(e => {
          const inset = e.type === 'inner-shadow' ? 'inset ' : '';
          const x = e.x || 0;
          const y = e.y || 4;
          const blur = e.blur || 8;
          const spread = e.spread ? ` ${e.spread}px` : '';
          const col = e.color || '#000000';
          const op = e.opacity !== undefined ? e.opacity : 0.25;
          return `${inset}${x}px ${y}px ${blur}px${spread} rgba(0,0,0,${op})`;
        });
      if (activeShadows.length > 0) {
        boxShadow = activeShadows.join(', ');
      }
    }

    // 5. Layout Display
    let display = 'block';
    let flexDirection = 'column';
    let justifyContent = 'flex-start';
    let alignItems = 'flex-start';
    let gap = '0px';
    let padding = '0px';

    if (obj.type === 'frame') {
      if (l.display === 'flex') {
        display = 'flex';
        flexDirection = l.direction || 'column';
        justifyContent = l.justifyContent || 'flex-start';
        alignItems = l.alignItems || 'flex-start';
        gap = (l.gap || 0) + 'px';
        if (Array.isArray(l.padding)) {
          padding = `${l.padding[0]}px ${l.padding[1]}px ${l.padding[2]}px ${l.padding[3]}px`;
        }
      } else if (l.display === 'grid') {
        display = 'grid';
        const cols = Math.max(1, parseInt(l.columns, 10) || 3);
        const colGap = l.colGap || 12;
        const rowGap = l.rowGap || 12;
        gap = `${rowGap}px ${colGap}px`;
        if (Array.isArray(l.padding)) {
          padding = `${l.padding[0]}px ${l.padding[1]}px ${l.padding[2]}px ${l.padding[3]}px`;
        }
      }
    }

    // 6. Positioning
    let position = 'relative';
    let posX = '';
    let posY = '';
    if (isChildOfFreeFrame) {
      position = 'absolute';
      posX = (t.x || 0) + 'px';
      posY = (t.y || 0) + 'px';
    } else if (c.position && (c.position.isActive || c.position.isAbsolute)) {
      position = c.position.type || 'absolute';
      if (c.position.left !== '' && c.position.left !== undefined) posX = c.position.left + 'px';
      if (c.position.top !== '' && c.position.top !== undefined) posY = c.position.top + 'px';
    }

    const $el = $('<div>').css({
      width: w > 0 ? (w + 'px') : 'auto',
      height: h > 0 ? (h + 'px') : 'auto',
      background: obj.type === 'text' ? 'transparent' : bg,
      border: border,
      borderRadius: br,
      boxShadow: boxShadow,
      boxSizing: 'border-box',
      display: display,
      flexDirection: flexDirection,
      justifyContent: justifyContent,
      alignItems: alignItems,
      gap: gap,
      padding: padding,
      position: position,
      left: posX,
      top: posY,
      opacity: sty.opacity !== undefined ? sty.opacity : 1,
      overflow: obj.clipContent !== false ? 'hidden' : 'visible',
      transition: 'all 0.12s ease'
    });

    if (obj.type === 'text') {
      $el.text(obj.content || obj.text || obj.name || 'Sample Text').css({
        fontSize: (obj.fontSize || 16) + 'px',
        fontFamily: obj.fontFamily || 'sans-serif',
        fontWeight: obj.fontWeight || '400',
        color: sty.fill || '#ffffff',
        lineHeight: obj.lineHeight ? (typeof obj.lineHeight === 'number' ? obj.lineHeight + 'px' : obj.lineHeight) : 'normal',
        letterSpacing: (obj.letterSpacing || 0) + 'px',
        textAlign: obj.textAlign || 'left',
        background: 'transparent'
      });
    }

    // Rekursif bangun anak jika ada
    if (Array.isArray(obj.children) && obj.children.length > 0) {
      const isFree = !l.display || l.display === 'none';
      obj.children.forEach(child => {
        const $childEl = buildLiveElement(child, isFree);
        if ($childEl) $el.append($childEl);
      });
    }

    return $el;
  };

  const renderLiveModalPreview = (obj) => {
    const $container = $('#code-preview-rendered-box');
    $container.empty();
    if (!obj || !obj.transform) return;

    const $renderedTree = buildLiveElement(obj, false);
    if ($renderedTree) {
      $container.append($renderedTree);
    }
    updatePreviewZoom(modalPreviewZoom);
  };


  const updatePreviewZoom = (zoom) => {
    modalPreviewZoom = Math.min(3, Math.max(0.2, zoom));
    $('#code-preview-stage-wrapper').css('transform', `scale(${modalPreviewZoom})`);
    $('#code-preview-zoom-label').text(Math.round(modalPreviewZoom * 100) + '%');
  };

  // Open modal button
  $(document).on('click', '#btn-open-code-export-modal', function () {
    if (typeof openModal === 'function') {
      openModal('code-export');
      syncExportModal();
    }
  });

  // Modal format switch
  $(document).on('click', '#code-modal-format-seg button', function () {
    currentModalFormat = $(this).data('format');
    syncExportModal();
  });

  // Modal style switch
  $(document).on('click', '#code-modal-style-seg button', function () {
    currentModalStyle = $(this).data('style');
    syncExportModal();
  });

  // Checkbox option toggles
  $(document).on('change', '#code-modal-opt-standalone, #code-modal-opt-comments', function () {
    syncExportModal();
  });

  // Zoom controls
  $(document).on('click', '#code-preview-zoom-in', function () {
    updatePreviewZoom(modalPreviewZoom + 0.15);
  });
  $(document).on('click', '#code-preview-zoom-out', function () {
    updatePreviewZoom(modalPreviewZoom - 0.15);
  });
  $(document).on('click', '#code-preview-zoom-reset', function () {
    updatePreviewZoom(1);
  });

  // Copy Code in Modal
  $(document).on('click', '#btn-code-modal-copy', function () {
    const text = $('#code-modal-snippet').text();
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text).then(() => {
        const $btn = $(this);
        const orig = $btn.html();
        $btn.html('<i class="fa-solid fa-check"></i> Copied!');
        setTimeout(() => $btn.html(orig), 1600);
      });
    }
  });

  // Download Code File
  $(document).on('click', '#btn-code-modal-download', function () {
    const text = $('#code-modal-snippet').text();
    if (!text) return;
    const obj = getSelectedObject();
    const name = obj ? (obj.name || 'Component').replace(/\s+/g, '_') : 'Component';
    const ext = currentModalStyle === 'css' ? 'css' : (currentModalFormat === 'react' ? 'jsx' : (currentModalFormat === 'vue' ? 'vue' : 'html'));
    const mime = ext === 'css' ? 'text/css' : (ext === 'html' ? 'text/html' : 'text/javascript');

    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  $('#modal-code-export').on('modal:open', syncExportModal);

  window.updateObjectInsetsFromTransform = updateObjectInsetsFromTransform;
  window.syncCodeView = syncCodeView;
  window.syncExportModal = syncExportModal;
});
