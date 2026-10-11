/* ================= TOOL: CIRCLE / ELLIPSE ================= */
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, requestRender, snapWorld).
// Drag di canvas saat State.tool === 'ellipse' → elips baru di State.objects.
// Tahan tombol Shift saat drag → bentuk menjadi lingkaran sempurna (1:1 aspect ratio).
// Event: 'object:add' [obj] setelah elips tersimpan (otomatis masuk ke history undo/redo & localStorage).
// Skema JSON mengikuti StructureJSON.md.

(function () {
    const TOOL = 'ellipse';
    const MIN_PX = 4; // drag lebih kecil dari ini (px layar) dianggap klik biasa dan dibatalkan
    const r2 = n => Math.round(n * 100) / 100;
    let start = null, // titik awal drag (koordinat dunia)
        pointerId = null;

    const makeEllipse = () => ({
        id: null, // diisi saat commit
        type: 'ellipse',
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
            isCustomPath: false
        },
        style: {
            fill: '#D9D9D9',
            stroke: '#000000',
            strokeWidth: 1
        }
    });

    // Kalkulasi bounding box (mendukung penahanan tombol Shift untuk lingkaran 1:1)
    const shape = (o, a, b, isShift) => {
        let w = Math.abs(a.x - b.x);
        let h = Math.abs(a.y - b.y);

        if (isShift) {
            const side = Math.max(w, h);
            w = side;
            h = side;
        }

        const left = b.x >= a.x ? a.x : a.x - w;
        const top = b.y >= a.y ? a.y : a.y - h;

        Object.assign(o.transform, {
            x: r2(left),
            y: r2(top),
            width: r2(w),
            height: r2(h)
        });
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
        State.drawing = makeEllipse();
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

        const t = State.drawing.transform;
        const screenW = t.width * State.zoom;
        const screenH = t.height * State.zoom;

        // Batal jika ukuran terlalu kecil (hanya klik singkat)
        if (screenW < MIN_PX || screenH < MIN_PX) {
            cancel();
            return;
        }

        // Komit objek baru ke State.objects
        const count = State.objects.filter(o => o && o.type === 'ellipse').length + 1;
        const ellipseObj = State.drawing;
        ellipseObj.id = `ellipse-${newObjectId()}`;
        ellipseObj.name = `Ellipse ${count}`;

        State.objects.push(ellipseObj);
        State.drawing = null;
        start = null;
        pointerId = null;

        // Otomatis pilih objek yang baru dibuat
        State.selectedIds = [ellipseObj.id];

        // Memicu sinkronisasi event
        $(document).trigger('object:add', [ellipseObj]);
        $(document).trigger('selection:change');
        requestRender();
    });

    cvEl.addEventListener('pointercancel', cancel);

    // Tangani perubahan status tombol Shift saat sedang drag
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
