/* ================= TOOL: LINE ================= */
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, requestRender, snapWorld).
// Drag di canvas saat State.tool === 'line' → garis baru di State.objects.
// Tahan tombol Shift saat drag → mengunci sudut garis ke kelipatan 45 derajat (0°, 45°, 90°, dst).
// Event: 'object:add' [obj] setelah garis tersimpan (otomatis masuk ke history undo/redo & localStorage).
// Skema JSON mengikuti StructureJSON.md.

(function () {
    const TOOL = 'line';
    const MIN_PX = 4; // drag lebih kecil dari ini (px layar) dianggap klik biasa dan dibatalkan
    const r2 = n => Math.round(n * 100) / 100;
    let start = null, // titik awal drag (koordinat dunia)
        pointerId = null;

    const makeLine = () => ({
        id: null,
        type: 'line',
        name: '',
        visible: true,
        locked: false,
        transform: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            pivot: { x: 0, y: 0 }
        },
        geometry: {
            nodes: [
                { id: 'p0', x: 0, y: 0 },
                { id: 'p1', x: 0, y: 0 }
            ]
        },
        style: {
            stroke: '#000000',
            strokeWidth: 2
        }
    });

    // Menghitung titik akhir garis dengan opsional snap sudut 45 derajat (Shift)
    const computeEndPoint = (a, b, isShift) => {
        let dx = b.x - a.x;
        let dy = b.y - a.y;

        if (isShift) {
            const angle = Math.atan2(dy, dx);
            const step = Math.PI / 4; // 45 derajat
            const snappedAngle = Math.round(angle / step) * step;
            const dist = Math.hypot(dx, dy);
            dx = dist * Math.cos(snappedAngle);
            dy = dist * Math.sin(snappedAngle);
        }

        return { x: a.x + dx, y: a.y + dy };
    };

    const shape = (o, a, b, isShift) => {
        const end = computeEndPoint(a, b, isShift);
        const minX = Math.min(a.x, end.x);
        const minY = Math.min(a.y, end.y);
        const w = Math.abs(end.x - a.x);
        const h = Math.abs(end.y - a.y);

        Object.assign(o.transform, {
            x: r2(minX),
            y: r2(minY),
            width: r2(Math.max(w, 1)),
            height: r2(Math.max(h, 1))
        });

        // Simpan titik lokal relatif terhadap transform (x, y)
        o.geometry.nodes = [
            { id: 'p0', x: r2(a.x - minX), y: r2(a.y - minY) },
            { id: 'p1', x: r2(end.x - minX), y: r2(end.y - minY) }
        ];
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
        State.drawing = makeLine();
        shape(State.drawing, start, start, e.shiftKey);
        requestRender();
    });

    cvEl.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== pointerId) return;
        const current = snapWorld(eventToWorld(e), e);
        shape(State.drawing, start, current, e.shiftKey);
        requestRender();
    });

    cvEl.addEventListener('pointerup', e => {
        if (!start || e.pointerId !== pointerId) return;
        const cur = snapWorld(eventToWorld(e), e);
        shape(State.drawing, start, cur, e.shiftKey);

        const nodes = State.drawing.geometry.nodes;
        const p0 = nodes[0];
        const p1 = nodes[1];
        const distWorld = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const distScreen = distWorld * State.zoom;

        // Batal jika ukuran garis terlalu pendek
        if (distScreen < MIN_PX) {
            cancel();
            return;
        }

        // Komit garis baru ke State.objects
        const count = State.objects.filter(o => o && o.type === 'line').length + 1;
        const lineObj = State.drawing;
        lineObj.id = `line-${newObjectId()}`;
        lineObj.name = `Line ${count}`;

        State.objects.push(lineObj);
        State.drawing = null;
        start = null;
        pointerId = null;

        // Seleksi objek baru
        State.selectedIds = [lineObj.id];

        // Trigger sinkronisasi
        $(document).trigger('object:add', [lineObj]);
        $(document).trigger('selection:change');
        if (typeof window.pickTool === 'function') {
            window.pickTool('select');
        }
        requestRender();
    });

    cvEl.addEventListener('pointercancel', cancel);

    window.addEventListener('keydown', e => {
        if (e.key === 'Shift' && start && State.drawing) {
            requestRender();
        }
    });
    window.addEventListener('keyup', e => {
        if (e.key === 'Shift' && start && State.drawing) {
            requestRender();
        }
    });
})();
