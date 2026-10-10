/* ================= CANVAS (render + koordinat + zoom/pan) ================= */
// Bergantung pada: variabel.js (State), zoom.js (getZoom, setZoom).
// Koordinat dunia = koordinat objek di State.objects.
// Koordinat layar = piksel CSS relatif ke pojok kiri-atas #canvas.
const cvEl = document.getElementById('canvas');
const cvCtx = cvEl.getContext('2d');
let cvW = 0,
    cvH = 0,
    cvDpr = 1,
    cvDirty = false;

/* ---------- konversi koordinat (dipakai tool) ---------- */
const screenToWorld = (x, y) => ({
    x: (x - State.panX) / State.zoom,
    y: (y - State.panY) / State.zoom
});
const worldToScreen = (x, y) => ({
    x: x * State.zoom + State.panX,
    y: y * State.zoom + State.panY
});
const eventToWorld = e => { // dari event mouse/pointer langsung ke koordinat dunia
    const r = cvEl.getBoundingClientRect();
    return screenToWorld(e.clientX - r.left, e.clientY - r.top);
};
// Snap ke grid 1×1 satuan dunia; tahan Ctrl/Cmd saat drag untuk mematikan sementara
const snapWorld = (pt, e) => {
    if (e && (e.ctrlKey || e.metaKey)) return pt;
    return { x: Math.round(pt.x), y: Math.round(pt.y) };
};

/* ---------- render (hanya saat ada perubahan) ---------- */
// Ambang zoom untuk menampilkan grid (State.zoom = 8 setara 800%)
const GRID_ZOOM_THRESHOLD = 8;
const drawGrid = () => {
    if (State.zoom < GRID_ZOOM_THRESHOLD) return;
    // Hitung batas kolom/baris satuan dunia yang terlihat di viewport
    const x0 = Math.floor(-State.panX / State.zoom);
    const y0 = Math.floor(-State.panY / State.zoom);
    const x1 = Math.ceil((cvW - State.panX) / State.zoom);
    const y1 = Math.ceil((cvH - State.panY) / State.zoom);
    const pxPerUnit = cvDpr * State.zoom; // piksel fisik per 1 satuan dunia
    cvCtx.save();
    cvCtx.setTransform(1, 0, 0, 1, 0, 0); // kembali ke koordinat layar fisik
    cvCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    cvCtx.lineWidth = 1;
    cvCtx.beginPath();
    for (let xi = x0; xi <= x1; xi++) {
        const sx = Math.round(xi * pxPerUnit + cvDpr * State.panX) + 0.5;
        cvCtx.moveTo(sx, 0);
        cvCtx.lineTo(sx, cvEl.height);
    }
    for (let yi = y0; yi <= y1; yi++) {
        const sy = Math.round(yi * pxPerUnit + cvDpr * State.panY) + 0.5;
        cvCtx.moveTo(0, sy);
        cvCtx.lineTo(cvEl.width, sy);
    }
    cvCtx.stroke();
    cvCtx.restore();
};
const drawObject = o => {
    if (!o || o.visible === false || !o.transform) return;
    const t = o.transform,
        s = o.style || {};

    if (o.type === 'frame') {
        // 1. Gambar latar belakang & border Frame
        if (s.fill) {
            cvCtx.fillStyle = s.fill;
            cvCtx.fillRect(t.x, t.y, t.width, t.height);
        }
        if (s.stroke && s.strokeWidth > 0) {
            cvCtx.lineWidth = s.strokeWidth;
            cvCtx.strokeStyle = s.stroke;
            cvCtx.strokeRect(t.x, t.y, t.width, t.height);
        }

        // 2. Gambar label nama Frame di atas sudut kiri luar Frame
        cvCtx.save();
        cvCtx.font = `${Math.max(11, 12 / State.zoom)}px sans-serif`;
        cvCtx.fillStyle = '#8C8C8C';
        cvCtx.fillText(o.name || 'Frame', t.x, t.y - (4 / State.zoom));
        cvCtx.restore();

        // 3. Render anak-anak elemen di dalam Frame (dengan clipping jika clipContent === true)
        if (Array.isArray(o.children) && o.children.length > 0) {
            cvCtx.save();
            if (o.clipContent !== false) {
                cvCtx.beginPath();
                cvCtx.rect(t.x, t.y, t.width, t.height);
                cvCtx.clip();
            }
            // Geser origin kanvas ke titik sudut Frame (koordinat lokal anak)
            cvCtx.translate(t.x, t.y);
            o.children.forEach(drawObject);
            cvCtx.restore();
        }
    } else if (o.type === 'rectangle') {
        if (s.fill) {
            cvCtx.fillStyle = s.fill;
            cvCtx.fillRect(t.x, t.y, t.width, t.height);
        }
        if (s.stroke && s.strokeWidth > 0) {
            cvCtx.lineWidth = s.strokeWidth; // satuan dunia → ikut membesar/mengecil saat zoom
            cvCtx.strokeStyle = s.stroke;
            cvCtx.strokeRect(t.x, t.y, t.width, t.height);
        }
    }
};

