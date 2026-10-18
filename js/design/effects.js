/* ================= DESIGN: EFFECTS (panel kanan → Effects ala Figma) ================= */
// Bergantung pada: variabel.js (State), geometry.js (Geo), colors.js (Color), paint.js (Paint),
//                  design/colorpicker.js (ColorPicker), canvas.js (requestRender).
// Mendukung 8 jenis efek visual:
// 1. Inner shadow (bayangan dalam)
// 2. Drop shadow (bayangan luar)
// 3. Layer blur (pengaburan objek)
// 4. Background blur (pengaburan latar belakang)
// 5. Noise (bintik / grain tekstur)
// 6. Texture (tekstur kanvas/paper/grunge)
// 7. Glass (efek kaca / glassmorphism)
// 8. Shader (Beta - gelombang/chromatic/duotone/vignette)

(function () {
  const $list = $('#effects-list'),
    $btnAdd = $('#btn-fx-add'),
    $secWrap = $('#sec-effects-wrap');

  if (!$list.length) return;

  // Metadata 8 tipe efek
  const EFFECT_META = {
    INNER_SHADOW: {
      label: 'Inner shadow',
      icon: 'fa-regular fa-square',
      defaultProps: () => ({ x: 0, y: 4, blur: 4, spread: 0, color: '#000000', opacity: 0.25 })
    },
    DROP_SHADOW: {
      label: 'Drop shadow',
      icon: 'fa-regular fa-clone',
      defaultProps: () => ({ x: 0, y: 4, blur: 8, spread: 0, color: '#000000', opacity: 0.25 })
    },
    LAYER_BLUR: {
      label: 'Layer blur',
      icon: 'fa-solid fa-droplet',
      defaultProps: () => ({ blur: 8 })
    },
    BACKGROUND_BLUR: {
      label: 'Background blur',
      icon: 'fa-solid fa-border-none',
      defaultProps: () => ({ blur: 16 })
    },
    NOISE: {
      label: 'Noise',
      icon: 'fa-solid fa-braille',
      defaultProps: () => ({ amount: 15, mode: 'monochrome' })
    },
    TEXTURE: {
      label: 'Texture',
      icon: 'fa-solid fa-grip',
      defaultProps: () => ({ pattern: 'paper', scale: 100, opacity: 0.15 })
    },
    GLASS: {
      label: 'Glass',
      icon: 'fa-solid fa-circle-notch',
      defaultProps: () => ({ blur: 16, specular: 30, tint: '#FFFFFF', opacity: 0.2 })
    },
    SHADER: {
      label: 'Shader',
      icon: 'fa-solid fa-water',
      beta: true,
      defaultProps: () => ({ type: 'wave', intensity: 20, speed: 1 })
    }
  };

  const NO_EFFECTS = ['group'];
  const selected = () => (State.selectedIds || []).map(id => Geo.find(String(id))).filter(f => f && f.obj);
  const targets = () => selected().filter(f => !NO_EFFECTS.includes(f.obj.type));

  const effectsOf = style => {
    if (!style) return [];
    if (Array.isArray(style.effects)) return style.effects;
    return [];
  };

  const ensureEffects = style => {
    if (!Array.isArray(style.effects)) {
      style.effects = [];
    }
    return style.effects;
  };

  const strip = effects => effects.map(({ id, ...rest }) => rest);

  const model = () => {
    const ts = targets();
    if (!ts.length) return null;
    const sets = ts.map(f => effectsOf(f.obj.style)),
      first = JSON.stringify(strip(sets[0]));
    const mixed = !sets.every(s => JSON.stringify(strip(s)) === first);
    return { ts, effects: sets[0], mixed };
  };

  const rowHtml = (fx, i) => {
    const meta = EFFECT_META[fx.type] || { label: fx.type, icon: 'fa-solid fa-wand-magic-sparkles' };
    const vis = fx.visible !== false;
    return `
    <div class="fx-item" data-i="${i}" data-id="${fx.id}">
      <i class="${meta.icon} fx-ico"></i>
      <button type="button" class="fx-name-btn" data-act="fx-edit" title="Atur parameter ${meta.label}">
        ${meta.label} ${meta.beta ? '<span class="fx-beta-badge">Beta</span>' : ''}
      </button>
      <div class="fx-actions">
        <button type="button" class="fg-ib" data-act="fx-settings" title="Pengaturan efek">
          <i class="fa-solid fa-sliders"></i>
        </button>
        <button type="button" class="fg-ib" data-act="fx-eye" title="Tampilkan / sembunyikan">
          <i class="fa-regular ${vis ? 'fa-eye' : 'fa-eye-slash'}"></i>
        </button>
        <button type="button" class="fg-ib" data-act="fx-del" title="Hapus efek">
          <i class="fa-solid fa-minus"></i>
        </button>
      </div>
    </div>`;
  };

  const apply = (fn, final = true) => {
    const ts = targets();
    if (!ts.length) return;
    ts.forEach(f => {
      const st = f.obj.style || (f.obj.style = {});
      const fxs = ensureEffects(st);
      fn(fxs, f);
    });
    if (final) {
      $(document).trigger('object:change');
    } else {
      if (typeof requestRender === 'function') requestRender();
      if (typeof scheduleSave === 'function') scheduleSave();
      refresh();
    }
  };

  const rowIndex = el => +$(el).closest('.fx-item').data('i');

  let sig = null;
  const refresh = force => {
    const m = model();
    if (!m || !m.effects || m.effects.length === 0) {
      $list.empty();
      sig = '';
      return;
    }

    const rows = m.mixed ? [] : m.effects.slice().reverse();
    const s = m.mixed ? 'mixed' : rows.map(fx => `${fx.id}:${fx.type}:${fx.visible}`).join('|');

    if (s !== sig || force) {
      $list.html(rows.map(rowHtml).join(''));
      sig = s;
    }
  };

  /* ============================================================
     DROPDOWN MENU TAMBAH EFEK (FIGMA SCREENSHOT STYLE)
     ============================================================ */
  let $menu = null;

  const closeMenu = () => {
    if ($menu) {
      $menu.remove();
      $menu = null;
    }
    $(document).off('pointerdown.fxmenu');
  };

  const openAddMenu = () => {
    closeMenu();
    closePopover();

    const ts = targets();
    if (!ts.length) return;

    let itemsHtml = '';
    for (const [key, meta] of Object.entries(EFFECT_META)) {
      itemsHtml += `
      <div class="fx-menu-item" data-type="${key}">
        <i class="${meta.icon}"></i>
        <span>${meta.label}</span>
        ${meta.beta ? '<span class="fx-beta-badge">Beta</span>' : ''}
      </div>`;
    }

    const menuHtml = `<div class="fx-menu" id="fx-add-menu">${itemsHtml}</div>`;
    $menu = $(menuHtml).appendTo('body');

    // Posisikan di bawah tombol +
    const btnRect = $btnAdd[0].getBoundingClientRect();
    const menuW = 180;
    let left = btnRect.right - menuW;
    let top = btnRect.bottom + 4;

    if (left < 10) left = 10;
    if (top + 280 > window.innerHeight) top = btnRect.top - 280;

    $menu.css({ left, top });

    $menu.on('click', '.fx-menu-item', function () {
      const type = $(this).data('type');
      closeMenu();
      addEffect(type);
    });

    setTimeout(() => {
      $(document).on('pointerdown.fxmenu', e => {
        if (!$(e.target).closest('#fx-add-menu, #btn-fx-add').length) {
          closeMenu();
        }
      });
    }, 10);
  };

  const addEffect = type => {
    const meta = EFFECT_META[type];
    if (!meta) return;

    const newFx = {
      id: 'fx_' + Math.random().toString(36).slice(2, 8),
      type,
      visible: true,
      ...meta.defaultProps()
    };

    apply(effects => {
      effects.push(newFx);
    });

    if ($secWrap.length && !$secWrap.hasClass('open')) {
      if (typeof setAcc === 'function') setAcc($secWrap, true);
    }
  };

  $btnAdd.on('click', e => {
    e.stopPropagation();
    if ($menu) closeMenu();
    else openAddMenu();
  });

  /* ============================================================
     POPOVER PENGATURAN PARAMETER EFEK (DRAGGABLE FIGMA STYLE)
     ============================================================ */
  let $popover = null;
  let activeFxId = null;

  const closePopover = () => {
    if ($popover) {
      $popover.remove();
      $popover = null;
    }
    activeFxId = null;
    $(document).off('pointerdown.fxpop');
    if (ColorPicker.isOpen() && String(ColorPicker.key()).startsWith('fx_')) {
      ColorPicker.close();
    }
  };

  const openSettingsPopover = (fx, anchorEl) => {
    closePopover();
    closeMenu();

    activeFxId = fx.id;
    const meta = EFFECT_META[fx.type] || { label: fx.type };

    let bodyHtml = '';

    if (fx.type === 'DROP_SHADOW' || fx.type === 'INNER_SHADOW') {
      const c = Color.parseHex(fx.color) || Color.parseCss(fx.color) || { r: 0, g: 0, b: 0, a: 1 };
      const hexVal = Color.toHex(c).slice(1);
      const opVal = Math.round((fx.opacity == null ? 0.25 : fx.opacity) * 100);

      bodyHtml = `
      <div class="fx-param-grid">
        <label class="fg-in" title="Offset X">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">X</span>
          <input type="number" id="fx-p-x" value="${fx.x || 0}" step="1">
        </label>
        <label class="fg-in" title="Offset Y">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Y</span>
          <input type="number" id="fx-p-y" value="${fx.y || 4}" step="1">
        </label>
        <label class="fg-in" title="Blur Radius">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Blur</span>
          <input type="number" id="fx-p-blur" value="${fx.blur || 4}" min="0" step="1">
        </label>
        <label class="fg-in" title="Spread Radius">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Spread</span>
          <input type="number" id="fx-p-spread" value="${fx.spread || 0}" step="1">
        </label>
      </div>

      <div class="stroke-field-label">Color & Opacity</div>
      <div class="fx-color-row">
        <input type="color" class="fx-color-swatch" id="fx-p-swatch" value="${Color.toHex(c)}" aria-label="Warna bayangan">
        <div class="fg-color" style="flex:1;">
          <input class="hex" id="fx-p-hex" value="${hexVal}" maxlength="9" spellcheck="false" aria-label="Hex bayangan">
          <input class="op" id="fx-p-op" type="number" min="0" max="100" value="${opVal}" aria-label="Opasitas bayangan (%)">
          <span class="pc">%</span>
        </div>
      </div>`;
    } else if (fx.type === 'LAYER_BLUR' || fx.type === 'BACKGROUND_BLUR') {
      bodyHtml = `
      <div class="stroke-field-group">
        <div class="stroke-field-label">Blur Radius (px)</div>
        <label class="fg-in" style="width:100%;">
          <i class="fa-solid fa-droplet" style="margin-right:4px;"></i>
          <input type="number" id="fx-p-blur" value="${fx.blur || 8}" min="0" max="200" step="1">
        </label>
      </div>`;
    } else if (fx.type === 'NOISE') {
      bodyHtml = `
      <div class="stroke-field-group">
        <div class="stroke-field-label">Noise Amount (%)</div>
        <label class="fg-in" style="width:100%;">
          <i class="fa-solid fa-braille" style="margin-right:4px;"></i>
          <input type="number" id="fx-p-amount" value="${fx.amount || 15}" min="1" max="100" step="1">
        </label>
      </div>
      <div class="stroke-field-group" style="margin-top:10px;">
        <div class="stroke-field-label">Color Mode</div>
        <div class="stroke-btn-group" id="fx-noise-mode">
          <button type="button" class="stroke-btn-opt ${fx.mode !== 'color' ? 'active' : ''}" data-val="monochrome">Monochrome</button>
          <button type="button" class="stroke-btn-opt ${fx.mode === 'color' ? 'active' : ''}" data-val="color">Color</button>
        </div>
      </div>`;
    } else if (fx.type === 'TEXTURE') {
      bodyHtml = `
      <div class="stroke-field-group">
        <div class="stroke-field-label">Texture Pattern</div>
        <select id="fx-p-texture-pattern" class="fg-select" style="width:100%; background:var(--c-input); padding:6px 10px; border-radius:6px;">
          <option value="paper" ${fx.pattern === 'paper' ? 'selected' : ''}>Paper Grain</option>
          <option value="canvas" ${fx.pattern === 'canvas' ? 'selected' : ''}>Canvas Cloth</option>
          <option value="grunge" ${fx.pattern === 'grunge' ? 'selected' : ''}>Grunge Scratches</option>
          <option value="dots" ${fx.pattern === 'dots' ? 'selected' : ''}>Halftone Dots</option>
        </select>
      </div>
      <div class="fx-param-grid" style="margin-top:10px;">
        <label class="fg-in" title="Scale (%)">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Scale</span>
          <input type="number" id="fx-p-scale" value="${fx.scale || 100}" min="20" max="300" step="5">
          <span class="end">%</span>
        </label>
        <label class="fg-in" title="Opacity (%)">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Op</span>
          <input type="number" id="fx-p-op" value="${Math.round((fx.opacity || 0.15) * 100)}" min="0" max="100" step="1">
          <span class="end">%</span>
        </label>
      </div>`;
    } else if (fx.type === 'GLASS') {
      const tintHex = (fx.tint || '#FFFFFF').replace('#', '');
      const opVal = Math.round((fx.opacity == null ? 0.2 : fx.opacity) * 100);

      bodyHtml = `
      <div class="fx-param-grid">
        <label class="fg-in" title="Blur Radius">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Blur</span>
          <input type="number" id="fx-p-blur" value="${fx.blur || 16}" min="0" max="100" step="1">
        </label>
        <label class="fg-in" title="Specular Highlight">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Shine</span>
          <input type="number" id="fx-p-specular" value="${fx.specular || 30}" min="0" max="100" step="1">
          <span class="end">%</span>
        </label>
      </div>
      <div class="stroke-field-label">Glass Tint & Opacity</div>
      <div class="fx-color-row">
        <input type="color" class="fx-color-swatch" id="fx-p-swatch" value="${fx.tint || '#FFFFFF'}" aria-label="Warna kaca">
        <div class="fg-color" style="flex:1;">
          <input class="hex" id="fx-p-hex" value="${tintHex}" maxlength="9" spellcheck="false" aria-label="Hex kaca">
          <input class="op" id="fx-p-op" type="number" min="0" max="100" value="${opVal}" aria-label="Opasitas kaca (%)">
          <span class="pc">%</span>
        </div>
      </div>`;
    } else if (fx.type === 'SHADER') {
      bodyHtml = `
      <div class="stroke-field-group">
        <div class="stroke-field-label">Shader Program (Beta)</div>
        <select id="fx-p-shader-type" class="fg-select" style="width:100%; background:var(--c-input); padding:6px 10px; border-radius:6px;">
          <option value="wave" ${fx.type === 'wave' || !fx.shaderType ? 'selected' : ''}>Sine Wave Warp</option>
          <option value="chromatic" ${fx.shaderType === 'chromatic' ? 'selected' : ''}>Chromatic Aberration</option>
          <option value="vignette" ${fx.shaderType === 'vignette' ? 'selected' : ''}>Radial Vignette</option>
          <option value="duotone" ${fx.shaderType === 'duotone' ? 'selected' : ''}>Duotone Gradient</option>
        </select>
      </div>
      <div class="fx-param-grid" style="margin-top:10px;">
        <label class="fg-in" title="Intensity">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Power</span>
          <input type="number" id="fx-p-intensity" value="${fx.intensity || 20}" min="0" max="100" step="1">
        </label>
        <label class="fg-in" title="Frequency / Speed">
          <span style="font-size:11px; color:var(--c-mute); margin-right:4px;">Speed</span>
          <input type="number" id="fx-p-speed" value="${fx.speed || 1}" min="0.1" max="10" step="0.5">
        </label>
      </div>`;
    }

    const popHtml = `
    <div class="fx-popover" id="fx-settings-popover">
      <div class="fx-popover-head">
        <span>${meta.label} Settings</span>
        <button type="button" class="fx-pop-close" id="fx-pop-close">&times;</button>
      </div>
      ${bodyHtml}
    </div>`;

    $popover = $(popHtml).appendTo('body');

    // Drag header
    const head = $popover.find('.fx-popover-head')[0];
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

    // Initial position
    const btnRect = anchorEl ? anchorEl.getBoundingClientRect() : { left: window.innerWidth - 300, top: 200, height: 30 };
    const popW = 250;
    const popH = $popover.outerHeight() || 240;
    let left = btnRect.left - popW - 10;
    let top = btnRect.top - 20;

    if (left < 10) left = 10;
    if (top + popH > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - popH - 16);
    }
    if (top < 16) top = 16;

    $popover.css({ left, top });

    // Events in popover
    $popover.find('#fx-pop-close').on('click', closePopover);

    const updateActiveEffect = (updater, final = false) => {
      apply(effects => {
        const targetFx = effects.find(item => item.id === activeFxId);
        if (targetFx) updater(targetFx);
      }, final);
    };

    // Binding inputs
    $popover.find('#fx-p-x').on('input change', function () {
      const val = parseFloat(this.value) || 0;
      updateActiveEffect(f => { f.x = val; });
    });
    $popover.find('#fx-p-y').on('input change', function () {
      const val = parseFloat(this.value) || 0;
      updateActiveEffect(f => { f.y = val; });
    });
    $popover.find('#fx-p-blur').on('input change', function () {
      const val = Math.max(0, parseFloat(this.value) || 0);
      updateActiveEffect(f => { f.blur = val; });
    });
    $popover.find('#fx-p-spread').on('input change', function () {
      const val = parseFloat(this.value) || 0;
      updateActiveEffect(f => { f.spread = val; });
    });
    $popover.find('#fx-p-amount').on('input change', function () {
      const val = Math.max(0, Math.min(100, parseFloat(this.value) || 0));
      updateActiveEffect(f => { f.amount = val; });
    });
    $popover.find('#fx-p-scale').on('input change', function () {
      const val = Math.max(10, parseFloat(this.value) || 100);
      updateActiveEffect(f => { f.scale = val; });
    });
    $popover.find('#fx-p-specular').on('input change', function () {
      const val = Math.max(0, Math.min(100, parseFloat(this.value) || 0));
      updateActiveEffect(f => { f.specular = val; });
    });
    $popover.find('#fx-p-intensity').on('input change', function () {
      const val = Math.max(0, parseFloat(this.value) || 0);
      updateActiveEffect(f => { f.intensity = val; });
    });
    $popover.find('#fx-p-speed').on('input change', function () {
      const val = parseFloat(this.value) || 1;
      updateActiveEffect(f => { f.speed = val; });
    });
    $popover.find('#fx-p-texture-pattern').on('change', function () {
      const val = this.value;
      updateActiveEffect(f => { f.pattern = val; });
    });
    $popover.find('#fx-p-shader-type').on('change', function () {
      const val = this.value;
      updateActiveEffect(f => { f.shaderType = val; });
    });

    $popover.find('#fx-noise-mode .stroke-btn-opt').on('click', function () {
      $popover.find('#fx-noise-mode .stroke-btn-opt').removeClass('active');
      $(this).addClass('active');
      const val = $(this).data('val');
      updateActiveEffect(f => { f.mode = val; });
    });

    // Color & Opacity
    $popover.find('#fx-p-swatch').on('click', function (e) {
      e.preventDefault();
      const currentFx = targets()[0] && effectsOf(targets()[0].obj.style).find(item => item.id === activeFxId);
      if (!currentFx) return;

      const baseColor = currentFx.color || currentFx.tint || '#000000';
      const baseOp = currentFx.opacity == null ? 0.25 : currentFx.opacity;

      ColorPicker.open({
        key: 'fx_' + activeFxId,
        anchor: this,
        paint: Paint.solid(baseColor, baseOp),
        onChange: (np, final) => {
          if (np.type === 'SOLID') {
            const hex = np.color;
            const op = np.opacity == null ? 1 : np.opacity;
            $popover.find('#fx-p-swatch').val(hex);
            $popover.find('#fx-p-hex').val(hex.replace('#', ''));
            $popover.find('#fx-p-op').val(Math.round(op * 100));

            updateActiveEffect(f => {
              if (f.color !== undefined) f.color = hex;
              if (f.tint !== undefined) f.tint = hex;
              f.opacity = op;
            });
          }
        }
      });
    });

    $popover.find('#fx-p-hex').on('change', function () {
      const c = Color.parseHex(this.value.trim().replace('#', ''));
      if (c) {
        const hex = Color.toHex(c);
        $popover.find('#fx-p-swatch').val(hex);
        updateActiveEffect(f => {
          if (f.color !== undefined) f.color = hex;
          if (f.tint !== undefined) f.tint = hex;
        });
      }
    });

    $popover.find('#fx-p-op').on('change', function () {
      const val = Math.max(0, Math.min(100, parseFloat(this.value) || 0)) / 100;
      updateActiveEffect(f => {
        f.opacity = val;
      });
    });

    setTimeout(() => {
      $(document).on('pointerdown.fxpop', e => {
        if (!$(e.target).closest('#fx-settings-popover, .fx-actions, .mv-cp').length) {
          closePopover();
        }
      });
    }, 10);
  };

  // Actions baris efek
  $list.on('click', '[data-act="fx-edit"], [data-act="fx-settings"]', function (e) {
    e.stopPropagation();
    const i = rowIndex(this);
    const m = model();
    if (!m) return;
    const fx = m.effects[m.effects.length - 1 - i];
    if (fx) openSettingsPopover(fx, this);
  });

  $list.on('click', '[data-act="fx-eye"]', function (e) {
    e.stopPropagation();
    const i = rowIndex(this);
    apply(effects => {
      const fx = effects[effects.length - 1 - i];
      if (fx) fx.visible = fx.visible === false;
    });
  });

  $list.on('click', '[data-act="fx-del"]', function (e) {
    e.stopPropagation();
    const i = rowIndex(this);
    closePopover();
    apply(effects => {
      effects.splice(effects.length - 1 - i, 1);
    });
  });

  // Global listeners
  $(document).on('selection:change project:load object:add object:change object:remove', () => {
    refresh();
  });

  $(document).on('selection:change project:load object:remove', () => {
    closePopover();
    closeMenu();
  });

  window.EffectsDesign = {
    refresh,
    effectsOf,
    ensureEffects
  };
})();
