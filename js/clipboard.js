/* ================= CLIPBOARD (COPY, PASTE, DUPLICATE) ================= */
// Mengelola penyalinan elemen ke memori internal dan duplikasi ala Figma.
// Bergantung pada: variabel.js (State, newObjectId), geometry.js (Geo), canvas.js (requestRender).

const Clipboard = (() => {
  let buffer = []; // Tempat menyimpan objek yang di-copy (JSON string)
  let pasteCount = 0; // Menghitung berapa kali paste berulang untuk offset dinamis

  // Clone elemen secara mendalam serta berikan ID unik baru (rekursif untuk frame beranak)
  const cloneElement = (el, offset = 20) => {
    const copy = JSON.parse(JSON.stringify(el));
    const prefix = copy.type || 'obj';
    copy.id = `${prefix}-${newObjectId()}`;
    
    // Perbarui nama objek jika perlu
    if (copy.name) {
      const match = copy.name.match(/^(.*?)(?: (\d+))?$/);
      if (match) {
        copy.name = `${match[1]} (copy)`;
      }
    }

    // Geser posisi sedikit agar terlihat bertumpuk rapi seperti di Figma
    if (copy.transform) {
      copy.transform.x = Math.round((copy.transform.x + offset) * 100) / 100;
      copy.transform.y = Math.round((copy.transform.y + offset) * 100) / 100;
    }

    // Tangani anak-anak di dalam frame
    if (Array.isArray(copy.children)) {
      copy.children = copy.children.map(child => cloneElement(child, 0)); // Anak tidak perlu di-offset ganda
    }

    return copy;
  };

  // 1. COPY (Ctrl+C)
  const copy = () => {
    const sel = Geo.selection();
    if (!sel || !sel.length) return false;

    // Simpan salinan JSON independen
    buffer = sel.map(f => JSON.parse(JSON.stringify(f.obj)));
    pasteCount = 0;
    return true;
  };

  // 2. PASTE (Ctrl+V)
  const paste = async () => {
    // 2a. Cek apakah ada gambar di OS clipboard (Async Clipboard API)
    if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = e => {
              if (window.ImageTool && typeof window.ImageTool.placeImageAt === 'function') {
                window.ImageTool.placeImageAt(e.target.result, 'Pasted Image');
              }
            };
            reader.readAsDataURL(blob);
            return true;
          }
        }
      } catch (_) {
        // Izin clipboard async diblokir atau tidak didukung -> lanjut ke fallback buffer
      }
    }

    // 2b. Fallback ke internal buffer objek MiniVector
    if (!buffer || !buffer.length) return false;

    pasteCount++;
    const offset = 20 * pasteCount;
    const newObjects = [];
    const newIds = [];

    buffer.forEach(item => {
      const cloned = cloneElement(item, offset);
      State.objects.push(cloned);
      newObjects.push(cloned);
      newIds.push(cloned.id);
    });

    // Otomatis pilih elemen-elemen baru yang baru saja di-paste
    State.selectedIds = newIds;

    // Trigger sinkronisasi riwayat, kanvas, dan layer
    newObjects.forEach(obj => $(document).trigger('object:add', [obj]));
    $(document).trigger('selection:change');
    if (typeof requestRender === 'function') requestRender();
    return true;
  };

  // 3. DUPLICATE (Ctrl+D)
  const duplicate = () => {
    const sel = Geo.selection();
    if (!sel || !sel.length) return false;

    const newObjects = [];
    const newIds = [];

    sel.forEach(f => {
      const cloned = cloneElement(f.obj, 20);
      
      // Jika objek berada di dalam frame, masukkan ke children frame induknya
      if (f.parent && Array.isArray(f.parent.children)) {
        f.parent.children.push(cloned);
      } else {
        // Objek di root kanvas
        State.objects.push(cloned);
      }

      newObjects.push(cloned);
      newIds.push(cloned.id);
    });

    State.selectedIds = newIds;

    newObjects.forEach(obj => $(document).trigger('object:add', [obj]));
    $(document).trigger('selection:change');
    if (typeof requestRender === 'function') requestRender();
    return true;
  };

  return {
    copy,
    paste,
    duplicate,
    hasBuffer: () => buffer.length > 0
  };
})();

// Listener paste event bawaan browser (Ctrl+V) untuk menangkap image blob secara langsung
window.addEventListener('paste', e => {
  // Jika fokus sedang di input teks atau textarea biasa, jangan tangkap paste kecuali memang gambar
  const activeEl = document.activeElement;
  const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;

      const reader = new FileReader();
      reader.onload = ev => {
        if (window.ImageTool && typeof window.ImageTool.placeImageAt === 'function') {
          window.ImageTool.placeImageAt(ev.target.result, file.name || 'Pasted Image');
        }
      };
      reader.readAsDataURL(file);
      return;
    }
  }

  // Jika bukan input dan tidak ada image di clipboard, shortcut.js akan memproses buffer MiniVector
});

window.Clipboard = Clipboard;
