/* ================= TOOL: FRAME ================= */
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, snapWorld, requestRender).
// Drag di canvas saat State.tool === 'frame' → frame baru di State.objects.
// Event: 'object:add' [obj] setelah frame tersimpan.
(function () {
    const TOOL = 'frame';
    const MIN_PX = 4; // drag lebih kecil dari ini (px layar) dibatalkan
    const r2 = n => Math.round(n * 100) / 100;
    let start = null,
        pointerId = null;

    const makeFrame = () => ({
        id: null,
        type: 'frame',
        name: '',
        visible: true,
        locked: false,
        open: true, // untuk status expand/collapse di panel layer
        clipContent: true, // memotong elemen anak yang keluar garis batas
        transform: { x: 0, y: 0, width: 0, height: 0, rotation: 0, pivot: { x: 0.5, y: 0.5 } },
        geometry: { cornerRadius: [0, 0, 0, 0] },
        style: { fill: '#FFFFFF', stroke: '#E5E5E5', strokeWidth: 1 },
        children: [] // elemen yang berada di dalam frame
    });

    const shape = (o, a, b) => {
        const w = r2(Math.abs(a.x - b.x)),
            h = r2(Math.abs(a.y - b.y));
        Object.assign(o.transform, { x: r2(Math.min(a.x, b.x)), y: r2(Math.min(a.y, b.y)), width: w, height: h });
    };

    const cancel = () => {
        if (!start) return;
        start = null;
        pointerId = null;
        State.drawing = null;
        requestRender();
    };

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0 || start) return;
        start = snapWorld(eventToWorld(e), e);
        pointerId = e.pointerId;
        cvEl.setPointerCapture(e.pointerId);
        State.drawing = makeFrame();
        shape(State.drawing, start, start);
        requestRender();
    });

    cvEl.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== pointerId) return;
        shape(State.drawing, start, snapWorld(eventToWorld(e), e));
        requestRender();
    });

    cvEl.addEventListener('pointerup', e => {
        if (!start || e.pointerId !== pointerId) return;
        const o = State.drawing,
            min = MIN_PX / State.zoom;
        shape(o, start, snapWorld(eventToWorld(e), e));
        if (o.transform.width < min || o.transform.height < min) return cancel();

        const n = newObjectId();
        o.id = 'frame-' + n;
        o.name = 'Frame ' + n;
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
