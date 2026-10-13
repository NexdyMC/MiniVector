/* ================= DESIGN: COLOR PICKER (panel warna mengambang) ================= */
// Komponen mandiri, dipakai fill.js (nanti juga stroke). Bergantung pada: colors.js (Color), paint.js (Paint), jQuery.
// ColorPicker.open({ key, anchor, paint, background, onChange(paint, final), onClose })
//   paint = fill SOLID atau GRADIENT_* (lihat StructureJSON.md bagian 6); onChange menerima salinan paint utuh
//   background = warna latar untuk kontras · final=false saat masih di-drag (belum perlu disimpan)
// Kompatibel lama: open({ color, opacity, ... }) = paint SOLID.
// ColorPicker.close() · isOpen() · key()
// Mode: Solid dan Gradient (linear, radial, angular). Pattern / Image menyusul (ikonnya dinonaktifkan).
// Di mode Gradient, area warna / slider / kolom nilai mengedit stop yang sedang dipilih.
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
    P = null, // salinan kerja paint yang sedang diedit
    sel = null, // gradient: stop yang sedang dipilih (referensi objek di P.stops)
    hdrag = null, // seret handle stop: { id, stop }
    st = { h: 0, s: 0, v: 0.85, a: 1 }, // HSV + alpha dari warna target (paint SOLID atau stop terpilih)
    bg = { r: 30, g: 30, b: 30 },
    drawnHue = null,
    picking = false;
  let $area, $cv, $thumb, $hue, $alpha, $aGrad, $fmt, $fields, $pct, $ratio, $badge, $eye, $grad, $meta, $gtype, $bar, $barBg, $handles, $geo, $slist;

  const CSS = `
.mv-cp{max-height:calc(100vh - 16px);overflow-y:auto;position:fixed;z-index:9998;width:280px;background:#2b2b2b;color:#d1d1d1;border:1px solid #3e3e3e;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.5);font:13px/1.2 system-ui,sans-serif;user-select:none}
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
.mv-cp.gm .mv-cp-area{height:140px}
.mv-cp-grad{padding:4px 16px 8px}
.mv-cp-grad[hidden]{display:none}
.mv-cp-grow{display:flex;align-items:center;gap:6px;margin-bottom:12px}
.mv-cp-gtype{flex:1;min-width:0;background:#1e1e1e;border:1px solid #3e3e3e;border-radius:6px;padding:6px 6px;cursor:pointer}
.mv-cp-ib{background:transparent;border:0;border-radius:6px;width:28px;height:28px;color:#9a9a9a;cursor:pointer;flex:none}
.mv-cp-ib:hover{color:#fff;background:#3a3a3a}
.mv-cp-ib:disabled{opacity:.35;cursor:not-allowed}
.mv-cp-bar{position:relative;height:28px;margin:0 8px 12px;border-radius:5px;cursor:copy;touch-action:none;background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0}
.mv-cp-barbg{position:absolute;inset:0;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.mv-cp-handles{position:absolute;inset:0}
.mv-cp-h{position:absolute;top:-4px;width:16px;height:36px;margin-left:-8px;padding:0;border:2px solid #fff;border-radius:5px;background:transparent;cursor:grab;touch-action:none;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 2px 4px rgba(0,0,0,.4)}
.mv-cp-h span{position:absolute;inset:0;border-radius:3px;pointer-events:none}
.mv-cp-h.on{border-color:#0d99ff;z-index:2}
.mv-cp-h:focus-visible{outline:2px solid #0d99ff;outline-offset:2px}
.mv-cp-geo{display:flex;gap:6px;margin-bottom:12px}
.mv-cp-geo:empty{display:none}
.mv-cp-g{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;font-size:11px;color:#9a9a9a}
.mv-cp-g input{width:100%;min-width:0;background:#1e1e1e;border:1px solid #3e3e3e;border-radius:6px;padding:5px 2px;text-align:center;outline:none}
.mv-cp-g input:focus{border-color:#0d99ff}
.mv-cp-sh{display:flex;align-items:center;justify-content:space-between;font-weight:600;color:#fff;margin-bottom:4px}
.mv-cp-slist{display:flex;flex-direction:column;gap:4px;max-height:132px;overflow-y:auto}
.mv-cp-sr{display:flex;align-items:center;gap:4px;padding:3px;border-radius:6px;border:1px solid transparent}
.mv-cp-sr.on{background:#2f3f5c;border-color:#3b4b68}
.mv-cp-sr input{min-width:0;background:#1e1e1e;border:1px solid #3e3e3e;border-radius:5px;padding:5px 2px;text-align:center;outline:none}
.mv-cp-sr input:focus{border-color:#0d99ff}
.mv-cp-spos{width:44px}.mv-cp-shex{flex:1;font-family:ui-monospace,monospace}.mv-cp-sop{width:40px}
.mv-cp-ssw{width:18px;height:18px;border-radius:4px;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.25);cursor:pointer}
.mv-cp-sr .pc{color:#9a9a9a;font-size:11px}
`;

  const build = () => {
    if ($el) return;
    $('<style>').text(CSS).appendTo('head');
    $el = $(`
<div class="mv-cp" role="dialog" aria-label="Pemilih warna" hidden>
  <div class="mv-cp-head"><span class="mv-cp-title">Custom</span><button type="button" class="mv-cp-x" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div>
  <div class="mv-cp-modes">
    <button type="button" class="mv-cp-mode on" data-mode="solid" title="Solid" aria-pressed="true"><i class="fa-regular fa-square"></i></button>
    <button type="button" class="mv-cp-mode" data-mode="gradient" title="Gradient" aria-pressed="false"><i class="fa-solid fa-border-all"></i></button>
    <button type="button" class="mv-cp-mode" data-mode="pattern" title="Pattern (segera)" disabled><i class="fa-solid fa-film"></i></button>
    <button type="button" class="mv-cp-mode" data-mode="image" title="Image (segera)" disabled><i class="fa-regular fa-image"></i></button>
  </div>
  <div class="mv-cp-grad" hidden>
    <div class="mv-cp-grow">
      <select class="mv-cp-gtype" aria-label="Jenis gradient"><option value="GRADIENT_LINEAR">Linear</option><option value="GRADIENT_RADIAL">Radial</option><option value="GRADIENT_ANGULAR">Angular</option><option disabled>Diamond (segera)</option></select>
      <button type="button" class="mv-cp-ib mv-cp-rev" title="Balik arah warna" aria-label="Balik arah warna"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
      <button type="button" class="mv-cp-ib mv-cp-rot" title="Putar 90°" aria-label="Putar 90 derajat"><i class="fa-solid fa-rotate-right"></i></button>
    </div>
    <div class="mv-cp-bar" title="Klik untuk menambah stop"><div class="mv-cp-barbg"></div><div class="mv-cp-handles"></div></div>
    <div class="mv-cp-geo"></div>
    <div class="mv-cp-sh"><span>Stops</span><button type="button" class="mv-cp-ib mv-cp-sadd" title="Tambah stop" aria-label="Tambah stop"><i class="fa-solid fa-plus"></i></button></div>
    <div class="mv-cp-slist"></div>
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
    $grad = $el.find('.mv-cp-grad');
    $meta = $el.find('.mv-cp-meta');
    $gtype = $el.find('.mv-cp-gtype');
    $bar = $el.find('.mv-cp-bar');
    $barBg = $el.find('.mv-cp-barbg');
    $handles = $el.find('.mv-cp-handles');
    $geo = $el.find('.mv-cp-geo');
    $slist = $el.find('.mv-cp-slist');
    bind();
  };

  /* ---------- state ↔ tampilan ---------- */
  const rgbNow = () => Color.hsvToRgb(st.h, st.s, st.v);
  const clone = o => JSON.parse(JSON.stringify(o));
  const isGrad = () => Paint.isGradient(P);
  const target = () => (isGrad() ? sel : P); // yang warnanya sedang diedit area / slider / kolom nilai
  const loadTarget = () => {
    const t = target(),
      c = Color.parseCss(t.color) || { r: 217, g: 217, b: 217, a: 1 };
    setRgb(c);
    st.a = t.opacity == null ? 1 : clamp(t.opacity, 0, 1);
  };
  const commitTarget = () => {
    const t = target();
    t.color = Color.toHex(rgbNow());
    t.opacity = st.a;
  };
  const emit = final => { // kirim salinan paint utuh
    if (opts && opts.onChange) opts.onChange(clone(P), final);
  };
  const emitColor = final => { // perubahan warna dari area / slider / kolom nilai
    commitTarget();
    emit(final);
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
    if (!isGrad()) showContrast();
    else {
      refreshStopViews(force);
      refreshGeo(force);
    }
  };

  /* ---------- mode & gradient ---------- */
  const r3 = n => Math.round(n * 1000) / 1000;
  const fmt2 = n => String(Math.round(n * 100) / 100);
  const normalizeStops = () => P.stops.sort((a, b) => a.offset - b.offset);
  const showMode = () => {
    $el.find('.mv-cp-mode[data-mode="solid"]').toggleClass('on', !isGrad()).attr('aria-pressed', String(!isGrad()));
    $el.find('.mv-cp-mode[data-mode="gradient"]').toggleClass('on', isGrad()).attr('aria-pressed', String(isGrad()));
    $grad.prop('hidden', !isGrad());
    $meta.prop('hidden', isGrad()); // kontras hanya untuk warna polos
    $el.toggleClass('gm', isGrad()); // mode gradient: area warna dipendekkan agar panel muat di layar
    drawnHue = null; // area berubah ukuran → gambar ulang
  };
  const stopHex = s => Color.toHex(Color.parseCss(s.color) || { r: 0, g: 0, b: 0 });
  const geoDefs = () => {
    const c = P.center || { x: 0.5, y: 0.5 };
    if (P.type === 'GRADIENT_LINEAR') return [['angle', 'Sudut °', Paint.linearAngle(P)]];
    if (P.type === 'GRADIENT_RADIAL') return [['cx', 'X %', c.x * 100], ['cy', 'Y %', c.y * 100], ['rx', 'Rx %', (P.radius || { rx: 0.5 }).rx * 100], ['ry', 'Ry %', (P.radius || { ry: 0.5 }).ry * 100]];
    return [['cx', 'X %', c.x * 100], ['cy', 'Y %', c.y * 100], ['sa', 'Sudut °', P.startAngle || 0]];
  };
  const renderGeo = () => {
    $geo.html(geoDefs().map(([k, l, v]) => `<label class="mv-cp-g"><span>${l}</span><input type="number" step="any" data-k="${k}" value="${fmt2(v)}" aria-label="${l}"></label>`).join(''));
  };
  const refreshGeo = force => {
    const defs = geoDefs();
    if ($geo.children().length !== defs.length) return renderGeo();
    defs.forEach(([k, , v]) => {
      const el = $geo.find(`[data-k="${k}"]`)[0];
      if (el && (force || document.activeElement !== el)) el.value = fmt2(v);
    });
  };
  const barCss = () => `linear-gradient(to right, ${Paint.sortedStops(P).map(s => `${Paint.stopCss(s, 1)} ${+(s.offset * 100).toFixed(2)}%`).join(', ')})`;
  const renderGradAll = () => { // bangun ulang handle + daftar stop + kolom geometri (saat jumlah / urutan stop atau tipe berubah)
    $gtype.val(P.type);
    $handles.html(P.stops.map((s, i) => `<button type="button" class="mv-cp-h" data-i="${i}" aria-label="Stop"><span></span></button>`).join(''));
    $slist.html(P.stops.map((s, i) => `<div class="mv-cp-sr" data-i="${i}"><input class="mv-cp-spos" type="number" step="any" aria-label="Posisi stop (%)"><span class="pc">%</span><span class="mv-cp-ssw" title="Pilih stop"></span><input class="mv-cp-shex" type="text" maxlength="9" spellcheck="false" aria-label="Warna stop (hex)"><input class="mv-cp-sop" type="number" min="0" max="100" aria-label="Opasitas stop (%)"><span class="pc">%</span><button type="button" class="mv-cp-ib mv-cp-sdel" title="Hapus stop" aria-label="Hapus stop"${P.stops.length <= 2 ? ' disabled' : ''}><i class="fa-solid fa-minus"></i></button></div>`).join(''));
    renderGeo();
    refreshStopViews(true);
    fit();
  };
  const refreshStopViews = force => { // perbarui posisi / warna / nilai tanpa membangun ulang (handle yang sedang diseret tetap utuh)
    if (!isGrad()) return;
    $barBg.css('background', barCss());
    P.stops.forEach((s, i) => {
      const css = Paint.stopCss(s, 1),
        h = $handles.children()[i],
        r = $slist.children()[i];
      if (!h || !r) return;
      h.style.left = s.offset * 100 + '%';
      h.firstChild.style.background = css;
      h.classList.toggle('on', s === sel);
      h.setAttribute('aria-label', `Stop ${fmt2(s.offset * 100)}%`);
      r.classList.toggle('on', s === sel);
      r.querySelector('.mv-cp-ssw').style.background = css;
      const set = (cls, v) => {
        const el = r.querySelector(cls);
        if (force || document.activeElement !== el) el.value = v;
      };
      set('.mv-cp-spos', fmt2(s.offset * 100));
      set('.mv-cp-shex', stopHex(s).slice(1));
      set('.mv-cp-sop', Math.round((s.opacity == null ? 1 : s.opacity) * 100));
    });
  };
  const selectStop = s => {
    if (!s || s === sel) return;
    sel = s;
    loadTarget();
    sync(true);
  };
  const addStop = offset => {
    const c = Paint.colorAt(P, offset),
      s = { offset: r3(clamp(offset, 0, 1)), color: c.color, opacity: c.opacity };
    P.stops.push(s);
    sel = s;
    normalizeStops();
    renderGradAll();
    loadTarget();
    sync(true);
    return s;
  };
  const removeStop = s => {
    if (P.stops.length <= 2) return;
    const i = P.stops.indexOf(s);
    P.stops.splice(i, 1);
    if (sel === s) sel = P.stops[Math.min(i, P.stops.length - 1)];
    renderGradAll();
    loadTarget();
    sync(true);
    emit(true);
  };
  const setMode = mode => {
    if (mode === 'gradient' && !isGrad()) {
      commitTarget();
      const g = Paint.gradient('GRADIENT_LINEAR', P.color, 1);
      g.id = P.id;
      g.visible = P.visible;
      g.opacity = P.opacity == null ? 1 : P.opacity; // transparansi warna polos menjadi opasitas paint
      P = g;
      sel = P.stops[0];
    } else if (mode === 'solid' && isGrad()) {
      commitTarget();
      P = Paint.toSolid(P);
      sel = null;
    } else return;
    loadTarget();
    showMode();
    if (isGrad()) renderGradAll();
    sync(true);
    fit();
    emit(true);
  };
  const applyGeo = () => {
    const v = k => parseFloat($geo.find(`[data-k="${k}"]`).val());
    let ok = true;
    if (P.type === 'GRADIENT_LINEAR') {
      if (isFinite(v('angle'))) Paint.setLinearAngle(P, v('angle'));
      else ok = false;
    } else {
      const cx = v('cx'),
        cy = v('cy');
      if (![cx, cy].every(isFinite)) ok = false;
      else P.center = { x: r3(cx / 100), y: r3(cy / 100) };
      if (ok && P.type === 'GRADIENT_RADIAL') {
        const rx = v('rx'),
          ry = v('ry');
        if ([rx, ry].every(isFinite)) P.radius = { rx: r3(Math.max(0.1, Math.abs(rx)) / 100), ry: r3(Math.max(0.1, Math.abs(ry)) / 100) };
        else ok = false;
      } else if (ok) {
        const sa = v('sa');
        if (isFinite(sa)) P.startAngle = ((sa % 360) + 360) % 360;
        else ok = false;
      }
    }
    refreshGeo(true);
    if (ok) emit(true);
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
    if (ok) emitColor(true);
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
    emitColor(true);
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
  const fit = () => { // tinggi panel berubah (mode, jumlah stop): geser naik bila bagian bawah keluar layar
    if (!$el || $el.prop('hidden')) return;
    const r = $el[0].getBoundingClientRect(),
      over = r.bottom - (window.innerHeight - 8);
    if (over > 0) $el.css('top', Math.max(8, r.top - over));
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
    P = clone(o.paint || Paint.solid(o.color, o.opacity));
    sel = null;
    if (isGrad()) {
      if (!Array.isArray(P.stops) || P.stops.length < 2) P.stops = Paint.gradient(P.type, '#D9D9D9').stops; // data rusak: perbaiki
      normalizeStops();
      sel = P.stops[0];
    }
    loadTarget();
    const b = Color.parseCss(o.background);
    bg = b || workspaceBg();
    stopCanvasPick();
    $el.prop('hidden', false);
    showMode();
    if (isGrad()) renderGradAll();
    buildFields();
    drawnHue = null;
    place(o.anchor);
    sync(true);
    fit();
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
      emitColor(false);
    });
    area.addEventListener('pointermove', e => {
      if (dragId !== e.pointerId) return;
      fromArea(e);
      sync();
      emitColor(false);
    });
    const endArea = e => {
      if (dragId !== e.pointerId) return;
      dragId = null;
      emitColor(true);
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
      emitColor(true);
    });
    // slider hue & opacity
    $hue.on('input', function() {
      st.h = (+this.value) % 360;
      sync();
      emitColor(false);
    }).on('change', () => emitColor(true));
    $alpha.on('input', function() {
      st.a = clamp(+this.value, 0, 100) / 100;
      sync();
      emitColor(false);
    }).on('change', () => emitColor(true));
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
        emitColor(true);
      } else sync(true);
    });
    $eye.on('click', pickColor);
    $el.find('.mv-cp-x').on('click', close);
    // mode, tipe, balik, putar
    $el.find('.mv-cp-mode').on('click', function() {
      if (!this.disabled) setMode(this.dataset.mode);
    });
    $gtype.on('change', function() {
      Paint.setType(P, this.value);
      renderGeo();
      emit(true);
    });
    $el.find('.mv-cp-rev').on('click', () => {
      Paint.reverse(P);
      renderGradAll();
      emit(true);
    });
    $el.find('.mv-cp-rot').on('click', () => {
      Paint.rotate90(P);
      refreshGeo(true);
      emit(true);
    });
    $geo.on('change', 'input', applyGeo);
    $geo.on('keydown', 'input', function(e) {
      if (e.key === 'Enter') this.blur();
    });
    // bar: klik = tambah stop (langsung bisa diseret); handle: seret / panah / hapus
    const barOffset = e => {
      const r = $bar[0].getBoundingClientRect();
      return r3(clamp((e.clientX - r.left) / r.width, 0, 1));
    };
    $bar[0].addEventListener('pointerdown', e => {
      if (e.button) return;
      const h = e.target.closest('.mv-cp-h');
      if (h) {
        sel = P.stops[+h.dataset.i];
        hdrag = { id: e.pointerId, stop: sel };
        h.setPointerCapture(e.pointerId);
        h.focus({ preventScroll: true });
        loadTarget();
        sync(true);
        e.preventDefault();
        return;
      }
      const s = addStop(barOffset(e)),
        nh = $handles.children()[P.stops.indexOf(s)];
      hdrag = { id: e.pointerId, stop: s };
      nh.setPointerCapture(e.pointerId);
      emit(false);
      e.preventDefault();
    });
    $bar[0].addEventListener('pointermove', e => {
      if (!hdrag || hdrag.id !== e.pointerId) return;
      hdrag.stop.offset = barOffset(e);
      refreshStopViews();
      emit(false);
    });
    const endHandle = e => {
      if (!hdrag || hdrag.id !== e.pointerId) return;
      hdrag = null;
      normalizeStops(); // urutan array mengikuti posisi
      renderGradAll();
      emit(true);
    };
    $bar[0].addEventListener('pointerup', endHandle);
    $bar[0].addEventListener('pointercancel', endHandle);
    $handles.on('keydown', '.mv-cp-h', function(e) {
      const s = P.stops[+this.dataset.i],
        k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        s.offset = r3(clamp(s.offset + (k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.1 : 0.01), 0, 1));
        sel = s;
        normalizeStops();
        renderGradAll();
        $handles.children()[P.stops.indexOf(s)].focus();
        emit(true);
      } else if (k === 'Delete' || k === 'Backspace') {
        removeStop(s);
      } else return;
      e.preventDefault();
    });
    // daftar stop
    const rowStop = el => P.stops[+$(el).closest('.mv-cp-sr').data('i')];
    $slist.on('pointerdown focusin', '.mv-cp-sr', function() {
      selectStop(P.stops[+this.dataset.i]);
    });
    $slist.on('change', '.mv-cp-spos', function() {
      const s = rowStop(this),
        v = parseFloat(this.value);
      if (!isFinite(v)) return refreshStopViews(true);
      s.offset = r3(clamp(v, 0, 100) / 100);
      sel = s;
      normalizeStops();
      renderGradAll();
      emit(true);
    });
    $slist.on('change', '.mv-cp-shex', function() {
      const s = rowStop(this),
        raw = String(this.value).trim().replace('#', ''),
        c = Color.parseHex(raw);
      if (!c) return refreshStopViews(true);
      s.color = Color.toHex(c);
      if (raw.length === 4 || raw.length === 8) s.opacity = Math.round(c.a * 100) / 100;
      sel = s;
      loadTarget();
      sync(true);
      emit(true);
    });
    $slist.on('change', '.mv-cp-sop', function() {
      const s = rowStop(this),
        v = parseFloat(this.value);
      if (!isFinite(v)) return refreshStopViews(true);
      s.opacity = clamp(v, 0, 100) / 100;
      sel = s;
      loadTarget();
      sync(true);
      emit(true);
    });
    $slist.on('keydown', 'input', function(e) {
      if (e.key === 'Enter') this.blur();
    });
    $slist.on('click', '.mv-cp-sdel', function() {
      removeStop(rowStop(this));
    });
    $el.find('.mv-cp-sadd').on('click', () => {
      const st2 = Paint.sortedStops(P);
      let best = 0,
        at = 0.5; // sisipkan di tengah celah terlebar antar stop
      for (let i = 0; i < st2.length - 1; i++) {
        const gap = st2[i + 1].offset - st2[i].offset;
        if (gap > best) {
          best = gap;
          at = (st2[i].offset + st2[i + 1].offset) / 2;
        }
      }
      addStop(at);
      emit(true);
    });
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