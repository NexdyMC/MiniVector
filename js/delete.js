/* ================= DELETE (hapus elemen terpilih) ================= */
// Bergantung pada: variabel.js (State), canvas.js (cvEl, eventToWorld, requestRender).
// Cara hapus: Delete / Backspace (shortcut.js memanggil deleteSelected) dan klik kanan → menu "Hapus"
// (di baris panel layer maupun di objek pada canvas).
// Event: 'object:remove' [[{obj, parentId, index}]] → variabel.js menyimpan ulang JSON/localStorage,
//        canvas.js dan layers.js menggambar ulang; lalu 'selection:change' (seleksi dikosongkan).
// Payload object:remove menyimpan objek beserta induk dan posisinya, supaya undo nanti bisa memulihkannya.

const removeFrom = (list, id, parentId) => { // cabut objek dari array (rekursif ke children frame)
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { obj: list.splice(i, 1)[0], parentId, index: i };
    if (Array.isArray(list[i].children)) {
      const r = removeFrom(list[i].children, id, list[i].id);
      if (r) return r;
    }
  }
  return null;
};
// Hapus semua objek di State.selectedIds. Mengembalikan jumlah objek yang benar-benar terhapus.
const deleteSelected = () => {
  if (State.drawing) return 0; // sedang menggambar → abaikan
  const ids = (State.selectedIds || []).map(String);
  if (!ids.length) return 0;
  const removed = [];
  ids.forEach(id => { // id anak yang ikut hilang bersama induknya tidak ditemukan lagi → dilewati
    const r = removeFrom(State.objects, id, null);
    if (r) removed.push(r);
  });
  State.selectedIds = [];
  if (removed.length) $(document).trigger('object:remove', [removed]);
  $(document).trigger('selection:change');
  return removed.length;
};

/* ---------- menu klik kanan ---------- */
$(function() {
  $('<style>').text(
    '.mv-ctx-menu{position:fixed;z-index:9999;min-width:176px;padding:4px;background:#2c2c2c;color:#fff;border:1px solid #444;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45);font:13px/1.2 system-ui,sans-serif}' +
    '.mv-ctx-menu[hidden]{display:none}' +
    '.mv-ctx-item{display:flex;align-items:center;justify-content:space-between;gap:24px;width:100%;padding:7px 10px;background:transparent;border:0;border-radius:5px;color:inherit;font:inherit;text-align:left;cursor:pointer}' +
    '.mv-ctx-item:hover,.mv-ctx-item:focus-visible{background:#0d99ff;outline:0}' +
    '.mv-ctx-item kbd{font:inherit;opacity:.6}'
  ).appendTo('head');
  const $menu = $('<div class="mv-ctx-menu" role="menu" aria-label="Menu elemen" hidden>' +
    '<button type="button" class="mv-ctx-item" data-act="group" role="menuitem"><span class="mv-ctx-label">Group Selection</span><kbd>Ctrl+G</kbd></button>' +
    '<button type="button" class="mv-ctx-item" data-act="ungroup" role="menuitem"><span class="mv-ctx-label">Ungroup</span><kbd>Ctrl+Shift+G</kbd></button>' +
    '<div class="mv-ctx-sep" style="height:1px;background:#444;margin:4px 0"></div>' +
    '<button type="button" class="mv-ctx-item" data-act="delete" role="menuitem"><span class="mv-ctx-label mv-del-label">Hapus</span><kbd>Backspace</kbd></button></div>').appendTo('body');
  const close = () => $menu.prop('hidden', true);
  const openAt = (x, y) => {
    const sel = typeof Geo !== 'undefined' ? Geo.selection() : [];
    const n = sel.length;
    $menu.find('.mv-del-label').text(n > 1 ? `Hapus (${n})` : 'Hapus');

    // Cek apakah ada objek group yang terseleksi
    const hasGroup = sel.some(f => f.obj && f.obj.type === 'group');
    $menu.find('[data-act="group"]').toggle(n >= 2);
    $menu.find('[data-act="ungroup"]').toggle(hasGroup);
    $menu.find('.mv-ctx-sep').toggle(n >= 2 || hasGroup);

    $menu.css({ left: 0, top: 0 }).prop('hidden', false);
    const w = $menu.outerWidth(),
      h = $menu.outerHeight();
    $menu.css({ // tetap di dalam viewport
      left: Math.max(4, Math.min(x, window.innerWidth - w - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - h - 4))
    });
    $menu.find('.mv-ctx-item:visible').first().focus();
  };
  const selectOnly = id => {
    State.selectedIds = [id];
    $(document).trigger('selection:change');
    requestRender();
  };
  const ensureSelected = id => {
    if (!(State.selectedIds || []).map(String).includes(id)) selectOnly(id); // klik kanan di objek yang sudah terpilih → seleksi dipertahankan
  };

  // objek paling depan di titik dunia (wx, wy); frame dicek bersama isinya
  const inside = (o, x, y) => {
    const t = o.transform;
    if (o.type === 'ellipse') {
      const rx = Math.abs(t.width) / 2,
        ry = Math.abs(t.height) / 2;
      if (!rx || !ry) return false;
      const dx = (x - (t.x + rx)) / rx,
        dy = (y - (t.y + ry)) / ry;
      return dx * dx + dy * dy <= 1;
    }
    return x >= t.x && y >= t.y && x <= t.x + t.width && y <= t.y + t.height;
  };
  const hitTest = (list, x, y) => {
    for (let i = list.length - 1; i >= 0; i--) { // urutan array: terakhir = paling depan
      const o = list[i];
      if (!o || o.visible === false || !o.transform) continue;
      if (!inside(o, x, y)) continue;
      if (o.type === 'frame' && Array.isArray(o.children)) {
        const child = hitTest(o.children, x - o.transform.x, y - o.transform.y); // koordinat anak relatif frame
        if (child) return child;
      }
      return o.id;
    }
    return null;
  };

  cvEl.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (State.drawing) return;
    const w = eventToWorld(e),
      id = hitTest(State.objects, w.x, w.y);
    if (!id) return close();
    ensureSelected(String(id));
    openAt(e.clientX, e.clientY);
  });
  $('#layer-list').on('contextmenu', '.layer', function(e) {
    e.preventDefault();
    ensureSelected(String($(this).data('id')));
    openAt(e.clientX, e.clientY);
  });
  $menu.on('click', '.mv-ctx-item', function() {
    const act = $(this).data('act');
    close();
    if (act === 'group') {
      if (window.Grouping) window.Grouping.group();
    } else if (act === 'ungroup') {
      if (window.Grouping) window.Grouping.ungroup();
    } else {
      deleteSelected();
    }
  });
  $menu.on('keydown', e => {
    if (e.key === 'Tab') close();
  });
  $(document).on('pointerdown', e => {
    if (!$(e.target).closest('.mv-ctx-menu').length) close();
  });
  $(document).on('keydown', e => {
    if (e.key === 'Escape') close();
  });
  $(window).on('blur resize', close);
  $(document).on('zoom:change tool:change object:remove project:load', close);
});