/* ================= DESIGN: COLOR PICKER (panel warna mengambang) ================= */
// Komponen mandiri, dipakai fill.js (nanti juga stroke). Bergantung pada: colors.js (Color), jQuery.
// ColorPicker.open({ key, anchor, color, opacity, background, onChange(paint, final), onClose })
//   color = '#RRGGBB' · opacity 0-1 · background = warna latar (kontras) · final=false saat masih di-drag
// ColorPicker.close() · isOpen() · key()
// Tahap ini: mode Solid. Gradient / Pattern / Image menyusul (ikonnya sudah ada, dinonaktifkan).
// Eyedropper: EyeDropper API bila ada, jika tidak mengambil warna dari canvas (cvEl, cvCtx).
const ColorPicker = (() => {
  const clamp = Color.clamp;
  const FMT_KEY = 'minivector:colorFormat';
  const FORMATS = [['hex', 'Hex'], ['rgb', 'RGB'], ['css', 'CSS'], ['hsl', 'HSL'], ['hsb', 'HSB']];
  const FIELDS = {
    hex: [['hex', 'Hex']],
    rgb: [['r', 'R'], ['g', 'G'], ['b', 'B']],
    css: [['css', 'CSS']],
    hsl: [['h', 'H'], ['s', 'S'], ['l', 'L']],
    hsb: [['h', 'H'], ['s', 'S'], ['b', 'B']]
  };
  let fmt = 'hex';
  try {
    const f = localStorage.getItem(FMT_KEY);
    if (FIELDS[f]) fmt = f;
  } catch (e) {}

  let $el = null,
    opts = null,
    st = { h: 0, s: 0, v: 0.85, a: 1 }, // HSV + alpha: sumber kebenaran picker
    bg = { r: 30, g: 30, b: 30 },
    drawnHue = null,
    picking = false;
  let $area, $cv, $thumb, $hue, $alpha, $aGrad, $fmt, $fields, $pct, $ratio, $badge, $eye;

  const CSS = `
.mv-cp{position:fixed;z-index:9998;width:280px;background:#2b2b2b;color:#d1d1d1;border:1px solid #3e3e3e;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.5);font:13px/1.2 system-ui,sans-serif;user-select:none}
.mv-cp[hidden]{display:none}
.mv-cp button,.mv-cp select,.mv-cp input{font:inherit;color:inherit}
.mv-cp-head{display:flex;align-items:center;justify-content:space-between;padding:8px 8px 8px 12px;border-bottom:1px solid #3e3e3e;cursor:grab;touch-action:none}
.mv-cp-head:active{cursor:grabbing}
.mv-cp-title{font-weight:600;color:#fff}
.mv-cp-x{background:transparent;border:0;cursor:pointer;color:#9a9a9a;width:26px;height:26px;border-radius:6px}
.mv-cp-x:hover{color:#fff;background:#3a3a3a}
.mv-cp-modes{display:flex;justify-content:space-between;padding:10px 14px 4px}
.mv-cp-mode{background:transparent;border:0;border-radius:6px;width:30px;height:28px;color:#9a9a9a;cursor:pointer}
.mv-cp-mode.on{background:#3b4b68;color:#8cb4ff}
.mv-cp-mode:disabled{opacity:.35;cursor:not-allowed}
.mv-cp-meta{display:flex;justify-content:space-between;align-items:center;padding:6px 16px;font-size:12px;font-weight:600}
.mv-cp-badge{color:#fff}
.mv-cp-badge.fail{color:#ff8a80}
.mv-cp-area{position:relative;margin:4px 16px 12px;height:180px;border-radius:6px;overflow:hidden;outline:none;touch-action:none;cursor:crosshair}
.mv-cp-area:focus-visible{box-shadow:0 0 0 2px #0d99ff}
.mv-cp-area canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.mv-cp-thumb{position:absolute;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.4);transform:translate(-50%,-50%);pointer-events:none}
.mv-cp-sliders{display:flex;align-items:center;gap:12px;padding:0 16px 12px}
.mv-cp-eye{background:transparent;border:0;cursor:pointer;color:#9a9a9a;width:24px;height:24px;border-radius:6px;flex:none}
.mv-cp-eye:hover,.mv-cp-eye[aria-pressed="true"]{color:#fff;background:#3a3a3a}
.mv-cp-tracks{flex:1;display:flex;flex-direction:column;gap:12px}
.mv-cp input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:10px;margin:0;background:transparent;outline:none;display:block}
.mv-cp input[type=range]::-webkit-slider-runnable-track{height:10px;border-radius:5px;background:var(--trk,transparent)}
.mv-cp input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-3px;border-radius:50%;border:3px solid #fff;background:var(--thumb,transparent);box-shadow:0 0 0 1px rgba(0,0,0,.25),0 2px 4px rgba(0,0,0,.3);cursor:pointer}
.mv-cp input[type=range]::-moz-range-track{height:10px;border-radius:5px;background:var(--trk,transparent)}
.mv-cp input[type=range]::-moz-range-thumb{width:10px;height:10px;border-radius:50%;border:3px solid #fff;background:var(--thumb,transparent);box-shadow:0 0 0 1px rgba(0,0,0,.25),0 2px 4px rgba(0,0,0,.3);cursor:pointer}
.mv-cp input[type=range]:focus-visible{box-shadow:0 0 0 2px #0d99ff;border-radius:5px}
.mv-cp-hue{--trk:linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)}
.mv-cp-checker{position:relative;height:10px;border-radius:5px;background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0}
.mv-cp-agrad{position:absolute;inset:0;border-radius:5px}
.mv-cp-checker input{position:absolute;inset:0}
.mv-cp-inputs{display:flex;align-items:center;gap:8px;padding:0 16px 14px}
.mv-cp-fmt{background:#1e1e1e;border:1px solid #3e3e3e;border-radius:6px;padding:6px 4px;cursor:pointer;width:62px;flex:none}
.mv-cp-fields{flex:1;display:flex;gap:4px;min-width:0}
.mv-cp-f{flex:1;min-width:0;width:100%;background:#1e1e1e;border:1px solid #3e3e3e;border-radius:6px;padding:6px 4px;text-align:center;outline:none;font-family:ui-monospace,monospace}
.mv-cp-f:focus,.mv-cp-fmt:focus,.mv-cp-pct input:focus{border-color:#0d99ff}
.mv-cp-pct{display:flex;align-items:center;gap:2px;background:#1e1e1e;border:1px solid #3e3e3e;border-radius:6px;padding:0 6px;width:62px;flex:none}
.mv-cp-pct input{width:100%;min-width:0;background:transparent;border:0;outline:none;text-align:center;padding:6px 0}
.mv-cp-pct span{color:#9a9a9a}
.mv-cp input[type=number]::-webkit-inner-spin-button{display:none}
`;

  const build = () => {
    if ($el) return;
    $('<style>').text(CSS).appendTo('head');
    $el = $(`
<div class="mv-cp" role="dialog" aria-label="Pemilih warna" hidden>
  <div class="mv-cp-head"><span class="mv-cp-title">Custom</span><button type="button" class="mv-cp-x" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div>
  <div class="mv-cp-modes">
    <button type="button" class="mv-cp-mode on" data-mode="solid" title="Solid" aria-pressed="true"><i class="fa-regular fa-square"></i></button>
    <button type="button" class="mv-cp-mode" data-mode="gradient" title="Gradient (segera)" disabled><i class="fa-solid fa-border-all"></i></button>
    <button type="button" class="mv-cp-mode" data-mode="pattern" title="Pattern (segera)" disabled><i class="fa-solid fa-film"></i></button>
    <button type="button" class="mv-cp-mode" data-mode="image" title="Image (segera)" disabled><i class="fa-regular fa-image"></i></button>
  </div>
  <div class="mv-cp-meta"><span class="mv-cp-ratio" title="Kontras terhadap latar"></span><span class="mv-cp-badge"></span></div>
  <div class="mv-cp-area" tabindex="0" role="application" aria-label="Area saturasi dan kecerahan. Gunakan tombol panah.">
    <canvas></canvas><div class="mv-cp-thumb"></div>
  </div>
  <div class="mv-cp-sliders">
    <button type="button" class="mv-cp-eye" title="Eyedropper" aria-label="Eyedropper" aria-pressed="false"><i class="fa-solid fa-eye-dropper"></i></button>
    <div class="mv-cp-tracks">
      <input type="range" class="mv-cp-hue" min="0" max="360" step="1" value="0" aria-label="Hue">
      <div class="mv-cp-checker"><div class="mv-cp-agrad"></div><input type="range" class="mv-cp-alpha" min="0" max="100" step="1" value="100" aria-label="Opasitas"></div>
    </div>
  </div>
  <div class="mv-cp-inputs">
    <select class="mv-cp-fmt" aria-label="Format warna">${FORMATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <div class="mv-cp-fields"></div>
    <label class="mv-cp-pct"><input type="number" min="0" max="100" step="1" value="100" aria-label="Opasitas (%)"><span>%</span></label>
  </div>
</div>`).appendTo('body');
    $area = $el.find('.mv-cp-area');
    $cv = $area.find('canvas');
    $thumb = $area.find('.mv-cp-thumb');
    $hue = $el.find('.mv-cp-hue');
    $alpha = $el.find('.mv-cp-alpha');
    $aGrad = $el.find('.mv-cp-agrad');
    $fmt = $el.find('.mv-cp-fmt').val(fmt);
    $fields = $el.find('.mv-cp-fields');
    $pct = $el.find('.mv-cp-pct input');
    $ratio = $el.find('.mv-cp-ratio');
    $badge = $el.find('.mv-cp-badge');
    $eye = $el.find('.mv-cp-eye');
    bind();
  };

  /* ---------- state ↔ tampilan ---------- */
  const rgbNow = () => Color.hsvToRgb(st.h, st.s, st.v);
  const emit = final => {
    if (opts && opts.onChange) opts.onChange({ color: Color.toHex(rgbNow()), opacity: st.a }, final);
  };
  const setRgb = (rgb, hue) => { // warna abu-abu / hitam tidak punya hue: pertahankan hue sebelumnya
    const v = Color.rgbToHsv(rgb);
    st.s = v.s;
    st.v = v.v;
    st.h = hue != null ? hue : (v.s > 0 && v.v > 0 ? v.h : st.h);
  };
  const drawArea = () => {
    const cv = $cv[0],
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      w = $area.width(),
      h = $area.height();
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = `hsl(${st.h}, 100%, 50%)`;
    g.fillRect(0, 0, w, h);
    let gr = g.createLinearGradient(0, 0, w, 0); // putih → transparan: saturasi
    gr.addColorStop(0, '#fff');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    gr = g.createLinearGradient(0, h, 0, 0); // hitam → transparan: kecerahan
    gr.addColorStop(0, '#000');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    drawnHue = st.h;
  };
  const fieldValues = () => {
    const rgb = rgbNow(),
      R = Math.round(rgb.r),
      G = Math.round(rgb.g),
      B = Math.round(rgb.b);
    if (fmt === 'hex') return { hex: Color.toHex(rgb).slice(1) };
    if (fmt === 'rgb') return { r: R, g: G, b: B };
    if (fmt === 'css') return { css: Color.toCss({ r: R, g: G, b: B, a: st.a }) };
    if (fmt === 'hsl') {
      const l = Color.rgbToHsl(rgb);
      return { h: Math.round(st.h), s: Math.round(l.s * 100), l: Math.round(l.l * 100) };
    }
    return { h: Math.round(st.h), s: Math.round(st.s * 100), b: Math.round(st.v * 100) };
  };
  const buildFields = () => {
    const text = fmt === 'hex' || fmt === 'css';
    $fields.html(FIELDS[fmt].map(([k, l]) =>
      `<input class="mv-cp-f" data-k="${k}" type="${text ? 'text' : 'number'}" ${text ? 'spellcheck="false" maxlength="40"' : 'step="1"'} aria-label="${l}">`).join(''));
  };
  const showFields = force => {
    const v = fieldValues();
    $fields.find('.mv-cp-f').each(function() {
      if (force || document.activeElement !== this) this.value = v[this.dataset.k];
    });
    if (force || document.activeElement !== $pct[0]) $pct.val(Math.round(st.a * 100));
  };
  const showContrast = () => {
    const ratio = Color.contrast(Color.blend(rgbNow(), st.a, bg), bg),
      pass = ratio >= 4.5;
    $ratio.text(ratio.toFixed(2) + ' : 1');
    $badge.toggleClass('fail', !pass).html(`<i class="fa-solid ${pass ? 'fa-check' : 'fa-xmark'}"></i> ${ratio >= 7 ? 'AAA' : pass ? 'AA' : 'Gagal'}`);
  };
  const sync = force => {
    const rgb = rgbNow(),
      hex = Color.toHex(rgb);
    if (drawnHue !== st.h) drawArea();
    $thumb.css({ left: st.s * 100 + '%', top: (1 - st.v) * 100 + '%', background: hex });
    $hue.val(Math.round(st.h));
    $hue[0].style.setProperty('--thumb', `hsl(${st.h}, 100%, 50%)`);
    $alpha.val(Math.round(st.a * 100));
    $alpha[0].style.setProperty('--thumb', hex);
    $aGrad.css('background', `linear-gradient(to right, rgba(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)},0), ${hex})`);
    showFields(force);
    showContrast();
  };

  /* ---------- input dari pengguna ---------- */
  const applyFields = () => {
    const get = k => $fields.find(`[data-k="${k}"]`).val(),
      num = k => parseFloat(get(k));
    let ok = true;
    if (fmt === 'hex') {
      const raw = String(get('hex')).trim().replace('#', ''),
        c = Color.parseHex(raw);
      if (c) {
        setRgb(c);
        if (raw.length === 4 || raw.length === 8) st.a = c.a;
      } else ok = false;
    } else if (fmt === 'css') {
      const c = Color.parseCss(get('css'));
      if (c) {
        setRgb(c);
        st.a = c.a;
      } else ok = false;
    } else if (fmt === 'rgb') {
      const r = num('r'),
        g = num('g'),
        b = num('b');
      if ([r, g, b].every(isFinite)) setRgb({ r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) });
      else ok = false;
    } else if (fmt === 'hsl') {
      const h = num('h'),
        s = num('s'),
        l = num('l');
      if ([h, s, l].every(isFinite)) setRgb(Color.hslToRgb(h, clamp(s, 0, 100) / 100, clamp(l, 0, 100) / 100), ((h % 360) + 360) % 360);
      else ok = false;
    } else {
      const h = num('h'),
        s = num('s'),
        b = num('b');
      if ([h, s, b].every(isFinite)) {
        st.h = ((h % 360) + 360) % 360;
        st.s = clamp(s, 0, 100) / 100;
        st.v = clamp(b, 0, 100) / 100;
      } else ok = false;
    }
    sync(true); // nilai tidak valid → kolom kembali ke warna sekarang
    if (ok) emit(true);
  };
  const fromArea = e => {
    const r = $area[0].getBoundingClientRect();
    st.s = clamp((e.clientX - r.left) / r.width, 0, 1);
    st.v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
  };
  const workspaceBg = () => {
    const ws = document.getElementById('workspace'),
      c = ws && Color.parseCss(getComputedStyle(ws).backgroundColor);
    return c && c.a > 0 ? c : { r: 30, g: 30, b: 30, a: 1 }; // tema gelap bila tidak terbaca
  };

  /* ---------- eyedropper ---------- */
  const stopCanvasPick = () => {
    picking = false;
    $eye.attr('aria-pressed', 'false');
    window.removeEventListener('pointerdown', onPickDown, true);
    if (typeof cvEl !== 'undefined') cvEl.style.cursor = '';
  };
  const takeColor = rgb => {
    setRgb(rgb);
    st.a = 1;
    sync(true);
    emit(true);
  };
  function onPickDown(e) { // mengambil warna piksel canvas di bawah kursor
    stopCanvasPick();
    const r = cvEl.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    e.stopPropagation();
    e.preventDefault(); // jangan sampai ikut memilih / menggeser objek
    const sx = cvEl.width / r.width,
      sy = cvEl.height / r.height;
    const d = cvCtx.getImageData(Math.min(cvEl.width - 1, Math.floor((e.clientX - r.left) * sx)), Math.min(cvEl.height - 1, Math.floor((e.clientY - r.top) * sy)), 1, 1).data;
    const a = d[3] / 255,
      back = workspaceBg();
    takeColor(a ? Color.blend({ r: d[0], g: d[1], b: d[2] }, a, back) : back); // hasil akhir = warna yang terlihat
  }
  const pickColor = () => {
    if (picking) return stopCanvasPick();
    if (window.EyeDropper) {
      new window.EyeDropper().open().then(r => {
        const c = Color.parseHex(r.sRGBHex);
        if (c && opts) takeColor(c);
      }).catch(() => {});
      return;
    }
    picking = true;
    $eye.attr('aria-pressed', 'true');
    cvEl.style.cursor = 'crosshair';
    window.addEventListener('pointerdown', onPickDown, true);
  };

  /* ---------- posisi, seret, tutup ---------- */
  const place = anchor => {
    const w = $el.outerWidth(),
      h = $el.outerHeight(),
      a = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth - 40, top: 80, right: window.innerWidth - 40 };
    const host = anchor && anchor.closest('#view-design') ? anchor.closest('#view-design').getBoundingClientRect() : a;
    let x = host.left - w - 12; // di kiri panel kanan, seperti Figma
    if (x < 8) x = clamp(a.left - w - 8, 8, window.innerWidth - w - 8);
    $el.css({ left: x, top: clamp(a.top - 40, 8, Math.max(8, window.innerHeight - h - 8)) });
  };
  const close = () => {
    if (!$el || $el.prop('hidden')) return;
    stopCanvasPick();
    $el.prop('hidden', true);
    const cb = opts && opts.onClose;
    opts = null;
    if (cb) cb();
  };
  const open = o => {
    build();
    opts = o;
    const c = Color.parseCss(o.color) || { r: 217, g: 217, b: 217, a: 1 };
    setRgb(c);
    st.a = o.opacity == null ? 1 : clamp(o.opacity, 0, 1);
    const b = Color.parseCss(o.background);
    bg = b || workspaceBg();
    stopCanvasPick();
    $el.prop('hidden', false);
    buildFields();
    drawnHue = null;
    place(o.anchor);
    sync(true);
    $area[0].focus({ preventScroll: true });
  };

  function bind() {
    const area = $area[0],
      head = $el.find('.mv-cp-head')[0];
    // area saturasi / kecerahan (pointer + keyboard)
    let dragId = null;
    area.addEventListener('pointerdown', e => {
      if (e.button) return;
      e.preventDefault();
      area.setPointerCapture(e.pointerId);
      area.focus({ preventScroll: true });
      dragId = e.pointerId;
      fromArea(e);
      sync();
      emit(false);
    });
    area.addEventListener('pointermove', e => {
      if (dragId !== e.pointerId) return;
      fromArea(e);
      sync();
      emit(false);
    });
    const endArea = e => {
      if (dragId !== e.pointerId) return;
      dragId = null;
      emit(true);
    };
    area.addEventListener('pointerup', endArea);
    area.addEventListener('pointercancel', endArea);
    area.addEventListener('keydown', e => {
      const step = e.shiftKey ? 0.1 : 0.01,
        k = e.key;
      if (k === 'ArrowLeft') st.s = clamp(st.s - step, 0, 1);
      else if (k === 'ArrowRight') st.s = clamp(st.s + step, 0, 1);
      else if (k === 'ArrowUp') st.v = clamp(st.v + step, 0, 1);
      else if (k === 'ArrowDown') st.v = clamp(st.v - step, 0, 1);
      else return;
      e.preventDefault();
      sync();
      emit(true);
    });
    // slider hue & opacity
    $hue.on('input', function() {
      st.h = (+this.value) % 360;
      sync();
      emit(false);
    }).on('change', () => emit(true));
    $alpha.on('input', function() {
      st.a = clamp(+this.value, 0, 100) / 100;
      sync();
      emit(false);
    }).on('change', () => emit(true));
    // kolom nilai, format, opasitas %
    $fields.on('change', '.mv-cp-f', applyFields);
    $fields.on('keydown', '.mv-cp-f', function(e) {
      if (e.key === 'Enter') this.blur();
    });
    $fmt.on('change', function() {
      fmt = this.value;
      try {
        localStorage.setItem(FMT_KEY, fmt);
      } catch (e) {}
      buildFields();
      sync(true);
    });
    $pct.on('change', function() {
      const v = parseFloat(this.value);
      if (isFinite(v)) {
        st.a = clamp(v, 0, 100) / 100;
        sync(true);
        emit(true);
      } else sync(true);
    });
    $eye.on('click', pickColor);
    $el.find('.mv-cp-x').on('click', close);
    // seret panel lewat header
    let mv = null;
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.button) return;
      const r = $el[0].getBoundingClientRect();
      mv = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
      if (!mv || mv.id !== e.pointerId) return;
      $el.css({
        left: clamp(e.clientX - mv.dx, 0, window.innerWidth - $el.outerWidth()),
        top: clamp(e.clientY - mv.dy, 0, window.innerHeight - 40)
      });
    });
    const endMove = e => {
      if (mv && mv.id === e.pointerId) mv = null;
    };
    head.addEventListener('pointerup', endMove);
    head.addEventListener('pointercancel', endMove);
    // tombol di dalam panel tidak boleh memicu shortcut aplikasi (V, R, Delete, Backspace, ...)
    $el[0].addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        picking ? stopCanvasPick() : close();
        return;
      }
      if (e.key !== 'Tab') e.stopPropagation();
    });
    window.addEventListener('resize', () => {
      if (opts) place(opts.anchor);
    });
  }
  // Esc di luar panel: tutup picker saja (jangan ikut mengganti tool). Klik di luar panel: tutup.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !opts) return;
    e.stopPropagation();
    picking ? stopCanvasPick() : close();
  }, true);
  document.addEventListener('pointerdown', e => {
    if (!opts || picking || !$el) return;
    if ($el[0].contains(e.target) || (opts.anchor && opts.anchor.contains(e.target))) return;
    close();
  }, true);

  return { open, close, isOpen: () => !!opts, key: () => (opts ? opts.key : null) };
})();