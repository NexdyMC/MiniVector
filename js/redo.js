/* ================= REDO MODULE ================= */
// Bagian dari sistem History (undo.js). Menyediakan akses Redo global.
// Bergantung pada: undo.js (History).

const executeRedo = () => {
  if (window.History && typeof window.History.redo === 'function') {
    return window.History.redo();
  }
  return false;
};
