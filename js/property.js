/* ================= TAB DESIGN / CODE & ACCORDION ================= */
const setAcc = ($sec, open) => {
  $sec.toggleClass('open', open);
  $sec.find('.fg-body').prop('hidden', !open);
  $sec.find('.fg-acc-toggle').attr('aria-expanded', open);
};
$('#view-design').on('click', '.fg-acc-toggle', function() {
  const $s = $(this).closest('.fg-acc');
  setAcc($s, !$s.hasClass('open'));
});
$('#view-design').on('click', '.fg-add', function() {
  setAcc($(this).closest('.fg-acc'), true);
});
$('#view-design').on('input', '.fg-color input[type="color"]', function() {
  $(this).siblings('.hex').val(this.value.slice(1).toUpperCase());
});
$('#view-design').on('input', '.fg-color .hex', function() {
  if (/^[0-9a-f]{6}$/i.test(this.value)) $(this).siblings('input[type="color"]').val('#' + this.value);
});
$('.mode-tab').on('click', function() {
  const mode = $(this).data('mode');
  $('.mode-tab').removeClass('active').attr('aria-selected', false);
  $(this).addClass('active').attr('aria-selected', true);
  $('#view-design').prop('hidden', mode !== 'design');
  $('#view-code').prop('hidden', mode !== 'code');
});

