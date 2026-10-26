// Modul helper untuk mengubah objek MiniVector menjadi inline SVG atau IMG tag
(function () {
  'use strict';

  /**
   * Helper mengekstrak path d atau polygon points dari sebuah vector object
   */
  const getVectorSvgSnippet = (obj, options = {}) => {
    if (!obj) return '';
    const t = obj.transform || { width: 24, height: 24 };
    const w = Math.round(t.width || 24);
    const h = Math.round(t.height || 24);
    const s = obj.style || {};
    const c = obj.code || {};
    const useCurrentColor = c.svgColorMode !== 'original';

    let fillAttr = 'fill="none"';
    let strokeAttr = '';

    if (s.fill && s.fill !== 'none') {
      fillAttr = useCurrentColor ? 'fill="currentColor"' : `fill="${s.fill}"`;
    }
    const bw = s.strokeWidth !== undefined ? s.strokeWidth : 0;
    if (bw > 0 && s.stroke && s.stroke !== 'none') {
      strokeAttr = useCurrentColor ? `stroke="currentColor" stroke-width="${bw}"` : `stroke="${s.stroke}" stroke-width="${bw}"`;
    }

    let innerContent = '';
    const geom = obj.geometry || {};

    if (obj.type === 'path') {
      if (geom.pathData) {
        const vb = geom.viewBox || { x: 0, y: 0, width: w, height: h };
        innerContent = `<path d="${geom.pathData}" ${fillAttr} ${strokeAttr} />`;
      } else if (Array.isArray(geom.nodes) && geom.nodes.length > 1) {
        const nodes = geom.nodes;
        let d = `M ${nodes[0].x} ${nodes[0].y}`;
        for (let i = 1; i < nodes.length; i++) {
          const prev = nodes[i - 1];
          const curr = nodes[i];
          if (prev.handleOut || curr.handleIn) {
            const cp1x = prev.handleOut ? prev.handleOut.x : prev.x;
            const cp1y = prev.handleOut ? prev.handleOut.y : prev.y;
            const cp2x = curr.handleIn ? curr.handleIn.x : curr.x;
            const cp2y = curr.handleIn ? curr.handleIn.y : curr.y;
            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
          } else {
            d += ` L ${curr.x} ${curr.y}`;
          }
        }
        if (obj.closed && nodes.length > 2) {
          d += ' Z';
        }
        innerContent = `<path d="${d}" ${fillAttr} ${strokeAttr} />`;
      }
    } else if (obj.type === 'ellipse') {
      innerContent = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" ${fillAttr} ${strokeAttr} />`;
    } else if (obj.type === 'rect') {
      const cr = geom.cornerRadius || s.cornerRadius || 0;
      const rxAttr = cr ? `rx="${cr}"` : '';
      innerContent = `<rect width="${w}" height="${h}" ${rxAttr} ${fillAttr} ${strokeAttr} />`;
    } else if (obj.type === 'polygon' || obj.type === 'star') {
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const count = Math.max(3, parseInt(geom.pointCount, 10) || (obj.type === 'polygon' ? 3 : 5));
      const pts = [];
      if (obj.type === 'polygon') {
        for (let i = 0; i < count; i++) {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
          pts.push(`${Math.round(cx + rx * Math.cos(angle))},${Math.round(cy + ry * Math.sin(angle))}`);
        }
      } else {
        const innerRatio = parseFloat(geom.innerRadius) || 0.382;
        const totalPts = count * 2;
        for (let i = 0; i < totalPts; i++) {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalPts;
          const rFactorX = (i % 2 === 0) ? rx : rx * innerRatio;
          const rFactorY = (i % 2 === 0) ? ry : ry * innerRatio;
          pts.push(`${Math.round(cx + rFactorX * Math.cos(angle))},${Math.round(cy + rFactorY * Math.sin(angle))}`);
        }
      }
      innerContent = `<polygon points="${pts.join(' ')}" ${fillAttr} ${strokeAttr} />`;
    }

    if (!innerContent) {
      innerContent = `<rect width="${w}" height="${h}" ${fillAttr} ${strokeAttr} />`;
    }

    return { w, h, innerContent };
  };

  /**
   * Helper mengekstrak URL atau inline source gambar
   */
  const getImageSource = (obj) => {
    if (!obj) return '';
    const sty = obj.style || {};
    const c = obj.code || {};
    if (c.imageSrc) return c.imageSrc;
    if (obj.src) return obj.src;
    
    // Cek fill bertipe image
    const fills = Array.isArray(sty.fills) ? sty.fills : [];
    const imgFill = fills.find(f => f && f.type === 'IMAGE' && f.url);
    if (imgFill) return imgFill.url;

    // Placeholder fallback
    const t = obj.transform || { width: 300, height: 200 };
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=${Math.round(t.width || 300)}&auto=format&fit=crop&q=80`;
  };

  window.CodeMedia = {
    getVectorSvgSnippet,
    getImageSource
  };
})();
