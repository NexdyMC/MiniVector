/* ================= TOOL: ELLIPSE / CIRCLE ================= */
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, snapWorld, requestRender).
// Drag di canvas saat State.tool === 'ellipse' → ellipse baru di State.objects (kotak pembatas = area drag).
// Tahan Shift → lingkaran sempurna; tahan Ctrl / Cmd → tanpa snap ke grid 1×1.
// Event: 'object:add' [obj] setelah objek tersimpan (layers / undo mendengarkan ini).
// Skema mengikuti StructureJSON.md (tipe "ellipse"): posisi + ukuran + rotasi di transform, tanpa nodes.
(function() {
  const TOOL = 'ellipse'; // sesuai data-tool tombol "Ellipse (O)" di toolbar
  const MIN_PX = 4; // gerakan mouse lebih kecil dari ini (px layar) dianggap klik dan dibatalkan
  const r2 = n => Math.round(n * 100) / 100;
  let start = null, // titik awal drag (koordinat dunia, belum di-snap; untuk membedakan klik vs drag)
    from = null, // titik awal setelah snap
    pointerId = null;

  const makeEllipse = () => ({
    id: null, // diisi saat commit supaya drag yang dibatalkan tidak memakai id
    type: 'ellipse',
    name: '',
    visible: true,
    locked: false,
    transform: { x: 0, y: 0, width: 0, height: 0, rotation: 0, pivot: { x: 0.5, y: 0.5 } },
    geometry: { isCustomPath: false },
    style: { fill: '#D9D9D9', stroke: '#000000', strokeWidth: 1 }
  });
  // Shift: sisi terpanjang dipakai untuk kedua sumbu, arah drag dipertahankan
  const lockSquare = (a, b) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      size = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: a.x + (dx < 0 ? -size : size), y: a.y + (dy < 0 ? -size : size) };
  };
  // drag ke arah mana pun → x,y = pojok kiri-atas kotak pembatas, width/height selalu positif
  const shape = (o, a, b, square) => {
    if (square) b = lockSquare(a, b);
    Object.assign(o.transform, {
      x: r2(Math.min(a.x, b.x)),
      y: r2(Math.min(a.y, b.y)),
      width: r2(Math.abs(a.x - b.x)),
      height: r2(Math.abs(a.y - b.y))
    });
  };
  const cancel = () => {
    if (!start) return; // hanya membatalkan drag milik tool ini
    start = null;
    from = null;
    pointerId = null;
    State.drawing = null;
    requestRender();
  };

  cvEl.addEventListener('pointerdown', e => {
    if (State.tool !== TOOL || e.button !== 0 || start) return;
    start = eventToWorld(e);
    from = snapWorld(start, e);
    pointerId = e.pointerId;
    cvEl.setPointerCapture(e.pointerId);
    State.drawing = makeEllipse();
    shape(State.drawing, from, from, false);
    requestRender();
  });
  cvEl.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== pointerId) return;
    shape(State.drawing, from, snapWorld(eventToWorld(e), e), e.shiftKey);
    requestRender();
  });
  cvEl.addEventListener('pointerup', e => {
    if (!start || e.pointerId !== pointerId) return;
    const o = State.drawing,
      end = eventToWorld(e),
      z = State.zoom;
    shape(o, from, snapWorld(end, e), e.shiftKey);
    // klik / getaran kecil = bukan drag (diukur dari gerakan mouse asli, bukan hasil snap);
    // dengan Shift cukup satu sumbu yang cukup panjang, karena bentuk dikunci menjadi lingkaran
    const rx = Math.abs(end.x - start.x) * z,
      ry = Math.abs(end.y - start.y) * z;
    const tooSmall = e.shiftKey ? Math.max(rx, ry) < MIN_PX : (rx < MIN_PX || ry < MIN_PX);
    if (tooSmall || o.transform.width <= 0 || o.transform.height <= 0) return cancel();
    const n = newObjectId();
    o.id = 'ellipse-' + n;
    o.name = 'Ellipse ' + n;
    start = null;
    from = null;
    pointerId = null;
    State.drawing = null;
    State.objects.push(o);
    $(document).trigger('object:add', [o]);
    requestRender();
  });
  cvEl.addEventListener('pointercancel', e => {
    if (e.pointerId === pointerId) cancel();
  });
  $(document).on('tool:change', cancel);
  $(document).on('keydown', e => {
    if (e.key === 'Escape') cancel();
  });
})();