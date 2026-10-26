/* ================= TAILWIND GENERATOR (js/code/tailwind.js) ================= */
// Mengonversi properti visual objek MiniVector menjadi utility class Tailwind CSS standar.

(function () {
  'use strict';

  // Helper pemetaan skala Tailwind untuk Spacing / Dimensions
  const tailwindSpacingMap = {
    0: '0', 1: '0.5', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5', 12: '3',
    14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8', 36: '9', 40: '10',
    44: '11', 48: '12', 56: '14', 64: '16', 72: '18', 80: '20', 96: '24',
    112: '28', 128: '32', 144: '36', 160: '40', 176: '44', 192: '48',
    208: '52', 224: '56', 240: '60', 256: '64', 288: '72', 320: '80', 384: '96'
  };

  const getSpacingClass = (prefix, px) => {
    const rounded = Math.round(px);
    if (tailwindSpacingMap[rounded] !== undefined) {
      return `${prefix}-${tailwindSpacingMap[rounded]}`;
    }
    return `${prefix}-[${rounded}px]`;
  };

  const toTailwind = (obj) => {
    if (!obj || !obj.transform) return '<!-- Tidak ada objek terpilih -->';

    const t = obj.transform;
    const s = obj.style || {};
    const g = obj.geometry || {};
    const l = obj.layout || {};
    const c = obj.code || {};
    const classes = [];

    const tag = (c && c.htmlTag) || (obj.type === 'text' ? 'p' : 'div');

    // 1. Display & Flow (None | Flex | Grid)
    if (obj.type === 'frame') {
      if (l.display === 'grid') {
        classes.push('grid');
        const cols = Math.max(1, parseInt(l.columns, 10) || 3);
        classes.push(`grid-cols-${cols}`);
        const colGap = typeof l.colGap === 'number' ? l.colGap : 12;
        const rowGap = typeof l.rowGap === 'number' ? l.rowGap : 12;
        if (colGap === rowGap && colGap > 0) {
          classes.push(getSpacingClass('gap', colGap));
        } else {
          if (colGap > 0) classes.push(getSpacingClass('gap-x', colGap));
          if (rowGap > 0) classes.push(getSpacingClass('gap-y', rowGap));
        }
        if (Array.isArray(l.padding)) {
          const [top, right, bottom, left] = l.padding;
          if (top > 0) classes.push(getSpacingClass('p', top));
        }
        if (obj.clipContent) classes.push('overflow-hidden');
      } else if (l.display === 'flex') {
        classes.push('flex');
        const dir = l.direction || 'column';
        if (dir === 'column') classes.push('flex-col');
        else if (dir === 'row') classes.push('flex-row');

        if (l.alignItems === 'center') classes.push('items-center');
        else if (l.alignItems === 'flex-end') classes.push('items-end');
        else if (l.alignItems === 'flex-start') classes.push('items-start');
        else if (l.alignItems === 'stretch') classes.push('items-stretch');
        else if (l.alignItems === 'baseline') classes.push('items-baseline');
      
        if (l.justifyContent === 'center') classes.push('justify-center');
        else if (l.justifyContent === 'space-between') classes.push('justify-between');
        else if (l.justifyContent === 'space-around') classes.push('justify-around');
        else if (l.justifyContent === 'space-evenly') classes.push('justify-evenly');
        else if (l.justifyContent === 'flex-end') classes.push('justify-end');
        else if (l.justifyContent === 'flex-start') classes.push('justify-start');

        if (typeof l.gap === 'number' && l.gap > 0) {
          classes.push(getSpacingClass('gap', l.gap));
        }

      if (Array.isArray(l.padding)) {
        const [top, right, bottom, left] = l.padding;
        if (top === bottom && right === left && top === right && top > 0) {
          classes.push(getSpacingClass('p', top));
        } else {
          if (right === left && right > 0) classes.push(getSpacingClass('px', right));
          else {
            if (left > 0) classes.push(getSpacingClass('pl', left));
            if (right > 0) classes.push(getSpacingClass('pr', right));
          }
          if (top === bottom && top > 0) classes.push(getSpacingClass('py', top));
          else {
            if (top > 0) classes.push(getSpacingClass('pt', top));
            if (bottom > 0) classes.push(getSpacingClass('pb', bottom));
          }
        }
      }

      if (obj.clipContent) classes.push('overflow-hidden');
      }
    } else {
      classes.push('block');
    }

    // 1b. Grid Item Placement (col-span-X & row-span-Y)
    if (l.colSpan && l.colSpan > 1) {
      classes.push(`col-span-${l.colSpan}`);
    }
    if (l.rowSpan && l.rowSpan > 1) {
      classes.push(`row-span-${l.rowSpan}`);
    }

    // 2. Position (Dinamis: jika isAbsolute === true)
    if (c.position && c.position.isAbsolute) {
      classes.push('absolute');
      if (c.position.top !== null && c.position.top !== undefined) classes.push(getSpacingClass('top', c.position.top));
      if (c.position.left !== null && c.position.left !== undefined) classes.push(getSpacingClass('left', c.position.left));
      if (c.position.right !== null && c.position.right !== undefined) classes.push(getSpacingClass('right', c.position.right));
      if (c.position.bottom !== null && c.position.bottom !== undefined) classes.push(getSpacingClass('bottom', c.position.bottom));
      if (c.position.zIndex !== undefined && c.position.zIndex !== 1) classes.push(`z-[${c.position.zIndex}]`);
    }

    // 3. Dimensions (Width & Height)
    if (c.sizing && c.sizing.width && c.sizing.width.unit === 'full') {
      classes.push('w-full');
    } else if (t.width !== undefined) {
      classes.push(getSpacingClass('w', t.width));
    }

    if (c.sizing && c.sizing.height && c.sizing.height.unit === 'full') {
      classes.push('h-full');
    } else if (t.height !== undefined) {
      classes.push(getSpacingClass('h', t.height));
    }

    // 4. Background Fill
    if (s.fill && s.fill !== 'none') {
      if (s.fill.startsWith('#')) {
        classes.push(`bg-[${s.fill}]`);
      } else {
        classes.push(`bg-[${s.fill}]`);
      }
    }

    // 5. Border & Stroke
    const sw = s.strokeWidth !== undefined ? s.strokeWidth : 1;
    const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
    if (hasStroke && sw > 0) {
      classes.push(sw === 1 ? 'border' : `border-[${sw}px]`);
      if (s.stroke && s.stroke !== 'none') classes.push(`border-[${s.stroke}]`);
    }

    // 6. Corner Radius (All / Individual Corners)
    const cr = g.cornerRadius || s.cornerRadius;
    const getRadiusClass = (prefix, val) => {
      if (val === 4) return prefix ? `${prefix}` : 'rounded';
      if (val === 6) return `${prefix ? prefix + '-' : 'rounded-'}md`;
      if (val === 8) return `${prefix ? prefix + '-' : 'rounded-'}lg`;
      if (val === 12) return `${prefix ? prefix + '-' : 'rounded-'}xl`;
      if (val === 16) return `${prefix ? prefix + '-' : 'rounded-'}2xl`;
      if (val >= 999) return `${prefix ? prefix + '-' : 'rounded-'}full`;
      return `${prefix ? prefix + '-' : 'rounded-'}[${val}px]`;
    };

    if (Array.isArray(cr)) {
      const [tl, tr, br, bl] = cr;
      if (tl === tr && tr === br && br === bl) {
        if (tl > 0) classes.push(getRadiusClass('', tl));
      } else {
        if (tl > 0) classes.push(getRadiusClass('rounded-tl', tl));
        if (tr > 0) classes.push(getRadiusClass('rounded-tr', tr));
        if (br > 0) classes.push(getRadiusClass('rounded-br', br));
        if (bl > 0) classes.push(getRadiusClass('rounded-bl', bl));
      }
    } else if (parseFloat(cr) > 0) {
      classes.push(getRadiusClass('', parseFloat(cr)));
    }

    // 7. Shadow
    if (Array.isArray(s.effects) && s.effects.length > 0) {
      classes.push('shadow-md');
    }

    // 8. Typography & Text Formatting (Khusus Teks)
    if (obj.type === 'text') {
      // Font Size
      const fs = obj.fontSize || 16;
      const fontSizeMap = {
        12: 'text-xs',
        14: 'text-sm',
        16: 'text-base',
        18: 'text-lg',
        20: 'text-xl',
        24: 'text-2xl',
        30: 'text-3xl',
        36: 'text-4xl',
        48: 'text-5xl',
        60: 'text-6xl'
      };
      if (fontSizeMap[fs]) {
        classes.push(fontSizeMap[fs]);
      } else {
        classes.push(`text-[${fs}px]`);
      }

      // Font Weight
      const fw = String(obj.fontWeight || '400');
      const fontWeightMap = {
        '100': 'font-thin',
        '200': 'font-extralight',
        '300': 'font-light',
        '400': 'font-normal',
        '500': 'font-medium',
        '600': 'font-semibold',
        '700': 'font-bold',
        '800': 'font-extrabold',
        '900': 'font-black'
      };
      if (fontWeightMap[fw]) {
        classes.push(fontWeightMap[fw]);
      }

      // Text Align
      const ta = obj.textAlign || 'left';
      if (ta === 'center') classes.push('text-center');
      else if (ta === 'right') classes.push('text-right');
      else if (ta === 'justify') classes.push('text-justify');
      else if (ta === 'left') classes.push('text-left');

      // Leading (Line Height)
      const lh = obj.leadingPreset || (obj.lineHeightCustom ? (obj.lineHeight / (obj.fontSize || 16)) : 'normal');
      const leadingMap = {
        'none': 'leading-none',
        'tight': 'leading-tight',
        'snug': 'leading-snug',
        'normal': 'leading-normal',
        'relaxed': 'leading-relaxed',
        'loose': 'leading-loose'
      };
      if (leadingMap[lh]) {
        if (lh !== 'normal') classes.push(leadingMap[lh]);
      } else if (typeof lh === 'number' && lh > 0) {
        if (Math.abs(lh - 1.25) < 0.05) classes.push('leading-tight');
        else if (Math.abs(lh - 1.375) < 0.05) classes.push('leading-snug');
        else if (Math.abs(lh - 1.5) < 0.05) classes.push('leading-normal');
        else if (Math.abs(lh - 1.625) < 0.05) classes.push('leading-relaxed');
        else if (Math.abs(lh - 2) < 0.05) classes.push('leading-loose');
        else classes.push(`leading-[${Math.round(lh * 100) / 100}]`);
      }

      // Tracking (Letter Spacing)
      const tr = obj.trackingPreset || 'normal';
      const trackingMap = {
        'tighter': 'tracking-tighter',
        'tight': 'tracking-tight',
        'normal': 'tracking-normal',
        'wide': 'tracking-wide',
        'wider': 'tracking-wider',
        'widest': 'tracking-widest'
      };
      if (trackingMap[tr]) {
        if (tr !== 'normal') classes.push(trackingMap[tr]);
      } else if (parseFloat(obj.letterSpacing) > 0) {
        classes.push(`tracking-[${obj.letterSpacing}px]`);
      }
    }

    // 9. Custom classes
    if (c.customClasses) {
      classes.push(c.customClasses);
    }

    const classStr = classes.join(' ');
    const textContent = obj.type === 'text' ? (obj.content || obj.text || obj.name || 'Sample Text') : '';
    const exportFormat = (c && c.exportFormat) || 'html';

    // Format output berdasarkan pilihan: HTML | React (JSX) | Vue Template
    if (exportFormat === 'react') {
      const compName = (obj.name || 'MyComponent').replace(/[^a-zA-Z0-9]/g, '');
      const validCompName = compName ? (compName.charAt(0).toUpperCase() + compName.slice(1)) : 'Component';
      return `export default function ${validCompName}() {\n  return (\n    <${tag} className="${classStr}">\n      ${textContent}\n    </${tag}>\n  );\n}`;
    }

    if (exportFormat === 'vue') {
      return `<template>\n  <${tag} class="${classStr}">\n    ${textContent}\n  </${tag}>\n</template>`;
    }

    // Default HTML
    return `<${tag} class="${classStr}">\n  ${textContent}\n</${tag}>`;
  };

  window.CodeTailwind = {
    generate: toTailwind,
    spacingMap: tailwindSpacingMap
  };
})();
