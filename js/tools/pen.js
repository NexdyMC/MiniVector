/* ================= TOOL: PEN (Vector Pen & Custom Node Edit) ================= */
// Mengimplementasikan:
// 1. Pembuatan path vektor bebas (Freeform Bezier Path) dengan tool 'pen' (shortcut 'P').
// 2. Klik biasa -> titik sudut tajam (sharp node).
// 3. Klik + Drag -> menarik handle kurva Bezier simetris (smooth node).
// 4. Tahan Alt saat drag handle -> mematahkan keterikatan sudut handle (asymmetric/corner).
// 5. Klik titik awal (P0) -> otomatis menutup jalur (closed path) & finalize.
// 6. Enter / Escape -> menyelesaikan pembuatan jalur terbuka (open path) & finalize.
// 7. Mode Custom / Node Edit Mode:
//    - Double-click pada objek 'path' saat di tool select -> masuk ke mode edit titik.
//    - Klik dan drag pada anchor point untuk memindahkan posisi titik.
//    - Klik dan drag pada handle point untuk memutar/menyesuaikan lengkungan Bezier.
//    - Double-click pada anchor point untuk toggle antara sharp (lurus) <-> smooth (lengkung).
//    - Tekan Enter / Escape / ganti tool untuk keluar dari mode edit titik.
// Bergantung pada: variabel.js (State, newObjectId), canvas.js (cvEl, eventToWorld, requestRender, snapWorld).

