/* ================= DESIGN: FRAME PRESETS ================= */
// Mengelola preset ukuran Frame berdasarkan kategori (Mobile, Tablet, Laptop, Desktop, Paper, Aspect Ratio).
// Terletak di Property Display panel kanan: "Frame Presets".
// Bergantung pada: variabel.js (State), geometry.js (Geo), canvas.js (requestRender).

$(function() {
  const r2 = n => Math.round(n * 100) / 100;

  // Daftar data preset lengkap sesuai permintaan kategori
  const FRAME_PRESETS = [
    // 1. Mobile / Phone
    { type: 'mobile', label: 'iPhone 16 Pro Max (440x956)', width: 440, height: 956 },
    { type: 'mobile', label: 'iPhone 16 / 15 Pro (393x852)', width: 393, height: 852 },
    { type: 'mobile', label: 'iPhone SE (375x667)', width: 375, height: 667 },
    { type: 'mobile', label: 'Android Large (360x800)', width: 360, height: 800 },
    { type: 'mobile', label: 'Android Small (360x640)', width: 360, height: 640 },

    // 2. Tablet
    { type: 'tablet', label: 'iPad Pro 12.9" (1024x1366)', width: 1024, height: 1366 },
    { type: 'tablet', label: 'iPad Air / Pro 11" (834x1194)', width: 834, height: 1194 },
    { type: 'tablet', label: 'iPad mini (744x1133)', width: 744, height: 1133 },
    { type: 'tablet', label: 'Surface Pro 8 (1440x960)', width: 1440, height: 960 },

    // 3. Laptop
    { type: 'laptop', label: 'MacBook Pro 16" (1728x1117)', width: 1728, height: 1117 },
    { type: 'laptop', label: 'MacBook Pro 14" (1512x982)', width: 1512, height: 982 },
    { type: 'laptop', label: 'MacBook Air (1280x832)', width: 1280, height: 832 },
    { type: 'laptop', label: 'Laptop (400x720px)', width: 400, height: 720 },
    { type: 'laptop', label: 'Laptop HD (1366x768)', width: 1366, height: 768 },

    // 4. Desktop / Monitor
    { type: 'desktop', label: 'Desktop 1080p (1920x1080)', width: 1920, height: 1080 },
    { type: 'desktop', label: 'Desktop 1440p (2560x1440)', width: 2560, height: 1440 },
    { type: 'desktop', label: 'Desktop 4K (3840x2160)', width: 3840, height: 2160 },
    { type: 'desktop', label: 'iMac 24" (2240x1260)', width: 2240, height: 1260 },

    // 5. Paper (Ukuran Kertas Standar)
    { type: 'paper', label: 'A4 (595x842)', width: 595, height: 842 },
    { type: 'paper', label: 'A3 (842x1191)', width: 842, height: 1191 },
    { type: 'paper', label: 'A5 (420x595)', width: 420, height: 595 },
    { type: 'paper', label: 'Letter (612x792)', width: 612, height: 792 },
    { type: 'paper', label: 'Tabloid (792x1224)', width: 792, height: 1224 },

    // 6. Aspect Ratio
    { type: 'ratio', label: '16:9 Widescreen (1920x1080)', width: 1920, height: 1080 },
    { type: 'ratio', label: '9:16 Story / Reels (1080x1920)', width: 1080, height: 1920 },
    { type: 'ratio', label: '1:1 Square Post (1080x1080)', width: 1080, height: 1080 },
    { type: 'ratio', label: '4:5 Feed Post (1080x1350)', width: 1080, height: 1350 },
    { type: 'ratio', label: '4:3 Standard (1440x1080)', width: 1440, height: 1080 }
  ];

  // Populate options ke dalam optgroup masing-masing
  FRAME_PRESETS.forEach(p => {
    const $group = $(`#preset-group-${p.type}`);
    if ($group.length) {
      $group.append(`<option value="${p.width}x${p.height}" data-w="${p.width}" data-h="${p.height}" data-type="${p.type}">${p.label}</option>`);
    }
  });

  const getSingleSelectedFrame = () => {
    const sel = Geo.selection();
    if (sel.length === 1 && sel[0].obj.type === 'frame') {
      return sel[0];
    }
    return null;
  };

  const syncUI = () => {
    const f = getSingleSelectedFrame();
    const $wrap = $('#sec-frame-presets-wrap');
    if (!f) {
      $wrap.hide();
      return;
    }

    $wrap.show();
    const t = f.obj.transform;
    const curW = Math.round(t.width);
    const curH = Math.round(t.height);

    $('#frame-preset-current-info').text(`${curW} × ${curH} px`);

    // Update status tombol Portrait / Landscape
    const isPortrait = curH >= curW;
    $('#frame-orientation-seg button[data-orient="portrait"]').toggleClass('on', isPortrait);
    $('#frame-orientation-seg button[data-orient="landscape"]').toggleClass('on', !isPortrait);

    // Cek apakah ukuran saat ini cocok dengan salah satu preset
    const exactMatch = `${curW}x${curH}`;
    const flippedMatch = `${curH}x${curW}`;
    const $select = $('#prop-frame-preset-select');

    if ($select.find(`option[value="${exactMatch}"]`).length) {
      $select.val(exactMatch);
    } else if ($select.find(`option[value="${flippedMatch}"]`).length) {
      $select.val(flippedMatch);
    } else {
      $select.val('');
    }
  };

  // Dengarkan perubahan seleksi atau objek
  Geo.watch(syncUI);
  $(document).on('selection:change object:change', syncUI);

  // Ubah ukuran frame saat preset dipilih
  $('#prop-frame-preset-select').on('change', function() {
    const f = getSingleSelectedFrame();
    if (!f) return;

    const $opt = $(this).find(':selected');
    let w = parseFloat($opt.data('w'));
    let h = parseFloat($opt.data('h'));
    if (!w || !h) return;

    // Pertahankan orientasi saat ini jika user sedang dalam landscape/portrait
    const curW = f.obj.transform.width;
    const curH = f.obj.transform.height;
    const currentlyLandscape = curW > curH;
    const presetIsLandscape = w > h;

    if (currentlyLandscape !== presetIsLandscape && w !== h) {
      // Tukar agar mengikuti orientasi saat ini
      const tmp = w;
      w = h;
      h = tmp;
    }

    Geo.setSize(f.obj, w, h);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncUI();
  });

  // Tombol Flip Orientation (Portrait <-> Landscape)
  $('#btn-flip-orientation').on('click', function(e) {
    e.stopPropagation();
    const f = getSingleSelectedFrame();
    if (!f) return;

    const t = f.obj.transform;
    const newW = t.height;
    const newH = t.width;

    Geo.setSize(f.obj, newW, newH);
    $(document).trigger('object:change');
    if (typeof requestRender === 'function') requestRender();
    syncUI();
  });

  // Tombol P / L Segmented control
  $('#frame-orientation-seg').on('click', 'button[data-orient]', function() {
    const orient = $(this).data('orient');
    const f = getSingleSelectedFrame();
    if (!f) return;

    const t = f.obj.transform;
    const isCurrentlyPortrait = t.height >= t.width;

    if (orient === 'portrait' && !isCurrentlyPortrait) {
      const newW = t.height;
      const newH = t.width;
      Geo.setSize(f.obj, newW, newH);
      $(document).trigger('object:change');
      if (typeof requestRender === 'function') requestRender();
      syncUI();
    } else if (orient === 'landscape' && isCurrentlyPortrait) {
      const newW = t.height;
      const newH = t.width;
      Geo.setSize(f.obj, newW, newH);
      $(document).trigger('object:change');
      if (typeof requestRender === 'function') requestRender();
      syncUI();
    }
  });

  // Inisialisasi awal
  syncUI();
});
