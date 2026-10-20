/* ================= EXPORT & SAVE PROJECT (JSON) ================= */
// Mengelola dialog Save di navbar tengah, penyimpanan lokal, dan pengunduhan file JSON proyek
// Bergantung pada: variabel.js (State, serializeProject, saveProject), exporter.js (Exporter)

(function () {
  const getProjectName = () => {
    return ($('#save-project-name').val() || $('#file-name').text() || 'Untitled').trim();
  };

  const updateStats = () => {
    const count = (State.objects || []).length;
    const name = ($('#file-name').text() || 'Untitled').trim();
    $('#save-project-name').val(name);
    $('#save-stats-info').text(`${count} Objek di kanvas • LocalStorage aktif`);
    $('#save-copied-feedback').hide();
  };

  // Sinkronisasi saat modal Save dibuka
  $('#modal-save').on('modal:open', function () {
    updateStats();
  });

  // Ganti nama proyek saat input diubah
  $('#save-project-name').on('input change', function () {
    const val = ($(this).val() || 'Untitled').trim();
    $('#file-name').text(val);
  });

  // Tombol Simpan Ulang ke Browser (LocalStorage)
  $('#btn-save-local-now').on('click', function () {
    if (typeof window.saveCameraNow === 'function') {
      window.saveCameraNow();
    } else if (typeof saveProject === 'function') {
      saveProject();
    }
    const $btn = $(this);
    const oldText = $btn.text();
    $btn.text('Tersimpan! ✓').css('color', '#22c55e');
    setTimeout(() => {
      $btn.text(oldText).css('color', '');
    }, 1500);
  });

  // Tombol Export File Proyek (.json) untuk dipindahkan ke PC lain
  $('#btn-export-project-json').on('click', function () {
    const name = getProjectName();
    $('#file-name').text(name);

    if (window.Exporter && typeof window.Exporter.json === 'function') {
      window.Exporter.json();
    } else {
      // Fallback export JSON langsung
      try {
        const data = typeof serializeProject === 'function' ? serializeProject() : { objects: State.objects };
        const str = JSON.stringify(data, null, 2);
        const blob = new Blob([str], { type: 'application/json' });
        const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'minivector';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanName}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 150);
      } catch (e) {
        console.error('Export JSON error:', e);
      }
    }
  });

  // Tombol Salin JSON ke Clipboard
  $('#btn-copy-project-json').on('click', function () {
    try {
      const data = typeof serializeProject === 'function' ? serializeProject() : { objects: State.objects };
      const str = JSON.stringify(data, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(str).then(() => {
          $('#save-copied-feedback').fadeIn(150);
          setTimeout(() => $('#save-copied-feedback').fadeOut(200), 2500);
        });
      } else {
        const $temp = $('<textarea>').val(str).appendTo('body').select();
        document.execCommand('copy');
        $temp.remove();
        $('#save-copied-feedback').fadeIn(150);
        setTimeout(() => $('#save-copied-feedback').fadeOut(200), 2500);
      }
    } catch (e) {
      console.warn('Copy JSON error:', e);
    }
  });
})();
