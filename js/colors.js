/* ================= COLORS (konversi, parsing, kontras) ================= */
// Tanpa dependensi. Model: rgb {r,g,b} 0-255 · hsv {h 0-360, s 0-1, v 0-1} · hsl {h, s, l} · alpha a 0-1.
// API: Color.parseHex, parseCss, toHex, toCss, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, blend, contrast
const Color = (() => {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const h2 = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  const toHex = ({ r, g, b }) => ('#' + h2(r) + h2(g) + h2(b)).toUpperCase();
  const toCss = ({ r, g, b, a = 1 }) => {
    const R = Math.round(r),
      G = Math.round(g),
      B = Math.round(b);
    return a >= 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${+a.toFixed(2)})`;
  };

  // "#RGB", "#RGBA", "#RRGGBB", "#RRGGBBAA" (tanda # boleh dihilangkan) → {r,g,b,a} | null
  const parseHex = str => {
    const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(str == null ? '' : str).trim());
    if (!m) return null;
    let h = m[1];
    if (h.length <= 4) h = h.split('').map(c => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    };
  };

  // segi-enam warna: dipakai bersama oleh HSV dan HSL
  const sector = (h, c) => {
    h = ((h % 360) + 360) % 360;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    return h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  };
  const rgbToHsv = ({ r, g, b }) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      d = mx - mn;
    let h = 0;
    if (d) {
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h, s: mx ? d / mx : 0, v: mx };
  };
  const hsvToRgb = (h, s, v) => {
    const [r, g, b] = sector(h, v * s),
      m = v - v * s;
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  };
  const rgbToHsl = rgb => {
    const { h } = rgbToHsv(rgb),
      r = rgb.r / 255,
      g = rgb.g / 255,
      b = rgb.b / 255;
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      d = mx - mn,
      l = (mx + mn) / 2;
    return { h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
  };
  const hslToRgb = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s,
      [r, g, b] = sector(h, c),
      m = l - c / 2;
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  };

  // kontras WCAG 2.x (1 – 21)
  const lin = v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (c1, c2) => {
    const a = luminance(c1),
      b = luminance(c2);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const blend = (fg, a, bg) => ({ r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) });

  // warna CSS apa pun (nama, rgb(), hsl(), ...) → {r,g,b,a} | null. Memakai parser canvas milik browser.
  const cache = new Map();
  let ctx2d = null;
  const parseCss = str => {
    str = String(str == null ? '' : str).trim();
    if (!str) return null;
    const hx = parseHex(str);
    if (hx) return hx;
    if (cache.has(str)) return cache.get(str);
    ctx2d = ctx2d || document.createElement('canvas').getContext('2d');
    ctx2d.fillStyle = '#010203';
    ctx2d.fillStyle = str;
    const a = ctx2d.fillStyle;
    ctx2d.fillStyle = '#040506';
    ctx2d.fillStyle = str;
    const b = ctx2d.fillStyle;
    let out = null;
    if (a === b) { // nilai tidak valid diabaikan canvas, sehingga hasilnya mengikuti nilai awal masing-masing
      out = parseHex(a);
      if (!out) {
        const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(a);
        if (m) out = { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
      }
    }
    if (cache.size > 200) cache.clear();
    cache.set(str, out);
    return out;
  };

  return { clamp, parseHex, parseCss, toHex, toCss, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, luminance, contrast, blend };
})();