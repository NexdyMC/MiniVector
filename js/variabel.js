/* ================= VARIABEL (state bersama) ================= */
// Satu sumber kebenaran untuk canvas, tool, dan (nanti) layers / export.
// Data proyek = State.objects → disimpan sebagai JSON di localStorage.
const STORAGE_KEY = 'minivector:project';
const SCHEMA_VERSION = 1; // [EDIT] naikkan saat format JSON berubah, lalu tambah langkah di migrateProject
const State = {
    zoom: 1, // skala (1 = 100%); diisi canvas.js dari event 'zoom:change'
    panX: 0, // offset dunia → layar (px)
    panY: 0,
    tool: 'select', // diisi dari data-tool tombol toolbar
    drawing: null, // objek sementara saat drag (belum masuk objects)
    nextId: 1, // penghitung id objek
    objects: [], // daftar objek vektor (skema: Structure-JSON.md)
    selectedIds: [], // ID objek terpilih untuk mode select
    marquee: null // Kotak area seleksi drag {x, y, width, height} dalam satuan dunia
};
const newObjectId = () => State.nextId++;

/* ---------- serialize / load (dipakai localStorage, export, import) ---------- */
// Event: 'project:load' (setelah State.objects diganti), 'tool:change' [nama tool]
// Event dari tool: 'object:add' | 'object:change' | 'object:remove' → otomatis simpan.
const serializeProject = () => ({
    schemaVersion: SCHEMA_VERSION,
    nextId: State.nextId,
    camera: {
        panX: Math.round(State.panX * 100) / 100,
        panY: Math.round(State.panY * 100) / 100,
        zoom: Math.round((typeof getZoom === 'function' ? getZoom() : State.zoom * 100))
    },
    objects: State.objects
});
const migrateProject = data => {
    if (!data || typeof data !== 'object' || !Array.isArray(data.objects)) return null;
    const v = Number(data.schemaVersion);
    if (!Number.isInteger(v) || v < 1 || v > SCHEMA_VERSION) return null; // tidak dikenal / dari versi lebih baru
    // [EDIT] contoh nanti: if (v === 1) { ...ubah data ke format v2...; }
    return data;
};
const loadProject = data => {
    const p = migrateProject(data);
    if (!p) return false;
    State.objects = p.objects.filter(o => o && typeof o.id === 'string' && typeof o.type === 'string');
    const maxId = State.objects.reduce((m, o) => Math.max(m, parseInt(o.id.split('-').pop(), 10) || 0), 0);
    State.nextId = Math.max(1, Math.floor(Number(p.nextId)) || 1, maxId + 1);
    State.drawing = null;
    State.selectedIds = State.selectedIds.filter(id => State.objects.some(o => o.id === id));

    // Muat posisi camera (panX, panY, zoom) jika tersimpan di JSON proyek
    if (p.camera && typeof p.camera === 'object') {
        if (typeof p.camera.panX === 'number') State.panX = p.camera.panX;
        if (typeof p.camera.panY === 'number') State.panY = p.camera.panY;
        if (typeof p.camera.zoom === 'number') {
            State.zoom = p.camera.zoom / 100;
            if (typeof setZoom === 'function') {
                setZoom(p.camera.zoom);
            }
        }
    }

    $(document).trigger('project:load');
    return true;
};

/* ---------- localStorage & Camera Save Modes ---------- */
const STORAGE_KEY_CAMERA_MODE = 'minivector:camera_save_mode'; // 'auto' | 'manual'
let cameraSaveMode = localStorage.getItem(STORAGE_KEY_CAMERA_MODE) || 'auto';

window.getCameraSaveMode = () => cameraSaveMode;
window.setCameraSaveMode = mode => {
    cameraSaveMode = (mode === 'manual') ? 'manual' : 'auto';
    try {
        localStorage.setItem(STORAGE_KEY_CAMERA_MODE, cameraSaveMode);
    } catch (_) {}
};

let saveTimer = null;
let cameraTimer = null;

const saveProject = () => {
    saveTimer = null;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject()));
        return true;
    } catch (e) {
        console.warn('Gagal menyimpan proyek:', e);
        return false;
    }
};

const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, 300);
};

// Auto-save khusus posisi kamera (dipicu saat pan atau zoom berubah)
const onCameraChange = () => {
    if (cameraSaveMode === 'auto') {
        clearTimeout(cameraTimer);
        cameraTimer = setTimeout(saveProject, 250);
    }
};

window.saveCameraNow = () => {
    saveProject();
};

const loadFromStorage = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? loadProject(JSON.parse(raw)) : false;
    } catch (e) {
        console.warn('Gagal memuat proyek:', e);
        return false;
    }
};

$(document).on('object:add object:change object:remove', scheduleSave);
$(document).on('camera:change', onCameraChange);

$(window).on('pagehide', () => {
    if (saveTimer || cameraTimer) {
        clearTimeout(saveTimer);
        clearTimeout(cameraTimer);
        saveProject();
    }
});

/* ---------- tool aktif ---------- */
$('#toolbar').on('click', '.tool', function () {
    State.tool = String($(this).data('tool'));
    $(document).trigger('tool:change', [State.tool]);
});

loadFromStorage();
/* ---------- helper global text formatting (case & list) ---------- */
window.getFormattedTextContent = (rawText, textCase = 'none', listType = 'none') => {
    if (!rawText) return '';
    let txt = rawText;

    // 1. Text Case Transformation
    if (textCase === 'uppercase') {
        txt = txt.toUpperCase();
    } else if (textCase === 'lowercase') {
        txt = txt.toLowerCase();
    } else if (textCase === 'titlecase' || textCase === 'capitalize') {
        txt = txt.replace(/\b[a-z]/g, c => c.toUpperCase());
    }

    // 2. List Type prefixing
    if (listType === 'bullet') {
        txt = txt.split('\n').map(line => line.startsWith('• ') ? line : ('• ' + line)).join('\n');
    } else if (listType === 'numbered') {
        let num = 1;
        txt = txt.split('\n').map(line => {
            const cleaned = line.replace(/^\d+\.\s*/, '');
            return `${num++}. ${cleaned}`;
        }).join('\n');
    }

    return txt;
};
