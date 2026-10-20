/* ================= POPUP (modal) ================= */
let lastFocus = null;
const modalOpen = () => $('.modal.open').length > 0;
const openModal = id => {
  const $m = $('#modal-' + id);
  if (!$m.length) return;
  lastFocus = document.activeElement;
  $m.addClass('open').trigger('modal:open');
  $m.find('.modal-close').first().trigger('focus');
};
const closeModal = () => {
  $('.modal.open').removeClass('open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
};
const trapTab = e => {
  const f = $('.modal.open').find('button, input:not([hidden]), [tabindex]:not([tabindex="-1"])')
    .filter(':visible:not(:disabled)').toArray();
  if (!f.length) return;
  const first = f[0],
    last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
};
$(document).on('click', '[data-open-modal]', function () {
  openModal($(this).data('open-modal'));
});
$(document).on('click', '[data-close-modal]', closeModal);
let downOnBackdrop = false;
$('.modal').on('mousedown', function (e) {
  downOnBackdrop = e.target === this;
})
  .on('click', function (e) {
    if (e.target === this && downOnBackdrop) closeModal();
  });

/* ---- Image: 9 Slot Panel Manager (PNG, JPG, WEBP, SVG) ---- */
const STORAGE_KEY_SLOTS = 'minivector_image_slots_v1';
let imageSlots = [];

const loadImageSlots = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SLOTS);
    imageSlots = raw ? JSON.parse(raw) : [];
  } catch (_) {
    imageSlots = [];
  }
  // Pastikan tepat 9 slot
  while (imageSlots.length < 9) {
    imageSlots.push(null);
  }
  if (imageSlots.length > 9) {
    imageSlots = imageSlots.slice(0, 9);
  }
};

const saveImageSlots = () => {
  try {
    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(imageSlots));
  } catch (err) {
    console.warn('Storage quota exceeded for image slots:', err);
  }
};

const renderImageGrid = () => {
  const html = imageSlots.map((slot, i) => {
    if (slot && slot.dataUrl) {
      return `
        <div class="img-cell has-image" data-slot="${i}" role="button" tabindex="0" title="Klik untuk tempatkan ke canvas: ${esc(slot.name || 'Image ' + (i + 1))}">
          <button class="img-del-btn" data-del-slot="${i}" title="Hapus gambar dari slot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <img src="${slot.dataUrl}" alt="${esc(slot.name || '')}">
        </div>
      `;
    } else {
      return `
        <button class="img-cell" data-slot="${i}" aria-label="Upload gambar ke Slot ${i + 1}">
          ${ico('image')}
          <span class="img-cell-label">Image ${i + 1}</span>
        </button>
      `;
    }
  }).join('');
  $('#image-grid').html(html);
};

loadImageSlots();
renderImageGrid();

let targetUploadSlot = -1;

$('#image-grid').on('click', '.img-cell', function (e) {
  // Jangan proses jika tombol delete yang diklik
  if ($(e.target).closest('.img-del-btn').length > 0) return;

  const slotIdx = parseInt($(this).data('slot'), 10);
  const slotData = imageSlots[slotIdx];

  if (!slotData || !slotData.dataUrl) {
    // Slot masih kosong -> buka file picker
    targetUploadSlot = slotIdx;
    $('#image-slot-file-input').val('').trigger('click');
  } else {
    // Slot sudah terisi -> pilih gambar ini untuk ditaruh ke canvas
    $('#image-grid .img-cell').removeClass('selected');
    $(this).addClass('selected');

    if (window.ImageTool && typeof window.ImageTool.prepareImage === 'function') {
      window.ImageTool.prepareImage(slotData.dataUrl, slotData.name || `Image ${slotIdx + 1}`);
    }
    closeModal();
    if (typeof window.pickTool === 'function') {
      window.pickTool('image');
    }
  }
});

// Hapus gambar dari slot
$('#image-grid').on('click', '.img-del-btn', function (e) {
  e.stopPropagation();
  e.preventDefault();
  const slotIdx = parseInt($(this).data('del-slot'), 10);
  if (slotIdx >= 0 && slotIdx < imageSlots.length) {
    imageSlots[slotIdx] = null;
    saveImageSlots();
    renderImageGrid();
  }
});

// Baca file yang dipilih dari file input
$('#image-slot-file-input').on('change', function () {
  const file = this.files && this.files[0];
  if (!file || targetUploadSlot < 0) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    imageSlots[targetUploadSlot] = {
      name: file.name || `Image ${targetUploadSlot + 1}`,
      type: file.type,
      size: file.size,
      dataUrl: dataUrl
    };
    saveImageSlots();
    renderImageGrid();
    targetUploadSlot = -1;
  };
  reader.readAsDataURL(file);
});

