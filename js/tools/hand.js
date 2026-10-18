/* ================= TOOL: HAND (PAN KANVAS) ================= */
// Bergantung pada: variabel.js (State), canvas.js (cvEl, requestRender).
// Berfungsi saat State.tool === 'hand' (atau saat tombol Space ditekan via shortcut.js).
// Menggeser panX dan panY secara mulus saat klik kiri ditahan dan digeser.

(function () {
    const TOOL = 'hand';
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    const setCursor = style => {
        if (State.tool === TOOL) {
            cvEl.style.cursor = style;
        }
    };

    // Sinkronkan kursor saat tool berganti
    $(document).on('tool:change', (e, toolName) => {
        if (toolName === TOOL) {
            cvEl.style.cursor = 'grab';
        } else {
            cvEl.style.cursor = '';
        }
    });

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0) return;
        e.preventDefault();
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        cvEl.setPointerCapture(e.pointerId);
        cvEl.style.cursor = 'grabbing';
    });

    cvEl.addEventListener('pointermove', e => {
        if (!isPanning) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;

        State.panX += dx;
        State.panY += dy;
        requestRender();
    });

    const endPan = e => {
        if (!isPanning) return;
        isPanning = false;
        if (State.tool === TOOL) {
            cvEl.style.cursor = 'grab';
        } else {
            cvEl.style.cursor = '';
        }
        $(document).trigger('camera:change');
    };

    cvEl.addEventListener('pointerup', endPan);
    cvEl.addEventListener('pointercancel', endPan);
})();