// Mencari bounding box absolut dunia dari objek (termasuk objek yang bersarang di dalam frame)
const getWorldBounds = (objId, list = State.objects, parentOffset = { x: 0, y: 0 }) => {
    for (const o of list) {
        if (!o || !o.transform) continue;
        const absX = parentOffset.x + o.transform.x;
        const absY = parentOffset.y + o.transform.y;
        if (o.id === objId) {
            return { x: absX, y: absY, width: o.transform.width, height: o.transform.height };
        }
        if (Array.isArray(o.children) && o.children.length > 0) {
            const res = getWorldBounds(objId, o.children, { x: absX, y: absY });
            if (res) return res;
        }
    }
    return null;
};

const drawSelection = () => {
    // 1. Gambar kotak marquee jika sedang drag seleksi di area kosong
    if (State.marquee) {
        const m = State.marquee;
        cvCtx.save();
        cvCtx.fillStyle = 'rgba(13, 153, 255, 0.12)';
        cvCtx.strokeStyle = '#0D99FF';
        cvCtx.lineWidth = Math.max(1 / State.zoom, 1 / (cvDpr * State.zoom));
        cvCtx.fillRect(m.x, m.y, m.width, m.height);
        cvCtx.strokeRect(m.x, m.y, m.width, m.height);
        cvCtx.restore();
    }

    // 2. Gambar outline & handle untuk objek terpilih (mendukung objek di dalam frame)
    if (!State.selectedIds || !State.selectedIds.length) return;

    const lw = Math.max(1 / State.zoom, 1 / (cvDpr * State.zoom));
    const handleSize = 6 / State.zoom; // ukuran handle transform dalam satuan dunia
    const half = handleSize / 2;

    State.selectedIds.forEach(id => {
        const bounds = getWorldBounds(id);
        if (!bounds) return;

        // Bounding box outline
        cvCtx.save();
        cvCtx.strokeStyle = '#0D99FF';
        cvCtx.lineWidth = lw;
        cvCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // 4 corner handles
        cvCtx.fillStyle = '#FFFFFF';
        const corners = [
            [bounds.x, bounds.y],
            [bounds.x + bounds.width, bounds.y],
            [bounds.x + bounds.width, bounds.y + bounds.height],
            [bounds.x, bounds.y + bounds.height]
        ];
        corners.forEach(([cx, cy]) => {
            cvCtx.fillRect(cx - half, cy - half, handleSize, handleSize);
            cvCtx.strokeRect(cx - half, cy - half, handleSize, handleSize);
        });
        cvCtx.restore();
    });
};

const drawScene = () => {
    cvDirty = false;
    cvCtx.setTransform(1, 0, 0, 1, 0, 0);
    cvCtx.clearRect(0, 0, cvEl.width, cvEl.height);
    drawGrid(); // [EDIT] grid di bawah objek; save/restore transform dilakukan di dalam drawGrid
    const k = cvDpr * State.zoom;
    cvCtx.setTransform(k, 0, 0, k, cvDpr * State.panX, cvDpr * State.panY);
    State.objects.forEach(drawObject);
    if (State.drawing) drawObject(State.drawing); // pratinjau saat drag
    drawSelection(); // [EDIT] gambar outline & transform handles objek yang terpilih
};
const requestRender = () => {
    if (cvDirty) return;
    cvDirty = true;
    requestAnimationFrame(drawScene);
};

