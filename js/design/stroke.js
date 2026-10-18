/* ================= DESIGN: STROKE (panel kanan → Stroke ala Figma) ================= */
// Bergantung pada: variabel.js (State), geometry.js (Geo), colors.js (Color), paint.js (Paint),
//                  design/colorpicker.js (ColorPicker), canvas.js (requestRender).
// Mendukung:
// 1. Swatch warna yang membuka ColorPicker terintegrasi (Solid / Gradient / Hex / Opacity).
// 2. Stroke Width (tebal garis).
// 3. Stroke Align: 'inside' | 'center' | 'outside'.
// 4. Advanced Stroke Settings Popover:
//    - Style: Solid vs Dashed (input dash & gap).
//    - Cap: Flat / None, Round, Triangle Arrow.
//    - Join: Miter, Round, Bevel.

(function () {
  const $list = $('#stroke-list'),
    $controls = $('#stroke-controls-row'),
    $add = $('[data-act="stroke-add"]'),
    $widthInput = $('#prop-strokewidth'),
    $alignSelect = $('#prop-strokealign'),
    $btnAdvanced = $('#btn-stroke-advanced'),
    $secWrap = $('#sec-stroke-wrap');

  if (!$list.length) return;

  const LABEL = { ...Paint.GRADIENT_LABEL, PATTERN: 'Pattern', IMAGE: 'Image' };

  // Objek yang tidak memiliki stroke
  const NO_STROKE = ['group'];
  const selected = () => (State.selectedIds || []).map(id => Geo.find(String(id))).filter(f => f && f.obj);
  const targets = () => selected().filter(f => !NO_STROKE.includes(f.obj.type));

  // Stroke paint model
  // format objek:
  // style.strokes = [{ id, type, visible, opacity, color, ... }]
  // atau style.stroke (string) & style.strokeWidth (number) format lama
  const strokesOf = style => {
    if (!style) return [];
    if (Array.isArray(style.strokes) && style.strokes.length > 0) {
      return style.strokes;
    }
    if (typeof style.stroke === 'string' && style.stroke && style.stroke !== 'none') {
      const c = Color.parseCss(style.stroke);
      if (c) {
        return [{
          id: 'stroke_legacy',
          type: 'SOLID',
          visible: true,
          opacity: c.a,
          color: Color.toHex(c)
        }];
      }
    }
    return [];
  };

  const ensureStrokes = style => {
    if (!Array.isArray(style.strokes)) {
      style.strokes = strokesOf(style).map(p => ({ ...p, id: Paint.uid() }));
    }
    return style.strokes;
  };

  const strip = strokes => strokes.map(({ id, ...rest }) => rest);

  const model = () => {
    const ts = targets();
    if (!ts.length) return null;
    const sets = ts.map(f => strokesOf(f.obj.style)),
      first = JSON.stringify(strip(sets[0]));
    const mixed = !sets.every(s => JSON.stringify(strip(s)) === first);
    return { ts, strokes: sets[0], mixed };
  };

  // View untuk row stroke
  const view = (p, mixed) => {
    if (mixed) return { sw: '#808080', hex: 'Mixed', op: '', vis: true, solid: false, ro: true };
    if (!p) return { sw: '#000000', hex: '000000', op: 100, vis: true, solid: true, ro: false };
    if (p.type !== 'SOLID') {
      return {
        sw: '#808080',
        grad: Paint.isGradient(p) ? Paint.previewCss(p) : '',
        hex: LABEL[p.type] || p.type,
        op: Math.round((p.opacity == null ? 1 : p.opacity) * 100),
        vis: p.visible !== false,
        solid: false,
        ro: true
      };
    }
    const c = Color.parseCss(p.color);
    return {
      sw: c ? Color.toHex(c) : '#000000',
      hex: c ? Color.toHex(c).slice(1) : '000000',
      op: Math.round((p.opacity == null ? 1 : p.opacity) * 100),
      vis: p.visible !== false,
      solid: true,
      ro: false
    };
  };

  const rowHtml = (v, i) => `
  <div class="fg-grid fill stroke-item" data-i="${i}">
    <div class="fg-color">
      ${v.grad ?
        `<span class="stroke-sw stroke-sw-g" role="button" tabindex="0" aria-label="Edit stroke gradient" style="background:${v.grad}"></span>` :
        `<input type="color" class="stroke-sw" value="${v.sw}" aria-label="Pilih warna stroke">`
      }
      <input class="hex stroke-hex" value="${v.hex}" maxlength="9" spellcheck="false" aria-label="Kode hex stroke"${v.ro ? ' readonly' : ''}>
      <input class="op stroke-op" type="number" min="0" max="100" value="${v.op}" aria-label="Opasitas stroke (%)"${v.op === '' ? ' disabled' : ''}>
      <span class="pc">%</span>
    </div>
    <button type="button" class="fg-ib" data-act="stroke-eye" title="Tampilkan / sembunyikan stroke"${v.op === '' ? ' disabled' : ''}>
      <i class="fa-regular ${v.vis ? 'fa-eye' : 'fa-eye-slash'}"></i>
    </button>
    <button type="button" class="fg-ib" data-act="stroke-del" title="Hapus stroke">
      <i class="fa-solid fa-minus"></i>
    </button>
  </div>`;

  const syncLegacyProps = (style, strokes) => {
    const active = strokes.slice().reverse().find(s => s.visible !== false);
    if (active) {
      if (active.type === 'SOLID') {
        style.stroke = active.color || '#000000';
      } else {
        style.stroke = (active.stops && active.stops[0] && active.stops[0].color) || '#000000';
      }
      if (style.strokeWidth === undefined || style.strokeWidth === 0) {
        style.strokeWidth = 1;
      }
    } else {
      style.stroke = 'none';
    }
  };

  const apply = (fn, final = true) => {
    const ts = targets();
    if (!ts.length) return;
    ts.forEach(f => {
      const st = f.obj.style || (f.obj.style = {});
      const strks = ensureStrokes(st);
      fn(strks, f);
      syncLegacyProps(st, strks);
    });
    if (final) {
      $(document).trigger('object:change');
    } else {
      if (typeof requestRender === 'function') requestRender();
      if (typeof scheduleSave === 'function') scheduleSave();
      refresh();
    }
  };

  const rowIndex = el => +$(el).closest('.stroke-item').data('i');

  const backgroundFor = f => {
    const ws = document.getElementById('workspace');
    let bg = ws && Color.parseCss(getComputedStyle(ws).backgroundColor);
    if (!bg || bg.a === 0) bg = { r: 30, g: 30, b: 30, a: 1 };
    if (f.parent) {
      const top = Paint.fillsOf(f.parent.style).slice().reverse().find(p => p.type === 'SOLID' && p.visible !== false),
        c = top && Color.parseCss(top.color);
      if (c) bg = Color.blend(c, (top.opacity == null ? 1 : top.opacity) * c.a, bg);
    }
    return Color.toHex(bg);
  };

  const openFor = el => {
    const m = model();
    if (!m) return;
    const $row = $(el).closest('.stroke-item'),
      i = +$row.data('i'),
      p = m.mixed ? null : m.strokes[m.strokes.length - 1 - i];
    if (p && p.type !== 'SOLID' && !Paint.isGradient(p)) return;

    const key = 'stroke_' + (m.mixed ? 'mixed' : (p ? p.id : '0'));
    if (ColorPicker.isOpen() && ColorPicker.key() === key) return ColorPicker.close();

    const base = p || (m.ts[0].obj.style && strokesOf(m.ts[0].obj.style).slice().reverse().find(q => q.type === 'SOLID')) || Paint.solid('#000000', 1);
    const sessionIds = new Map();

    ColorPicker.open({
      key,
      anchor: $row.find('.stroke-sw')[0],
      paint: JSON.parse(JSON.stringify(base)),
      background: backgroundFor(m.ts[0]),
      onChange: (np, final) => {
        if (m.mixed) {
          apply((strokes, f) => {
            if (!sessionIds.has(f.obj.id)) sessionIds.set(f.obj.id, Paint.uid());
            strokes.length = 0;
            strokes.push({ ...JSON.parse(JSON.stringify(np)), id: sessionIds.get(f.obj.id) });
          }, final);
        } else {
          apply(strokes => {
            const idx = strokes.length - 1 - i;
            if (strokes[idx]) {
              strokes[idx] = { ...JSON.parse(JSON.stringify(np)), id: strokes[idx].id };
            }
          }, final);
        }
      }
    });
  };

  let sig = null;
  const refresh = force => {
    const m = model();
    if (!m || !m.strokes || m.strokes.length === 0) {
      $list.empty();
      $controls.hide();
      sig = '';
      return;
    }

    const rows = m.mixed ? [null] : m.strokes.slice().reverse();
    const views = rows.map(p => view(p, m.mixed));
    const s = m.mixed ? 'mixed' : rows.map(p => (p ? p.id + ':' + p.type : '')).join('|');

    if (s !== sig || force) {
      $list.html(views.map(rowHtml).join(''));
      sig = s;
    }

    $controls.show();

    // Update Stroke Width & Alignment input
    const firstObj = m.ts[0].obj;
    const st = firstObj.style || {};
    const sw = st.strokeWidth !== undefined ? st.strokeWidth : 1;
    const align = st.strokeAlign || 'inside';

    if (!$widthInput.is(':focus') || force) {
      $widthInput.val(sw);
    }
    $alignSelect.val(align);
  };

  // Event handlers list
  $list.on('click', '.stroke-sw', function (e) {
    e.preventDefault();
    openFor(this);
  });
  $list.on('keydown', '.stroke-sw', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFor(this);
    }
  });

  $list.on('change', '.stroke-hex', function () {
    const raw = String(this.value).trim().replace('#', ''),
      c = Color.parseHex(raw),
      i = rowIndex(this);
    if (!c) return refresh(true);
    apply(strokes => {
      const q = strokes[strokes.length - 1 - i];
      if (!q || q.type !== 'SOLID') return;
      q.color = Color.toHex(c);
      if (raw.length === 4 || raw.length === 8) q.opacity = Math.round(c.a * 100) / 100;
    });
  });

  $list.on('change', '.stroke-op', function () {
    const v = parseFloat(this.value),
      i = rowIndex(this);
    if (!isFinite(v)) return refresh(true);
    apply(strokes => {
      const q = strokes[strokes.length - 1 - i];
      if (q) q.opacity = Math.min(100, Math.max(0, v)) / 100;
    });
  });

  $list.on('click', '[data-act="stroke-eye"]', function () {
    const i = rowIndex(this);
    apply(strokes => {
      const q = strokes[strokes.length - 1 - i];
      if (q) q.visible = q.visible === false;
    });
  });

  $list.on('click', '[data-act="stroke-del"]', function () {
    const m = model(),
      i = rowIndex(this);
    ColorPicker.close();
    apply(strokes => {
      if (m && m.mixed) strokes.length = 0;
      else strokes.splice(strokes.length - 1 - i, 1);
    });
  });

  $add.on('click', () => {
    ColorPicker.close();
    const ts = targets();
    if (!ts.length) return;
    apply((strokes, f) => {
      if (strokes.length === 0) {
        strokes.push(Paint.solid('#000000', 1));
        if (!f.obj.style.strokeWidth || f.obj.style.strokeWidth <= 0) {
          f.obj.style.strokeWidth = 1;
        }
        if (!f.obj.style.strokeAlign) {
          f.obj.style.strokeAlign = 'inside';
        }
      } else {
        strokes.push(Paint.solid('#000000', 1));
      }
    });
    // Buka accordion jika tertutup
    if ($secWrap.length && !$secWrap.hasClass('open')) {
      if (typeof setAcc === 'function') setAcc($secWrap, true);
    }
  });

  // Stroke Width & Align change
  $widthInput.on('input change', function () {
    const val = Math.max(0, parseFloat(this.value) || 0);
    const ts = targets();
    if (!ts.length) return;
    ts.forEach(f => {
      if (!f.obj.style) f.obj.style = {};
      f.obj.style.strokeWidth = val;
    });
    $(document).trigger('object:change');
  });

  $alignSelect.on('change', function () {
    const align = this.value;
    const ts = targets();
    if (!ts.length) return;
    ts.forEach(f => {
      if (!f.obj.style) f.obj.style = {};
      f.obj.style.strokeAlign = align;
    });
    $(document).trigger('object:change');
  });

  /* ============================================================
     ADVANCED STROKE SETTINGS POPOVER (FIGMA STYLE)
     ============================================================ */
  let $popover = null;

  const closePopover = () => {
    if ($popover) {
      $popover.remove();
      $popover = null;
    }
    $(document).off('pointerdown.strokepop');
  };

  const openAdvancedPopover = () => {
    closePopover();
    const ts = targets();
    if (!ts.length) return;
    const firstStyle = ts[0].obj.style || {};

    const isDashed = Array.isArray(firstStyle.strokeDashes) && firstStyle.strokeDashes.length > 0;
    const dashVal = isDashed ? (firstStyle.strokeDashes[0] || 4) : 4;
    const gapVal = isDashed ? (firstStyle.strokeDashes[1] !== undefined ? firstStyle.strokeDashes[1] : 4) : 4;
    const capVal = firstStyle.strokeCap || 'round';
    const joinVal = firstStyle.strokeJoin || 'round';

    const popHtml = `
    <div class="stroke-popover" id="stroke-advanced-popover">
      <div class="stroke-popover-head">
        <span>Stroke Settings</span>
        <button type="button" class="stroke-pop-close" id="stroke-pop-close">&times;</button>
      </div>

      <!-- Stroke Style: Solid vs Dashed -->
      <div class="stroke-field-group">
        <div class="stroke-field-label">Style</div>
        <div class="stroke-btn-group" id="pop-stroke-style">
          <button type="button" class="stroke-btn-opt ${!isDashed ? 'active' : ''}" data-val="solid">
            <i class="fa-solid fa-minus"></i> Solid
          </button>
          <button type="button" class="stroke-btn-opt ${isDashed ? 'active' : ''}" data-val="dashed">
            <i class="fa-solid fa-ellipsis"></i> Dashed
          </button>
        </div>
      </div>

      <!-- Dash & Gap Inputs -->
      <div class="stroke-field-group" id="pop-dash-gap-row" style="${isDashed ? '' : 'display:none;'}">
        <div class="stroke-field-label">Dash & Gap (px)</div>
        <div class="stroke-inputs-row">
          <label class="fg-in" title="Dash Length">
            <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Dash</span>
            <input type="number" id="pop-dash-val" value="${dashVal}" min="1" max="100">
          </label>
          <label class="fg-in" title="Gap Length">
            <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Gap</span>
            <input type="number" id="pop-gap-val" value="${gapVal}" min="1" max="100">
          </label>
        </div>
      </div>

      <!-- End Caps: Flat, Round, Arrow -->
      <div class="stroke-field-group">
        <div class="stroke-field-label">Cap (Ujung Garis)</div>
        <div class="stroke-btn-group" id="pop-stroke-cap">
          <button type="button" class="stroke-btn-opt ${capVal === 'butt' ? 'active' : ''}" data-val="butt" title="Flat / None">
            <i class="fa-solid fa-grip-lines-vertical"></i> Flat
          </button>
          <button type="button" class="stroke-btn-opt ${capVal === 'round' ? 'active' : ''}" data-val="round" title="Round / Bulat">
            <i class="fa-solid fa-circle"></i> Round
          </button>
          <button type="button" class="stroke-btn-opt ${capVal === 'arrow' ? 'active' : ''}" data-val="arrow" title="Triangle Arrow">
            <i class="fa-solid fa-play"></i> Arrow
          </button>
        </div>
      </div>

      <!-- Corner Join: Miter, Round, Bevel -->
      <div class="stroke-field-group">
        <div class="stroke-field-label">Join (Sudut Sambungan)</div>
        <div class="stroke-btn-group" id="pop-stroke-join">
          <button type="button" class="stroke-btn-opt ${joinVal === 'miter' ? 'active' : ''}" data-val="miter" title="Miter / Lancip">
            Miter
          </button>
          <button type="button" class="stroke-btn-opt ${joinVal === 'round' ? 'active' : ''}" data-val="round" title="Round / Bulat">
            Round
          </button>
          <button type="button" class="stroke-btn-opt ${joinVal === 'bevel' ? 'active' : ''}" data-val="bevel" title="Bevel / Miring">
            Bevel
          </button>
        </div>
      </div>
    </div>`;

    $popover = $(popHtml).appendTo('body');

    // Posisi popover di sebelah kiri tombol ... dan pastikan berada nyaman di dalam viewport
    const btnRect = $btnAdvanced[0].getBoundingClientRect();
    const popW = 240;
    const popH = $popover.outerHeight() || 290;
    let left = btnRect.left - popW - 8;
    let top = btnRect.top - 20;

    if (left < 10) left = 10;
    if (top + popH > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - popH - 16);
    }
    if (top < 16) top = 16;

    $popover.css({ left, top });

    // Events dalam popover
    $popover.find('#stroke-pop-close').on('click', closePopover);

    $popover.find('#pop-stroke-style .stroke-btn-opt').on('click', function () {
      $popover.find('#pop-stroke-style .stroke-btn-opt').removeClass('active');
      $(this).addClass('active');
      const val = $(this).data('val');
      if (val === 'dashed') {
        $popover.find('#pop-dash-gap-row').slideDown(120);
        const d = parseFloat($popover.find('#pop-dash-val').val()) || 4;
        const g = parseFloat($popover.find('#pop-gap-val').val()) || 4;
        updateTargetsStroke(st => { st.strokeDashes = [d, g]; });
      } else {
        $popover.find('#pop-dash-gap-row').slideUp(120);
        updateTargetsStroke(st => { st.strokeDashes = null; });
      }
    });

    const updateDashesFromInputs = () => {
      const d = Math.max(1, parseFloat($popover.find('#pop-dash-val').val()) || 4);
      const g = Math.max(1, parseFloat($popover.find('#pop-gap-val').val()) || 4);
      updateTargetsStroke(st => { st.strokeDashes = [d, g]; });
    };

    $popover.find('#pop-dash-val, #pop-gap-val').on('input change', updateDashesFromInputs);

    $popover.find('#pop-stroke-cap .stroke-btn-opt').on('click', function () {
      $popover.find('#pop-stroke-cap .stroke-btn-opt').removeClass('active');
      $(this).addClass('active');
      const cap = $(this).data('val');
      updateTargetsStroke(st => { st.strokeCap = cap; });
    });

    $popover.find('#pop-stroke-join .stroke-btn-opt').on('click', function () {
      $popover.find('#pop-stroke-join .stroke-btn-opt').removeClass('active');
      $(this).addClass('active');
      const join = $(this).data('val');
      updateTargetsStroke(st => { st.strokeJoin = join; });
    });

    // Draggable popover lewat header
    const head = $popover.find('.stroke-popover-head')[0];
    let mv = null;
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.button !== 0) return;
      const r = $popover[0].getBoundingClientRect();
      mv = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
      if (!mv || mv.id !== e.pointerId) return;
      const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
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

    setTimeout(() => {
      $(document).on('pointerdown.strokepop', e => {
        if (!$(e.target).closest('#stroke-advanced-popover, #btn-stroke-advanced').length) {
          closePopover();
        }
      });
    }, 10);
  };

  const updateTargetsStroke = fn => {
    const ts = targets();
    if (!ts.length) return;
    ts.forEach(f => {
      if (!f.obj.style) f.obj.style = {};
      fn(f.obj.style);
    });
    $(document).trigger('object:change');
  };

  $btnAdvanced.on('click', e => {
    e.stopPropagation();
    if ($popover) closePopover();
    else openAdvancedPopover();
  });

  // Sync event
  $(document).on('selection:change project:load object:add object:change object:remove', () => {
    refresh();
  });

  $(document).on('selection:change project:load object:remove', () => {
    closePopover();
    if (ColorPicker.isOpen() && String(ColorPicker.key()).startsWith('stroke_')) {
      ColorPicker.close();
    }
  });

  // Expose publik helper
  window.StrokeDesign = {
    refresh,
    strokesOf,
    ensureStrokes
  };
})();
