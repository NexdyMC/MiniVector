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
    let mode = null, // 'move' (memindah objek) atau 'marquee' (tarik kotak seleksi)
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

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0) return;

        const clickWorld = eventToWorld(e);
        const hit = hitTest(clickWorld);

        pointerId = e.pointerId;
        cvEl.setPointerCapture(e.pointerId);
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

            $(document).trigger('selection:change');
            requestRender();

            // Simpan posisi awal untuk drag move
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
        if (!mode || e.pointerId !== pointerId || !dragStartWorld) return;

        const currentWorld = eventToWorld(e);

        if (mode === 'move') {
            // Geser objek yang sedang terseleksi
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

            $(document).trigger('selection:change');
        }

        requestRender();
    });

    const endDrag = (commit, e) => {
        if (!mode) return;

        const prevMode = mode;
        mode = null;
        pointerId = null;
        dragStartWorld = null;
        State.marquee = null;

        if (prevMode === 'move' && commit && origTransforms.size > 0) {
            // Auto-Nesting / Reparenting Logic saat pointer up
            const pointerWorld = e ? eventToWorld(e) : null;

            if (pointerWorld) {
                State.selectedIds.forEach(id => {
                    const found = findObjectWithParent(id);
                    if (!found) return;

                    const obj = found.obj;
                    const oldParent = found.parent;
                    const oldParentOffset = oldParent ? { x: oldParent.transform.x, y: oldParent.transform.y } : { x: 0, y: 0 };
                    const absX = oldParentOffset.x + obj.transform.x;
                    const absY = oldParentOffset.y + obj.transform.y;

                    // Cari apakah kursor berada di dalam Frame baru
                    const targetFrame = findTargetFrame(pointerWorld, [id]);

                    if (targetFrame && targetFrame.id !== (oldParent ? oldParent.id : null)) {
                        // 1. MASUK KE DALAM FRAME (Drag-in)
                        found.arr.splice(found.index, 1); // cabut dari parent lama
                        if (!Array.isArray(targetFrame.children)) targetFrame.children = [];

                        // Ubah koordinat menjadi lokal Frame baru
                        obj.transform.x = absX - targetFrame.transform.x;
                        obj.transform.y = absY - targetFrame.transform.y;

                        targetFrame.children.push(obj);
                    } else if (!targetFrame && oldParent) {
                        // 2. KELUAR DARI FRAME (Drag-out ke root canvas)
                        found.arr.splice(found.index, 1); // cabut dari frame
                        // Ubah koordinat kembali ke koordinat dunia kanvas
                        obj.transform.x = absX;
                        obj.transform.y = absY;
                        State.objects.push(obj);
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
})();
