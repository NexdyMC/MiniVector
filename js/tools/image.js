/* ================= TOOL: IMAGE (Place & Draw Image on Canvas) ================= */
// Mengelola penempatan gambar (PNG, JPG, WEBP, SVG) di atas canvas:
// 1. Gambar dipilih dari modal Image panel (9 slot) melalui prepareImage(dataUrl, name).
// 2. Klik di canvas: menempatkan gambar di posisi kursor dengan ukuran proporsional (default max 300x300 atau natural size).
// 3. Klik + Drag di canvas: menggambar bounding box untuk menentukan ukuran gambar secara presisi (tahan Shift untuk kunci rasio).
// 4. Setelah gambar ditempatkan, otomatis beralih ke tool 'select'.
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, requestRender, snapWorld).

(function () {
    const TOOL = 'image';
    const MIN_PX = 4;
    const r2 = n => Math.round(n * 100) / 100;

    let pendingImageDataUrl = null;
    let pendingImageName = 'Image';
    let pendingImageNaturalDim = { width: 300, height: 200 };

    let start = null;
    let pointerId = null;

    const buildNodes = (w, h) => [
        { id: 'p0', x: 0, y: 0 },
        { id: 'p1', x: w, y: 0 },
        { id: 'p2', x: w, y: h },
        { id: 'p3', x: 0, y: h }
    ];

    const makeImageObj = (src, name, w, h) => {
        const imgId = `image-${newObjectId()}`;
        return {
            id: imgId,
            type: 'image',
            name: name || `Image ${imgId.split('-').pop()}`,
            visible: true,
            locked: false,
            src: src,
            transform: {
                x: 0,
                y: 0,
                width: w || 300,
                height: h || 200,
                rotation: 0,
                pivot: { x: 0.5, y: 0.5 }
            },
            geometry: {
                isCustomPath: false,
                cornerRadius: [0, 0, 0, 0],
                nodes: buildNodes(w || 300, h || 200)
            },
            style: {
                stroke: 'none',
                strokeWidth: 0,
                fills: []
            }
        };
    };

    const shape = (o, a, b, keepRatio = false) => {
        let w = r2(Math.abs(a.x - b.x));
        let h = r2(Math.abs(a.y - b.y));

        if (keepRatio && pendingImageNaturalDim.width > 0 && pendingImageNaturalDim.height > 0) {
            const ratio = pendingImageNaturalDim.width / pendingImageNaturalDim.height;
            if (w / ratio < h) {
                w = r2(h * ratio);
            } else {
                h = r2(w / ratio);
            }
        }

        const left = Math.min(a.x, b.x);
        const top = Math.min(a.y, b.y);

        Object.assign(o.transform, { x: r2(left), y: r2(top), width: w, height: h });
        o.geometry.nodes = buildNodes(w, h);
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

        // Jika belum ada gambar yang dipilih di slot, buka modal Image
        if (!pendingImageDataUrl) {
            if (typeof openModal === 'function') {
                openModal('image');
            }
            return;
        }

        start = snapWorld(eventToWorld(e), e);
        pointerId = e.pointerId;
        try { cvEl.setPointerCapture(e.pointerId); } catch (_) {}

        State.drawing = makeImageObj(pendingImageDataUrl, pendingImageName, 0, 0);
        shape(State.drawing, start, start);
        requestRender();
    });

    cvEl.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== pointerId) return;
        shape(State.drawing, start, snapWorld(eventToWorld(e), e), e.shiftKey);
        requestRender();
    });

    cvEl.addEventListener('pointerup', e => {
        if (!start || e.pointerId !== pointerId) return;
        try { cvEl.releasePointerCapture(e.pointerId); } catch (_) {}

        const endPt = snapWorld(eventToWorld(e), e);
        const screenDist = Math.hypot((endPt.x - start.x) * State.zoom, (endPt.y - start.y) * State.zoom);

        let finalObj = null;

        if (screenDist < MIN_PX) {
            // Klik biasa tanpa drag: buat gambar di posisi klik dengan ukuran proporsional
            let targetW = pendingImageNaturalDim.width || 300;
            let targetH = pendingImageNaturalDim.height || 200;

            // Batasi agar tidak terlalu raksasa saat ditaruh pertama kali di canvas (max 400px)
            const MAX_DEFAULT = 400;
            if (targetW > MAX_DEFAULT || targetH > MAX_DEFAULT) {
                const scale = Math.min(MAX_DEFAULT / targetW, MAX_DEFAULT / targetH);
                targetW = Math.round(targetW * scale);
                targetH = Math.round(targetH * scale);
            }

            finalObj = makeImageObj(pendingImageDataUrl, pendingImageName, targetW, targetH);
            finalObj.transform.x = r2(start.x);
            finalObj.transform.y = r2(start.y);
            finalObj.geometry.nodes = buildNodes(targetW, targetH);
        } else {
            // Drag: gunakan ukuran hasil drag
            finalObj = State.drawing;
        }

        start = null;
        pointerId = null;
        State.drawing = null;

        if (finalObj && finalObj.transform.width > 0 && finalObj.transform.height > 0) {
            State.objects.push(finalObj);
            State.selectedIds = [finalObj.id];
            $(document).trigger('selection:change');
            $(document).trigger('object:add', [finalObj]);

            // Kembalikan ke tool 'select'
            if (typeof window.pickTool === 'function') {
                window.pickTool('select');
            }
        }

        requestRender();
    });

    cvEl.addEventListener('pointercancel', cancel);

    // Ganti tool membatalkan proses jika sedang drag
    $(document).on('tool:change', (e, newTool) => {
        if (newTool !== TOOL && start) {
            cancel();
        }
    });

    // API Publik ImageTool
    window.ImageTool = {
        prepareImage: (dataUrl, name) => {
            pendingImageDataUrl = dataUrl;
            pendingImageName = name || 'Image';

            // Hitung ukuran natural gambar
            const tempImg = new Image();
            tempImg.onload = () => {
                pendingImageNaturalDim = {
                    width: tempImg.naturalWidth || 300,
                    height: tempImg.naturalHeight || 200
                };
            };
            tempImg.src = dataUrl;
        },
        hasPendingImage: () => !!pendingImageDataUrl,
        clearPendingImage: () => {
            pendingImageDataUrl = null;
        },
        makeImageObj: makeImageObj,
        buildNodes: buildNodes,
        // Helper untuk langsung meletakkan gambar di koordinat world tertentu (misal dari paste atau drop)
        placeImageAt: (dataUrl, name, worldPos) => {
            return new Promise((resolve) => {
                const tempImg = new Image();
                tempImg.onload = () => {
                    let w = tempImg.naturalWidth || 300;
                    let h = tempImg.naturalHeight || 200;

                    // Batasi agar ukuran awal tidak lebih dari 450px jika sangat besar
                    const MAX_DEFAULT = 450;
                    if (w > MAX_DEFAULT || h > MAX_DEFAULT) {
                        const scale = Math.min(MAX_DEFAULT / w, MAX_DEFAULT / h);
                        w = Math.round(w * scale);
                        h = Math.round(h * scale);
                    }

                    // Tentukan posisi: jika worldPos ada, letakkan di tengah worldPos atau top-left
                    let posX = worldPos ? (worldPos.x - w / 2) : (-State.panX + (window.innerWidth / 2) - (w / 2)) / State.zoom;
                    let posY = worldPos ? (worldPos.y - h / 2) : (-State.panY + (window.innerHeight / 2) - (h / 2)) / State.zoom;

                    posX = Math.round(posX);
                    posY = Math.round(posY);

                    const imgObj = makeImageObj(dataUrl, name || 'Image', w, h);
                    imgObj.transform.x = posX;
                    imgObj.transform.y = posY;
                    imgObj.geometry.nodes = buildNodes(w, h);

                    State.objects.push(imgObj);
                    State.selectedIds = [imgObj.id];

                    // Simpan juga ke slot panel Image jika helper tersedia
                    if (typeof window.addImageToSlots === 'function') {
                        window.addImageToSlots(dataUrl, name || 'Image');
                    }

                    $(document).trigger('selection:change');
                    $(document).trigger('object:add', [imgObj]);
                    if (typeof requestRender === 'function') requestRender();

                    resolve(imgObj);
                };
                tempImg.onerror = () => {
                    resolve(null);
                };
                tempImg.src = dataUrl;
            });
        }
    };
})();