(function () {
    const TOOL = 'pen';
    const r2 = n => Math.round(n * 100) / 100;

    // State pembuatan path aktif
    let activeNodes = []; // [{ x, y, handleIn: {x,y}|null, handleOut: {x,y}|null }]
    let isDrawing = false;
    let isDraggingHandle = false;
    let dragNodeIndex = -1;
    let currentPointerPos = null; // koordinat dunia kursor saat pointermove
    let isHoveringStart = false; // apakah kursor dekat dengan P0 untuk snap/close

    // State Mode Edit Titik (Node Edit Mode)
    let editingPathObj = null; // referensi objek path yang sedang diedit titiknya
    let editSelectedNodeIdx = -1;
    let editDragTarget = null; // { type: 'anchor'|'handleIn'|'handleOut', nodeIndex: number }
    let editDragStart = null;
    let origNodeState = null;

    /* -------------------------------------------------------------
     * Helper Geometri & Bounding Box
     * ------------------------------------------------------------- */
    const distSq = (p1, p2) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return dx * dx + dy * dy;
    };

    // Hitung batas terluar (bounding box) seluruh nodes dan handles
    const computeBounds = (nodes) => {
        if (!nodes || nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x);
            maxY = Math.max(maxY, n.y);
            if (n.handleIn) {
                minX = Math.min(minX, n.handleIn.x);
                minY = Math.min(minY, n.handleIn.y);
                maxX = Math.max(maxX, n.handleIn.x);
                maxY = Math.max(maxY, n.handleIn.y);
            }
            if (n.handleOut) {
                minX = Math.min(minX, n.handleOut.x);
                minY = Math.min(minY, n.handleOut.y);
                maxX = Math.max(maxX, n.handleOut.x);
                maxY = Math.max(maxY, n.handleOut.y);
            }
        });
        const w = Math.max(maxX - minX, 1);
        const h = Math.max(maxY - minY, 1);
        return { x: minX, y: minY, width: w, height: h };
    };

    /* -------------------------------------------------------------
     * Finalisasi Pembuatan Path Baru
     * ------------------------------------------------------------- */
    const finishPath = (closed = false) => {
        if (activeNodes.length >= 2) {
            const b = computeBounds(activeNodes);
            // Normalisasikan koordinat nodes agar relatif terhadap (b.x, b.y)
            const localNodes = activeNodes.map(n => ({
                x: r2(n.x - b.x),
                y: r2(n.y - b.y),
                handleIn: n.handleIn ? { x: r2(n.handleIn.x - b.x), y: r2(n.handleIn.y - b.y) } : null,
                handleOut: n.handleOut ? { x: r2(n.handleOut.x - b.x), y: r2(n.handleOut.y - b.y) } : null
            }));

            const pathId = `path-${newObjectId()}`;
            const newObj = {
                id: pathId,
                type: 'path',
                name: `Path ${pathId.split('-').pop()}`,
                visible: true,
                locked: false,
                closed: closed,
                transform: {
                    x: r2(b.x),
                    y: r2(b.y),
                    width: r2(b.width),
                    height: r2(b.height),
                    rotation: 0,
                    pivot: { x: 0.5, y: 0.5 }
                },
                geometry: {
                    nodes: localNodes
                },
                style: {
                    stroke: '#000000',
                    strokeWidth: 2,
                    strokeCap: 'round',
                    strokeJoin: 'round',
                    fills: []
                }
            };

            State.objects.push(newObj);
            State.selectedIds = [newObj.id];
            $(document).trigger('selection:change');
            $(document).trigger('object:add', [newObj]);
            if (typeof window.pickTool === 'function') {
                window.pickTool('select');
            }
        }

        activeNodes = [];
        isDrawing = false;
        isDraggingHandle = false;
        dragNodeIndex = -1;
        currentPointerPos = null;
        isHoveringStart = false;
        requestRender();
    };

    const cancelDrawing = () => {
        activeNodes = [];
        isDrawing = false;
        isDraggingHandle = false;
        dragNodeIndex = -1;
        currentPointerPos = null;
        isHoveringStart = false;
        requestRender();
    };

    /* -------------------------------------------------------------
     * Node Edit Mode (Mode Custom)
     * ------------------------------------------------------------- */
    const startNodeEditing = (pathObj) => {
        if (!pathObj || pathObj.type !== 'path') return;
        editingPathObj = pathObj;
        editSelectedNodeIdx = 0;
        editDragTarget = null;
        // Beralih ke tool pen untuk interaksi node
        if (State.tool !== TOOL) {
            $('#toolbar .tool').removeClass('active');
            $(`#toolbar .tool[data-tool="${TOOL}"]`).addClass('active');
            State.tool = TOOL;
            $(document).trigger('tool:change', [TOOL]);
        }
        requestRender();
    };

    const stopNodeEditing = () => {
        if (!editingPathObj) return;
        // Rekalkulasi bounding box dan normalisasi titik setelah diedit
        const nodes = editingPathObj.geometry.nodes;
        if (nodes && nodes.length > 0) {
            const t = editingPathObj.transform;
            // Ubah koordinat lokal ke dunia sementara
            const worldNodes = nodes.map(n => ({
                x: t.x + n.x,
                y: t.y + n.y,
                handleIn: n.handleIn ? { x: t.x + n.handleIn.x, y: t.y + n.handleIn.y } : null,
                handleOut: n.handleOut ? { x: t.x + n.handleOut.x, y: t.y + n.handleOut.y } : null
            }));

            const b = computeBounds(worldNodes);
            editingPathObj.transform.x = r2(b.x);
            editingPathObj.transform.y = r2(b.y);
            editingPathObj.transform.width = r2(b.width);
            editingPathObj.transform.height = r2(b.height);

            editingPathObj.geometry.nodes = worldNodes.map(n => ({
                x: r2(n.x - b.x),
                y: r2(n.y - b.y),
                handleIn: n.handleIn ? { x: r2(n.handleIn.x - b.x), y: r2(n.handleIn.y - b.y) } : null,
                handleOut: n.handleOut ? { x: r2(n.handleOut.x - b.x), y: r2(n.handleOut.y - b.y) } : null
            }));
            $(document).trigger('object:change');
        }
        editingPathObj = null;
        editSelectedNodeIdx = -1;
        editDragTarget = null;
        if (typeof window.pickTool === 'function') {
            window.pickTool('select');
        }
        requestRender();
    };

    /* -------------------------------------------------------------
     * Event Listeners Canvas (Pointer & Keyboard)
     * ------------------------------------------------------------- */
    cvEl.addEventListener('pointerdown', e => {
        if (e.button !== 0) return; // Hanya klik kiri
        const pt = snapWorld(eventToWorld(e), e);

        // A. JIKA SEDANG DALAM MODE EDIT TITIK (Node Edit Mode)
        if (editingPathObj) {
            const t = editingPathObj.transform;
            const nodes = editingPathObj.geometry.nodes || [];
            const hitRadius = Math.max(6, 9 / State.zoom);
            const hitRadiusSq = hitRadius * hitRadius;

            // Periksa klik pada handle dari node terpilih terlebih dahulu
            if (editSelectedNodeIdx >= 0 && editSelectedNodeIdx < nodes.length) {
                const selNode = nodes[editSelectedNodeIdx];
                if (selNode.handleIn) {
                    const hx = t.x + selNode.handleIn.x, hy = t.y + selNode.handleIn.y;
                    if (distSq(pt, { x: hx, y: hy }) <= hitRadiusSq) {
                        editDragTarget = { type: 'handleIn', nodeIndex: editSelectedNodeIdx };
                        editDragStart = { ...pt };
                        origNodeState = JSON.parse(JSON.stringify(selNode));
                        cvEl.setPointerCapture(e.pointerId);
                        return;
                    }
                }
                if (selNode.handleOut) {
                    const hx = t.x + selNode.handleOut.x, hy = t.y + selNode.handleOut.y;
                    if (distSq(pt, { x: hx, y: hy }) <= hitRadiusSq) {
                        editDragTarget = { type: 'handleOut', nodeIndex: editSelectedNodeIdx };
                        editDragStart = { ...pt };
                        origNodeState = JSON.parse(JSON.stringify(selNode));
                        cvEl.setPointerCapture(e.pointerId);
                        return;
                    }
                }
            }

            // Periksa klik pada salah satu anchor node
            for (let i = 0; i < nodes.length; i++) {
                const nx = t.x + nodes[i].x, ny = t.y + nodes[i].y;
                if (distSq(pt, { x: nx, y: ny }) <= hitRadiusSq) {
                    editSelectedNodeIdx = i;
                    editDragTarget = { type: 'anchor', nodeIndex: i };
                    editDragStart = { ...pt };
                    origNodeState = JSON.parse(JSON.stringify(nodes[i]));
                    cvEl.setPointerCapture(e.pointerId);
                    requestRender();
                    return;
                }
            }

            // Jika klik di luar node, akhiri mode edit
            stopNodeEditing();
            return;
        }

        // B. JIKA SEDANG MENGGUNAKAN PEN TOOL UNTUK MEMBUAT PATH BARU
        if (State.tool === TOOL) {
            e.preventDefault();
            cvEl.setPointerCapture(e.pointerId);

            // Cek apakah klik pada titik P0 untuk menutup kurva
            if (activeNodes.length >= 2) {
                const snapThreshSq = Math.pow(Math.max(8, 12 / State.zoom), 2);
                if (distSq(pt, activeNodes[0]) <= snapThreshSq) {
                    finishPath(true);
                    return;
                }
            }

            // Tambahkan titik baru
            const newNode = {
                x: pt.x,
                y: pt.y,
                handleIn: null,
                handleOut: null
            };
            activeNodes.push(newNode);
            isDrawing = true;
            isDraggingHandle = true;
            dragNodeIndex = activeNodes.length - 1;
            requestRender();
        }
    });

    cvEl.addEventListener('pointermove', e => {
        const pt = snapWorld(eventToWorld(e), e);
        currentPointerPos = pt;

        // A. JIKA SEDANG DRAG DALAM MODE EDIT TITIK
        if (editingPathObj && editDragTarget) {
            const t = editingPathObj.transform;
            const nodes = editingPathObj.geometry.nodes;
            const node = nodes[editDragTarget.nodeIndex];
            const dx = pt.x - editDragStart.x;
            const dy = pt.y - editDragStart.y;

            if (editDragTarget.type === 'anchor') {
                // Geser anchor point dan bawa serta handle-nya
                node.x = origNodeState.x + dx;
                node.y = origNodeState.y + dy;
                if (origNodeState.handleIn) {
                    node.handleIn = { x: origNodeState.handleIn.x + dx, y: origNodeState.handleIn.y + dy };
                }
                if (origNodeState.handleOut) {
                    node.handleOut = { x: origNodeState.handleOut.x + dx, y: origNodeState.handleOut.y + dy };
                }
            } else if (editDragTarget.type === 'handleOut') {
                node.handleOut = { x: pt.x - t.x, y: pt.y - t.y };
                // Jika tidak menahan Alt, pertahankan simetri handleIn
                if (!e.altKey) {
                    const hdx = pt.x - (t.x + node.x);
                    const hdy = pt.y - (t.y + node.y);
                    node.handleIn = { x: node.x - hdx, y: node.y - hdy };
                }
            } else if (editDragTarget.type === 'handleIn') {
                node.handleIn = { x: pt.x - t.x, y: pt.y - t.y };
                // Jika tidak menahan Alt, pertahankan simetri handleOut
                if (!e.altKey) {
                    const hdx = pt.x - (t.x + node.x);
                    const hdy = pt.y - (t.y + node.y);
                    node.handleOut = { x: node.x - hdx, y: node.y - hdy };
                }
            }
            requestRender();
            return;
        }

        // B. JIKA SEDANG DRAG MEMBUAT HANDLE KURVA BEZIER SAAT PEN TOOL AKTIF
        if (State.tool === TOOL && isDrawing) {
            if (isDraggingHandle && dragNodeIndex >= 0) {
                const node = activeNodes[dragNodeIndex];
                const dx = pt.x - node.x;
                const dy = pt.y - node.y;

                if (Math.hypot(dx, dy) > 2) {
                    // handleOut mengikuti arah mouse
                    node.handleOut = { x: pt.x, y: pt.y };
                    // handleIn simetris berlawanan (kecuali menahan Alt)
                    if (!e.altKey) {
                        node.handleIn = { x: node.x - dx, y: node.y - dy };
                    }
                }
            }

            // Deteksi hover pada P0 untuk snap/close
            if (activeNodes.length >= 2) {
                const snapThreshSq = Math.pow(Math.max(8, 12 / State.zoom), 2);
                isHoveringStart = (distSq(pt, activeNodes[0]) <= snapThreshSq);
            } else {
                isHoveringStart = false;
            }
            requestRender();
        }
    });

    cvEl.addEventListener('pointerup', e => {
        if (editingPathObj && editDragTarget) {
            editDragTarget = null;
            origNodeState = null;
            $(document).trigger('object:change');
            requestRender();
            return;
        }

        if (State.tool === TOOL && isDrawing) {
            isDraggingHandle = false;
            dragNodeIndex = -1;
            requestRender();
        }
    });

    // Double-click pada node dalam mode edit untuk toggle Sharp <-> Smooth (Lengkung)
    cvEl.addEventListener('dblclick', e => {
        const pt = snapWorld(eventToWorld(e), e);

        // Jika double click objek path saat tool select -> masuk mode edit
        if (State.tool === 'select' && !editingPathObj) {
            const hit = State.objects.find(o => {
                if (o.type !== 'path' || !o.transform) return false;
                const t = o.transform;
                return pt.x >= t.x && pt.x <= t.x + t.width && pt.y >= t.y && pt.y <= t.y + t.height;
            });
            if (hit) {
                startNodeEditing(hit);
                return;
            }
        }

        // Jika double click anchor saat sedang dalam mode edit -> toggle Sharp / Smooth
        if (editingPathObj) {
            const t = editingPathObj.transform;
            const nodes = editingPathObj.geometry.nodes;
            const hitRadiusSq = Math.pow(Math.max(7, 10 / State.zoom), 2);

            for (let i = 0; i < nodes.length; i++) {
                const nx = t.x + nodes[i].x, ny = t.y + nodes[i].y;
                if (distSq(pt, { x: nx, y: ny }) <= hitRadiusSq) {
                    const node = nodes[i];
                    if (node.handleIn || node.handleOut) {
                        // Ubah jadi Sharp (hilangkan handle)
                        node.handleIn = null;
                        node.handleOut = null;
                    } else {
                        // Ubah jadi Smooth (buat handle default horizontal halus)
                        const offset = Math.max(20, (editingPathObj.transform.width || 40) / 4);
                        node.handleIn = { x: node.x - offset, y: node.y };
                        node.handleOut = { x: node.x + offset, y: node.y };
                    }
                    editSelectedNodeIdx = i;
                    $(document).trigger('object:change');
                    requestRender();
                    return;
                }
            }
        }
    });

    // Shortcut Keyboard: Enter (selesai), Escape (batal / keluar)
    $(document).on('keydown', e => {
        if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;

        if (e.key === 'Enter') {
            if (editingPathObj) {
                stopNodeEditing();
            } else if (State.tool === TOOL && isDrawing) {
                finishPath(false);
            }
        } else if (e.key === 'Escape') {
            if (editingPathObj) {
                stopNodeEditing();
            } else if (State.tool === TOOL && isDrawing) {
                cancelDrawing();
            }
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && editingPathObj && editSelectedNodeIdx >= 0) {
            // Hapus titik anchor terpilih dalam mode edit
            const nodes = editingPathObj.geometry.nodes;
            if (nodes.length > 2) {
                nodes.splice(editSelectedNodeIdx, 1);
                editSelectedNodeIdx = Math.max(0, editSelectedNodeIdx - 1);
                $(document).trigger('object:change');
                requestRender();
            } else {
                // Jika titik tersisa < 2, hapus seluruh path
                const idx = State.objects.indexOf(editingPathObj);
                if (idx >= 0) State.objects.splice(idx, 1);
                $(document).trigger('object:remove', [editingPathObj]);
                stopNodeEditing();
            }
        }
    });

    // Ganti tool otomatis mereset mode menggambar / edit
    $(document).on('tool:change', (e, newTool) => {
        if (newTool !== TOOL) {
            if (isDrawing) finishPath(false);
            if (editingPathObj) stopNodeEditing();
        }
    });

    /* -------------------------------------------------------------
     * Rendering Canvas Overlay (Pratinjau Garis, Handles, dan Nodes)
     * ------------------------------------------------------------- */
    window.drawPenOverlay = (ctx, zoom) => {
        const lw = 1.5 / zoom;
        const nodeSize = 6 / zoom;
        const half = nodeSize / 2;
        const handleRadius = 4 / zoom;

        // A. RENDER OVERLAY MODE EDIT TITIK (Node Edit Mode)
        if (editingPathObj) {
            const t = editingPathObj.transform;
            const nodes = editingPathObj.geometry.nodes || [];

            ctx.save();
            // Gambar semua anchor nodes
            nodes.forEach((n, idx) => {
                const nx = t.x + n.x, ny = t.y + n.y;
                const isSelected = (idx === editSelectedNodeIdx);

                // Gambar garis handle untuk node yang sedang dipilih
                if (isSelected) {
                    ctx.lineWidth = lw;
                    ctx.strokeStyle = '#0D99FF';

                    if (n.handleIn) {
                        const hx = t.x + n.handleIn.x, hy = t.y + n.handleIn.y;
                        ctx.beginPath();
                        ctx.moveTo(nx, ny);
                        ctx.lineTo(hx, hy);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fill();
                        ctx.stroke();
                    }

                    if (n.handleOut) {
                        const hx = t.x + n.handleOut.x, hy = t.y + n.handleOut.y;
                        ctx.beginPath();
                        ctx.moveTo(nx, ny);
                        ctx.lineTo(hx, hy);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fill();
                        ctx.stroke();
                    }
                }

                // Titik Anchor (Kotak)
                ctx.fillStyle = isSelected ? '#0D99FF' : '#FFFFFF';
                ctx.strokeStyle = '#0D99FF';
                ctx.lineWidth = lw;
                ctx.fillRect(nx - half, ny - half, nodeSize, nodeSize);
                ctx.strokeRect(nx - half, ny - half, nodeSize, nodeSize);
            });
            ctx.restore();
            return;
        }

        // B. RENDER OVERLAY PEMBUATAN PATH (Pen Tool Active)
        if (State.tool === TOOL && activeNodes.length > 0) {
            ctx.save();

            // 1. Gambar garis segmen yang sudah terbentuk
            ctx.strokeStyle = '#0D99FF';
            ctx.lineWidth = lw * 1.5;
            ctx.beginPath();
            ctx.moveTo(activeNodes[0].x, activeNodes[0].y);

            for (let i = 1; i < activeNodes.length; i++) {
                const prev = activeNodes[i - 1];
                const curr = activeNodes[i];
                if (prev.handleOut || curr.handleIn) {
                    const cp1 = prev.handleOut || prev;
                    const cp2 = curr.handleIn || curr;
                    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, curr.x, curr.y);
                } else {
                    ctx.lineTo(curr.x, curr.y);
                }
            }

            // 2. Garis pratinjau (Rubber-band) ke posisi kursor saat ini
            if (currentPointerPos && !isDraggingHandle) {
                const last = activeNodes[activeNodes.length - 1];
                if (isHoveringStart && activeNodes.length >= 2) {
                    // Snap ke P0 (penutup)
                    const p0 = activeNodes[0];
                    if (last.handleOut || p0.handleIn) {
                        const cp1 = last.handleOut || last;
                        const cp2 = p0.handleIn || p0;
                        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p0.x, p0.y);
                    } else {
                        ctx.lineTo(p0.x, p0.y);
                    }
                } else {
                    if (last.handleOut) {
                        ctx.bezierCurveTo(last.handleOut.x, last.handleOut.y, currentPointerPos.x, currentPointerPos.y, currentPointerPos.x, currentPointerPos.y);
                    } else {
                        ctx.lineTo(currentPointerPos.x, currentPointerPos.y);
                    }
                }
            }
            ctx.stroke();

            // 3. Gambar garis handle jika sedang di-drag
            if (isDraggingHandle && dragNodeIndex >= 0) {
                const n = activeNodes[dragNodeIndex];
                ctx.lineWidth = lw;
                ctx.strokeStyle = '#0D99FF';

                if (n.handleIn) {
                    ctx.beginPath();
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(n.handleIn.x, n.handleIn.y);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(n.handleIn.x, n.handleIn.y, handleRadius, 0, Math.PI * 2);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fill();
                    ctx.stroke();
                }

                if (n.handleOut) {
                    ctx.beginPath();
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(n.handleOut.x, n.handleOut.y);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(n.handleOut.x, n.handleOut.y, handleRadius, 0, Math.PI * 2);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fill();
                    ctx.stroke();
                }
            }

            // 4. Gambar semua titik anchor yang sudah ada
            activeNodes.forEach((n, idx) => {
                const isStart = (idx === 0);
                ctx.fillStyle = (isStart && isHoveringStart) ? '#0D99FF' : '#FFFFFF';
                ctx.strokeStyle = '#0D99FF';
                ctx.lineWidth = lw;

                if (isStart && isHoveringStart) {
                    // Indikator lingkaran penutup jalur
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, nodeSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillRect(n.x - half, n.y - half, nodeSize, nodeSize);
                    ctx.strokeRect(n.x - half, n.y - half, nodeSize, nodeSize);
                }
            });

            ctx.restore();
        }
    };

    // Ekspor helper global jika dibutuhkan modul lain
    window.startPathNodeEditing = startNodeEditing;
    window.stopPathNodeEditing = stopNodeEditing;
})();
