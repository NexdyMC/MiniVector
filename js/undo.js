/* ================= UNDO & HISTORY SYSTEM ================= */
// Mengelola tumpukan riwayat (undo stack & redo stack) dari State.objects.
// Bergantung pada: variabel.js (State, saveProject), canvas.js (requestRender).

const History = (() => {
  const MAX_HISTORY = 40; // Batas langkah riwayat agar memori tetap ringan
  const undoStack = [];
  const redoStack = [];
  let isExecuting = false; // Flag mencegah looping saat undo/redo sedang menerapkan state

  // Snapshot representasi data objek dan seleksi
  const snapshot = () => ({
    objects: JSON.parse(JSON.stringify(State.objects || [])),
    nextId: State.nextId,
    selectedIds: [...(State.selectedIds || [])]
  });

  const updateUI = () => {
    const canUndo = undoStack.length > 0 || ((State.objects || []).length > 0);
    const canRedo = redoStack.length > 0;
    $('#btn-undo').prop('disabled', !canUndo).attr('aria-disabled', !canUndo);
    $('#btn-redo').prop('disabled', !canRedo).attr('aria-disabled', !canRedo);
  };

  let isPointerDown = false;
  window.addEventListener('pointerdown', () => { isPointerDown = true; }, { capture: true });
  window.addEventListener('pointerup', () => {
    if (isPointerDown) {
      isPointerDown = false;
      // Catat state saat mouse baru saja dilepas jika ada perubahan
      setTimeout(record, 10);
    }
  }, { capture: true });

  // Mencatat kejadian baru ke tumpukan undo
  const record = (force = false) => {
    // Jangan rekam jika sedang mengeksekusi undo/redo, sedang drag menggambar, atau pointer mouse masih ditekan (kecuali force)
    if (isExecuting || State.drawing || (isPointerDown && !force)) return;
    const current = snapshot();

    // Hindari duplikasi jika tidak ada perubahan objek sama sekali
    if (undoStack.length > 0) {
      const last = undoStack[undoStack.length - 1];
      if (JSON.stringify(last.objects) === JSON.stringify(current.objects)) {
        return;
      }
    }

    undoStack.push(current);
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }

    // Aksi baru menghapus riwayat redo
    redoStack.length = 0;
    updateUI();
  };

  const applyState = snap => {
    isExecuting = true;
    try {
      State.objects = JSON.parse(JSON.stringify(snap.objects || []));
      State.nextId = snap.nextId !== undefined ? snap.nextId : State.nextId;
      State.selectedIds = (snap.selectedIds || []).filter(id => {
        // Pastikan objek yang diseleksi masih ada
        const exists = (list, searchId) => {
          for (const o of list) {
            if (o.id === searchId) return true;
            if (Array.isArray(o.children) && exists(o.children, searchId)) return true;
          }
          return false;
        };
        return exists(State.objects, id);
      });

      // Memicu sinkronisasi ke seluruh sistem
      if (typeof saveProject === 'function') saveProject();
      $(document).trigger('selection:change');
      if (typeof requestRender === 'function') requestRender();
      $(document).trigger('history:change');
    } finally {
      isExecuting = false;
      updateUI();
    }
  };

  const undo = () => {
    if (isExecuting) return false;
    const current = snapshot();
    const curJson = JSON.stringify(current.objects);

    // Jika snapshot paling atas di undoStack persis sama dengan kondisi saat ini,
    // singkirkan agar kita bisa mundur ke langkah sebelumnya
    while (undoStack.length > 0 && JSON.stringify(undoStack[undoStack.length - 1].objects) === curJson) {
      undoStack.pop();
    }

    if (!undoStack.length) {
      // Tidak ada state sebelumnya di tumpukan; jika saat ini ada objek di kanvas,
      // tindakan undo mengembalikan kanvas ke state kosong
      if (current.objects && current.objects.length > 0) {
        redoStack.push(current);
        applyState({
          objects: [],
          nextId: State.nextId,
          selectedIds: []
        });
        return true;
      }
      return false;
    }

    const prev = undoStack.pop();
    redoStack.push(current);
    applyState(prev);
    return true;
  };

  const redo = () => {
    if (!redoStack.length || isExecuting) return false;
    const current = snapshot();
    const next = redoStack.pop();

    undoStack.push(current);
    applyState(next);
    return true;
  };

  const clear = () => {
    undoStack.length = 0;
    redoStack.length = 0;
    updateUI();
  };

  // Event listeners
  $(document).on('object:add object:change object:remove', () => record());
  $(document).on('project:load', () => {
    clear();
    setTimeout(() => {
      if (undoStack.length === 0 && State.objects && State.objects.length > 0) {
        undoStack.push(snapshot());
      }
      updateUI();
    }, 50);
  });

  // Sambungkan ke tombol navigasi topbar
  $(function () {
    $('#btn-undo').on('click', e => {
      e.preventDefault();
      undo();
    });
    $('#btn-redo').on('click', e => {
      e.preventDefault();
      redo();
    });

    // Baseline awal
    setTimeout(() => {
      if (undoStack.length === 0 && State.objects && State.objects.length > 0) {
        undoStack.push(snapshot());
      }
      updateUI();
    }, 100);
  });

  return {
    record: (force) => record(force),
    undo,
    redo,
    clear,
    canUndo: () => undoStack.length > 0 || ((State.objects || []).length > 0),
    canRedo: () => redoStack.length > 0
  };
})();

// Ekspor fungsi global agar mudah dipanggil modul lain / shortcut
window.History = History;
const executeUndo = () => History.undo();
