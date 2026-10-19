/* ================= BOOLEAN OPERATIONS ENGINE ================= */
// Mengimplementasikan operasi Boolean ala Figma & Illustrator:
// 1. Union (Gabungan bentuk)
// 2. Subtract (Difference - Bentuk bawah dipotong bentuk atas)
// 3. Intersect (Irisan dua bentuk)
// 4. Exclude (XOR - Bagian yang tidak beririsan)
// Bekerja pada 2 atau lebih objek shape/vektor apapun (Rectangle, Ellipse, Polygon, Star, Path).
// Menghasilkan objek baru bertipe 'path' yang dapat diedit langsung menggunakan Pen Tool & Node Editor.
// Bergantung pada: variabel.js (State, newObjectId), geometry.js (Geo), canvas.js (requestRender), undo.js (History).

const BooleanOps = (() => {
  const r2 = n => Math.round(n * 100) / 100;

  /* -------------------------------------------------------------
   * 1. Helper Konversi Objek Menjadi Poligon 2D Tertutup
   * ------------------------------------------------------------- */
  const rotatePoint = (x, y, cx, cy, rad) => {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: cos * (x - cx) - sin * (y - cy) + cx,
      y: sin * (x - cx) + cos * (y - cy) + cy
    };
  };

  // Mengubah objek apapun (termasuk rotasi & flip) ke representasi poligon koordinat dunia
  const objectToPolygon = (o, parentOffset = { x: 0, y: 0 }) => {
    if (!o || !o.transform) return null;
    const t = o.transform;
    const absX = parentOffset.x + t.x;
    const absY = parentOffset.y + t.y;
    const w = t.width;
    const h = t.height;
    const cx = absX + w / 2;
    const cy = absY + h / 2;
    const rot = t.rotation || 0;
    const rad = (rot * Math.PI) / 180;
    const flipX = !!t.flipX;
    const flipY = !!t.flipY;

    // Transformasikan titik lokal (0 s.d. w, 0 s.d. h) ke koordinat dunia terotasi
    const transformPt = (lx, ly) => {
      let nx = absX + (flipX ? (w - lx) : lx);
      let ny = absY + (flipY ? (h - ly) : ly);
      if (rot !== 0) {
        return rotatePoint(nx, ny, cx, cy, rad);
      }
      return { x: nx, y: ny };
    };

    const pts = [];

    if (o.type === 'rectangle') {
      const cr = (o.geometry && o.geometry.cornerRadius) || (o.style && o.style.cornerRadius) || 0;
      const radius = Array.isArray(cr) ? cr[0] : (parseFloat(cr) || 0);

      if (radius <= 0) {
        pts.push(transformPt(0, 0));
        pts.push(transformPt(w, 0));
        pts.push(transformPt(w, h));
        pts.push(transformPt(0, h));
      } else {
        // Sample sudut melengkung
        const maxR = Math.min(w / 2, h / 2);
        const r = Math.min(radius, maxR);
        const segments = 8;
        const addCorner = (cornerCx, cornerCy, startAngle) => {
          for (let i = 0; i <= segments; i++) {
            const a = startAngle + (i / segments) * (Math.PI / 2);
            pts.push(transformPt(cornerCx + r * Math.cos(a), cornerCy + r * Math.sin(a)));
          }
        };
        addCorner(w - r, r, -Math.PI / 2);
        addCorner(w - r, h - r, 0);
        addCorner(r, h - r, Math.PI / 2);
        addCorner(r, r, Math.PI);
      }
    } else if (o.type === 'ellipse') {
      const rx = w / 2;
      const ry = h / 2;
      const segments = 64;
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(transformPt(rx + rx * Math.cos(a), ry + ry * Math.sin(a)));
      }
    } else if (o.type === 'polygon') {
      const count = Math.max(3, parseInt(o.geometry && o.geometry.pointCount, 10) || 3);
      const rx = w / 2;
      const ry = h / 2;
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        pts.push(transformPt(rx + rx * Math.cos(a), ry + ry * Math.sin(a)));
      }
    } else if (o.type === 'star') {
      const g = o.geometry || {};
      const count = Math.max(3, parseInt(g.pointCount, 10) || 5);
      const ratio = Math.max(0.05, Math.min(0.95, (parseFloat(g.innerRadiusRatio) || 38.2) / 100));
      const rx = w / 2;
      const ry = h / 2;
      const total = count * 2;
      for (let i = 0; i < total; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / total;
        const factor = (i % 2 === 0) ? 1 : ratio;
        pts.push(transformPt(rx + rx * factor * Math.cos(a), ry + ry * factor * Math.sin(a)));
      }
    } else if (o.type === 'path' || o.type === 'vector') {
      const nodes = (o.geometry && o.geometry.nodes) || [];
      if (nodes.length < 3) return null;

      // Sample Bezier curve menjadi poligon titik padat
      for (let i = 0; i < nodes.length; i++) {
        const curr = nodes[i];
        const next = nodes[(i + 1) % nodes.length];
        if (!o.closed && i === nodes.length - 1) {
          pts.push(transformPt(curr.x, curr.y));
          break;
        }

        if (curr.handleOut || next.handleIn) {
          const p0 = { x: curr.x, y: curr.y };
          const p1 = curr.handleOut ? { x: curr.handleOut.x, y: curr.handleOut.y } : p0;
          const p2 = next.handleIn ? { x: next.handleIn.x, y: next.handleIn.y } : { x: next.x, y: next.y };
          const p3 = { x: next.x, y: next.y };

          const steps = 12;
          for (let step = 0; step < steps; step++) {
            const u = step / steps;
            const u1 = 1 - u;
            const bx = u1 * u1 * u1 * p0.x + 3 * u1 * u1 * u * p1.x + 3 * u1 * u * u * p2.x + u * u * u * p3.x;
            const by = u1 * u1 * u1 * p0.y + 3 * u1 * u1 * u * p1.y + 3 * u1 * u * u * p2.y + u * u * u * p3.y;
            pts.push(transformPt(bx, by));
          }
        } else {
          pts.push(transformPt(curr.x, curr.y));
        }
      }
    } else {
      // Default fallback: bounding box
      pts.push(transformPt(0, 0));
      pts.push(transformPt(w, 0));
      pts.push(transformPt(w, h));
      pts.push(transformPt(0, h));
    }

    return pts;
  };

  /* -------------------------------------------------------------
   * 2. Polygon Clipping & Boolean Operations (Greiner-Hormann Style)
   * ------------------------------------------------------------- */
  // Mengecek apakah titik P berada di dalam poligon (Ray-casting algorithm)
  const isPointInsidePoly = (pt, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < ((xj - xi) * (pt.y - yi)) / ((yj - yi) || 0.00001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Mencari titik potong antara dua segmen garis (p1-p2 dan p3-p4)
  const lineIntersection = (p1, p2, p3, p4) => {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return null; // Garis paralel

    const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      return {
        x: p1.x + u * (p2.x - p1.x),
        y: p1.y + u * (p2.y - p1.y),
        u,
        v
      };
    }
    return null;
  };

  // Hitung luas poligon (shoelace formula) untuk mengecek arah putaran (winding order)
  const getPolygonArea = (poly) => {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      area += poly[i].x * poly[j].y;
      area -= poly[j].x * poly[i].y;
    }
    return area / 2;
  };

  // Pastikan poligon berputar searah jarum jam (CW)
  const ensureClockwise = (poly) => {
    if (getPolygonArea(poly) < 0) {
      return poly.slice().reverse();
    }
    return poly;
  };

  // Melakukan operasi Boolean antara 2 poligon sederhana
  const clipPolygons = (polyA, polyB, operation) => {
    polyA = ensureClockwise(polyA);
    polyB = ensureClockwise(polyB);

    // Bangun vertex list untuk A dan B
    const listA = polyA.map((p, idx) => ({ ...p, isIntersection: false, partner: null, index: idx }));
    const listB = polyB.map((p, idx) => ({ ...p, isIntersection: false, partner: null, index: idx }));

    // Cari semua titik persimpangan
    const intersections = [];

    for (let i = 0; i < polyA.length; i++) {
      const a1 = polyA[i];
      const a2 = polyA[(i + 1) % polyA.length];

      for (let j = 0; j < polyB.length; j++) {
        const b1 = polyB[j];
        const b2 = polyB[(j + 1) % polyB.length];

        const inter = lineIntersection(a1, a2, b1, b2);
        if (inter) {
          intersections.push({
            pt: { x: inter.x, y: inter.y },
            edgeA: i,
            uA: inter.u,
            edgeB: j,
            uB: inter.v
          });
        }
      }
    }

    // Jika tidak ada irisan sama sekali
    if (intersections.length === 0) {
      const aInsideB = isPointInsidePoly(polyA[0], polyB);
      const bInsideA = isPointInsidePoly(polyB[0], polyA);

      if (operation === 'union') {
        if (aInsideB) return [polyB];
        if (bInsideA) return [polyA];
        return [polyA, polyB]; // Dua bentuk terpisah
      } else if (operation === 'subtract') {
        if (aInsideB) return []; // Habis terpotong
        if (bInsideA) return [polyA, polyB]; // B memotong bagian dalam A (lubang)
        return [polyA]; // Tidak bersentuhan, A utuh
      } else if (operation === 'intersect') {
        if (aInsideB) return [polyA];
        if (bInsideA) return [polyB];
        return []; // Tidak ada irisan
      } else if (operation === 'exclude') {
        if (aInsideB) return [polyB];
        if (bInsideA) return [polyA];
        return [polyA, polyB];
      }
    }

    // Sisipkan titik perpotongan ke dalam rantai titik listA dan listB
    const sortedForA = intersections.slice().sort((a, b) => a.edgeA === b.edgeA ? a.uA - b.uA : a.edgeA - b.edgeA);
    const sortedForB = intersections.slice().sort((a, b) => a.edgeB === b.edgeB ? a.uB - b.uB : a.edgeB - b.edgeB);

    const fullA = [];
    for (let i = 0; i < polyA.length; i++) {
      fullA.push(polyA[i]);
      const onEdge = sortedForA.filter(x => x.edgeA === i);
      onEdge.forEach(x => {
        const ptObj = { x: x.pt.x, y: x.pt.y, isIntersection: true, meta: x };
        x.nodeA = ptObj;
        fullA.push(ptObj);
      });
    }

    const fullB = [];
    for (let j = 0; j < polyB.length; j++) {
      fullB.push(polyB[j]);
      const onEdge = sortedForB.filter(x => x.edgeB === j);
      onEdge.forEach(x => {
        const ptObj = { x: x.pt.x, y: x.pt.y, isIntersection: true, meta: x };
        x.nodeB = ptObj;
        fullB.push(ptObj);
      });
    }

    // Tautkan partner titik potong
    intersections.forEach(x => {
      if (x.nodeA && x.nodeB) {
        x.nodeA.partner = x.nodeB;
        x.nodeB.partner = x.nodeA;
      }
    });

    // Tandai status titik: apakah masuk atau keluar (entry / exit)
    let insideB = isPointInsidePoly(fullA[0], polyB);
    fullA.forEach(pt => {
      if (pt.isIntersection) {
        pt.entry = !insideB;
        insideB = !insideB;
      }
    });

    let insideA = isPointInsidePoly(fullB[0], polyA);
    fullB.forEach(pt => {
      if (pt.isIntersection) {
        pt.entry = !insideA;
        insideA = !insideA;
      }
    });

    // Telusuri loop kurva hasil operasi boolean
    const visited = new Set();
    const resultPolys = [];

    const findStartIntersection = () => {
      for (const pt of fullA) {
        if (pt.isIntersection && !visited.has(pt)) {
          if (operation === 'union' && !pt.entry) return pt;
          if (operation === 'subtract' && pt.entry) return pt;
          if (operation === 'intersect' && pt.entry) return pt;
          if (operation === 'exclude') return pt;
        }
      }
      return null;
    };

    let startNode;
    let guard = 0;
    while ((startNode = findStartIntersection()) && guard++ < 30) {
      const currentPoly = [];
      let curr = startNode;
      let onA = true;
      let stepGuard = 0;

      while (curr && stepGuard++ < 1000) {
        visited.add(curr);
        if (curr.partner) visited.add(curr.partner);

        currentPoly.push({ x: curr.x, y: curr.y });

        if (curr.isIntersection && currentPoly.length > 1 && Math.hypot(curr.x - startNode.x, curr.y - startNode.y) < 1e-4) {
          break; // Loop tertutup
        }

        if (curr.isIntersection) {
          // Beralih antara poligon A dan B
          if (operation === 'union') {
            onA = !curr.entry;
            curr = onA ? curr : curr.partner;
          } else if (operation === 'subtract') {
            onA = curr.entry;
            curr = onA ? curr : curr.partner;
          } else if (operation === 'intersect') {
            onA = curr.entry;
            curr = onA ? curr : curr.partner;
          } else if (operation === 'exclude') {
            onA = !onA;
            curr = curr.partner || curr;
          }
        }

        // Ambil vertex berikutnya
        const currentList = onA ? fullA : fullB;
        const curIdx = currentList.indexOf(curr);
        let nextIdx = (curIdx + 1) % currentList.length;

        // Untuk subtract saat menelusuri batas pemotong B, telusuri secara terbalik
        if (operation === 'subtract' && !onA) {
          nextIdx = (curIdx - 1 + currentList.length) % currentList.length;
        }

        curr = currentList[nextIdx];
      }

      if (currentPoly.length >= 3) {
        resultPolys.push(currentPoly);
      }
    }

    if (resultPolys.length > 0) {
      return resultPolys;
    }

    // Fallback bila poligon kompleks gagal dilacak
    return [polyA];
  };

  /* -------------------------------------------------------------
   * 3. Sederhanakan Poligon Hasil Menjadi Nodes Bezier Path
   * ------------------------------------------------------------- */
  const polyToNodes = (poly) => {
    // Saring titik-titik yang terlalu rapat (< 1.5px)
    const cleaned = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      if (cleaned.length === 0) {
        cleaned.push(p);
      } else {
        const last = cleaned[cleaned.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 1.5) {
          cleaned.push(p);
        }
      }
    }

    if (cleaned.length >= 3) {
      const first = cleaned[0];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < 2) {
        cleaned.pop();
      }
    }

    return cleaned;
  };

  /* -------------------------------------------------------------
   * 4. Eksekusi Operasi Boolean Utama (Union, Subtract, Intersect, Exclude)
   * ------------------------------------------------------------- */
  const execute = (operation) => {
    const sel = Geo.selection();
    if (!sel || sel.length < 2) {
      alert('Pilih minimal 2 objek untuk melakukan Boolean Operation!');
      return false;
    }

    // Urutan layer: dari paling bawah ke paling atas
    // Objek di sel[0] adalah objek acuan bawah, objek di atasnya memotong/digabungkan
    const shapes = sel.map(f => ({
      obj: f.obj,
      poly: objectToPolygon(f.obj, f.origin),
      parent: f.parent,
      origin: f.origin
    })).filter(s => s.poly && s.poly.length >= 3);

    if (shapes.length < 2) {
      alert('Bentuk yang dipilih tidak valid untuk Boolean Operation.');
      return false;
    }

    // Ambil style dasar dari objek pertama (fill, stroke, dsb.)
    const baseObj = shapes[0].obj;
    const baseStyle = JSON.parse(JSON.stringify(baseObj.style || {}));
    if (!baseStyle.fill && (!baseStyle.fills || baseStyle.fills.length === 0)) {
      baseStyle.fill = '#D9D9D9';
    }

    // Lakukan operasi akumulatif
    let combinedPolys = [shapes[0].poly];

    for (let i = 1; i < shapes.length; i++) {
      const nextPoly = shapes[i].poly;
      const nextStepPolys = [];

      for (const curP of combinedPolys) {
        const clipped = clipPolygons(curP, nextPoly, operation);
        nextStepPolys.push(...clipped);
      }

      combinedPolys = nextStepPolys;
    }

    if (!combinedPolys || combinedPolys.length === 0) {
      alert('Hasil operasi Boolean kosong.');
      return false;
    }

    // Pilih poligon dengan area terbesar sebagai bentuk utama
    combinedPolys.sort((a, b) => Math.abs(getPolygonArea(b)) - Math.abs(getPolygonArea(a)));
    const primaryPoly = polyToNodes(combinedPolys[0]);

    if (primaryPoly.length < 3) {
      alert('Gagal mengomputasi kurva Boolean.');
      return false;
    }

    // Hitung bounding box baru dari koordinat dunia
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    primaryPoly.forEach(pt => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });

    const parentOrigin = shapes[0].origin || { x: 0, y: 0 };
    const localBoxX = r2(minX - parentOrigin.x);
    const localBoxY = r2(minY - parentOrigin.y);
    const boxW = Math.max(1, r2(maxX - minX));
    const boxH = Math.max(1, r2(maxY - minY));

    // Normalisasi nodes menjadi lokal (0 s.d. boxW, 0 s.d. boxH)
    const localNodes = primaryPoly.map(pt => ({
      x: r2(pt.x - minX),
      y: r2(pt.y - minY),
      handleIn: null,
      handleOut: null
    }));

    const opNames = {
      union: 'Union',
      subtract: 'Subtract',
      intersect: 'Intersect',
      exclude: 'Exclude'
    };

    const newPathObj = {
      id: `path-${newObjectId()}`,
      type: 'path',
      name: `${opNames[operation] || 'Boolean'} Shape`,
      visible: true,
      locked: false,
      closed: true,
      transform: {
        x: localBoxX,
        y: localBoxY,
        width: boxW,
        height: boxH,
        rotation: 0
      },
      geometry: {
        nodes: localNodes
      },
      style: baseStyle
    };

    // Hapus objek-objek sumber dari canvas/frame
    const idsToRemove = new Set(shapes.map(s => s.obj.id));
    const targetParent = shapes[0].parent;

    if (targetParent && Array.isArray(targetParent.children)) {
      targetParent.children = targetParent.children.filter(c => !idsToRemove.has(c.id));
      targetParent.children.push(newPathObj);
    } else {
      State.objects = State.objects.filter(o => !idsToRemove.has(o.id));
      State.objects.push(newPathObj);
    }

    // Seleksi objek hasil boolean yang baru
    State.selectedIds = [newPathObj.id];

    // Trigger update aplikasi
    $(document).trigger('selection:change');
    $(document).trigger('object:change');
    if (window.History && typeof window.History.record === 'function') {
      window.History.record();
    }
    if (typeof requestRender === 'function') {
      requestRender();
    }

    return newPathObj;
  };

  return {
    union: () => execute('union'),
    subtract: () => execute('subtract'),
    intersect: () => execute('intersect'),
    exclude: () => execute('exclude')
  };
})();

// Pasang ke window global agar dapat dipanggil dari UI toolbar, shortcut, dan context menu
window.BooleanOps = BooleanOps;
