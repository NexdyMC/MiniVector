/* ================= PAINT (fill objek → gaya canvas) ================= */
// Bergantung pada: colors.js (Color). Dipakai canvas.js saat menggambar dan design/fill.js saat mengedit.
// Data fill: style.fills = [{ id, type, visible, opacity, color, ... }] (lihat StructureJSON.md bagian 6).
// Urutan array: indeks 0 paling belakang, terakhir paling depan. style.fill (string, format lama) tetap dibaca.
// Saat ini tergambar: SOLID. Tipe lain (GRADIENT_*, PATTERN, IMAGE) disimpan tetapi dilewati saat render.
const Paint = (() => {
  const uid = () => 'fill_' + Math.random().toString(36).slice(2, 8);
  const solid = (color = '#D9D9D9', opacity = 1) => ({ id: uid(), type: 'SOLID', visible: true, opacity, color });

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

  // string warna canvas untuk satu fill, atau null bila tidak digambar
  const cssOf = p => {
    if (!p || p.visible === false || p.type !== 'SOLID') return null;
    const c = Color.parseHex(p.color) || Color.parseCss(p.color);
    if (!c) return null;
    const a = Math.min(1, Math.max(0, (p.opacity == null ? 1 : p.opacity) * c.a));
    return a <= 0 ? null : `rgba(${c.r}, ${c.g}, ${c.b}, ${+a.toFixed(4)})`;
  };
  const fillRect = (ctx, style, x, y, w, h) => {
    fillsOf(style).forEach(p => {
      const css = cssOf(p);
      if (!css) return;
      ctx.fillStyle = css;
      ctx.fillRect(x, y, w, h);
    });
  };
  // isi path yang sedang aktif di ctx (ellipse, dst.); box = {x, y, width, height} dicadangkan untuk gradient / image
  const fillPath = (ctx, style, box) => {
    fillsOf(style).forEach(p => {
      const css = cssOf(p);
      if (!css) return;
      ctx.fillStyle = css;
      ctx.fill();
    });
  };

  return { uid, solid, fillsOf, ensureFills, cssOf, fillRect, fillPath };
})();