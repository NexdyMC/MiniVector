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
    selectedId: null, // id objek yang sedang dipilih (mode select)
    nextId: 1, // penghitung id objek
    objects: [] // daftar objek vektor (skema: Structure-JSON.md)
};
const newObjectId = () => State.nextId++;

/* ---------- serialize / load (dipakai localStorage, export, import) ---------- */
// Event: 'project:load' (setelah State.objects diganti), 'tool:change' [nama tool]
// Event dari tool: 'object:add' | 'object:change' | 'object:remove' → otomatis simpan.
const serializeProject = () => ({
    schemaVersion: SCHEMA_VERSION,
    nextId: State.nextId,
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
    State.selectedId = null;
    $(document).trigger('project:load');
    return true;
};

/* ---------- localStorage ---------- */
let saveTimer = null;
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
$(window).on('pagehide', () => {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveProject();
    }
});

/* ---------- tool aktif ---------- */
$('#toolbar').on('click', '.tool', function () {
    State.tool = String($(this).data('tool'));
    $(document).trigger('tool:change', [State.tool]);
});

loadFromStorage();