/* ================= SCRUBBABLE NUMBER INPUTS (FIGMA STYLE WITH INFINITE MOUSE WRAP) ================= */
// Mengatur nilai input angka dengan klik-tahan pada label/ikon atau input, lalu geser horizontal.
// Fitur Infinite Mouse Wrapping ala Figma: saat kursor digeser keluar sisi kiri layar, kursor muncul dari kanan!
$(function() {
  let isScrubbing = false,
      startVal = 0,
      startX = 0,
      $targetInput = null,
      moved = false,
      step = 1,
      min = -Infinity,
      max = Infinity,
      isDecimal = false,
      totalDeltaX = 0,
      virtualX = 0,
      virtualY = 0;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Buat DOM Custom Virtual Scrubbing Cursor jika belum ada
  let $virtualCursor = $('#virtual-scrub-cursor');
  if (!$virtualCursor.length) {
    $virtualCursor = $(
      '<div id="virtual-scrub-cursor">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="8 4 2 12 8 20" stroke="#000" stroke-width="3"/>' +
          '<polyline points="16 4 22 12 16 20" stroke="#000" stroke-width="3"/>' +
          '<line x1="2" y1="12" x2="22" y2="12" stroke="#000" stroke-width="3"/>' +
          '<polyline points="8 4 2 12 8 20"/>' +
          '<polyline points="16 4 22 12 16 20"/>' +
          '<line x1="2" y1="12" x2="22" y2="12"/>' +
        '</svg>' +
      '</div>'
    ).appendTo('body');
  }

  $(document).on('pointerdown', '.fg-in > .lb, .fg-in > i, .fg-in input[type="number"], .fg-color .op, .matrix-cell-in, .matrix-cell-in > i, .matrix-cell-in input', function(e) {
    if (e.button !== 0) return; // Hanya klik kiri
    
    // Temukan input terkait
    const $this = $(this);
    if ($this.is('input')) {
      $targetInput = $this;
    } else if ($this.closest('.matrix-cell-in').length) {
      $targetInput = $this.closest('.matrix-cell-in').find('input');
    } else {
      $targetInput = $this.closest('.fg-in').find('input[type="number"]');
      if (!$targetInput.length) $targetInput = $this.closest('.fg-in').find('input');
    }

    if (!$targetInput.length || $targetInput.prop('disabled') || $targetInput.prop('readonly')) {
      $targetInput = null;
      return;
    }

    const currentVal = parseFloat($targetInput.val());
    startVal = isFinite(currentVal) ? currentVal : 0;
    startX = e.clientX;
    virtualX = e.clientX;
    virtualY = e.clientY;
    totalDeltaX = 0;
    moved = false;

    // Batas min dan max
    const rawMin = $targetInput.attr('min');
    const rawMax = $targetInput.attr('max');
    min = rawMin !== undefined && rawMin !== '' ? parseFloat(rawMin) : -Infinity;
    max = rawMax !== undefined && rawMax !== '' ? parseFloat(rawMax) : Infinity;

    // Deteksi apakah input memakai desimal
    const rawStep = $targetInput.attr('step');
    isDecimal = rawStep === 'any' || (rawStep && parseFloat(rawStep) < 1);
    step = 1;

    // Aktifkan scrubbing pada label/ikon atau jika klik pada elemen matrix
    if (!$this.is('input') || $this.closest('.matrix-cell-in').length) {
      if (!$this.is('input')) {
        e.preventDefault();
        isScrubbing = true;
        try {
          if (e.pointerId && this.setPointerCapture) this.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    }
  });

  $(document).on('pointermove', function(e) {
    if (!$targetInput) return;

    // Dapatkan pergerakan mouse aktual
    const moveX = (e.originalEvent && typeof e.originalEvent.movementX === 'number' && e.originalEvent.movementX !== 0) 
      ? e.originalEvent.movementX 
      : (e.clientX - startX);

    if (!moved && Math.abs(e.clientX - startX) > 2) {
      moved = true;
      isScrubbing = true;
      $('body').addClass('scrubbing-active');
      $virtualCursor.show().css({ left: virtualX + 'px', top: virtualY + 'px' });
    }

    if (isScrubbing && moved) {
      e.preventDefault();

      const screenW = window.innerWidth;
      
      // Update posisi virtual cursor dengan infinite wrap:
      // Jika kursor digeser keluar kiri (virtualX <= 0), lompat ke kanan layar (screenW)
      // Jika kursor digeser keluar kanan (virtualX >= screenW), lompat ke kiri layar (0)
      virtualX += (typeof e.originalEvent.movementX === 'number' && Math.abs(e.originalEvent.movementX) < 100)
        ? e.originalEvent.movementX
        : (e.clientX - startX);
      startX = e.clientX;

      if (virtualX <= 0) {
        virtualX = screenW - 2;
      } else if (virtualX >= screenW) {
        virtualX = 2;
      }

      $virtualCursor.css({ left: virtualX + 'px', top: virtualY + 'px' });

      // Akumulasikan total jarak scrub
      totalDeltaX += (typeof e.originalEvent.movementX === 'number' && Math.abs(e.originalEvent.movementX) < 100)
        ? e.originalEvent.movementX
        : moveX;

      // Multiplier modifier: Shift = 10x, Alt = 0.1x
      let multiplier = 1;
      if (e.shiftKey) multiplier = 10;
      else if (e.altKey) multiplier = 0.1;

      // Hitung selisih nilai berdasarkan jarak geser piksel
      // Setiap ~3px geser mouse = 1 unit nilai
      const deltaUnits = (totalDeltaX / 3) * step * multiplier;
      let nextVal = startVal + deltaUnits;

      if (isDecimal || e.altKey) {
        nextVal = Math.round(nextVal * 100) / 100;
      } else {
        nextVal = Math.round(nextVal);
      }

      nextVal = clamp(nextVal, min, max);

      // Perbarui nilai input dan trigger event input & change
      if (parseFloat($targetInput.val()) !== nextVal) {
        $targetInput.val(nextVal).trigger('input').trigger('change');
      }
    }
  });

  const endScrub = function(e) {
    if ($targetInput) {
      if (isScrubbing && moved) {
        $targetInput.trigger('change');
      }
      $('body').removeClass('scrubbing-active');
      $virtualCursor.hide();
    }
    isScrubbing = false;
    moved = false;
    totalDeltaX = 0;
    $targetInput = null;
  };

  $(document).on('pointerup pointercancel', endScrub);
});