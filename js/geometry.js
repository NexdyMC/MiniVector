/* ================= GEOMETRY (helper bersama panel Design) ================= */
// Bergantung pada: variabel.js (State). cvEl / requestRender (canvas.js) dipakai saat runtime.
// Koordinat anak frame relatif terhadap frame induknya; "origin" = posisi dunia titik (0,0) lokal induk.
// API: Geo.find(id), Geo.selection(), Geo.bounds(f), Geo.union(list), Geo.setSize(obj, w, h), Geo.watch(fn)
const Geo = (() => {
  // cari objek berdasarkan id (rekursif) → { obj, arr, index, parent, origin }
  const find = (id, list = State.objects, parent = null, origin = { x: 0, y: 0 }) => {
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.id === id) return { obj: o, arr: list, index: i, parent, origin };
      if (Array.isArray(o.children) && o.children.length) {
        const t = o.transform || { x: 0, y: 0 };
        const r = find(id, o.children, o, { x: origin.x + t.x, y: origin.y + t.y });
        if (r) return r;
      }
    }
    return null;
  };
  const descendants = (o, set) => {
    (o.children || []).forEach(c => {
      set.add(c.id);
      descendants(c, set);
    });
    return set;
  };
  // objek terpilih, tanpa yang leluhurnya juga terpilih (mereka ikut bergerak bersama induknya)
  const selection = () => {
    const found = (State.selectedIds || []).map(id => find(String(id))).filter(f => f && f.obj.transform);
    const covered = new Set();
    found.forEach(f => descendants(f.obj, covered));
    return found.filter(f => !covered.has(f.obj.id));
  };
  // kotak pembatas dalam koordinat dunia
  const bounds = f => {
    const o = f.obj;
    if (o.type === 'group' && Array.isArray(o.children) && o.children.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const baseAbsX = f.origin.x + o.transform.x;
      const baseAbsY = f.origin.y + o.transform.y;
      o.children.forEach(c => {
        if (!c.transform) return;
        const cX = baseAbsX + c.transform.x;
        const cY = baseAbsY + c.transform.y;
        const cW = c.transform.width;
        const cH = c.transform.height;
        if (cX < minX) minX = cX;
        if (cY < minY) minY = cY;
        if (cX + cW > maxX) maxX = cX + cW;
        if (cY + cH > maxY) maxY = cY + cH;
      });
      if (minX !== Infinity) {
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    }
    return {
      x: f.origin.x + o.transform.x,
      y: f.origin.y + o.transform.y,
      width: o.transform.width,
      height: o.transform.height
    };
  };
  const union = list => {
    if (!list.length) return null;
    const bs = list.map(bounds);
    const x0 = Math.min(...bs.map(b => b.x)),
      y0 = Math.min(...bs.map(b => b.y));
    const x1 = Math.max(...bs.map(b => b.x + b.width)),
      y1 = Math.max(...bs.map(b => b.y + b.height));
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  };
  // ubah ukuran; titik p0..p3 persegi ikut disesuaikan selama bukan custom path (lihat StructureJSON.md)
  const setSize = (o, w, h) => {
    const oldW = o.transform.width;
    const oldH = o.transform.height;
    o.transform.width = w;
    o.transform.height = h;
    const g = o.geometry;
    if (o.type === 'rectangle' && g && g.isCustomPath !== true && Array.isArray(g.nodes) && g.nodes.length === 4) {
      g.nodes = [
        { id: 'p0', x: 0, y: 0 },
        { id: 'p1', x: w, y: 0 },
        { id: 'p2', x: w, y: h },
        { id: 'p3', x: 0, y: h }
      ];
    } else if (o.type === 'path' && g && Array.isArray(g.nodes) && oldW > 0 && oldH > 0) {
      const sx = w / oldW;
      const sy = h / oldH;
      g.nodes.forEach(n => {
        n.x *= sx;
        n.y *= sy;
        if (n.handleIn) {
          n.handleIn.x *= sx;
          n.handleIn.y *= sy;
        }
        if (n.handleOut) {
          n.handleOut.x *= sx;
          n.handleOut.y *= sy;
        }
      });
    }
  };

  // panel mendaftar fungsi refresh(force); dipanggil saat seleksi / data berubah dan saat objek di-drag
  const watchers = [];
  const run = force => watchers.forEach(fn => fn(force));
  const watch = fn => {
    watchers.push(fn);
    fn(true);
  };
  $(document).on('selection:change object:change object:add object:remove project:load', () => run(true));
  $(function() {
    $('<style>').text(
      '.fg-ib:disabled{opacity:.4;cursor:not-allowed}' +
      '.fg-in input:disabled{opacity:.55}' +
      '.fg-ib[aria-pressed="true"]{background:rgba(13,153,255,.25);color:#0D99FF}'
    ).appendTo('head');
    let queued = false;
    cvEl.addEventListener('pointermove', () => { // objek yang sedang di-drag: angka di panel ikut berubah
      if (queued || !(State.selectedIds || []).length) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        run(false);
      });
    });
  });

  return { find, selection, bounds, union, setSize, watch };
})();