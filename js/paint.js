/* ================= PAINT (fill objek → gaya canvas) ================= */
// Bergantung pada: colors.js (Color). Dipakai canvas.js saat menggambar, design/fill.js dan design/colorpicker.js saat mengedit.
// Data fill: style.fills = [{ id, type, visible, opacity, ... }] (lihat StructureJSON.md bagian 6).
// Urutan array: indeks 0 paling belakang, terakhir paling depan. style.fill (string, format lama) tetap dibaca.
// Tergambar: SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR. Tipe lain (DIAMOND, PATTERN, IMAGE) disimpan tetapi dilewati.
// Koordinat gradient dinormalisasi 0–1 terhadap kotak pembatas objek, jadi ikut berubah saat objek di-resize.
const Paint = (() => {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round4 = n => Math.round(n * 10000) / 10000;
  const uid = () => 'fill_' + Math.random().toString(36).slice(2, 8);
  const solid = (color = '#D9D9D9', opacity = 1) => ({ id: uid(), type: 'SOLID', visible: true, opacity, color });

  const GRADIENT_LABEL = { GRADIENT_LINEAR: 'Linear', GRADIENT_RADIAL: 'Radial', GRADIENT_ANGULAR: 'Angular' };
  const isGradient = p => !!p && Object.prototype.hasOwnProperty.call(GRADIENT_LABEL, p.type);

  // daftar fill objek: style.fills, atau style.fill (string lama) yang dibaca sebagai satu fill SOLID (tidak disimpan)
  const fillsOf = style => {
    if (!style) return [];
    if (Array.isArray(style.fills)) return style.fills;
    if (typeof style.fill === 'string' && style.fill) {
      const c = Color.parseCss(style.fill);
      if (c) return [{ id: 'fill_legacy', type: 'SOLID', visible: true, opacity: c.a, color: Color.toHex(c) }];
    }
    return [];
  };
  // ubah ke format baru bila masih format lama (style.fill dihapus), lalu kembalikan array yang bisa diubah
  const ensureFills = style => {
    if (!Array.isArray(style.fills)) {
      style.fills = fillsOf(style).map(p => ({ ...p, id: uid() }));
      delete style.fill;
    }
    return style.fills;
  };

  /* ---------- warna ---------- */
  const rgbaOf = (colorStr, alpha) => {
    const c = Color.parseHex(colorStr) || Color.parseCss(colorStr);
    if (!c) return null;
    const a = clamp(alpha * c.a, 0, 1);
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${+a.toFixed(4)})`;
  };
  // string warna canvas untuk fill SOLID, atau null bila tidak digambar
  const cssOf = p => {
    if (!p || p.visible === false || p.type !== 'SOLID') return null;
    const css = rgbaOf(p.color, p.opacity == null ? 1 : p.opacity);
    return css && !/, 0\)$/.test(css) ? css : null;
  };
  // warna satu stop gradient; mult = opasitas paint (dikalikan opasitas stop)
  const stopCss = (s, mult = 1) => rgbaOf(s.color, mult * (s.opacity == null ? 1 : s.opacity));
  const sortedStops = p => (Array.isArray(p.stops) ? p.stops : []).filter(s => s && isFinite(s.offset)).slice().sort((a, b) => a.offset - b.offset);

  /* ---------- operasi data gradient (dipakai panel warna) ---------- */
  const defaults = type => type === 'GRADIENT_RADIAL' ? { center: { x: 0.5, y: 0.5 }, radius: { rx: 0.5, ry: 0.5 } } :
    type === 'GRADIENT_ANGULAR' ? { center: { x: 0.5, y: 0.5 }, startAngle: 0 } :
    { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } }; // linear: kiri → kanan
  // gradient baru: dari warna saat ini ke warna yang lebih gelap (seperti default Figma)
  const gradient = (type = 'GRADIENT_LINEAR', color = '#D9D9D9', opacity = 1) => {
    const c = Color.parseCss(color) || { r: 217, g: 217, b: 217 };
    return {
      id: uid(),
      type,
      visible: true,
      opacity,
      ...defaults(type),
      stops: [{ offset: 0, color: Color.toHex(c), opacity: 1 }, { offset: 1, color: Color.toHex(Color.blend(c, 0.53, { r: 0, g: 0, b: 0 })), opacity: 1 }]
    };
  };
  // ganti tipe gradient: geometri diganti bawaan tipe baru (pusat dipertahankan), stops tetap
  const setType = (p, type) => {
    const center = p.center;
    ['start', 'end', 'center', 'radius', 'startAngle'].forEach(k => delete p[k]);
    Object.assign(p, defaults(type));
    if (center && type !== 'GRADIENT_LINEAR') p.center = { ...center };
    p.type = type;
    return p;
  };
  // gradient → warna polos: memakai stop pertama
  const toSolid = p => {
    const f = sortedStops(p)[0] || { color: '#D9D9D9', opacity: 1 };
    return { id: p.id, type: 'SOLID', visible: p.visible !== false, opacity: round4((p.opacity == null ? 1 : p.opacity) * (f.opacity == null ? 1 : f.opacity)), color: Color.toHex(Color.parseCss(f.color) || { r: 217, g: 217, b: 217 }) };
  };
  // warna di posisi t (0–1) pada gradient, untuk stop baru
  const colorAt = (p, t) => {
    const st = sortedStops(p);
    if (!st.length) return { color: '#D9D9D9', opacity: 1 };
    if (t <= st[0].offset) return { color: st[0].color, opacity: st[0].opacity == null ? 1 : st[0].opacity };
    const last = st[st.length - 1];
    if (t >= last.offset) return { color: last.color, opacity: last.opacity == null ? 1 : last.opacity };
    let i = 0;
    while (st[i + 1].offset < t) i++;
    const a = st[i],
      b = st[i + 1],
      k = (t - a.offset) / ((b.offset - a.offset) || 1),
      ca = Color.parseCss(a.color),
      cb = Color.parseCss(b.color);
    const mix = (x, y) => x + (y - x) * k;
    return {
      color: Color.toHex({ r: mix(ca.r, cb.r), g: mix(ca.g, cb.g), b: mix(ca.b, cb.b) }),
      opacity: round4(mix(a.opacity == null ? 1 : a.opacity, b.opacity == null ? 1 : b.opacity))
    };
  };
  const reverse = p => { // balik arah warna: offset menjadi 1 − offset
    p.stops.forEach(s => {
      s.offset = round4(1 - s.offset);
    });
    p.stops.sort((a, b) => a.offset - b.offset);
    return p;
  };
  const linearAngle = p => { // derajat 0–360, 0 = ke kanan, searah jarum jam (sumbu y ke bawah)
    const s = p.start || { x: 0, y: 0.5 },
      e = p.end || { x: 1, y: 0.5 };
    return (Math.atan2(e.y - s.y, e.x - s.x) * 180 / Math.PI + 360) % 360;
  };
  const setLinearAngle = (p, deg) => { // titik tengah dan panjang garis dipertahankan
    const s = p.start || { x: 0, y: 0.5 },
      e = p.end || { x: 1, y: 0.5 },
      mx = (s.x + e.x) / 2,
      my = (s.y + e.y) / 2,
      len = Math.hypot(e.x - s.x, e.y - s.y) || 1,
      r = deg * Math.PI / 180,
      dx = Math.cos(r) * len / 2,
      dy = Math.sin(r) * len / 2;
    p.start = { x: round4(mx - dx), y: round4(my - dy) };
    p.end = { x: round4(mx + dx), y: round4(my + dy) };
    return p;
  };
  const rotate90 = p => {
    if (p.type === 'GRADIENT_LINEAR') setLinearAngle(p, linearAngle(p) + 90);
    else if (p.type === 'GRADIENT_ANGULAR') p.startAngle = ((p.startAngle || 0) + 90) % 360;
    else if (p.type === 'GRADIENT_RADIAL') p.radius = { rx: (p.radius || { rx: 0.5, ry: 0.5 }).ry, ry: (p.radius || { rx: 0.5, ry: 0.5 }).rx };
    return p;
  };
  // CSS pratinjau untuk swatch / bar (kiri → kanan, tanpa geometri)
  const previewCss = p => {
    const st = sortedStops(p).map(s => `${stopCss(s, 1)} ${+(s.offset * 100).toFixed(1)}%`).join(', ');
    if (!st) return '#808080';
    return p.type === 'GRADIENT_RADIAL' ? `radial-gradient(circle, ${st})` : p.type === 'GRADIENT_ANGULAR' ? `conic-gradient(${st})` : `linear-gradient(to right, ${st})`;
  };

  /* ---------- menggambar ---------- */
  const addStops = (g, p) => {
    const st = sortedStops(p),
      mult = p.opacity == null ? 1 : p.opacity;
    if (st.length < 2) return false;
    st.forEach(s => {
      const css = stopCss(s, mult);
      if (css) g.addColorStop(clamp(s.offset, 0, 1), css);
    });
    return true;
  };
  const num = v => typeof v === 'number' && isFinite(v);
  // gambar satu fill pada bentuk. usePath=true: path aktif di ctx yang diisi; false: persegi box
  const paintShape = (ctx, p, box, usePath) => {
    if (!p || p.visible === false) return;
    const { x, y, width: w, height: h } = box || {}; // fill SOLID tidak butuh box; gradient butuh
    const paint = g => {
      ctx.fillStyle = g;
      if (usePath) ctx.fill();
      else ctx.fillRect(x, y, w, h);
    };
    if (p.type === 'SOLID') {
      const css = cssOf(p);
      if (css) paint(css);
    } else if (![x, y, w, h].every(num)) {
      return; // gradient tanpa kotak pembatas yang valid
    } else if (p.type === 'GRADIENT_LINEAR') {
      const s = p.start || { x: 0, y: 0.5 },
        e = p.end || { x: 1, y: 0.5 };
      if (![s.x, s.y, e.x, e.y].every(num)) return;
      const g = ctx.createLinearGradient(x + s.x * w, y + s.y * h, x + e.x * w, y + e.y * h);
      if (addStops(g, p)) paint(g);
    } else if (p.type === 'GRADIENT_ANGULAR') {
      const c = p.center || { x: 0.5, y: 0.5 };
      if (!ctx.createConicGradient || ![c.x, c.y, p.startAngle || 0].every(num)) return;
      const g = ctx.createConicGradient((p.startAngle || 0) * Math.PI / 180, x + c.x * w, y + c.y * h);
      if (addStops(g, p)) paint(g);
    } else if (p.type === 'GRADIENT_RADIAL') {
      // gradient elips: gradient lingkaran satuan, diskalakan ke radius (rx × lebar, ry × tinggi) lalu dipotong ke bentuk objek
      const c = p.center || { x: 0.5, y: 0.5 },
        r = p.radius || { rx: 0.5, ry: 0.5 };
      if (![c.x, c.y, r.rx, r.ry].every(num)) return;
      const sx = Math.abs(r.rx * w),
        sy = Math.abs(r.ry * h);
      if (sx < 1e-6 || sy < 1e-6) return;
      const ox = x + c.x * w,
        oy = y + c.y * h,
        g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      if (!addStops(g, p)) return;
      ctx.save();
      if (!usePath) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
      }
      ctx.clip(); // bentuk objek (path aktif atau persegi box)
      ctx.translate(ox, oy);
      ctx.scale(sx, sy);
      ctx.fillStyle = g;
      ctx.fillRect((x - ox) / sx, (y - oy) / sy, w / sx, h / sy); // kotak pembatas dalam ruang satuan
      ctx.restore();
    }
  };
  const fillRect = (ctx, style, x, y, w, h) => {
    const box = { x, y, width: w, height: h };
    fillsOf(style).forEach(p => paintShape(ctx, p, box, false));
  };
  // isi path yang sedang aktif di ctx (ellipse, dst.); path tetap aktif setelahnya (untuk stroke)
  const fillPath = (ctx, style, box) => {
    fillsOf(style).forEach(p => paintShape(ctx, p, box, true));
  };

  return {
    uid, solid, fillsOf, ensureFills, cssOf, stopCss, sortedStops, fillRect, fillPath,
    GRADIENT_LABEL, isGradient, gradient, setType, toSolid, colorAt, reverse, linearAngle, setLinearAngle, rotate90, previewCss
  };
})();