/* ================= IMPORT JSON PROJECT ================= */
// Mengurai file JSON MiniVector saat user melakukan Import dan memuatnya ke kanvas
(function () {
  let pendingFile = null;

  window.setPendingImportFile = function (f) {
    pendingFile = f;
  };

  window.executeImportJSON = function (file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const text = e.target.result;
        const json = JSON.parse(text);
        if (typeof loadProject === 'function') {
          const success = loadProject(json);
          if (success) {
            // Update nama file jika nama proyek didapat dari nama file
            const fileNameClean = file.name.replace(/\.[^.]+$/, '');
            if (fileNameClean) {
              $('#file-name').text(fileNameClean);
            }
            if (typeof requestRender === 'function') {
              requestRender();
            }
            if (window.History && typeof window.History.clear === 'function') {
              window.History.clear();
            }
            if (typeof callback === 'function') callback(true);
            return;
          }
        }
        alert('File JSON tidak kompatibel dengan skema proyek MiniVector.');
        if (typeof callback === 'function') callback(false);
      } catch (err) {
        console.error('Import parse error:', err);
        alert('Gagal membaca file JSON: Format tidak valid.');
        if (typeof callback === 'function') callback(false);
      }
    };
    reader.readAsText(file);
  };
})();
