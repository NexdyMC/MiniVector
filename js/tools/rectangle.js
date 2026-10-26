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
    // drag ke arah mana pun → x,y = pojok kiri-atas, width/height selalu positif (Shift: kunci rasio 1:1)
    const shape = (o, a, b, isShift) => {
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
        const finalW = r2(w);
        const finalH = r2(h);
        Object.assign(o.transform, { x: r2(Math.min(a.x, b.x)), y: r2(Math.min(a.y, b.y)), width: finalW, height: finalH });
        o.geometry.nodes = buildNodes(finalW, finalH);
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
        shape(State.drawing, start, start, e.shiftKey);
        requestRender();
    });
    cvEl.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== pointerId) return;
        shape(State.drawing, start, snapWorld(eventToWorld(e), e), e.shiftKey); // [EDIT] snap pratinjau drag
        requestRender();
    });
    cvEl.addEventListener('pointerup', e => {
        if (!start || e.pointerId !== pointerId) return;
        const o = State.drawing,
            min = MIN_PX / State.zoom;
        shape(o, start, snapWorld(eventToWorld(e), e), e.shiftKey); // [EDIT] snap titik akhir saat commit
        if (o.transform.width < min || o.transform.height < min) return cancel();
        const n = newObjectId();
        o.id = 'rect-' + n;
        o.name = 'Rectangle ' + n;
        start = null;
        pointerId = null;
        State.drawing = null;
        // Cek apakah objek baru digambar di dalam suatu Frame
        let targetFrame = null;
        for (let i = State.objects.length - 1; i >= 0; i--) {
            const fo = State.objects[i];
            if (fo && fo.type === 'frame' && fo.visible !== false && !fo.locked && fo.transform) {
                const ft = fo.transform;
                if (o.transform.x >= ft.x && o.transform.x <= ft.x + ft.width &&
                    o.transform.y >= ft.y && o.transform.y <= ft.y + ft.height) {
                    targetFrame = fo;
                    break;
                }
            }
        }

        if (targetFrame) {
            if (!Array.isArray(targetFrame.children)) targetFrame.children = [];
            // Jika targetFrame memiliki alur flex, tempatkan di slot alur berikutnya
            if (window.LayoutEngine && targetFrame.layout && targetFrame.layout.display !== 'none') {
                const slot = window.LayoutEngine.getNextSlotPosition(targetFrame, o.transform.width, o.transform.height);
                o.transform.x = slot.x;
                o.transform.y = slot.y;
                targetFrame.children.push(o);
                window.LayoutEngine.applyAutoLayout(targetFrame);
            } else {
                o.transform.x -= targetFrame.transform.x;
                o.transform.y -= targetFrame.transform.y;
                targetFrame.children.push(o);
            }
        } else {
            State.objects.push(o);
        }

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