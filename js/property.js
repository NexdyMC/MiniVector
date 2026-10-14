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

/* ================= SCRUBBABLE NUMBER INPUTS (FIGMA STYLE) ================= */
// Mengatur nilai input angka dengan klik-tahan pada label/ikon atau input, lalu geser horizontal.
// Geser kanan (+), geser kiri (-). Tahan Shift untuk lompatan 10x, tahan Alt untuk presisi halus 0.1x.
$(function() {
  let isScrubbing = false,
      startVal = 0,
      startX = 0,
      $targetInput = null,
      moved = false,
      step = 1,
      min = -Infinity,
      max = Infinity,
      isDecimal = false;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  $(document).on('pointerdown', '.fg-in > .lb, .fg-in > i, .fg-in input[type="number"], .fg-color .op', function(e) {
    if (e.button !== 0) return; // Hanya klik kiri
    
    // Temukan input terkait
    const $this = $(this);
    if ($this.is('input')) {
      $targetInput = $this;
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

    // Kunci capture jika klik pada label/ikon
    if (!$this.is('input')) {
      e.preventDefault();
      isScrubbing = true;
      try {
        if (e.pointerId && this.setPointerCapture) this.setPointerCapture(e.pointerId);
      } catch (err) {}
      $('body').css('cursor', 'ew-resize');
    }
  });

  $(document).on('pointermove', function(e) {
    if (!$targetInput) return;

    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 2) {
      moved = true;
      isScrubbing = true;
      $('body').css('cursor', 'ew-resize');
    }

    if (isScrubbing && moved) {
      e.preventDefault();

      // Multiplier modifier: Shift = 10x, Alt = 0.1x
      let multiplier = 1;
      if (e.shiftKey) multiplier = 10;
      else if (e.altKey) multiplier = 0.1;

      // Hitung selisih nilai berdasarkan jarak geser piksel
      // Setiap ~3px geser mouse = 1 unit nilai
      const deltaUnits = (dx / 3) * step * multiplier;
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
        // Akhiri perubahan dan picu change final
        $targetInput.trigger('change');
      }
      $('body').css('cursor', '');
    }
    isScrubbing = false;
    moved = false;
    $targetInput = null;
  };

  $(document).on('pointerup pointercancel', endScrub);
});