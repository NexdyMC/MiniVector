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
    objects: JSON.parse(JSON.stringify(State.objects)),
    nextId: State.nextId,
    selectedIds: [...(State.selectedIds || [])]
  });

  const updateUI = () => {
    const canUndo = undoStack.length > 0;
    const canRedo = redoStack.length > 0;
    $('#btn-undo').prop('disabled', !canUndo).attr('aria-disabled', !canUndo);
    $('#btn-redo').prop('disabled', !canRedo).attr('aria-disabled', !canRedo);
  };

  // Mencatat kejadian baru ke tumpukan undo
  const record = () => {
    if (isExecuting || State.drawing) return;
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
      State.objects = JSON.parse(JSON.stringify(snap.objects));
      State.nextId = snap.nextId;
      State.selectedIds = snap.selectedIds.filter(id => {
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
    if (!undoStack.length || isExecuting) return false;
    const current = snapshot();
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
  $(document).on('object:add object:change object:remove', record);
  $(document).on('project:load', clear);

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
    updateUI();
  });

  return {
    record,
    undo,
    redo,
    clear,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0
  };
})();

// Ekspor fungsi global agar mudah dipanggil modul lain / shortcut
window.History = History;
const executeUndo = () => History.undo();