// Helper publik untuk menyimpan gambar (misal dari paste / drop) ke slot kosong pertama
window.addImageToSlots = (dataUrl, name = 'Image') => {
  if (!dataUrl) return -1;
  // Cari slot kosong pertama
  let emptyIdx = imageSlots.findIndex(s => !s || !s.dataUrl);
  if (emptyIdx === -1) {
    // Jika semua 9 slot penuh, ganti slot pertama (FIFO)
    emptyIdx = 0;
  }
  imageSlots[emptyIdx] = {
    name: name || `Image ${emptyIdx + 1}`,
    type: 'image/png',
    size: 0,
    dataUrl: dataUrl
  };
  saveImageSlots();
  renderImageGrid();
  return emptyIdx;
};

/* ---- Import (dummy) ---- */
const ACCEPT = /\.(json|svg|png|jpe?g|fig)$/i; // [EDIT] format yang dianggap lolos
const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const resetImport = () => {
  $('#import-file').val('');
  $('#import-result, #import-success, #btn-import-done').prop('hidden', true);
  $('#btn-import-confirm').prop('hidden', false).prop('disabled', true);
  $('#dropzone').removeClass('dragover');
};
let currentImportFile = null;
const takeFile = f => {
  if (f) {
    currentImportFile = f;
    if (typeof window.setPendingImportFile === 'function') window.setPendingImportFile(f);
  }
  if (!f) return;
  const ok = ACCEPT.test(f.name);
  $('#import-name').text(f.name);
  $('#import-size').text(fmtSize(f.size));
  $('#import-badge').text(ok ? 'Lolos' : 'Format tidak didukung').toggleClass('ok', ok).toggleClass('bad', !ok);
  $('#import-result').prop('hidden', false).toggleClass('is-bad', !ok);
  $('#import-success').prop('hidden', true);
  $('#btn-import-confirm').prop('hidden', false).prop('disabled', !ok);
  $('#btn-import-done').prop('hidden', true);
};
$('#modal-import').on('modal:open', resetImport);
$('#dropzone')
  .on('click', () => $('#import-file').trigger('click'))
  .on('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('#import-file').trigger('click');
    }
  })
  .on('dragenter dragover', function (e) {
    e.preventDefault();
    $(this).addClass('dragover');
  })
  .on('dragleave', function () {
    $(this).removeClass('dragover');
  })
  .on('drop', function (e) {
    e.preventDefault();
    $(this).removeClass('dragover');
    takeFile(e.originalEvent.dataTransfer.files[0]);
  });
$('#import-file').on('change', function () {
  takeFile(this.files[0]);
});
$('#btn-import-confirm').on('click', function () {
  const self = this;
  if (currentImportFile && currentImportFile.name.endsWith('.json') && typeof window.executeImportJSON === 'function') {
    window.executeImportJSON(currentImportFile, function(ok) {
      if (ok) {
        $('#import-success').prop('hidden', false).html('<svg class="ico"><use href="#i-check" /></svg>File JSON berhasil dimuat ke kanvas!');
        $(self).prop('hidden', true);
        $('#btn-import-done').prop('hidden', false).trigger('focus');
      }
    });
  } else {
    $('#import-success').prop('hidden', false);
    $(self).prop('hidden', true);
    $('#btn-import-done').prop('hidden', false).trigger('focus');
  }
});

/* ---- Settings modal initialization & synchronization ---- */
const initSettingsModal = () => {
  if (window.Magnet) {
    $('#setting-magnet-enable').prop('checked', !!window.Magnet.enabled);
    $('#setting-magnet-threshold').val(window.Magnet.threshold || 6);
  }
  if (window.Padding) {
    $('#setting-padding-enable').prop('checked', !!window.Padding.enabled);
  }
  if (typeof window.getCameraSaveMode === 'function') {
    $('#setting-camera-autosave').prop('checked', window.getCameraSaveMode() === 'auto');
  }
};

$('#modal-settings').on('modal:open', initSettingsModal);

$(document).on('change', '#setting-magnet-enable', function () {
  if (window.Magnet) window.Magnet.setEnabled(this.checked);
});

$(document).on('input change', '#setting-magnet-threshold', function () {
  if (window.Magnet) window.Magnet.setThreshold(this.value);
});

$(document).on('change', '#setting-padding-enable', function () {
  if (window.Padding) window.Padding.setEnabled(this.checked);
});

$(document).on('change', '#setting-camera-autosave', function () {
  const mode = this.checked ? 'auto' : 'manual';
  if (typeof window.setCameraSaveMode === 'function') {
    window.setCameraSaveMode(mode);
  }
});

// Run initial sync on document ready
$(function () {
  initSettingsModal();
});

