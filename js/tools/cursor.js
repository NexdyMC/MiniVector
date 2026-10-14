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

            const isInside = pt.x >= absX && pt.x <= absX + w && pt.y >= absY && pt.y <= absY + h;

            // Jika ini frame, periksa anak-anaknya terlebih dahulu
            if (obj.type === 'frame' && Array.isArray(obj.children) && obj.children.length > 0) {
                const childHit = hitTest(pt, obj.children, { x: absX, y: absY });
                if (childHit) return childHit;
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

    // Deteksi apakah pointer mengenai salah satu dari 8 handle objek terpilih
    const getHandleAt = (pt) => {
        if (!State.selectedIds || State.selectedIds.length !== 1) return null;
        const targetId = State.selectedIds[0];
        const bounds = getWorldBounds(targetId);
        if (!bounds) return null;

        // Radius deteksi klik handle (px dunia)
        const hitRadius = Math.max(8, 12 / State.zoom);

        const handles = [
            { type: 'nw', x: bounds.x, y: bounds.y, cursor: 'nwse-resize' },
            { type: 'ne', x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize' },
            { type: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize' },
            { type: 'sw', x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize' },
            { type: 'n',  x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'ns-resize' },
            { type: 's',  x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 'ns-resize' },
            { type: 'e',  x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' },
            { type: 'w',  x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' }
        ];

        for (const h of handles) {
            if (Math.abs(pt.x - h.x) <= hitRadius && Math.abs(pt.y - h.y) <= hitRadius) {
                return { ...h, targetId, bounds };
            }
        }
        return null;
    };
    window.getHandleAt = getHandleAt;

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0) return;

        normalizeSelection();

        const clickWorld = eventToWorld(e);

        // 1. Prioritaskan Handle Hit-Test jika sudah ada objek terpilih
        const handleHit = getHandleAt(clickWorld);
        if (handleHit) {
            mode = 'resize';
            activeHandle = handleHit.type;
            resizeTargetId = handleHit.targetId;
            pointerId = e.pointerId;
            try { cvEl.setPointerCapture(e.pointerId); } catch (_) {}
            dragStartWorld = clickWorld;

            const found = findObjectWithParent(resizeTargetId);
            if (found && found.obj.transform) {
                origBox = {
                    x: found.obj.transform.x,
                    y: found.obj.transform.y,
                    width: found.obj.transform.width,
                    height: found.obj.transform.height
                };
            }
            return;
        }

        let hit = hitTest(clickWorld);

        // Jika hit adalah anak dari suatu Frame yang sedang diseleksi, gunakan Frame tersebut sebagai hit
        if (hit) {
            const hitParent = findObjectWithParent(hit.id);
            if (hitParent && hitParent.parent && State.selectedIds.includes(hitParent.parent.id)) {
                hit = hitParent.parent;
            }
        }

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
        if (!mode) {
            if (State.tool === TOOL) {
                const pt = eventToWorld(e);
                const handle = getHandleAt(pt);
                cvEl.style.cursor = handle ? handle.cursor : 'default';
            }
            return;
        }

        if (!dragStartWorld) return;
        if (pointerId != null && e.pointerId != null && e.pointerId !== pointerId) return;

        const currentWorld = eventToWorld(e);

        if (mode === 'resize' && resizeTargetId && origBox) {
            // Eksekusi resize dari handle mana pun (nw, ne, se, sw, n, s, e, w)
            const currentSnap = snapWorld(currentWorld, e);
            const dx = currentSnap.x - dragStartWorld.x;
            const dy = currentSnap.y - dragStartWorld.y;

            const found = findObjectWithParent(resizeTargetId);
            if (!found || !found.obj.transform) return;

            const t = found.obj.transform;
            const MIN_SIZE = 1;

            let newX = origBox.x;
            let newY = origBox.y;
            let newW = origBox.width;
            let newH = origBox.height;

            // X-axis & Width calculations
            if (activeHandle.includes('e')) {
                newW = Math.max(MIN_SIZE, origBox.width + dx);
            } else if (activeHandle.includes('w')) {
                const potentialW = origBox.width - dx;
                if (potentialW >= MIN_SIZE) {
                    newW = potentialW;
                    newX = origBox.x + dx;
                } else {
                    newW = MIN_SIZE;
                    newX = origBox.x + (origBox.width - MIN_SIZE);
                }
            }

            // Y-axis & Height calculations
            if (activeHandle.includes('s')) {
                newH = Math.max(MIN_SIZE, origBox.height + dy);
            } else if (activeHandle.includes('n')) {
                const potentialH = origBox.height - dy;
                if (potentialH >= MIN_SIZE) {
                    newH = potentialH;
                    newY = origBox.y + dy;
                } else {
                    newH = MIN_SIZE;
                    newY = origBox.y + (origBox.height - MIN_SIZE);
                }
            }

            // Terapkan perubahan posisi & ukuran
            t.x = Math.round(newX);
            t.y = Math.round(newY);
            if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
                Geo.setSize(found.obj, Math.round(newW), Math.round(newH));
            } else {
                t.width = Math.round(newW);
                t.height = Math.round(newH);
            }

            // Jika objek teks, beralih ke mode fixed saat ditarik handle horizontalnya
            if (found.obj.type === 'text' && (activeHandle.includes('e') || activeHandle.includes('w'))) {
                found.obj.resizing = 'fixed';
            }

            $(document).trigger('object:change');
            requestRender();
            return;
        }

        if (mode === 'move') {
            // Geser objek yang sedang terseleksi secara presisi
            const currentSnap = snapWorld(currentWorld, e);
            const dx = currentSnap.x - dragStartWorld.x;
            const dy = currentSnap.y - dragStartWorld.y;

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

        if (prevMode === 'resize') {
            $(document).trigger('object:change');
        }

        if (prevMode === 'move' && commit && origTransforms.size > 0) {
            // Auto-Nesting / Reparenting Logic hanya saat pointer dilepas
            const pointerWorld = e ? eventToWorld(e) : null;

            if (pointerWorld) {
                State.selectedIds.forEach(id => {
                    const found = findObjectWithParent(id);
                    if (!found) return;

                    // Frame itu sendiri tidak boleh dimasukkan ke frame lain dalam drag biasa
                    if (found.obj.type === 'frame') return;

                    const obj = found.obj;
                    const oldParent = found.parent;
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
                        } else if (oldParent) {
                            // 2. KELUAR DARI FRAME (Drag-out ke root)
                            found.arr.splice(found.index, 1);
                            obj.transform.x = absX;
                            obj.transform.y = absY;
                            State.objects.push(obj);
                        }
                    }
                });
            }

            $(document).trigger('object:change');
        }
        origTransforms.clear();
        requestRender();
    };

    cvEl.addEventListener('pointerup', e => {
        if (e.pointerId === pointerId) endDrag(true, e);
    });

    cvEl.addEventListener('pointercancel', e => {
        if (e.pointerId === pointerId) endDrag(false, e);
    });

    $(document).on('tool:change', () => endDrag(false));
    $(document).on('keydown', e => {
        if (e.key === 'Escape') endDrag(false);
    });

    // Double click untuk edit teks in-place
    cvEl.addEventListener('dblclick', e => {
        if (State.tool !== TOOL) return;
        const pt = eventToWorld(e);
        const hit = hitTest(pt);
        if (hit && hit.type === 'text' && typeof window.startTextEditing === 'function') {
            const found = findObjectWithParent(hit.id);
            window.startTextEditing(hit, found ? found.parent : null, false);
        }
    });
})();
