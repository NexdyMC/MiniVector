/* ================= TOOL: SELECT / CURSOR ================= */
// Mengelola interaksi saat State.tool === 'select':
// 1. Klik objek untuk memilih (prioritas objek paling atas).
// 2. Klik area kosong untuk membatalkan seleksi.
// 3. Drag objek terpilih untuk memindahkannya (didukung snapWorld).
// 4. Memicu event 'selection:change' [obj] dan 'object:change' setelah drag selesai.
(function () {
    const TOOL = 'select';
    let isDragging = false,
        dragMoved = false,
        startMouse = null,
        origPos = null,
        targetObj = null,
        pointerId = null;

    // Hit-testing sederhana untuk rectangle (koordinat dunia)
    const hitTest = (pt) => {
        // Loop terbalik agar objek paling atas (z-order tertinggi) terpilih lebih dulu
        const list = State.objects || [];
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            if (!o || o.visible === false || o.locked === true || !o.transform) continue;
            const t = o.transform;
            if (
                pt.x >= t.x &&
                pt.x <= t.x + t.width &&
                pt.y >= t.y &&
                pt.y <= t.y + t.height
            ) {
                return o;
            }
        }
        return null;
    };

    const cancel = () => {
        if (!isDragging) return;
        if (targetObj && origPos) {
            targetObj.transform.x = origPos.x;
            targetObj.transform.y = origPos.y;
            requestRender();
        }
        isDragging = false;
        dragMoved = false;
        startMouse = null;
        origPos = null;
        targetObj = null;
        pointerId = null;
        cvEl.style.cursor = '';
    };

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0) return;

        const pt = eventToWorld(e);
        const hit = hitTest(pt);

        if (hit) {
            targetObj = hit;
            isDragging = true;
            dragMoved = false;
            pointerId = e.pointerId;
            cvEl.setPointerCapture(e.pointerId);

            // Simpan posisi awal mouse dan koordinat awal objek
            startMouse = { x: pt.x, y: pt.y };
            origPos = { x: hit.transform.x, y: hit.transform.y };

            if (State.selectedId !== hit.id) {
                State.selectedId = hit.id;
                $(document).trigger('selection:change', [hit]);
                requestRender();
            }
        } else {
            // Klik di canvas kosong -> deselect
            if (State.selectedId !== null) {
                State.selectedId = null;
                $(document).trigger('selection:change', [null]);
                requestRender();
            }
        }
    });

    cvEl.addEventListener('pointermove', e => {
        if (!isDragging || e.pointerId !== pointerId || !targetObj || !origPos) return;

        const curPt = eventToWorld(e);
        const rawDx = curPt.x - startMouse.x;
        const rawDy = curPt.y - startMouse.y;

        if (!dragMoved && Math.hypot(rawDx * State.zoom, rawDy * State.zoom) > 3) {
            dragMoved = true;
            cvEl.style.cursor = 'move';
        }

        if (dragMoved) {
            // Terapkan snap ke posisi baru
            const targetPos = snapWorld({
                x: origPos.x + rawDx,
                y: origPos.y + rawDy
            }, e);

            targetObj.transform.x = targetPos.x;
            targetObj.transform.y = targetPos.y;
            requestRender();
        }
    });

    cvEl.addEventListener('pointerup', e => {
        if (!isDragging || e.pointerId !== pointerId) return;

        if (dragMoved && targetObj) {
            $(document).trigger('object:change', [targetObj]);
        }

        isDragging = false;
        dragMoved = false;
        startMouse = null;
        origPos = null;
        targetObj = null;
        pointerId = null;
        cvEl.style.cursor = '';
    });

    cvEl.addEventListener('pointercancel', e => {
        if (e.pointerId === pointerId) cancel();
    });

    $(document).on('tool:change', cancel);
    $(document).on('keydown', e => {
        if (e.key === 'Escape') cancel();
    });
})();
