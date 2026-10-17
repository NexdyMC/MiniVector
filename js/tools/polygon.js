/* ================= TOOL: POLYGON ================= */
// Mengimplementasikan pembuatan poligon reguler (default: Segitiga / 3 sisi).
// Drag di canvas saat State.tool === 'polygon' → poligon baru di State.objects.
// Tahan Shift → kunci rasio aspek 1:1 (lebar == tinggi).
// Tahan Alt → drag berpusat dari titik awal klik mouse.
// Setelah dibuat: objek otomatis terpilih dan tool otomatis kembali ke 'select' (ala Figma).
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, requestRender, snapWorld).

(function () {
    const TOOL = 'polygon';
    const MIN_PX = 4;
    const r2 = n => Math.round(n * 100) / 100;
    let start = null,
        from = null,
        pointerId = null;

    const makePolygon = () => ({
        id: null,
        type: 'polygon',
        name: '',
        visible: true,
        locked: false,
        transform: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            pivot: { x: 0.5, y: 0.5 }
        },
        geometry: {
            pointCount: 3,
            cornerRadius: 0
        },
        style: {
            fill: '#D9D9D9',
            stroke: '#000000',
            strokeWidth: 1,
            fills: []
        }
    });

    const shape = (o, a, b, isShift) => {
        let w = b.x - a.x;
        let h = b.y - a.y;
        if (isShift) {
            const side = Math.max(Math.abs(w), Math.abs(h));
            w = (w < 0 ? -1 : 1) * side;
            h = (h < 0 ? -1 : 1) * side;
        }
        const x = w < 0 ? a.x + w : a.x;
        const y = h < 0 ? a.y + h : a.y;
        Object.assign(o.transform, {
            x: r2(x),
            y: r2(y),
            width: r2(Math.abs(w)),
            height: r2(Math.abs(h))
        });
    };

    const cancel = () => {
        start = null;
        from = null;
        pointerId = null;
        if (State.drawing) {
            State.drawing = null;
            requestRender();
        }
    };

    cvEl.addEventListener('pointerdown', e => {
        if (e.button !== 0 || State.tool !== TOOL) return;
        e.preventDefault();
        pointerId = e.pointerId;
        cvEl.setPointerCapture(pointerId);
        start = eventToWorld(e);
        from = snapWorld(start, e);
        State.drawing = makePolygon();
    });

    cvEl.addEventListener('pointermove', e => {
        if (pointerId == null || e.pointerId !== pointerId || !State.drawing) return;
        const cur = snapWorld(eventToWorld(e), e);
        let a = from,
            b = cur;
        if (e.altKey) {
            // Tahan Alt: tumbuh dari pusat
            const dx = cur.x - from.x,
                  dy = cur.y - from.y;
            a = { x: from.x - dx, y: from.y - dy };
            b = { x: from.x + dx, y: from.y + dy };
        }
        shape(State.drawing, a, b, e.shiftKey);
        requestRender();
    });

    cvEl.addEventListener('pointerup', e => {
        if (pointerId == null || e.pointerId !== pointerId || !State.drawing) return;
        const o = State.drawing;
        const end = eventToWorld(e);
        const z = State.zoom;
        let a = from,
            b = snapWorld(end, e);
        if (e.altKey) {
            const dx = b.x - from.x,
                  dy = b.y - from.y;
            a = { x: from.x - dx, y: from.y - dy };
            b = { x: from.x + dx, y: from.y + dy };
        }
        shape(o, a, b, e.shiftKey);

        const rx = Math.abs(end.x - start.x) * z,
              ry = Math.abs(end.y - start.y) * z;
        const tooSmall = e.shiftKey ? Math.max(rx, ry) < MIN_PX : (rx < MIN_PX || ry < MIN_PX);
        if (tooSmall || o.transform.width <= 0 || o.transform.height <= 0) return cancel();

        const n = newObjectId();
        o.id = 'polygon-' + n;
        o.name = 'Polygon ' + n;
        start = null;
        from = null;
        pointerId = null;
        State.drawing = null;

        State.objects.push(o);
        State.selectedIds = [o.id];
        $(document).trigger('object:add', [o]);
        $(document).trigger('selection:change');

        // Otomatis kembali ke tool select ala Figma
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
