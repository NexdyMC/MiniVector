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

/* ---- Image: 6 kotak dummy ---- */
$('#image-grid').html(Array.from({
  length: 6
}, (_, i) =>
  `<button class="img-cell" aria-label="Image ${i + 1}">${ico('image')}<span>Image ${i + 1}</span></button>`).join(''));
$('#image-grid').on('click', '.img-cell', function () {
  $('#image-grid .img-cell').removeClass('selected');
  $(this).addClass('selected');
});

/* ---- Import (dummy) ---- */
const ACCEPT = /\.(json|svg|png|jpe?g|fig)$/i; // [EDIT] format yang dianggap lolos
const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const resetImport = () => {
  $('#import-file').val('');
  $('#import-result, #import-success, #btn-import-done').prop('hidden', true);
  $('#btn-import-confirm').prop('hidden', false).prop('disabled', true);
  $('#dropzone').removeClass('dragover');
};
const takeFile = f => {
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
  $('#import-success').prop('hidden', false);
  $(this).prop('hidden', true);
  $('#btn-import-done').prop('hidden', false).trigger('focus');
});
// cegah browser membuka file bila dilepas di luar dropzone
$(window).on('dragover drop', e => e.preventDefault());
