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

    const shape = (o, a, b, isShift) => {
        if (!o || !o.transform) return;
        let w = Math.abs(a.x - b.x);
        let h = Math.abs(a.y - b.y);
        if (isShift) {
            const side = Math.max(w, h);
            w = side;
            h = side;
            const signX = (b.x < a.x) ? -1 : 1;
            const signY = (b.y < a.y) ? -1 : 1;
            b = { x: a.x + signX * side, y: a.y + signY * side };
        }
        Object.assign(o.transform, { x: r2(Math.min(a.x, b.x)), y: r2(Math.min(a.y, b.y)), width: r2(w), height: r2(h) });
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
        shape(State.drawing, start, start, e.shiftKey);
        requestRender();
    });

    cvEl.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== pointerId) return;
        shape(State.drawing, start, snapWorld(eventToWorld(e), e), e.shiftKey);
        requestRender();
    });

    cvEl.addEventListener('pointerup', e => {
        if (!start || e.pointerId !== pointerId) return;
        const o = State.drawing,
            min = MIN_PX / State.zoom;
        shape(o, start, snapWorld(eventToWorld(e), e), e.shiftKey);
        if (o.transform.width < min || o.transform.height < min) return cancel();

        const n = newObjectId();
        o.id = 'frame-' + n;
        o.name = 'Frame ' + n;
        start = null;
        pointerId = null;
        State.drawing = null;
        State.objects.push(o);
        State.selectedIds = [o.id];
        $(document).trigger('object:add', [o]);
        $(document).trigger('selection:change');
        if (typeof window.pickTool === 'function') {
            window.pickTool('select');
        }
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
