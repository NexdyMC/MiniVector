/* ================= IMPORT SVG VECTOR ================= */
// Mengurai (parse) file SVG menjadi objek path/vektor native MiniVector (geometry.nodes)
// sehingga kotak seleksi pas 100%, dapat di-resize proporsional, dan diedit titiknya.

(function () {
  'use strict';

  const r2 = n => Math.round(n * 100) / 100;

  // Helper konversi warna SVG menjadi Hex / rgba
  const parseSvgColor = (colorStr, defaultColor = '#000000') => {
    if (!colorStr || colorStr === 'none' || colorStr === 'transparent') return 'none';
    if (colorStr === 'currentColor') return defaultColor;
    return colorStr.trim();
  };

  // Helper mencari atribut warisan (misal fill/stroke yang ditaruh di <g> atau <svg>)
  const getInheritedAttribute = (el, attrName, rootEl) => {
    let curr = el;
    while (curr && curr !== rootEl.parentElement) {
      if (curr.getAttribute && curr.getAttribute(attrName)) {
        return curr.getAttribute(attrName);
      }
      if (curr.style && curr.style[attrName]) {
        return curr.style[attrName];
      }
      curr = curr.parentElement;
    }
    return null;
  };

  /**
   * Parser instruksi path SVG ('M', 'L', 'C', 'S', 'Q', 'Z', dll.) menjadi array `nodes` native MiniVector
   */
  const parseSvgPathToNodes = (d) => {
    const tokens = d.match(/([a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi) || [];
    let i = 0;
    let currX = 0, currY = 0;
    let startX = 0, startY = 0;
    let lastControlX = 0, lastControlY = 0;
    let lastCmd = '';

    const nodes = [];

    const addNode = (x, y, handleIn = null, handleOut = null) => {
      nodes.push({
        x: r2(x),
        y: r2(y),
        handleIn: handleIn ? { x: r2(handleIn.x), y: r2(handleIn.y) } : null,
        handleOut: handleOut ? { x: r2(handleOut.x), y: r2(handleOut.y) } : null
      });
    };

    while (i < tokens.length) {
      const token = tokens[i];
      const isCmd = /^[a-df-z]$/i.test(token);
      let cmd = isCmd ? token : (lastCmd === 'M' ? 'L' : (lastCmd === 'm' ? 'l' : lastCmd));
      if (isCmd) i++;

      const isRel = cmd === cmd.toLowerCase();
      const type = cmd.toUpperCase();

      if (type === 'M') {
        const x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const y = (isRel ? currY : 0) + parseFloat(tokens[i++]);
        currX = x; currY = y;
        startX = x; startY = y;
        addNode(currX, currY);
      } else if (type === 'L') {
        const x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const y = (isRel ? currY : 0) + parseFloat(tokens[i++]);
        currX = x; currY = y;
        addNode(currX, currY);
      } else if (type === 'H') {
        const x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        currX = x;
        addNode(currX, currY);
      } else if (type === 'V') {
        const y = (isRel ? currY : 0) + parseFloat(tokens[i++]);
        currY = y;
        addNode(currX, currY);
      } else if (type === 'C') {
        const cp1x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const cp1y = (isRel ? currY : 0) + parseFloat(tokens[i++]);
        const cp2x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const cp2y = (isRel ? currY : 0) + parseFloat(tokens[i++]);
        const x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const y = (isRel ? currY : 0) + parseFloat(tokens[i++]);

        if (nodes.length > 0) {
          nodes[nodes.length - 1].handleOut = { x: r2(cp1x), y: r2(cp1y) };
        }
        currX = x; currY = y;
        lastControlX = cp2x; lastControlY = cp2y;
        addNode(currX, currY, { x: cp2x, y: cp2y }, null);
      } else if (type === 'S') {
        let cp1x = currX;
        let cp1y = currY;
        if (lastCmd.toUpperCase() === 'C' || lastCmd.toUpperCase() === 'S') {
          cp1x = 2 * currX - lastControlX;
          cp1y = 2 * currY - lastControlY;
        }
        const cp2x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const cp2y = (isRel ? currY : 0) + parseFloat(tokens[i++]);
        const x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const y = (isRel ? currY : 0) + parseFloat(tokens[i++]);

        if (nodes.length > 0) {
          nodes[nodes.length - 1].handleOut = { x: r2(cp1x), y: r2(cp1y) };
        }
        currX = x; currY = y;
        lastControlX = cp2x; lastControlY = cp2y;
        addNode(currX, currY, { x: cp2x, y: cp2y }, null);
      } else if (type === 'Q') {
        const qx = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const qy = (isRel ? currY : 0) + parseFloat(tokens[i++]);
        const x = (isRel ? currX : 0) + parseFloat(tokens[i++]);
        const y = (isRel ? currY : 0) + parseFloat(tokens[i++]);

        const cp1x = currX + (2 / 3) * (qx - currX);
        const cp1y = currY + (2 / 3) * (qy - currY);
        const cp2x = x + (2 / 3) * (qx - x);
        const cp2y = y + (2 / 3) * (qy - y);

        if (nodes.length > 0) {
          nodes[nodes.length - 1].handleOut = { x: r2(cp1x), y: r2(cp1y) };
        }
        currX = x; currY = y;
        lastControlX = qx; lastControlY = qy;
        addNode(currX, currY, { x: cp2x, y: cp2y }, null);
      } else if (type === 'Z') {
        currX = startX; currY = startY;
      }
      lastCmd = cmd;
    }

    return nodes;
  };

  /**
   * Hitung batas sebenarnya (true bounding box) dari sekumpulan nodes dan handles
   */
  const computeNodesBounds = (nodes) => {
    if (!nodes || nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
      if (n.handleIn) {
        minX = Math.min(minX, n.handleIn.x);
        minY = Math.min(minY, n.handleIn.y);
        maxX = Math.max(maxX, n.handleIn.x);
        maxY = Math.max(maxY, n.handleIn.y);
      }
      if (n.handleOut) {
        minX = Math.min(minX, n.handleOut.x);
        minY = Math.min(minY, n.handleOut.y);
        maxX = Math.max(maxX, n.handleOut.x);
        maxY = Math.max(maxY, n.handleOut.y);
      }
    });
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    return { x: minX, y: minY, width: w, height: h };
  };

  /**
   * Parser teks SVG mentah menjadi elemen-elemen vektor native MiniVector
   * @param {string} svgText Teks XML dari file SVG
   * @param {object} worldDropPos Posisi koordinat world kursor saat drop (opsional)
   * @param {string} fileName Nama file untuk memberi label layer
   * @returns {Array} Array objek MiniVector yang siap ditambahkan ke State.objects
   */
  const parseSVGToObjects = (svgText, worldDropPos, fileName = 'Icon') => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return null;

      // Kumpulkan semua elemen visual: path, rect, circle, ellipse, polygon, line
      const visualElements = svgEl.querySelectorAll('path, rect, circle, ellipse, polygon, line');
      if (!visualElements.length) return null;

      const importedObjects = [];
      const cleanName = fileName.replace(/\.[^.]+$/, '');
      const MAX_SIZE = 120; // Batas ukuran default saat baru diimpor agar proporsional di kanvas

      visualElements.forEach((el, index) => {
        let pathData = '';
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'path') {
          pathData = el.getAttribute('d') || '';
        } else if (tagName === 'rect') {
          const rx = parseFloat(el.getAttribute('x')) || 0;
          const ry = parseFloat(el.getAttribute('y')) || 0;
          const rw = parseFloat(el.getAttribute('width')) || 0;
          const rh = parseFloat(el.getAttribute('height')) || 0;
          if (rw > 0 && rh > 0) {
            pathData = `M ${rx} ${ry} H ${rx + rw} V ${ry + rh} H ${rx} Z`;
          }
        } else if (tagName === 'circle') {
          const cx = parseFloat(el.getAttribute('cx')) || 0;
          const cy = parseFloat(el.getAttribute('cy')) || 0;
          const cr = parseFloat(el.getAttribute('r')) || 0;
          if (cr > 0) {
            pathData = `M ${cx - cr} ${cy} A ${cr} ${cr} 0 1 0 ${cx + cr} ${cy} A ${cr} ${cr} 0 1 0 ${cx - cr} ${cy} Z`;
          }
        } else if (tagName === 'ellipse') {
          const cx = parseFloat(el.getAttribute('cx')) || 0;
          const cy = parseFloat(el.getAttribute('cy')) || 0;
          const rx = parseFloat(el.getAttribute('rx')) || 0;
          const ry = parseFloat(el.getAttribute('ry')) || 0;
          if (rx > 0 && ry > 0) {
            pathData = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
          }
        } else if (tagName === 'polygon') {
          const pts = (el.getAttribute('points') || '').trim();
          if (pts) {
            const coords = pts.split(/[\s,]+/).map(parseFloat);
            if (coords.length >= 4) {
              pathData = `M ${coords[0]} ${coords[1]}`;
              for (let k = 2; k < coords.length; k += 2) {
                pathData += ` L ${coords[k]} ${coords[k + 1]}`;
              }
              pathData += ' Z';
            }
          }
        } else if (tagName === 'line') {
          const x1 = parseFloat(el.getAttribute('x1')) || 0;
          const y1 = parseFloat(el.getAttribute('y1')) || 0;
          const x2 = parseFloat(el.getAttribute('x2')) || 0;
          const y2 = parseFloat(el.getAttribute('y2')) || 0;
          pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        if (!pathData.trim()) return;

        // 1. Parse menjadi titik-titik nodes native MiniVector
        const rawNodes = parseSvgPathToNodes(pathData);
        if (!rawNodes || rawNodes.length < 2) return;

        // 2. Hitung bounding box sebenarnya langsung dari nodes (Bukan tebakan viewBox yang meleset)
        const b = computeNodesBounds(rawNodes);
        if (b.width <= 0 || b.height <= 0) return;

        // 3. Normalisasikan titik-titik kurva agar pas 100% dimulai dari (0, 0)
        let scale = 1;
        if (b.width > MAX_SIZE || b.height > MAX_SIZE) {
          scale = Math.min(MAX_SIZE / b.width, MAX_SIZE / b.height);
        }

        const targetW = Math.round(b.width * scale);
        const targetH = Math.round(b.height * scale);

        const localNodes = rawNodes.map(n => ({
          x: r2((n.x - b.x) * scale),
          y: r2((n.y - b.y) * scale),
          handleIn: n.handleIn ? { x: r2((n.handleIn.x - b.x) * scale), y: r2((n.handleIn.y - b.y) * scale) } : null,
          handleOut: n.handleOut ? { x: r2((n.handleOut.x - b.x) * scale), y: r2((n.handleOut.y - b.y) * scale) } : null
        }));

        // 4. Hitung posisi penempatan di kanvas kursor
        let placeX = worldDropPos ? (worldDropPos.x - targetW / 2) : (-State.panX + (window.innerWidth / 2) - (targetW / 2)) / State.zoom;
        let placeY = worldDropPos ? (worldDropPos.y - targetH / 2) : (-State.panY + (window.innerHeight / 2) - (targetH / 2)) / State.zoom;
        placeX = Math.round(placeX);
        placeY = Math.round(placeY);

        // Ambil styling warna fill dan stroke (dukung warisan dari parent <g> atau <svg>)
        let rawFill = getInheritedAttribute(el, 'fill', svgEl);
        if (rawFill === null) rawFill = '#000000';
        const parsedFill = parseSvgColor(rawFill, '#000000');

        let rawStroke = getInheritedAttribute(el, 'stroke', svgEl);
        const parsedStroke = parseSvgColor(rawStroke, 'none');

        const rawStrokeWidth = getInheritedAttribute(el, 'stroke-width', svgEl);
        const strokeWidth = parseFloat(rawStrokeWidth) || 1;

        const pathId = `path-${newObjectId()}`;
        const pathObj = {
          id: pathId,
          type: 'path', // Objek vektor native sejati yang didukung oleh seluruh alat MiniVector
          name: visualElements.length > 1 ? `${cleanName} Part ${index + 1}` : cleanName,
          visible: true,
          locked: false,
          closed: tagName !== 'line' && /z/i.test(pathData),
          transform: {
            x: placeX,
            y: placeY,
            width: targetW,
            height: targetH,
            rotation: 0,
            pivot: { x: 0.5, y: 0.5 }
          },
          geometry: {
            nodes: localNodes
          },
          style: {
            fill: parsedFill,
            fills: parsedFill !== 'none' ? [{
              id: `fill-${newObjectId()}`,
              type: 'SOLID',
              color: parsedFill,
              opacity: 1,
              visible: true
            }] : [],
            stroke: parsedStroke,
            strokeWidth: strokeWidth,
            strokeCap: el.getAttribute('stroke-linecap') || 'round',
            strokeJoin: el.getAttribute('stroke-linejoin') || 'round',
            strokes: parsedStroke !== 'none' ? [{
              id: `stroke-${newObjectId()}`,
              type: 'SOLID',
              color: parsedStroke,
              opacity: 1,
              visible: true
            }] : []
          }
        };

        importedObjects.push(pathObj);
      });

      return importedObjects;
    } catch (e) {
      console.error('Failed to parse SVG to native nodes:', e);
      return null;
    }
  };

  window.SvgVectorImporter = {
    parseSVGToObjects
  };
})();