/* ---------- ukuran canvas ---------- */
const resizeCanvas = () => {
    cvW = Math.max(1, cvEl.clientWidth);
    cvH = Math.max(1, cvEl.clientHeight);
    cvDpr = Math.min(window.devicePixelRatio || 1, 2); // batas 2 agar ringan di laptop spek rendah
    cvEl.width = Math.round(cvW * cvDpr); // mengubah width mengosongkan canvas → render ulang
    cvEl.height = Math.round(cvH * cvDpr);
    requestRender();
};
new ResizeObserver(resizeCanvas).observe(cvEl);
resizeCanvas();
cvEl.style.touchAction = 'none'; // drag di layar sentuh tidak men-scroll halaman

/* ---------- zoom: titik di bawah anchor tetap di tempatnya ---------- */
// zoom.js memicu 'zoom:change' [persen, anchor?]; anchor = {x,y} layar, default: tengah canvas.
State.zoom = getZoom() / 100;
$(document).on('zoom:change', (e, persen, anchor) => {
    const prev = State.zoom,
        next = persen / 100;
    if (next === prev) return;
    const ax = anchor ? anchor.x : cvW / 2,
        ay = anchor ? anchor.y : cvH / 2;
    State.panX = ax - (ax - State.panX) / prev * next;
    State.panY = ay - (ay - State.panY) / prev * next;
    State.zoom = next;
    requestRender();
});

/* ---------- wheel: Ctrl+wheel (juga pinch trackpad) = zoom, wheel biasa = geser ---------- */
cvEl.addEventListener('wheel', e => {
    e.preventDefault();
    const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cvH : 1; // baris / halaman → piksel
    const dx = e.deltaX * m,
        dy = e.deltaY * m;
    if (e.ctrlKey) {
        const r = cvEl.getBoundingClientRect(),
            cur = getZoom();
        let next = Math.round(cur * Math.exp(-dy * 0.002));
        if (next === cur && dy) next = cur + (dy < 0 ? 1 : -1); // gerakan kecil tidak boleh macet
        setZoom(next, {
            x: e.clientX - r.left,
            y: e.clientY - r.top
        });
    } else {
        State.panX -= dx;
        State.panY -= dy;
        requestRender();
    }
}, {
    passive: false
});

/* ---------- pan dengan tombol tengah mouse (middle click) ---------- */
let isMiddlePanning = false,
    midStartX = 0,
    midStartY = 0;

cvEl.addEventListener('pointerdown', e => {
    if (e.button !== 1) return; // hanya tombol tengah mouse (wheel click)
    e.preventDefault();
    isMiddlePanning = true;
    midStartX = e.clientX;
    midStartY = e.clientY;
    cvEl.setPointerCapture(e.pointerId);
    cvEl.style.cursor = 'grabbing';
});

cvEl.addEventListener('pointermove', e => {
    if (!isMiddlePanning) return;
    const dx = e.clientX - midStartX,
        dy = e.clientY - midStartY;
    midStartX = e.clientX;
    midStartY = e.clientY;
    State.panX += dx;
    State.panY += dy;
    requestRender();
});

const endMiddlePan = e => {
    if (!isMiddlePanning) return;
    isMiddlePanning = false;
    cvEl.style.cursor = '';
};

cvEl.addEventListener('pointerup', e => {
    if (e.button === 1) endMiddlePan(e);
});
cvEl.addEventListener('pointercancel', endMiddlePan);
cvEl.addEventListener('auxclick', e => {
    if (e.button === 1) e.preventDefault(); // cegah autoscroll default browser
});

/* ---------- render ulang saat data berubah ---------- */
$(document).on('project:load object:add object:change object:remove', requestRender);