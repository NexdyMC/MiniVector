/* ================= CSS GENERATOR (js/code/css.js) ================= */
// Mengonversi properti visual objek MiniVector menjadi aturan CSS murni.
// Mendukung single / multi selection, layout flex, sizing, styling, radius, shadow, transform.

(function () {
  'use strict';

  const r2 = n => Math.round(n * 100) / 100;
  const hexToRgbaStr = (hex, alpha = 1) => {
    if (!hex) return 'rgba(0,0,0,' + alpha + ')';
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return hex;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };


  const getCssBackground = (style) => {
    if (!style) return null;
    const fills = Array.isArray(style.fills) ? style.fills.filter(f => f && f.visible !== false) : [];
    if (fills.length > 0) {
      const topFill = fills[fills.length - 1]; // Top-most fill
      if (topFill.type === 'SOLID') {
        const op = topFill.opacity !== undefined ? topFill.opacity : 1;
        return op < 1 ? hexToRgbaStr(topFill.color || '#D9D9D9', op) : (topFill.color || '#D9D9D9');
      } else if (topFill.type === 'GRADIENT_LINEAR') {
        // Calculate CSS degree
        // Paint.linearAngle gives 0deg = to right (90deg CSS), 90deg = to bottom (180deg CSS)
        let deg = 90;
        if (typeof Paint !== 'undefined' && typeof Paint.linearAngle === 'function') {
          deg = Math.round((Paint.linearAngle(topFill) + 90) % 360);
        } else if (topFill.start && topFill.end) {
          const s = topFill.start, e = topFill.end;
          const a = (Math.atan2(e.y - s.y, e.x - s.x) * 180 / Math.PI + 360) % 360;
          deg = Math.round((a + 90) % 360);
        }

        const stops = (Array.isArray(topFill.stops) ? topFill.stops : [])
          .filter(st => st && isFinite(st.offset))
          .sort((a, b) => a.offset - b.offset);

        if (stops.length > 0) {
          const stopStrs = stops.map(st => {
            const op = (topFill.opacity !== undefined ? topFill.opacity : 1) * (st.opacity !== undefined ? st.opacity : 1);
            const col = op < 1 ? hexToRgbaStr(st.color || '#000000', op) : (st.color || '#000000');
            const pct = Math.round(st.offset * 100);
            return `${col} ${pct}%`;
          });
          return `linear-gradient(${deg}deg, ${stopStrs.join(', ')})`;
        }
      }
    } else if (style.fill && style.fill !== 'none') {
      return style.fill;
    }
    return null;
  };

  /**
   * Helper menghasilkan nama class yang valid dan bersih dari objek / nama layer.
   */
  const getCleanClassName = (obj, fallbackPrefix = 'element') => {
    const c = obj.code || {};
    if (c.customClass && c.customClass.trim()) {
      return c.customClass.trim().replace(/^[.#]/, '');
    }
    const raw = (obj.name && obj.name !== 'Rectangle' && obj.name !== 'Frame' && obj.name !== 'Text')
      ? obj.name
      : (fallbackPrefix || obj.type || 'element');

    return raw
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'element';
  };

  /**
   * Helper mengekstrak baris-baris CSS properties untuk satu node tunggal.
   */
  const getNodeCssProperties = (obj, isChildOfFreeFrame = false) => {
    if (!obj || !obj.transform) return [];

    const t = obj.transform;
    const s = obj.style || {};
    const g = obj.geometry || {};
    const l = obj.layout || {};
    const c = obj.code || {};
    const lines = [];

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
            lines.push(`  padding: ${top}px ${right}px ${bottom}px ${left}px;`);
          }
        }
      } else {
        // Frame canvas bebas -> jadikan relative agar children absolute berpatokan ke frame ini
        lines.push('  position: relative;');
      }
    } else {
      lines.push('  display: block;');
    }

    // 1b. Grid Item Placement
    if (l.colSpan && l.colSpan > 1) lines.push(`  grid-column: span ${l.colSpan};`);
    if (l.rowSpan && l.rowSpan > 1) lines.push(`  grid-row: span ${l.rowSpan};`);

    // 2. Position (Dinamis atau Anak Frame Bebas)
    const hasExplicitPos = c.position && (c.position.isActive || c.position.isAbsolute);

    if (hasExplicitPos) {
      const pType = c.position.type || 'absolute';
      lines.push(`  position: ${pType};`);
      if (c.position.top !== null && c.position.top !== undefined && c.position.top !== '') {
        lines.push(`  top: ${c.position.top}px;`);
      }
      if (c.position.right !== null && c.position.right !== undefined && c.position.right !== '') {
        lines.push(`  right: ${c.position.right}px;`);
      }
      if (c.position.bottom !== null && c.position.bottom !== undefined && c.position.bottom !== '') {
        lines.push(`  bottom: ${c.position.bottom}px;`);
      }
      if (c.position.left !== null && c.position.left !== undefined && c.position.left !== '') {
        lines.push(`  left: ${c.position.left}px;`);
      }
      if (c.position.zIndex !== undefined && c.position.zIndex !== null && c.position.zIndex !== '' && c.position.zIndex !== 1) {
        lines.push(`  z-index: ${c.position.zIndex};`);
      }
    } else if (isChildOfFreeFrame) {
      lines.push('  position: absolute;');
      if (t.x !== undefined) lines.push(`  left: ${Math.round(t.x)}px;`);
      if (t.y !== undefined) lines.push(`  top: ${Math.round(t.y)}px;`);
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

    // 4. Fill (Background: Solid / Gradients) - Hanya jika bukan teks
    if (obj.type !== 'text') {
      const bgVal = getCssBackground(s);
      if (bgVal) {
        lines.push(`  background: ${bgVal};`);
      }
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

    // 7. Effects (Box Shadow & Blurs)
    if (Array.isArray(s.effects) && s.effects.length > 0) {
      const visibleEffects = s.effects.filter(e => e && e.visible !== false);
      const shadows = visibleEffects
        .filter(e => e.type === 'drop-shadow' || e.type === 'inner-shadow')
        .map(e => {
          const inset = e.type === 'inner-shadow' ? 'inset ' : '';
          const x = typeof e.x === 'number' ? e.x : 0;
          const y = typeof e.y === 'number' ? e.y : 4;
          const blur = typeof e.blur === 'number' ? e.blur : 8;
          const spread = typeof e.spread === 'number' && e.spread !== 0 ? ` ${e.spread}px` : '';
          const op = typeof e.opacity === 'number' ? e.opacity : 0.25;
          const color = hexToRgbaStr(e.color || '#000000', op);
          return `${inset}${x}px ${y}px ${blur}px${spread} ${color}`;
        });
      if (shadows.length > 0) {
        lines.push(`  box-shadow: ${shadows.join(', ')};`);
      }

      const layerBlur = visibleEffects.find(e => e.type === 'layer-blur');
      if (layerBlur && layerBlur.blur > 0) {
        lines.push(`  filter: blur(${layerBlur.blur}px);`);
      }
      const bgBlur = visibleEffects.find(e => e.type === 'background-blur');
      if (bgBlur && bgBlur.blur > 0) {
        lines.push(`  backdrop-filter: blur(${bgBlur.blur}px);`);
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
    if (obj.type === 'frame' && obj.clipContent !== false) {
      lines.push('  overflow: hidden;');
    }

    return lines;
  };

  /**
   * Rekursif: Mengumpulkan seluruh ruleset CSS dari node beserta seluruh anak-anaknya,
   * dan menyusun markup HTML bertingkat dengan class yang cocok.
   */

  const getPseudoStateCss = (selector, stateKey, stateObj) => {
    if (!stateObj) return null;
    const lines = [];
    if (stateObj.fill && stateObj.fill !== 'none') {
      lines.push(`  background: ${stateObj.fill};`);
    }
    if (stateObj.textColor && stateObj.textColor !== 'none') {
      lines.push(`  color: ${stateObj.textColor};`);
    }
    if (stateObj.scale && parseFloat(stateObj.scale) !== 1) {
      lines.push(`  transform: scale(${stateObj.scale});`);
    }
    if (stateObj.opacity !== undefined && stateObj.opacity !== '' && stateObj.opacity !== null) {
      const op = parseInt(stateObj.opacity, 10);
      if (!isNaN(op)) {
        lines.push(`  opacity: ${op / 100};`);
      }
    }
    if (stateObj.shadow && stateObj.shadow !== 'inherit') {
      const shadowMap = {
        'none': 'none',
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      };
      if (shadowMap[stateObj.shadow]) {
        lines.push(`  box-shadow: ${shadowMap[stateObj.shadow]};`);
      }
    }

    if (lines.length === 0) return null;
    return `${selector}:${stateKey} {
${lines.join('\n')}
}`;
  };

  const renderCssTree = (node, isChildOfFreeFrame = false, indent = 0, classCounts = {}, cssRules = []) => {
    if (!node || node.visible === false) return '';

    const ind = '  '.repeat(indent);
    const c = node.code || {};
    const defaultTag = (c && c.htmlTag) || (node.type === 'text' ? 'p' : 'div');
    const tag = defaultTag;

    // Tentukan nama class yang unik dan semantik
    let baseClassName = getCleanClassName(node);
    if (!classCounts[baseClassName]) {
      classCounts[baseClassName] = 1;
    } else {
      classCounts[baseClassName]++;
      baseClassName = `${baseClassName}-${classCounts[baseClassName]}`;
    }
    const className = baseClassName;

    // Dapatkan ruleset CSS untuk elemen ini
    const propLines = getNodeCssProperties(node, isChildOfFreeFrame);
    if (propLines.length > 0) {
      cssRules.push(`.${className} {\n${propLines.join('\n')}\n}`);
    }

    // 1. Jika objek adalah Image
    const isImageObj = node.type === 'image' || (node.style && Array.isArray(node.style.fills) && node.style.fills.some(f => f && f.type === 'IMAGE'));
    if (isImageObj) {
      const src = (typeof window !== 'undefined' && window.CodeMedia) ? window.CodeMedia.getImageSource(node) : (node.src || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe');
      const alt = node.name || 'Image';
      return `${ind}<img src="${src}" alt="${alt}" class="${className}" />`;
    }

    // 2. Jika objek adalah Vector / Path / Icon
    const isVectorObj = node.type === 'path' || node.type === 'polygon' || node.type === 'star';
    if (isVectorObj && typeof window !== 'undefined' && window.CodeMedia) {
      const svgInfo = window.CodeMedia.getVectorSvgSnippet(node);
      const viewBox = `viewBox="0 0 ${svgInfo.w} ${svgInfo.h}"`;
      return `${ind}<svg ${viewBox} class="${className}" fill="none" xmlns="http://www.w3.org/2000/svg">
${ind}  ${svgInfo.innerContent}
${ind}</svg>`;
    }

    // 3. Jika Text
    if (node.type === 'text') {
      const textVal = node.content || node.text || node.name || 'Sample Text';
      return `${ind}<${tag} class="${className}">${textVal}</${tag}>`;
    }

    // Jika memiliki children (misal Frame)
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    if (!hasChildren) {
      return `${ind}<${tag} class="${className}"></${tag}>`;
    }

    const isFreeCanvas = !node.layout || node.layout.display === 'none';
    const renderedChildren = node.children
      .map(child => renderCssTree(child, isFreeCanvas, indent + 1, classCounts, cssRules))
      .filter(html => html.length > 0)
      .join('\n');

    return `${ind}<${tag} class="${className}">\n${renderedChildren}\n${ind}</${tag}>`;
  };

  const toCss = (obj, options = {}) => {
    if (!obj || !obj.transform) return '/* Tidak ada objek terpilih */';

    const c = obj.code || {};
    const isInlineStyle = !!c.inlineStyle;

    // Mode 1: Jika objek tidak memiliki anak, atau mode inline style diaktifkan
    const hasChildren = Array.isArray(obj.children) && obj.children.length > 0;

    if (!hasChildren || isInlineStyle) {
      let selector = c.customClass ? c.customClass.trim() : '';
      if (selector) {
        if (!selector.startsWith('.') && !selector.startsWith('#')) selector = '.' + selector;
      } else {
        selector = '.' + getCleanClassName(obj);
      }

      const lines = getNodeCssProperties(obj, false);

      if (isInlineStyle) {
        const inlineProps = lines.map(l => l.trim()).filter(l => l && !l.startsWith('/*')).join(' ');
        return `style="${inlineProps}"`;
      }

      let resultCss = `${selector} {\n${lines.join('\n')}\n}`;
      const states = c.states || {};
      ['hover', 'active', 'focus'].forEach(stKey => {
        const stateRule = getPseudoStateCss(selector, stKey, states[stKey]);
        if (stateRule) resultCss += `\n\n${stateRule}`;
      });
      return resultCss;
    }

    // Mode 2: Full Tree Generator (Frame beserta seluruh anak-anaknya)
    const cssRules = [];
    const classCounts = {};
    const htmlMarkup = renderCssTree(obj, false, 0, classCounts, cssRules);

    // Format output: HTML Markup lengkap + Stylesheet CSS
    const combinedOutput = `<!-- HTML Markup -->\n${htmlMarkup}\n\n/* CSS Stylesheet */\n${cssRules.join('\n\n')}`;
    return combinedOutput;
  };

  window.CodeCSS = {
    generate: toCss
  };
})();