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

  // Helper Box Shadow Tailwind Mapper
  const getTailwindShadowClass = (effects) => {
    if (!Array.isArray(effects) || effects.length === 0) return null;
    const shadows = effects.filter(e => e && e.visible !== false && (e.type === 'drop-shadow' || e.type === 'inner-shadow'));
    if (shadows.length === 0) return null;

    // Jika tepat 1 shadow, periksa apakah cocok dengan preset Tailwind standar
    if (shadows.length === 1) {
      const e = shadows[0];
      const isInner = e.type === 'inner-shadow';
      const x = typeof e.x === 'number' ? e.x : 0;
      const y = typeof e.y === 'number' ? e.y : 0;
      const blur = typeof e.blur === 'number' ? e.blur : 0;
      const spread = typeof e.spread === 'number' ? e.spread : 0;
      const op = typeof e.opacity === 'number' ? e.opacity : 0.25;
      const col = (e.color || '#000000').toLowerCase();
      const isBlack = col === '#000000' || col === '#000';

      if (isInner) {
        if (x === 0 && y === 2 && blur === 4 && isBlack) return 'shadow-inner';
      } else {
        if (x === 0 && y === 1 && blur === 2 && isBlack && op <= 0.1) return 'shadow-sm';
        if (x === 0 && y === 1 && blur === 3 && isBlack) return 'shadow';
        if (x === 0 && y === 4 && blur === 6 && isBlack) return 'shadow-md';
        if (x === 0 && y === 10 && blur === 15 && isBlack) return 'shadow-lg';
        if (x === 0 && y === 20 && blur === 25 && isBlack) return 'shadow-xl';
        if (x === 0 && y === 25 && blur === 50 && isBlack) return 'shadow-2xl';
      }
    }

    // Jika custom atau multi-shadow, buat arbitrary shadow-[...]
    const parts = shadows.map(e => {
      const inset = e.type === 'inner-shadow' ? 'inset_' : '';
      const x = (typeof e.x === 'number' ? e.x : 0) + 'px';
      const y = (typeof e.y === 'number' ? e.y : 4) + 'px';
      const blur = (typeof e.blur === 'number' ? e.blur : 8) + 'px';
      const spread = typeof e.spread === 'number' && e.spread !== 0 ? ('_' + e.spread + 'px') : '';
      const op = typeof e.opacity === 'number' ? e.opacity : 0.25;
      let cleanHex = (e.color || '#000000').replace('#', '');
      if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
      const num = parseInt(cleanHex, 16);
      const r = isNaN(num) ? 0 : (num >> 16) & 255;
      const g = isNaN(num) ? 0 : (num >> 8) & 255;
      const b = isNaN(num) ? 0 : num & 255;
      const color = `rgba(${r},${g},${b},${op})`;
      return `${inset}${x}_${y}_${blur}${spread}_${color}`;
    });

    return `shadow-[${parts.join(',')}]`;
  };

  // Tailwind Palette Color Mapper
  const tailwindColorPalette = {
    '#ffffff': 'bg-white',
    '#000000': 'bg-black',
    '#f8fafc': 'bg-slate-50', '#f1f5f9': 'bg-slate-100', '#e2e8f0': 'bg-slate-200', '#cbd5e1': 'bg-slate-300',
    '#94a3b8': 'bg-slate-400', '#64748b': 'bg-slate-500', '#475569': 'bg-slate-600', '#334155': 'bg-slate-700',
    '#1e293b': 'bg-slate-800', '#0f172a': 'bg-slate-900', '#020617': 'bg-slate-950',
    '#ef4444': 'bg-red-500', '#dc2626': 'bg-red-600', '#b91c1c': 'bg-red-700',
    '#f97316': 'bg-orange-500', '#ea580c': 'bg-orange-600',
    '#f59e0b': 'bg-amber-500', '#d97706': 'bg-amber-600',
    '#10b981': 'bg-emerald-500', '#059669': 'bg-emerald-600',
    '#06b6d4': 'bg-cyan-500', '#0891b2': 'bg-cyan-600',
    '#3b82f6': 'bg-blue-500', '#2563eb': 'bg-blue-600', '#1d4ed8': 'bg-blue-700',
    '#6366f1': 'bg-indigo-500', '#4f46e5': 'bg-indigo-600', '#4338ca': 'bg-indigo-700',
    '#8b5cf6': 'bg-purple-500', '#7c3aed': 'bg-purple-600', '#6d28d9': 'bg-purple-700',
    '#ec4899': 'bg-pink-500', '#db2777': 'bg-pink-600',
    '#f43f5e': 'bg-rose-500', '#e11d48': 'bg-rose-600'
  };

  const getTailwindBgColor = (hex) => {
    if (!hex) return null;
    const lower = hex.toLowerCase();
    if (tailwindColorPalette[lower]) return tailwindColorPalette[lower];
    return `bg-[${hex}]`;
  };

  const getTailwindGradientClass = (fill) => {
    if (!fill || fill.type !== 'GRADIENT_LINEAR') return null;

    // Calculate angle in CSS degrees
    let deg = 90;
    if (typeof Paint !== 'undefined' && typeof Paint.linearAngle === 'function') {
      deg = Math.round((Paint.linearAngle(fill) + 90) % 360);
    } else if (fill.start && fill.end) {
      const s = fill.start, e = fill.end;
      const a = (Math.atan2(e.y - s.y, e.x - s.x) * 180 / Math.PI + 360) % 360;
      deg = Math.round((a + 90) % 360);
    }

    const stops = (Array.isArray(fill.stops) ? fill.stops : [])
      .filter(st => st && isFinite(st.offset))
      .sort((a, b) => a.offset - b.offset);

    if (stops.length < 2) return null;

    // Arah standar mata angin (8 arah)
    const angleMap = {
      90: 'to-r',
      135: 'to-br',
      180: 'to-b',
      225: 'to-bl',
      270: 'to-l',
      315: 'to-tl',
      0: 'to-t',
      360: 'to-t',
      45: 'to-tr'
    };

    // Cari arah mata angin yang paling dekat (toleransi +/- 5 derajat)
    let matchedDir = null;
    for (const [angleStr, dir] of Object.entries(angleMap)) {
      const a = parseInt(angleStr, 10);
      if (Math.abs(deg - a) <= 5) {
        matchedDir = dir;
        break;
      }
    }

    // Kasus 1: Tepat 2 atau 3 warna DAN memiliki sudut arah standar Tailwind (to-r, to-br, dll.)
    if (matchedDir && stops.length <= 3) {
      const classes = [`bg-gradient-${matchedDir}`];
      const fromColor = (stops[0].color || '#000000').toLowerCase();
      const toColor = (stops[stops.length - 1].color || '#ffffff').toLowerCase();

      // From color class
      const fromBg = tailwindColorPalette[fromColor] ? tailwindColorPalette[fromColor].replace('bg-', 'from-') : `from-[${fromColor}]`;
      classes.push(fromBg);

      // Via color class (jika 3 warna)
      if (stops.length === 3) {
        const viaColor = (stops[1].color || '#888888').toLowerCase();
        const viaBg = tailwindColorPalette[viaColor] ? tailwindColorPalette[viaColor].replace('bg-', 'via-') : `via-[${viaColor}]`;
        classes.push(viaBg);
      }

      // To color class
      const toBg = tailwindColorPalette[toColor] ? tailwindColorPalette[toColor].replace('bg-', 'to-') : `to-[${toColor}]`;
      classes.push(toBg);

      return classes.join(' ');
    }

    // Kasus 2: Multi-color (4 s/d 6+ warna) ATAU sudut kustom bebas (misal 120deg, 30deg)
    // Gunakan Arbitrary Tailwind linear-gradient yang presisi!
    const stopParts = stops.map(st => {
      const col = st.color || '#000000';
      const pct = Math.round(st.offset * 100);
      return `${col}_${pct}%`;
    });

    return `bg-[linear-gradient(${deg}deg,${stopParts.join(',')})]`;
  };

  const getSpacingClass = (prefix, px) => {
    const rounded = Math.round(px);
    if (tailwindSpacingMap[rounded] !== undefined) {
      return `${prefix}-${tailwindSpacingMap[rounded]}`;
    }
    return `${prefix}-[${rounded}px]`;
  };

  /**
   * Helper mengekstrak daftar class Tailwind untuk satu node tunggal.
   * Parameter isChildOfFreeFrame bernilai true jika node berada di dalam frame dengan display: 'none' (canvas bebas).
   */
  const getNodeClasses = (obj, isChildOfFreeFrame = false) => {
    if (!obj || !obj.transform) return [];

    const t = obj.transform;
    const s = obj.style || {};
    const g = obj.geometry || {};
    const l = obj.layout || {};
    const c = obj.code || {};
    const classes = [];

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
        if (obj.clipContent !== false) classes.push('overflow-hidden');
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

        if (obj.clipContent !== false) classes.push('overflow-hidden');
      } else {
        // Frame Canvas Bebas -> Beri relative dan overflow-hidden agar child absolute posisinya presisi
        classes.push('relative');
        if (obj.clipContent !== false) classes.push('overflow-hidden');
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

    // 2. Position (Dinamis: jika isActive / isAbsolute ATAU anak dari frame canvas bebas)
    const hasExplicitPos = c.position && (c.position.isActive || c.position.isAbsolute);

    if (hasExplicitPos) {
      const pType = c.position.type || 'absolute';
      classes.push(pType);

      const hasTop = c.position.top !== null && c.position.top !== undefined && c.position.top !== '';
      const hasRight = c.position.right !== null && c.position.right !== undefined && c.position.right !== '';
      const hasBottom = c.position.bottom !== null && c.position.bottom !== undefined && c.position.bottom !== '';
      const hasLeft = c.position.left !== null && c.position.left !== undefined && c.position.left !== '';

      const topVal = parseFloat(c.position.top);
      const rightVal = parseFloat(c.position.right);
      const bottomVal = parseFloat(c.position.bottom);
      const leftVal = parseFloat(c.position.left);

      if (hasTop && hasRight && hasBottom && hasLeft && topVal === 0 && rightVal === 0 && bottomVal === 0 && leftVal === 0) {
        classes.push('inset-0');
      } else {
        if (hasTop) classes.push(getSpacingClass('top', topVal));
        if (hasRight) classes.push(getSpacingClass('right', rightVal));
        if (hasBottom) classes.push(getSpacingClass('bottom', bottomVal));
        if (hasLeft) classes.push(getSpacingClass('left', leftVal));
      }

      if (c.position.zIndex !== undefined && c.position.zIndex !== null && c.position.zIndex !== '' && c.position.zIndex !== 1) {
        const zNum = parseInt(c.position.zIndex, 10);
        if ([0, 10, 20, 30, 40, 50].includes(zNum)) {
          classes.push(`z-${zNum}`);
        } else if (c.position.zIndex === 'auto') {
          classes.push('z-auto');
        } else {
          classes.push(`z-[${c.position.zIndex}]`);
        }
      }
    } else if (isChildOfFreeFrame) {
      // Jika berada di frame canvas bebas, pasang absolute dengan koordinat t.x dan t.y
      classes.push('absolute');
      if (t.x !== undefined) classes.push(getSpacingClass('left', t.x));
      if (t.y !== undefined) classes.push(getSpacingClass('top', t.y));
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

    // 4. Background Fill (Solid / Multi-Stop Gradients / Tailwind Mapping)
    // Catatan: Jika objek teks, s.fill diperlakukan sebagai text color (bukan bg color)
    if (obj.type !== 'text') {
      const fills = Array.isArray(s.fills) ? s.fills.filter(f => f && f.visible !== false) : [];
      if (fills.length > 0) {
        const topFill = fills[fills.length - 1];
        if (topFill.type === 'SOLID') {
          const bgClass = getTailwindBgColor(topFill.color || '#D9D9D9');
          if (bgClass) classes.push(bgClass);
        } else if (topFill.type === 'GRADIENT_LINEAR') {
          const gradClass = getTailwindGradientClass(topFill);
          if (gradClass) classes.push(gradClass);
        }
      } else if (s.fill && s.fill !== 'none') {
        const bgClass = getTailwindBgColor(s.fill);
        if (bgClass) classes.push(bgClass);
      }
    }

    // 5. Border & Stroke
    const sw = s.strokeWidth !== undefined ? s.strokeWidth : 1;
    const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
    if (hasStroke && sw > 0) {
      classes.push(sw === 1 ? 'border' : `border-[${sw}px]`);
      if (s.stroke && s.stroke !== 'none') {
        const strokeCol = (s.stroke || '').toLowerCase();
        const strokeClass = tailwindColorPalette[strokeCol] ? tailwindColorPalette[strokeCol].replace('bg-', 'border-') : `border-[${s.stroke}]`;
        classes.push(strokeClass);
      }
    }

    // 6. Corner Radius (All / Individual Corners)
    const cr = g.cornerRadius || s.cornerRadius;
    const getRadiusClass = (prefix, val) => {
      if (val === 4) return prefix ? `${prefix}` : 'rounded';
      if (val === 6) return `${prefix ? prefix + '-' : 'rounded-'}md`;
      if (val === 8) return `${prefix ? prefix + '-' : 'rounded-'}lg`;
      if (val === 12) return `${prefix ? prefix + '-' : 'rounded-'}xl`;
      if (val === 16) return `${prefix ? prefix + '-' : 'rounded-'}2xl`;
      if (val === 24) return `${prefix ? prefix + '-' : 'rounded-'}3xl`;
      if (val >= 999) return prefix ? `${prefix}-full` : 'rounded-full';
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

    // 7. Shadow & Effects
    if (Array.isArray(s.effects) && s.effects.length > 0) {
      const shadowClass = getTailwindShadowClass(s.effects);
      if (shadowClass) classes.push(shadowClass);

      const layerBlur = s.effects.find(e => e && e.visible !== false && e.type === 'layer-blur');
      if (layerBlur && layerBlur.blur > 0) {
        classes.push(`blur-[${layerBlur.blur}px]`);
      }
      const bgBlur = s.effects.find(e => e && e.visible !== false && e.type === 'background-blur');
      if (bgBlur && bgBlur.blur > 0) {
        classes.push(`backdrop-blur-[${bgBlur.blur}px]`);
      }
    }

    // 7b. Opacity
    if (s.opacity !== undefined && s.opacity !== null && s.opacity < 1) {
      const opPct = Math.round(s.opacity * 100);
      const standardOpacities = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100];
      if (standardOpacities.includes(opPct)) {
        classes.push(`opacity-${opPct}`);
      } else {
        classes.push(`opacity-[${s.opacity}]`);
      }
    }

    // 8. Typography & Text Formatting (Khusus Teks)
    if (obj.type === 'text') {
      const fs = obj.fontSize || 16;
      const fontSizeMap = {
        12: 'text-xs', 14: 'text-sm', 16: 'text-base', 18: 'text-lg',
        20: 'text-xl', 24: 'text-2xl', 30: 'text-3xl', 36: 'text-4xl',
        48: 'text-5xl', 60: 'text-6xl'
      };
      if (fontSizeMap[fs]) classes.push(fontSizeMap[fs]);
      else classes.push(`text-[${fs}px]`);

      const fw = String(obj.fontWeight || '400');
      const fontWeightMap = {
        '100': 'font-thin', '200': 'font-extralight', '300': 'font-light',
        '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold',
        '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black'
      };
      if (fontWeightMap[fw]) classes.push(fontWeightMap[fw]);

      const ta = obj.textAlign || 'left';
      if (ta === 'center') classes.push('text-center');
      else if (ta === 'right') classes.push('text-right');
      else if (ta === 'justify') classes.push('text-justify');

      if (s.fill && s.fill !== 'none') {
        const textCol = (s.fill || '').toLowerCase();
        const textColClass = tailwindColorPalette[textCol] ? tailwindColorPalette[textCol].replace('bg-', 'text-') : `text-[${s.fill}]`;
        classes.push(textColClass);
      }

      const lp = obj.leadingPreset || 'normal';
      const leadingMap = {
        'none': 'leading-none', 'tight': 'leading-tight', 'snug': 'leading-snug',
        'normal': 'leading-normal', 'relaxed': 'leading-relaxed', 'loose': 'leading-loose'
      };
      if (leadingMap[lp] && lp !== 'normal') classes.push(leadingMap[lp]);

      const tr = obj.trackingPreset || 'normal';
      const trackingMap = {
        'tighter': 'tracking-tighter', 'tight': 'tracking-tight', 'normal': 'tracking-normal',
        'wide': 'tracking-wide', 'wider': 'tracking-wider', 'widest': 'tracking-widest'
      };
      if (trackingMap[tr] && tr !== 'normal') classes.push(trackingMap[tr]);
    }

    // 8b. Interactive States (:hover, :active, :focus)
    const states = c.states || {};
    const hasAnyState = Object.keys(states).some(k => states[k] && Object.keys(states[k]).length > 0);

    if (hasAnyState) {
      // Transition class (default transition-all duration-200)
      const transDur = (states.hover && states.hover.transition) || (states.active && states.active.transition) || '200';
      if (transDur !== 'none') {
        classes.push('transition-all');
        if (transDur !== '150') classes.push(`duration-${transDur}`);
        else classes.push('duration-150');
      }

      ['hover', 'active', 'focus'].forEach(stKey => {
        const st = states[stKey];
        if (!st) return;
        const prefix = `${stKey}:`;

        // Background / Fill
        if (st.fill && st.fill !== 'none') {
          const col = st.fill.toLowerCase();
          const colClass = tailwindColorPalette[col] || `bg-[${st.fill}]`;
          classes.push(`${prefix}${colClass}`);
        }

        // Text Color
        if (st.textColor && st.textColor !== 'none') {
          const col = st.textColor.toLowerCase();
          const colClass = tailwindColorPalette[col] ? tailwindColorPalette[col].replace('bg-', 'text-') : `text-[${st.textColor}]`;
          classes.push(`${prefix}${colClass}`);
        }

        // Scale
        if (st.scale && parseFloat(st.scale) !== 1) {
          const scNum = parseFloat(st.scale);
          const scMap = {
            0.95: 'scale-95', 0.9: 'scale-90', 1.05: 'scale-105', 1.1: 'scale-110', 1.25: 'scale-125'
          };
          if (scMap[scNum]) {
            classes.push(`${prefix}${scMap[scNum]}`);
          } else {
            classes.push(`${prefix}scale-[${scNum}]`);
          }
        }

        // Opacity
        if (st.opacity !== undefined && st.opacity !== '' && st.opacity !== null) {
          const op = parseInt(st.opacity, 10);
          if (!isNaN(op) && op < 100) {
            classes.push(`${prefix}opacity-${op}`);
          }
        }

        // Shadow
        if (st.shadow && st.shadow !== 'inherit') {
          if (st.shadow === 'none') {
            classes.push(`${prefix}shadow-none`);
          } else {
            classes.push(`${prefix}shadow-${st.shadow}`);
          }
        }
      });
    }

    // 9. Custom class / Identifier
    const customCls = c.customClass ? c.customClass.trim().replace(/^[.#]/, '') : '';
    if (customCls) {
      classes.unshift(customCls);
    } else if (c.customClasses) {
      classes.push(c.customClasses);
    }

    return classes;
  };

  /**
   * Rekursif: Mengonversi elemen beserta seluruh elemen anaknya menjadi pohon DOM HTML/JSX.
   */
  const renderNodeToTailwind = (node, isChildOfFreeFrame = false, indent = 0, isReact = false) => {
    if (!node || node.visible === false) return '';

    const ind = '  '.repeat(indent);
    const c = node.code || {};
    const defaultTag = (c && c.htmlTag) || (node.type === 'text' ? 'p' : 'div');
    const tag = defaultTag;
    const classes = getNodeClasses(node, isChildOfFreeFrame);
    const classAttr = isReact ? 'className' : 'class';
    const classStr = classes.length > 0 ? ` ${classAttr}="${classes.join(' ')}"` : '';

    // 1. Jika objek adalah Image
    const isImageObj = node.type === 'image' || (node.style && Array.isArray(node.style.fills) && node.style.fills.some(f => f && f.type === 'IMAGE'));
    if (isImageObj) {
      const src = (typeof window !== 'undefined' && window.CodeMedia) ? window.CodeMedia.getImageSource(node) : (node.src || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe');
      const alt = node.name || 'Image';
      const fitCls = (node.code && node.code.imageFit === 'contain') ? 'object-contain' : 'object-cover';
      const fullClassStr = classStr ? classStr.replace('"', `"${fitCls} `) : ` ${classAttr}="${fitCls}"`;
      return `${ind}<img src="${src}" alt="${alt}"${fullClassStr} />`;
    }

    // 2. Jika objek adalah Vector / Path / Icon
    const isVectorObj = node.type === 'path' || node.type === 'polygon' || node.type === 'star';
    if (isVectorObj && typeof window !== 'undefined' && window.CodeMedia) {
      const svgInfo = window.CodeMedia.getVectorSvgSnippet(node);
      const viewBox = `viewBox="0 0 ${svgInfo.w} ${svgInfo.h}"`;
      return `${ind}<svg ${viewBox}${classStr} fill="none" xmlns="http://www.w3.org/2000/svg">
${ind}  ${svgInfo.innerContent}
${ind}</svg>`;
    }

    // 3. Jika objek adalah Text
    if (node.type === 'text') {
      const textVal = node.content || node.text || node.name || 'Sample Text';
      return `${ind}<${tag}${classStr}>${textVal}</${tag}>`;
    }

    // Periksa apakah node memiliki children (misal Frame)
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    if (!hasChildren) {
      return `${ind}<${tag}${classStr}></${tag}>`;
    }

    // Apakah frame ini bertipe free-canvas (display: 'none')?
    const isFreeCanvas = !node.layout || node.layout.display === 'none';

    // Rekursif render setiap child
    const renderedChildren = node.children
      .map(child => renderNodeToTailwind(child, isFreeCanvas, indent + 1, isReact))
      .filter(html => html.length > 0)
      .join('\n');

    return `${ind}<${tag}${classStr}>\n${renderedChildren}\n${ind}</${tag}>`;
  };

  const toTailwind = (obj) => {
    if (!obj || !obj.transform) return '<!-- Tidak ada objek terpilih -->';

    const c = obj.code || {};
    const exportFormat = (c && c.exportFormat) || 'html';
    const isReact = exportFormat === 'react';

    // Render tree secara rekursif mulai dari root object
    const bodyCode = renderNodeToTailwind(obj, false, (isReact ? 2 : 0), isReact);

    // Format output berdasarkan pilihan: HTML | React (JSX) | Vue Template
    if (exportFormat === 'react') {
      const rawComp = (c && c.componentName) ? c.componentName.trim() : (obj.name || 'MyComponent');
      const compName = rawComp.replace(/[^a-zA-Z0-9]/g, '');
      const validCompName = compName ? (compName.charAt(0).toUpperCase() + compName.slice(1)) : 'Component';
      return `export default function ${validCompName}() {\n  return (\n${bodyCode}\n  );\n}`;
    }

    if (exportFormat === 'vue') {
      return `<template>\n${bodyCode.split('\n').map(l => '  ' + l).join('\n')}\n</template>`;
    }

    // Default HTML
    return bodyCode;
  };

  window.CodeTailwind = {
    generate: toTailwind,
    spacingMap: tailwindSpacingMap
  };
})();