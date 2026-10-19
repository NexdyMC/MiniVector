/* ================= TOOL: SELECT / CURSOR ================= */
// Mengelola interaksi:
// 1. Single / Multi-select (klik / Shift+klik objek, termasuk anak di dalam Frame)
// 2. Drag & Move objek yang terseleksi
// 3. Auto-Nesting (Drag-in masuk Frame dan Drag-out keluar Frame)
// 4. Click + Tarik di area kosong (Marquee Selection Box)
// 5. Deselect saat klik kanvas kosong
// Bergantung pada: variabel.js (State), canvas.js (cvEl, eventToWorld, snapWorld, requestRender).
(function () {
    const TOOL = 'select';
    let mode = null, // 'move', 'resize', atau 'marquee'
        activeHandle = null, // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'
        resizeTargetId = null,
        origBox = null,
        pointerId = null,
        dragStartWorld = null,
        origTransforms = new Map(), // id -> { x, y, parentFrameId }
        initialSelectedOnDown = [];

    // Mencari objek dan parent frame-nya berdasarkan ID secara rekursif
    const findObjectWithParent = (id, list = State.objects, parent = null) => {
        for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (o.id === id) return { obj: o, arr: list, index: i, parent };
            if (Array.isArray(o.children) && o.children.length > 0) {
                const res = findObjectWithParent(id, o.children, o);
                if (res) return res;
            }
        }
        return null;
    };

    // Helper untuk rotasi titik di sekitar pivot
    const rotatePoint = (x, y, cx, cy, rad) => {
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const nx = cos * (x - cx) - sin * (y - cy) + cx;
        const ny = sin * (x - cx) + cos * (y - cy) + cy;
        return { x: nx, y: ny };
    };

    // Mencari objek yang terkena klik mouse di koordinat dunia (rekursif)
    const hitTest = (pt, list = State.objects, parentOffset = { x: 0, y: 0 }) => {
        // Cari dari urutan paling atas (index terbesar)
        for (let i = list.length - 1; i >= 0; i--) {
            const obj = list[i];
            if (!obj || obj.visible === false || obj.locked === true || !obj.transform) continue;

            const absX = parentOffset.x + obj.transform.x;
            const absY = parentOffset.y + obj.transform.y;
            const w = obj.transform.width;
            const h = obj.transform.height;
            const rot = obj.transform.rotation || 0;

            let localPt = pt;
            if (rot !== 0) {
                const cx = absX + w / 2;
                const cy = absY + h / 2;
                localPt = rotatePoint(pt.x, pt.y, cx, cy, (-rot * Math.PI) / 180);
            }

            const isInside = localPt.x >= absX && localPt.x <= absX + w && localPt.y >= absY && localPt.y <= absY + h;

            // Jika ini frame atau group, periksa anak-anaknya
            if ((obj.type === 'frame' || obj.type === 'group') && Array.isArray(obj.children) && obj.children.length > 0) {
                const childHit = hitTest(localPt, obj.children, { x: absX, y: absY });
                if (childHit) {
                    // Jika parent adalah group: klik biasa SELALU menyeleksi Group kecuali jika child sudah aktif terpilih
                    if (obj.type === 'group') {
                        const isChildAlreadySelected = State.selectedIds && State.selectedIds.includes(childHit.id);
                        if (!isChildAlreadySelected) {
                            return obj; // Kembalikan group itu sendiri
                        }
                    }
                    return childHit;
                }
            }

            if (isInside) {
                return obj;
            }
        }
        return null;
    };

    // Mencari Frame target di koordinat dunia pt (mengecualikan ID objek yang sedang di-drag)
    const findTargetFrame = (pt, excludeIds = []) => {
        for (let i = State.objects.length - 1; i >= 0; i--) {
            const obj = State.objects[i];
            if (!obj || obj.type !== 'frame' || obj.visible === false || obj.locked === true || !obj.transform) continue;
            if (excludeIds.includes(obj.id)) continue;

            const t = obj.transform;
            if (pt.x >= t.x && pt.x <= t.x + t.width && pt.y >= t.y && pt.y <= t.y + t.height) {
                return obj;
            }
        }
        return null;
    };

    // Mengecek apakah dua persegi bersinggungan / beririsan (AABB intersection)
    const rectsIntersect = (r1, r2) => {
        return !(
            r2.x > r1.x + r1.width ||
            r2.x + r2.width < r1.x ||
            r2.y > r1.y + r1.height ||
            r2.y + r2.height < r1.y
        );
    };

    // Normalisasi array seleksi: jika suatu Frame terseleksi, hilangkan anak-anaknya dari selectedIds
    const normalizeSelection = () => {
        if (!State.selectedIds || State.selectedIds.length <= 1) return;
        if (typeof Geo !== 'undefined' && typeof Geo.selection === 'function') {
            State.selectedIds = Geo.selection().map(f => f.obj.id);
        }
    };

    let origMultiStates = new Map(); // id -> { x, y, width, height, geometry: ... }
    let activeGapInfo = null;
    let activeGapHandle = null;
    let origGap = 0;
    let origGapItemPositions = [];
    let origRotationAngle = 0;
    let rotateCenter = null;

    // Deteksi apakah pointer mengenai salah satu dari 8 handle atau zona rotasi objek terpilih
    const getHandleAt = (pt) => {
        if (!State.selectedIds || State.selectedIds.length === 0) return null;
        
        let bounds = null;
        if (State.selectedIds.length === 1) {
            bounds = getWorldBounds(State.selectedIds[0]);
        } else if (typeof Geo !== 'undefined' && typeof Geo.selection === 'function') {
            const sel = Geo.selection();
            bounds = Geo.union(sel);
        }

        if (!bounds) return null;

        const rot = bounds.rotation || 0;
        const rad = (rot * Math.PI) / 180;
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;

        // Radius deteksi klik resize handle (px dunia)
        const hitRadius = Math.max(8, 12 / State.zoom);
        // Radius deteksi zona rotasi di luar sudut (8px s.d. 22px dari sudut)
        const rotOuterRadius = Math.max(16, 24 / State.zoom);

        const unrotatedHandles = [
            { type: 'nw', x: bounds.x, y: bounds.y, cursor: 'nwse-resize' },
            { type: 'ne', x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize' },
            { type: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize' },
            { type: 'sw', x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize' },
            { type: 'n',  x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'ns-resize' },
            { type: 's',  x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 'ns-resize' },
            { type: 'e',  x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' },
            { type: 'w',  x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' }
        ];

        // Transformasikan posisi handle sesuai sudut rotasi objek
        const handles = unrotatedHandles.map(h => {
            if (rot !== 0) {
                const rotated = rotatePoint(h.x, h.y, cx, cy, rad);
                return { ...h, x: rotated.x, y: rotated.y };
            }
            return h;
        });

        // 1. Cek Resize Handles (presisi tinggi tepat di atas handle)
        for (const h of handles) {
            if (Math.hypot(pt.x - h.x, pt.y - h.y) <= hitRadius) {
                return { ...h, targetId: State.selectedIds.length === 1 ? State.selectedIds[0] : '__multi__', bounds };
            }
        }

        // 2. Cek Rotation Zone (hanya untuk seleksi tunggal, tepat di luar 4 sudut)
        if (State.selectedIds.length === 1) {
            const cornerHandles = handles.slice(0, 4);
            for (const ch of cornerHandles) {
                const dist = Math.hypot(pt.x - ch.x, pt.y - ch.y);
                if (dist > hitRadius && dist <= rotOuterRadius) {
                    return {
                        type: 'rotate',
                        cursor: 'crosshair',
                        targetId: State.selectedIds[0],
                        bounds,
                        cx,
                        cy
                    };
                }
            }
        }

        // Hit-test untuk Tidy Up Button dan Interactive Gap Handles
        if (State.selectedIds.length >= 2 && window.Padding && typeof window.Padding.calculateGapHandles === 'function') {
            const gapInfo = window.Padding.calculateGapHandles(State.selectedIds);
            if (gapInfo) {
                // Tidy Up Button
                if (!gapInfo.isEven && typeof Geo !== 'undefined' && typeof Geo.selection === 'function') {
                    const union = Geo.union(Geo.selection());
                    if (union) {
                        const btnX = union.x + union.width + 14 / State.zoom;
                        const btnY = union.y + union.height + 14 / State.zoom;
                        const btnRadius = 12 / State.zoom;
                        if (Math.hypot(pt.x - btnX, pt.y - btnY) <= btnRadius) {
                            return { type: 'tidyUp', cursor: 'pointer', gapInfo };
                        }
                    }
                }

                // Interactive Gap Handles
                for (const gh of gapInfo.handles) {
                    const handleRadius = Math.max(10, 14 / State.zoom);
                    if (Math.hypot(pt.x - gh.x, pt.y - gh.y) <= handleRadius) {
                        return {
                            type: 'gap',
                            orientation: gh.orientation,
                            cursor: gh.orientation === 'h' ? 'ew-resize' : 'ns-resize',
                            gapHandle: gh,
                            gapInfo
                        };
                    }
                }
            }
        }

        return null;
    };
    window.getHandleAt = getHandleAt;

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0) return;

        const clickWorld = eventToWorld(e);

        // Jika mode Crop sedang aktif, serahkan event ke CropTool
        if (window.CropTool && window.CropTool.isActive()) {
            const handled = window.CropTool.handlePointerDown(e, clickWorld);
            if (handled) {
                pointerId = e.pointerId;
                try { cvEl.setPointerCapture(e.pointerId); } catch (_) {}
                return;
            }
        }

        normalizeSelection();

        // 1. Prioritaskan Handle Hit-Test jika sudah ada objek terpilih
        const handleHit = getHandleAt(clickWorld);
        if (handleHit) {
            if (handleHit.type === 'tidyUp') {
                // Klik tombol Tidy Up
                window.Padding.tidyUp(State.selectedIds);
                if (window.History && typeof window.History.record === 'function') {
                    window.History.record();
                }
                return;
            }

            if (handleHit.type === 'gap') {
                // Mode dragging gap serentak
                mode = 'gap';
                activeGapInfo = handleHit.gapInfo;
                activeGapHandle = handleHit.gapHandle;
                origGap = handleHit.gapInfo.currentGap || handleHit.gapHandle.gap;
                dragStartWorld = clickWorld;
                pointerId = e.pointerId;

                // Catat posisi awal semua item agar kalkulasi gap relatif terhadap posisi saat mulai drag
                origGapItemPositions = handleHit.gapInfo.items.map(it => ({
                    id: it.id,
                    initialWorldX: it.x,
                    initialWorldY: it.y,
                    initialTransformX: it.obj.transform.x,
                    initialTransformY: it.obj.transform.y,
                    width: it.width,
                    height: it.height,
                    obj: it.obj
                }));

                try { cvEl.setPointerCapture(e.pointerId); } catch (_) {}
                return;
            }

            if (handleHit.type === 'rotate') {
                // Mode rotasi interaktif dengan drag mouse
                mode = 'rotate';
                resizeTargetId = handleHit.targetId;
                rotateCenter = { x: handleHit.cx, y: handleHit.cy };
                const found = findObjectWithParent(handleHit.targetId);
                origRotationAngle = (found && found.obj.transform.rotation) || 0;
                dragStartWorld = clickWorld;
                pointerId = e.pointerId;
                try { cvEl.setPointerCapture(e.pointerId); } catch (_) {}
                return;
            }

            mode = 'resize';
            activeHandle = handleHit.type;
            resizeTargetId = handleHit.targetId;
            pointerId = e.pointerId;
            try { cvEl.setPointerCapture(e.pointerId); } catch (_) {}
            dragStartWorld = clickWorld;

            origBox = { ...handleHit.bounds };
            origMultiStates.clear();

            // Rekam state awal semua elemen yang terpilih
            State.selectedIds.forEach(id => {
                const found = findObjectWithParent(id);
                if (found && found.obj.transform) {
                    const b = getWorldBounds(id);
                    origMultiStates.set(id, {
                        x: found.obj.transform.x,
                        y: found.obj.transform.y,
                        width: found.obj.transform.width,
                        height: found.obj.transform.height,
                        worldX: b.x,
                        worldY: b.y,
                        worldW: b.width,
                        worldH: b.height,
                        geometry: found.obj.geometry ? JSON.parse(JSON.stringify(found.obj.geometry)) : null
                    });
                }
            });
            return;
        }

        let hit = hitTest(clickWorld);

        pointerId = e.pointerId;
        try { cvEl.setPointerCapture(e.pointerId); } catch (_) {}
        dragStartWorld = clickWorld;
        initialSelectedOnDown = [...State.selectedIds];

        if (hit) {
            // KLIK PADA OBJEK -> Mode 'move'
            mode = 'move';

            if (e.shiftKey) {
                // Multi-select toggle dengan Shift
                const idx = State.selectedIds.indexOf(hit.id);
                if (idx >= 0) {
                    State.selectedIds.splice(idx, 1);
                } else {
                    State.selectedIds.push(hit.id);
                }
            } else {
                // Jika objek yang diklik belum masuk seleksi, jadikan dia satu-satunya seleksi
                if (!State.selectedIds.includes(hit.id)) {
                    State.selectedIds = [hit.id];
                }
            }

            // Normalisasi seleksi agar jika Frame terseleksi, anak-anaknya tidak diseleksi ganda
            normalizeSelection();
            $(document).trigger('selection:change');
            requestRender();

            // Simpan posisi awal untuk drag move (hanya untuk elemen root dari seleksi)
            origTransforms.clear();
            const startSnap = snapWorld(clickWorld, e);
            dragStartWorld = startSnap;

            State.selectedIds.forEach(id => {
                const found = findObjectWithParent(id);
                if (found && found.obj.transform) {
                    origTransforms.set(id, {
                        x: found.obj.transform.x,
                        y: found.obj.transform.y,
                        parentId: found.parent ? found.parent.id : null
                    });
                }
            });
        } else {
            // KLIK PADA KANVAS KOSONG -> Mode 'marquee' (Click + Tarik Seleksi)
            mode = 'marquee';

            if (!e.shiftKey) {
                State.selectedIds = [];
                $(document).trigger('selection:change');
            }

            State.marquee = {
                x: clickWorld.x,
                y: clickWorld.y,
                width: 0,
                height: 0
            };
            requestRender();
        }
    });

    cvEl.addEventListener('pointermove', e => {
        // Jika mode Crop sedang aktif, serahkan ke CropTool
        if (window.CropTool && window.CropTool.isActive()) {
            const pt = eventToWorld(e);
            const handled = window.CropTool.handlePointerMove(e, pt);
            if (handled) return;

            // Update kursor mouse saat hover handle crop
            const cropHandle = window.CropTool.getCropHandleAt(pt, State.zoom);
            if (cropHandle) {
                cvEl.style.cursor = cropHandle.cursor;
            } else {
                cvEl.style.cursor = 'move';
            }
            return;
        }

        if (!mode) {
            if (State.tool === TOOL) {
                const pt = eventToWorld(e);
                const handle = getHandleAt(pt);
                cvEl.style.cursor = handle ? handle.cursor : 'default';

                // Figma-like Alt & Alt+Ctrl key measurement saat hover objek lain atau frame
                if (e.altKey && State.selectedIds.length === 1 && window.Padding && window.Padding.enabled) {
                    const selId = State.selectedIds[0];
                    const selBounds = getWorldBounds(selId);
                    const isCtrl = e.ctrlKey || e.metaKey;
                    const hoveredObj = isCtrl ? hitTestDeep(pt) : hitTest(pt);

                    const found = findObjectWithParent(selId);
                    const parentFrame = found && found.parent ? found.parent : null;

                    // Kasus 1: User hover di atas objek lain (atau hover frame induk)
                    if (selBounds && hoveredObj && hoveredObj.id !== selId) {
                        // Jika yang di-hover adalah Frame induknya sendiri, atau dengan Alt+Ctrl di kanvas frame
                        if (parentFrame && hoveredObj.id === parentFrame.id) {
                            const frameBounds = getWorldBounds(parentFrame.id);
                            if (frameBounds) {
                                window.Padding.measureInsideFrame(selBounds, frameBounds);
                                requestRender();
                            }
                        } else {
                            const targetBounds = getWorldBounds(hoveredObj.id);
                            if (targetBounds) {
                                window.Padding.measureBetween(selBounds, targetBounds);
                                requestRender();
                            }
                        }
                    } else if (selBounds && (!hoveredObj || (hoveredObj && hoveredObj.id === selId))) {
                        // Kasus 2: Hover pada objek terpilih itu sendiri atau area kosong di sekitarnya
                        // Ukur jarak 4 sisi (Top, Bottom, Left, Right) ke Frame induk jika ada
                        if (parentFrame) {
                            const frameBounds = getWorldBounds(parentFrame.id);
                            if (frameBounds) {
                                window.Padding.measureInsideFrame(selBounds, frameBounds);
                                requestRender();
                            }
                        } else if (window.Padding.activeMeasurements.length > 0) {
                            window.Padding.clear();
                            requestRender();
                        }
                    }
                } else if (!e.altKey && window.Padding && window.Padding.activeMeasurements.length > 0) {
                    window.Padding.clear();
                    requestRender();
                }
            }
            return;
        }

        if (!dragStartWorld) return;
        if (pointerId != null && e.pointerId != null && e.pointerId !== pointerId) return;

        const currentWorld = eventToWorld(e);

        if (mode === 'gap' && activeGapInfo) {
            // Interactive Gap Dragging: sesuaikan gap serentak
            const isH = activeGapInfo.orientation === 'h';
            const delta = isH ? (currentWorld.x - dragStartWorld.x) : (currentWorld.y - dragStartWorld.y);
            const newGap = Math.max(0, origGap + delta);

            window.Padding.applyGap(activeGapInfo, newGap, origGapItemPositions);
            requestRender();
            return;
        }

        if (mode === 'rotate' && resizeTargetId && rotateCenter) {
            // Hitung perubahan sudut rotasi terhadap titik tengah objek
            const startAngle = Math.atan2(dragStartWorld.y - rotateCenter.y, dragStartWorld.x - rotateCenter.x);
            const curAngle = Math.atan2(currentWorld.y - rotateCenter.y, currentWorld.x - rotateCenter.x);
            let diffDeg = ((curAngle - startAngle) * 180) / Math.PI;

            let newRot = Math.round(origRotationAngle + diffDeg);
            // Snap sudut setiap 15° jika menekan tombol Shift
            if (e.shiftKey) {
                newRot = Math.round(newRot / 15) * 15;
            }

            // Normalisasi ke rentang (-180° s.d. 180° atau 0° s.d. 360°)
            newRot = ((newRot % 360) + 360) % 360;
            if (newRot > 180) newRot -= 360;

            const found = findObjectWithParent(resizeTargetId);
            if (found && found.obj && found.obj.transform) {
                found.obj.transform.rotation = newRot;
            }

            $(document).trigger('object:change');
            requestRender();
            return;
        }

        if (mode === 'resize' && resizeTargetId && origBox) {
            // Eksekusi resize dari handle mana pun (nw, ne, se, sw, n, s, e, w)
            const currentSnap = snapWorld(currentWorld, e);
            const dx = currentSnap.x - dragStartWorld.x;
            const dy = currentSnap.y - dragStartWorld.y;
            const MIN_SIZE = 1;

            let newBoxX = origBox.x;
            let newBoxY = origBox.y;
            let newBoxW = origBox.width;
            let newBoxH = origBox.height;

            // X-axis & Width calculations
            if (activeHandle.includes('e')) {
                newBoxW = Math.max(MIN_SIZE, origBox.width + dx);
            } else if (activeHandle.includes('w')) {
                const potentialW = origBox.width - dx;
                if (potentialW >= MIN_SIZE) {
                    newBoxW = potentialW;
                    newBoxX = origBox.x + dx;
                } else {
                    newBoxW = MIN_SIZE;
                    newBoxX = origBox.x + (origBox.width - MIN_SIZE);
                }
            }

            // Y-axis & Height calculations
            if (activeHandle.includes('s')) {
                newBoxH = Math.max(MIN_SIZE, origBox.height + dy);
            } else if (activeHandle.includes('n')) {
                const potentialH = origBox.height - dy;
                if (potentialH >= MIN_SIZE) {
                    newBoxH = potentialH;
                    newBoxY = origBox.y + dy;
                } else {
                    newBoxH = MIN_SIZE;
                    newBoxY = origBox.y + (origBox.height - MIN_SIZE);
                }
            }

            // Kunci Rasio Aspek (Proportional Aspect Ratio Lock) jika menekan Shift pada handle sudut (nw, ne, se, sw)
            if (e.shiftKey && origBox.width > 0 && origBox.height > 0) {
                const aspect = origBox.width / origBox.height;
                const isCorner = (activeHandle.includes('n') || activeHandle.includes('s')) &&
                                 (activeHandle.includes('e') || activeHandle.includes('w'));

                if (isCorner) {
                    // Gunakan perubahan skala yang paling dominan
                    const scaleCandidateX = newBoxW / origBox.width;
                    const scaleCandidateY = newBoxH / origBox.height;
                    const scale = Math.max(scaleCandidateX, scaleCandidateY);

                    newBoxW = Math.max(MIN_SIZE, origBox.width * scale);
                    newBoxH = Math.max(MIN_SIZE, origBox.height * scale);

                    if (activeHandle.includes('w')) {
                        newBoxX = origBox.x + (origBox.width - newBoxW);
                    }
                    if (activeHandle.includes('n')) {
                        newBoxY = origBox.y + (origBox.height - newBoxH);
                    }
                } else if (activeHandle === 'e' || activeHandle === 'w') {
                    // Tarik handle samping kiri/kanan dengan Shift: sesuaikan tinggi proporsional dari tengah
                    newBoxH = Math.max(MIN_SIZE, newBoxW / aspect);
                    newBoxY = origBox.y + (origBox.height - newBoxH) / 2;
                } else if (activeHandle === 'n' || activeHandle === 's') {
                    // Tarik handle atas/bawah dengan Shift: sesuaikan lebar proporsional dari tengah
                    newBoxW = Math.max(MIN_SIZE, newBoxH * aspect);
                    newBoxX = origBox.x + (origBox.width - newBoxW) / 2;
                }
            }

            const scaleX = origBox.width > 0 ? newBoxW / origBox.width : 1;
            const scaleY = origBox.height > 0 ? newBoxH / origBox.height : 1;

            if (resizeTargetId === '__multi__' || State.selectedIds.length > 1) {
                // Multi-selection scaling: transformasikan setiap elemen terpilih proporsional terhadap origBox
                State.selectedIds.forEach(id => {
                    const found = findObjectWithParent(id);
                    if (!found || !origMultiStates.has(id)) return;
                    const st = origMultiStates.get(id);

                    // Offset relatif terhadap sudut kiri-atas origBox
                    const relX = st.worldX - origBox.x;
                    const relY = st.worldY - origBox.y;

                    const newTargetWorldX = newBoxX + (relX * scaleX);
                    const newTargetWorldY = newBoxY + (relY * scaleY);
                    const newW = Math.max(MIN_SIZE, Math.round(st.worldW * scaleX));
                    const newH = Math.max(MIN_SIZE, Math.round(st.worldH * scaleY));

                    // Konversi kembali ke koordinat lokal parent
                    const parentOriginX = found.parent ? (st.worldX - st.x) : 0;
                    const parentOriginY = found.parent ? (st.worldY - st.y) : 0;

                    found.obj.transform.x = Math.round(newTargetWorldX - parentOriginX);
                    found.obj.transform.y = Math.round(newTargetWorldY - parentOriginY);

                    if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
                        Geo.setSize(found.obj, newW, newH);
                    } else {
                        found.obj.transform.width = newW;
                        found.obj.transform.height = newH;
                    }
                });
            } else {
                // Single object resize
                const found = findObjectWithParent(resizeTargetId);
                if (found && found.obj.transform) {
                    const t = found.obj.transform;
                    t.x = Math.round(newBoxX);
                    t.y = Math.round(newBoxY);
                    if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
                        Geo.setSize(found.obj, Math.round(newBoxW), Math.round(newBoxH));
                    } else {
                        t.width = Math.round(newBoxW);
                        t.height = Math.round(newBoxH);
                    }

                    if (found.obj.type === 'text' && (activeHandle.includes('e') || activeHandle.includes('w'))) {
                        found.obj.resizing = 'fixed';
                    }
                }
            }

            requestRender();
            return;
        }

        if (mode === 'move') {
            // Geser objek yang sedang terseleksi secara presisi
            const currentSnap = snapWorld(currentWorld, e);
            let dx = currentSnap.x - dragStartWorld.x;
            let dy = currentSnap.y - dragStartWorld.y;

            // Integrasi Magnet (Snapping)
            if (window.Magnet && window.Magnet.enabled && State.selectedIds.length > 0) {
                // Kumpulkan calon target snapping di canvas selain objek yang sedang diseleksi
                const candidates = [];
                const collectCandidates = (list, offset = { x: 0, y: 0 }) => {
                    list.forEach(o => {
                        if (!o || o.visible === false || !o.transform) return;
                        if (State.selectedIds.includes(o.id)) return;
                        const bx = offset.x + o.transform.x;
                        const by = offset.y + o.transform.y;
                        candidates.push({
                            id: o.id,
                            x: bx,
                            y: by,
                            width: o.transform.width,
                            height: o.transform.height
                        });
                        if (Array.isArray(o.children) && o.children.length > 0) {
                            collectCandidates(o.children, { x: bx, y: by });
                        }
                    });
                };
                collectCandidates(State.objects);

                // Hitung bounding box sementara objek pertama yang diseleksi
                const primaryId = State.selectedIds[0];
                const orig = origTransforms.get(primaryId);
                const found = findObjectWithParent(primaryId);
                if (orig && found && found.obj.transform) {
                    const parentOffset = found.parent ? { x: found.parent.transform.x, y: found.parent.transform.y } : { x: 0, y: 0 };
                    const movingBox = {
                        x: parentOffset.x + orig.x + dx,
                        y: parentOffset.y + orig.y + dy,
                        width: found.obj.transform.width,
                        height: found.obj.transform.height
                    };

                    const snapRes = window.Magnet.snap(movingBox, candidates, State.zoom);
                    if (snapRes.snappedX) {
                        dx += snapRes.deltaX;
                    }
                    if (snapRes.snappedY) {
                        dy += snapRes.deltaY;
                    }

                    // Ukur jarak realtime ke kandidat terdekat saat digeser
                    if (window.Padding && window.Padding.enabled && candidates.length > 0) {
                        // Jika Smart Equal Spacing Snapping sedang aktif, sembunyikan padding biasa agar tidak bertumpuk
                        if (window.Magnet && window.Magnet.activeSpacingGuides && window.Magnet.activeSpacingGuides.length > 0) {
                            window.Padding.clear();
                        } else {
                            // Cari kandidat terdekat
                            let nearest = null;
                            let minDist = Infinity;
                            for (const cand of candidates) {
                                const dist = Math.hypot(
                                    (cand.x + cand.width / 2) - (movingBox.x + movingBox.width / 2),
                                    (cand.y + cand.height / 2) - (movingBox.y + movingBox.height / 2)
                                );
                                if (dist < minDist) {
                                    minDist = dist;
                                    nearest = cand;
                                }
                            }
                            if (nearest && minDist < 300 / State.zoom) {
                                window.Padding.measureBetween(movingBox, nearest);
                            } else {
                                window.Padding.clear();
                            }
                        }
                    }
                }
            } else {
                if (window.Magnet) window.Magnet.clear();
                if (window.Padding) window.Padding.clear();
            }

            State.selectedIds.forEach(id => {
                const found = findObjectWithParent(id);
                if (found && origTransforms.has(id)) {
                    const orig = origTransforms.get(id);
                    found.obj.transform.x = orig.x + dx;
                    found.obj.transform.y = orig.y + dy;
                }
            });
        } else if (mode === 'marquee') {
            // Bentuk kotak seleksi marquee
            const minX = Math.min(dragStartWorld.x, currentWorld.x);
            const minY = Math.min(dragStartWorld.y, currentWorld.y);
            const w = Math.abs(dragStartWorld.x - currentWorld.x);
            const h = Math.abs(dragStartWorld.y - currentWorld.y);

            State.marquee = { x: minX, y: minY, width: w, height: h };

            // Cari semua objek yang bersinggungan dengan kotak marquee
            const enclosedIds = [];
            const checkIntersections = (list, parentOffset = { x: 0, y: 0 }) => {
                list.forEach(o => {
                    if (o.visible === false || o.locked === true || !o.transform) return;
                    const absBounds = {
                        x: parentOffset.x + o.transform.x,
                        y: parentOffset.y + o.transform.y,
                        width: o.transform.width,
                        height: o.transform.height
                    };
                    if (rectsIntersect(State.marquee, absBounds)) {
                        enclosedIds.push(o.id);
                    }
                    if (Array.isArray(o.children) && o.children.length > 0) {
                        checkIntersections(o.children, { x: absBounds.x, y: absBounds.y });
                    }
                });
            };
            checkIntersections(State.objects);

            if (e.shiftKey) {
                const combined = new Set([...initialSelectedOnDown, ...enclosedIds]);
                State.selectedIds = Array.from(combined);
            } else {
                State.selectedIds = enclosedIds;
            }

            normalizeSelection();
            $(document).trigger('selection:change');
        }

        requestRender();
    });

    const endDrag = (commit, e) => {
        if (!mode) return;

        const prevMode = mode;
        mode = null;
        activeHandle = null;
        resizeTargetId = null;
        origBox = null;
        pointerId = null;
        dragStartWorld = null;
        State.marquee = null;

        activeGapInfo = null;
        activeGapHandle = null;
        rotateCenter = null;

        if (window.Magnet) window.Magnet.clear();
        if (window.Padding) window.Padding.clear();

        if (prevMode === 'resize' || prevMode === 'gap' || prevMode === 'rotate') {
            $(document).trigger('object:change');
            if (window.History && typeof window.History.record === 'function') {
                window.History.record();
            }
        }

        if (prevMode === 'move' && commit && origTransforms.size > 0) {
            // Auto-Nesting / Reparenting Logic hanya saat pointer dilepas
            const pointerWorld = e ? eventToWorld(e) : null;
            const groupsToRecalculate = new Set();

            State.selectedIds.forEach(id => {
                const found = findObjectWithParent(id);
                if (!found) return;

                const obj = found.obj;
                const oldParent = found.parent;

                // Jika objek berada di dalam GROUP, tandai group untuk dihitung ulang bounds-nya
                // dan jangan pernah keluarkan atau pindah parent via canvas drag
                if (oldParent && oldParent.type === 'group') {
                    groupsToRecalculate.add(oldParent);
                    return;
                }

                // Frame itu sendiri tidak boleh dimasukkan ke frame lain dalam drag biasa
                if (found.obj.type === 'frame') return;

                if (!pointerWorld) return;

                const oldParentId = oldParent ? oldParent.id : null;
                const origData = origTransforms.get(id);
                if (!origData) return;

                // Cari apakah kursor saat ini berada di atas suatu Frame
                const targetFrame = findTargetFrame(pointerWorld, [id]);
                const targetFrameId = targetFrame ? targetFrame.id : null;

                // HANYA lakukan reparenting jika Frame tujuan BERBEDA dari induk sebelumnya
                if (targetFrameId !== oldParentId) {
                    const oldParentOffset = oldParent ? { x: oldParent.transform.x, y: oldParent.transform.y } : { x: 0, y: 0 };
                    const absX = oldParentOffset.x + obj.transform.x;
                    const absY = oldParentOffset.y + obj.transform.y;

                    if (targetFrame) {
                        // 1. MASUK KE FRAME BARU (Drag-in)
                        found.arr.splice(found.index, 1);
                        if (!Array.isArray(targetFrame.children)) targetFrame.children = [];

                        obj.transform.x = absX - targetFrame.transform.x;
                        obj.transform.y = absY - targetFrame.transform.y;
                        targetFrame.children.push(obj);
                    } else if (oldParent && oldParent.type === 'frame') {
                        // 2. KELUAR DARI FRAME (Drag-out ke root) - hanya jika parent asalnya adalah FRAME
                        found.arr.splice(found.index, 1);
                        obj.transform.x = absX;
                        obj.transform.y = absY;
                        State.objects.push(obj);
                    }
                }
            });

            // Hitung ulang bounding box group jika ada anak grup yang digeser
            if (groupsToRecalculate.size > 0 && window.Grouping && typeof window.Grouping.recalculateBounds === 'function') {
                groupsToRecalculate.forEach(grp => {
                    window.Grouping.recalculateBounds(grp);
                });
            }

            $(document).trigger('object:change');
        }
        origTransforms.clear();
        requestRender();
    };

    cvEl.addEventListener('pointerup', e => {
        if (window.CropTool && window.CropTool.isActive()) {
            window.CropTool.handlePointerUp();
        }
        if (e.pointerId === pointerId) endDrag(true, e);
    });

    cvEl.addEventListener('pointercancel', e => {
        if (window.CropTool && window.CropTool.isActive()) {
            window.CropTool.handlePointerUp();
        }
        if (e.pointerId === pointerId) endDrag(false, e);
    });

    cvEl.addEventListener('pointerleave', () => {
        if (!mode && window.Padding && window.Padding.activeMeasurements.length > 0) {
            window.Padding.clear();
            requestRender();
        }
    });

    $(window).on('keyup', e => {
        if (e.key === 'Alt' && window.Padding && window.Padding.activeMeasurements.length > 0) {
            window.Padding.clear();
            requestRender();
        }
    });

    $(document).on('tool:change', (e, newTool) => {
        endDrag(false);
        if (newTool === TOOL && typeof cvEl !== 'undefined' && cvEl) {
            cvEl.style.cursor = 'default';
        }
    });
    $(document).on('keydown', e => {
        if (e.key === 'Escape') endDrag(false);
    });

    // Helper mencari elemen anak terdalam di titik pt (drill-down rekursif)
    const hitTestDeep = (pt, list = State.objects, parentOffset = { x: 0, y: 0 }) => {
        for (let i = list.length - 1; i >= 0; i--) {
            const obj = list[i];
            if (!obj || obj.visible === false || obj.locked === true || !obj.transform) continue;

            const absX = parentOffset.x + obj.transform.x;
            const absY = parentOffset.y + obj.transform.y;
            const w = obj.transform.width;
            const h = obj.transform.height;

            const isInside = pt.x >= absX && pt.x <= absX + w && pt.y >= absY && pt.y <= absY + h;

            // Masuk ke children terdalam
            if (Array.isArray(obj.children) && obj.children.length > 0) {
                const childHit = hitTestDeep(pt, obj.children, { x: absX, y: absY });
                if (childHit) return childHit;
            }

            if (isInside) return obj;
        }
        return null;
    };

    // Helper mencari apakah titik klik mengenai label judul Frame di kanvas (di atas top-left frame)
    const hitTestFrameHeader = (pt) => {
        // Toleransi dalam koordinat world
        const titleFontSize = Math.max(12, 14 / State.zoom);
        const headerHeight = titleFontSize + (16 / State.zoom);

        // Periksa semua frame dari yang terdepan
        const checkList = (list, parentOffset = { x: 0, y: 0 }) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const o = list[i];
                if (!o || o.visible === false || !o.transform) continue;
                const absX = parentOffset.x + o.transform.x;
                const absY = parentOffset.y + o.transform.y;

                if (o.type === 'frame') {
                    // Hitbox judul frame: sedikit lebih lebar dan tinggi agar mudah di-double click
                    const minX = absX - (10 / State.zoom);
                    const maxX = absX + Math.max(180, o.transform.width);
                    const minY = absY - headerHeight;
                    const maxY = absY + (4 / State.zoom);

                    if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
                        return { obj: o, absX, absY };
                    }
                }

                if (Array.isArray(o.children) && o.children.length > 0) {
                    const childHeader = checkList(o.children, { x: absX, y: absY });
                    if (childHeader) return childHeader;
                }
            }
            return null;
        };

        return checkList(State.objects);
    };

    // Editor inline untuk rename judul Frame langsung di kanvas
    let $canvasRenameInput = $('#canvas-rename-input');
    if (!$canvasRenameInput.length) {
        $canvasRenameInput = $('<input type="text" id="canvas-rename-input" spellcheck="false" autocomplete="off">').appendTo('#workspace');
    }

    const startCanvasFrameRename = (frameHit) => {
        const frameObj = frameHit.obj;
        const oldName = frameObj.name || 'Frame';
        
        // Hitung posisi layar dari koordinat absX, absY
        const screenPos = worldToScreen(frameHit.absX, frameHit.absY);
        const titleFontSize = Math.max(11, 12);

        $canvasRenameInput.val(oldName);
        $canvasRenameInput.css({
            left: `${screenPos.x}px`,
            top: `${screenPos.y - 26}px`,
            minWidth: '90px',
            maxWidth: '240px',
            fontSize: `${titleFontSize}px`,
            display: 'block'
        }).focus().select();

        let finished = false;
        const finish = (save) => {
            if (finished) return;
            finished = true;
            if (save) {
                const newName = $canvasRenameInput.val().trim();
                if (newName && newName !== oldName) {
                    frameObj.name = newName;
                    $(document).trigger('object:change');
                    requestRender();
                }
            }
            $canvasRenameInput.hide();
        };

        $canvasRenameInput.off('keydown blur');
        $canvasRenameInput.on('keydown', function(ev) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                finish(true);
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                finish(false);
            }
        });
        $canvasRenameInput.on('blur', function() {
            finish(true);
        });
    };

    // Double click untuk drill-down ke dalam Frame & Group, edit teks in-place, rename Frame, atau edit node path
    cvEl.addEventListener('dblclick', e => {
        if (State.tool !== TOOL) return;
        const pt = eventToWorld(e);

        // 1. Double click pada judul Frame di atas kanvas -> Rename Frame secara inline
        const frameHeaderHit = hitTestFrameHeader(pt);
        if (frameHeaderHit) {
            State.selectedIds = [frameHeaderHit.obj.id];
            $(document).trigger('selection:change');
            startCanvasFrameRename(frameHeaderHit);
            return;
        }

        // 2. Drill-down: Jika Group atau Frame sedang terpilih, double click masuk menyeleksi elemen anak di dalamnya
        const deepTarget = hitTestDeep(pt);
        if (deepTarget && State.selectedIds && State.selectedIds.length > 0) {
            const currentSelected = State.selectedIds[0];
            const foundParent = findObjectWithParent(deepTarget.id);

            // Jika yang diklik adalah anak dari Frame atau Group yang sedang aktif terpilih,
            // dan anak tersebut BELUM terpilih, jadikan anak tersebut yang terpilih (mode select)!
            if (foundParent && foundParent.parent && (foundParent.parent.id === currentSelected || State.selectedIds.includes(foundParent.parent.id))) {
                if (!State.selectedIds.includes(deepTarget.id)) {
                    State.selectedIds = [deepTarget.id];
                    $(document).trigger('selection:change');
                    requestRender();
                    return; // Selesai: Masuk ke mode select anak (jangan langsung Crop)
                }
            }
        }

        const hit = hitTest(pt);

        // Crop HANYA aktif jika gambar tersebut memang SUDAH berada dalam mode select (terpilih secara langsung)
        const activeSelectedImage = (State.selectedIds && State.selectedIds.length === 1)
            ? (() => {
                const f = findObjectWithParent(State.selectedIds[0]);
                return (f && f.obj && f.obj.type === 'image') ? f.obj : null;
            })()
            : null;

        const isClickingSelectedImage = activeSelectedImage && (
            (hit && hit.id === activeSelectedImage.id) ||
            (deepTarget && deepTarget.id === activeSelectedImage.id)
        );

        if (hit && hit.type === 'text' && typeof window.startTextEditing === 'function') {
            const found = findObjectWithParent(hit.id);
            window.startTextEditing(hit, found ? found.parent : null, false);
        } else if (isClickingSelectedImage && window.CropUI) {
            window.CropUI.show(activeSelectedImage);
        } else if (hit && hit.type === 'path' && typeof window.startPathNodeEditing === 'function') {
            window.startPathNodeEditing(hit);
        } else if (deepTarget && deepTarget.id !== (hit ? hit.id : null)) {
            // Drill-down ke anak terdalam jika yang terluar adalah group atau frame
            State.selectedIds = [deepTarget.id];
            $(document).trigger('selection:change');
            requestRender();
        }
    });
    // Bersihkan pengukuran Alt hover saat tombol Alt dilepas atau window blur
    window.addEventListener('keyup', e => {
        if (e.key === 'Alt') {
            if (window.Padding && (window.Padding.activeMeasurements.length > 0 || window.Padding.targetBounds)) {
                window.Padding.clear();
                requestRender();
            }
        }
    });

    window.addEventListener('blur', () => {
        if (window.Padding && (window.Padding.activeMeasurements.length > 0 || window.Padding.targetBounds)) {
            window.Padding.clear();
            requestRender();
        }
    });

    // Klik Kanan di atas kanvas -> Buka Context Menu untuk objek atau frame yang terkena klik
    cvEl.addEventListener('contextmenu', e => {
        e.preventDefault();
        const pt = eventToWorld(e);
        const headerHit = hitTestFrameHeader(pt);
        let targetId = null;

        if (headerHit) {
            targetId = headerHit.obj.id;
        } else {
            const hit = hitTest(pt);
            if (hit) {
                targetId = hit.id;
            }
        }

        if (targetId) {
            if (!State.selectedIds || !State.selectedIds.includes(targetId)) {
                State.selectedIds = [targetId];
                $(document).trigger('selection:change');
                requestRender();
            }
        }

        if (window.ContextMenu && typeof window.ContextMenu.show === 'function') {
            window.ContextMenu.show(e.clientX, e.clientY, targetId, 'canvas');
        }
    });

    window.startCanvasFrameRename = (frameId) => {
        const found = findObjectWithParent(frameId);
        if (!found || !found.obj || found.obj.type !== 'frame') return;
        const b = getWorldBounds(frameId);
        if (b) {
            startCanvasFrameRename({ obj: found.obj, absX: b.x, absY: b.y });
        }
    };
})();
