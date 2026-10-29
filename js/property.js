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

  let pointerLockedElement = null;

  // Selector komprehensif mencakup semua input number, label, ikon, maupun span prefix/suffix
  const SCRUB_SELECTOR = [
    'input[type="number"]',
    '#prop-fontsize', '#prop-lineheight', '#prop-letterspacing', // Input text yang berisi angka
    '.fg-in > .lb', '.fg-in > i', '.fg-in > svg', '.fg-in > span:not(.end)',
    '.fg-label',
    '.fg-color .op',
    '.matrix-cell-in', '.matrix-cell-in > i', '.matrix-cell-in input',
    '.zoom-val', '.zoom-val span', '.zoom-val input'
  ].join(', ');

  $(document).on('pointerdown', SCRUB_SELECTOR, function(e) {
    if (e.button !== 0) return; // Hanya klik kiri
    
    const $this = $(this);
    let $input = null;

    // 1. Jika elemen yang diklik adalah input itu sendiri
    if ($this.is('input')) {
      $input = $this;
    } 
    // 2. Jika di dalam .matrix-cell-in
    else if ($this.closest('.matrix-cell-in').length) {
      $input = $this.closest('.matrix-cell-in').find('input');
    }
    // 3. Jika di dalam .zoom-val
    else if ($this.closest('.zoom-val').length) {
      $input = $this.closest('.zoom-val').find('input');
    }
    // 4. Jika di dalam .fg-in
    else if ($this.closest('.fg-in').length) {
      $input = $this.closest('.fg-in').find('input[type="number"]');
      if (!$input.length) $input = $this.closest('.fg-in').find('input');
    }
    // 5. Jika mengklik .fg-label (mencari input number di bawahnya)
    else if ($this.hasClass('fg-label')) {
      const $parentDiv = $this.parent();
      $input = $parentDiv.find('.fg-in input[type="number"], input[type="number"]');
      if (!$input.length) {
        $input = $this.next('.fg-in').find('input');
      }
    }

    if (!$input || !$input.length || $input.prop('disabled') || $input.prop('readonly')) {
      $targetInput = null;
      return;
    }

    $targetInput = $input;

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

    // Deteksi apakah input memakai desimal atau step custom
    const rawStep = $targetInput.attr('step');
    isDecimal = rawStep === 'any' || (rawStep && parseFloat(rawStep) < 1);
    step = (rawStep && rawStep !== 'any' && parseFloat(rawStep) > 0) ? parseFloat(rawStep) : 1;

    // Aktifkan scrubbing jika klik pada label/ikon atau drag mouse
    if (!$this.is('input') || $this.closest('.matrix-cell-in').length) {
      if (!$this.is('input')) {
        e.preventDefault();
        isScrubbing = true;
        pointerLockedElement = this;
        try {
          if (e.pointerId && this.setPointerCapture) this.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    }
  });

  $(document).on('pointermove', function(e) {
    if (!$targetInput) return;

    // Pergerakan mouse aktual
    let delta = 0;
    if (e.originalEvent && typeof e.originalEvent.movementX === 'number' && e.originalEvent.movementX !== 0) {
      delta = e.originalEvent.movementX;
    } else {
      delta = e.clientX - startX;
      startX = e.clientX;
    }

    if (!moved && Math.abs(delta) > 0) {
      moved = true;
      isScrubbing = true;
      $('body').addClass('scrubbing-active');
      $virtualCursor.show().css({ left: virtualX + 'px', top: virtualY + 'px' });
      // Coba request pointer lock browser jika didukung agar kursor hardware tidak mentok di layar
      try {
        if (pointerLockedElement && pointerLockedElement.requestPointerLock && !document.pointerLockElement) {
          pointerLockedElement.requestPointerLock();
        }
      } catch (_) {}
    }

    if (isScrubbing && moved) {
      e.preventDefault();

      const screenW = window.innerWidth;
      
      // Update posisi virtual cursor dengan infinite wrap:
      virtualX += delta;
      if (virtualX <= 0) {
        virtualX = screenW - 2;
      } else if (virtualX >= screenW) {
        virtualX = 2;
      }

      $virtualCursor.css({ left: virtualX + 'px', top: virtualY + 'px' });

      // Akumulasikan total jarak scrub
      totalDeltaX += delta;

      // Multiplier modifier: Shift = 10x, Alt = 0.1x
      let multiplier = 1;
      if (e.shiftKey) multiplier = 10;
      else if (e.altKey) multiplier = 0.1;

      // Hitung selisih nilai: ~2.5px geser mouse = 1 unit nilai
      const deltaUnits = (totalDeltaX / 2.5) * step * multiplier;
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
    if (document.exitPointerLock && document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (_) {}
    }
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
    pointerLockedElement = null;
  };

  $(document).on('pointerup pointercancel', endScrub);
});