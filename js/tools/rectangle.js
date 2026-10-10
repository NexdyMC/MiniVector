/* ================= TOOL: RECTANGLE ================= */
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, requestRender).
// Drag di canvas saat State.tool === 'rectangle' → persegi baru di State.objects.
// Event: 'object:add' [obj] setelah persegi tersimpan (hook untuk layers / undo nanti).
// Skema mengikuti Structure-JSON.md: 4 titik lokal (p0..p3) di geometry.nodes, posisi + ukuran + rotasi di transform.
(function () {
    const TOOL = 'rectangle';
    const MIN_PX = 4; // drag lebih kecil dari ini (px layar, di salah satu sisi) dianggap klik dan dibatalkan
    const r2 = n => Math.round(n * 100) / 100;
    let start = null, // titik awal drag (koordinat dunia)
        pointerId = null;

    // titik sudut dalam koordinat lokal objek (kiri-atas = 0,0), searah jarum jam
    const buildNodes = (w, h) => [
        { id: 'p0', x: 0, y: 0 },
        { id: 'p1', x: w, y: 0 },
        { id: 'p2', x: w, y: h },
        { id: 'p3', x: 0, y: h }
    ];
    const makeRect = () => ({
        id: null, // diisi saat commit supaya drag yang dibatalkan tidak memakai id
        type: 'rectangle',
        name: '',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 0, height: 0, rotation: 0, pivot: { x: 0.5, y: 0.5 } },
        geometry: { isCustomPath: false, cornerRadius: [0, 0, 0, 0], nodes: buildNodes(0, 0) },
        style: { fill: '#D9D9D9', stroke: '#000000', strokeWidth: 1 }
    });
    // drag ke arah mana pun → x,y = pojok kiri-atas, width/height selalu positif
    const shape = (o, a, b) => {
        const w = r2(Math.abs(a.x - b.x)),
            h = r2(Math.abs(a.y - b.y));
        Object.assign(o.transform, { x: r2(Math.min(a.x, b.x)), y: r2(Math.min(a.y, b.y)), width: w, height: h });
        o.geometry.nodes = buildNodes(w, h);
    };
    const cancel = () => {
        if (!start) return; // hanya membatalkan drag milik tool ini
        start = null;
        pointerId = null;
        State.drawing = null;
        requestRender();
    };

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0 || start) return;
        start = snapWorld(eventToWorld(e), e); // [EDIT] snap ke grid 1×1; tahan Ctrl untuk menonaktifkan
        pointerId = e.pointerId;
        cvEl.setPointerCapture(e.pointerId);
        State.drawing = makeRect();
        shape(State.drawing, start, start);
        requestRender();
    });
    cvEl.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== pointerId) return;
        shape(State.drawing, start, snapWorld(eventToWorld(e), e)); // [EDIT] snap pratinjau drag
        requestRender();
    });
    cvEl.addEventListener('pointerup', e => {
        if (!start || e.pointerId !== pointerId) return;
        const o = State.drawing,
            min = MIN_PX / State.zoom;
        shape(o, start, snapWorld(eventToWorld(e), e)); // [EDIT] snap titik akhir saat commit
        if (o.transform.width < min || o.transform.height < min) return cancel();
        const n = newObjectId();
        o.id = 'rect-' + n;
        o.name = 'Rectangle ' + n;
        start = null;
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