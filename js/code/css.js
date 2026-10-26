/* ================= CSS GENERATOR (js/code/css.js) ================= */
// Mengonversi properti visual objek MiniVector menjadi aturan CSS murni.
// Mendukung single / multi selection, layout flex, sizing, styling, radius, shadow, transform.

(function () {
  'use strict';

  const r2 = n => Math.round(n * 100) / 100;

  const toCss = (obj) => {
    if (!obj || !obj.transform) return '/* Tidak ada objek terpilih */';

    const t = obj.transform;
    const s = obj.style || {};
    const g = obj.geometry || {};
    const l = obj.layout || {};
    const c = obj.code || {};
    const lines = [];

    const className = (obj.name || obj.type || 'element')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');

    // 1. Display & Flow (Layout: None | Flex | Grid)
    if (obj.type === 'frame') {
      if (l.display === 'grid') {
        lines.push('  display: grid;');
        const cols = Math.max(1, parseInt(l.columns, 10) || 3);
        lines.push(`  grid-template-columns: repeat(${cols}, 1fr);`);
        const colGap = typeof l.colGap === 'number' ? l.colGap : 12;
        const rowGap = typeof l.rowGap === 'number' ? l.rowGap : 12;
        if (colGap === rowGap && colGap > 0) lines.push(`  gap: ${colGap}px;`);
        else if (rowGap > 0 || colGap > 0) lines.push(`  row-gap: ${rowGap}px; column-gap: ${colGap}px;`);
        if (Array.isArray(l.padding)) {
          const [top, right, bottom, left] = l.padding;
          if (top || right || bottom || left) {
            lines.push(`  padding: ${top}px ${right}px ${bottom}px ${left}px;`);
          }
        }
      } else if (l.display === 'flex') {
        lines.push('  display: flex;');
        const dir = l.direction || 'column';
        if (dir !== 'row') lines.push(`  flex-direction: ${dir};`);
        if (l.alignItems) lines.push(`  align-items: ${l.alignItems};`);
        if (l.justifyContent) lines.push(`  justify-content: ${l.justifyContent};`);
        if (typeof l.gap === 'number' && l.gap > 0) lines.push(`  gap: ${l.gap}px;`);
        
        if (Array.isArray(l.padding)) {
          const [top, right, bottom, left] = l.padding;
          if (top || right || bottom || left) {
            if (top === bottom && right === left) {
              lines.push(top === right ? `  padding: ${top}px;` : `  padding: ${top}px ${right}px;`);
            } else {
              lines.push(`  padding: ${top}px ${right}px ${bottom}px ${left}px;`);
            }
          }
        }
      } else {
        lines.push(`  display: ${l.display};`);
      }
    } else {
      lines.push('  display: block;');
    }

    // 1b. Grid Item Placement (Jika memiliki parent Grid)
    if (l.colSpan && l.colSpan > 1) {
      lines.push(`  grid-column: span ${l.colSpan};`);
    }
    if (l.rowSpan && l.rowSpan > 1) {
      lines.push(`  grid-row: span ${l.rowSpan};`);
    }

    // 2. Position (Dinamis: hanya jika isAbsolute === true)
    if (c.position && c.position.isAbsolute) {
      lines.push('  position: absolute;');
      if (c.position.top !== null && c.position.top !== undefined) lines.push(`  top: ${c.position.top}px;`);
      if (c.position.left !== null && c.position.left !== undefined) lines.push(`  left: ${c.position.left}px;`);
      if (c.position.right !== null && c.position.right !== undefined) lines.push(`  right: ${c.position.right}px;`);
      if (c.position.bottom !== null && c.position.bottom !== undefined) lines.push(`  bottom: ${c.position.bottom}px;`);
      if (c.position.zIndex !== undefined && c.position.zIndex !== 1) lines.push(`  z-index: ${c.position.zIndex};`);
    }

    // 3. Dimensions
    if (t.width !== undefined) {
      const wPreset = c.sizing && c.sizing.width && c.sizing.width.unit === 'full' ? '100%' : `${r2(t.width)}px`;
      lines.push(`  width: ${wPreset};`);
    }
    if (t.height !== undefined) {
      const hPreset = c.sizing && c.sizing.height && c.sizing.height.unit === 'full' ? '100%' : `${r2(t.height)}px`;
      lines.push(`  height: ${hPreset};`);
    }

    // 4. Fill (Background)
    if (s.fill && s.fill !== 'none') {
      lines.push(`  background: ${s.fill};`);
    }

    // 5. Border & Stroke
    const sw = s.strokeWidth !== undefined ? s.strokeWidth : 1;
    const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
    if (hasStroke && sw > 0) {
      lines.push(`  border: ${sw}px solid ${s.stroke || '#000000'};`);
    }

    // 6. Corner Radius (All / Individual Corners)
    const cr = g.cornerRadius || s.cornerRadius;
    if (Array.isArray(cr)) {
      const [tl, tr, br, bl] = cr;
      if (tl || tr || br || bl) {
        if (tl === tr && tr === br && br === bl) {
          lines.push(`  border-radius: ${tl}px;`);
        } else {
          lines.push(`  border-radius: ${tl || 0}px ${tr || 0}px ${br || 0}px ${bl || 0}px;`);
        }
      }
    } else if (parseFloat(cr) > 0) {
      lines.push(`  border-radius: ${parseFloat(cr)}px;`);
    }

    // 7. Effects (Box Shadow)
    if (Array.isArray(s.effects) && s.effects.length > 0) {
      const shadows = s.effects
        .filter(e => e.type === 'drop-shadow' || e.type === 'inner-shadow')
        .map(e => {
          const inset = e.type === 'inner-shadow' ? 'inset ' : '';
          return `${inset}${e.x || 0}px ${e.y || 4}px ${e.blur || 12}px ${e.color || 'rgba(0,0,0,0.1)'}`;
        });
      if (shadows.length > 0) {
        lines.push(`  box-shadow: ${shadows.join(', ')};`);
      }
    }

    // 8. Opacity
    if (s.opacity !== undefined && s.opacity < 1) {
      lines.push(`  opacity: ${r2(s.opacity)};`);
    }

    // 9. Typography (jika objek teks)
    if (obj.type === 'text') {
      const ff = obj.fontFamily || (obj.textStyle && obj.textStyle.fontFamily);
      const fs = obj.fontSize || (obj.textStyle && obj.textStyle.fontSize);
      const fw = obj.fontWeight || (obj.textStyle && obj.textStyle.fontWeight);
      const lh = obj.lineHeight || (obj.textStyle && obj.textStyle.lineHeight);
      const ls = obj.letterSpacing !== undefined ? obj.letterSpacing : (obj.textStyle && obj.textStyle.letterSpacing);
      const ta = obj.textAlign || (obj.textStyle && obj.textStyle.textAlign);

      if (ff) lines.push(`  font-family: ${ff};`);
      if (fs) lines.push(`  font-size: ${fs}px;`);
      if (fw) lines.push(`  font-weight: ${fw};`);
      if (lh) lines.push(`  line-height: ${typeof lh === 'number' ? lh + 'px' : lh};`);
      if (ls !== undefined && ls !== 0) lines.push(`  letter-spacing: ${ls}px;`);
      if (ta) lines.push(`  text-align: ${ta};`);
      if (s.fill) lines.push(`  color: ${s.fill};`);
    }

    // 10. Transform (Rotation & Flip)
    const transforms = [];
    if (t.rotation) transforms.push(`rotate(${r2(t.rotation)}deg)`);
    if (t.flipX || t.flipY) transforms.push(`scale(${t.flipX ? -1 : 1}, ${t.flipY ? -1 : 1})`);
    if (transforms.length > 0) {
      lines.push(`  transform: ${transforms.join(' ')};`);
    }

    // 11. Clip Content / Overflow
    if (obj.type === 'frame' && obj.clipContent) {
      lines.push('  overflow: hidden;');
    }

    return `.${className} {\n${lines.join('\n')}\n}`;
  };

  window.CodeCSS = {
    generate: toCss
  };
})();
