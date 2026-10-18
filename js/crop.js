/* ================= TOOL: CROP (INTERACTIVE FIGMA-STYLE IMAGE CROP) ================= */
// Mengelola interaksi Crop gambar:
// 1. Gambar latar penuh yang diredupkan (dimmed / dark overlay).
// 2. Bounding box pemotongan (crop rect) yang bisa digeser atau di-resize dengan 8 handles (corner & side).
// 3. Slider scale zoom gambar di dalam bingkai crop.
// 4. Dropdown pilihan rasio (Custom, Original, 1:1 Square, Circle, Landscape 16:9 dll, Portrait 9:16 dll).
// 5. Tombol Resize to Fit, Cancel (Esc), dan Apply (Enter / ✓).

window.CropTool = (() => {
  let active = false;
  let targetObj = null;
  let imgEl = null;

  // State crop saat ini (dalam koordinat lokal gambar asli: naturalWidth x naturalHeight)
  let initialTransform = null;
  let initialCrop = null;

  // Rect crop aktif (dalam koordinat world canvas)
  let cropWorld = { x: 0, y: 0, width: 100, height: 100 };
  
  // Rect gambar asli penuh (dalam koordinat world canvas)
  let imgWorld = { x: 0, y: 0, width: 100, height: 100 };

  // Rasio aspek yang sedang dikunci (null jika bebas / 'custom')
  let lockedRatio = null; // number (width / height) atau 'circle'
  let isCircle = false;

  // Drag interaction
  let dragMode = null; // 'crop-move', 'crop-resize', 'img-pan'
  let activeHandle = null; // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'
  let dragStart = null;
  let origCropWorld = null;
  let origImgWorld = null;

  const r2 = n => Math.round(n * 100) / 100;

  // Masuk ke mode Crop untuk suatu objek gambar
  const enter = (imageObj) => {
    if (!imageObj || imageObj.type !== 'image' || !imageObj.src) return;
    targetObj = imageObj;
    active = true;

    // Ambil cache ImageElement
    if (typeof getImageElement === 'function') {
      imgEl = getImageElement(imageObj.src);
    } else {
      imgEl = new Image();
      imgEl.src = imageObj.src;
    }

    const t = imageObj.transform;
    initialTransform = JSON.parse(JSON.stringify(t));
    initialCrop = imageObj.crop ? JSON.parse(JSON.stringify(imageObj.crop)) : null;

    // Hitung posisi absolut (dunia) objek jika berada di dalam frame atau group
    let worldX = t.x;
    let worldY = t.y;
    if (typeof Geo !== 'undefined' && typeof Geo.find === 'function') {
      const found = Geo.find(imageObj.id);
      if (found && found.origin) {
        worldX = found.origin.x + t.x;
        worldY = found.origin.y + t.y;
      }
    }

    // Jika objek sudah memiliki crop sebelumnya, hitung posisi imgWorld relatif terhadap crop
    const natW = (imgEl && imgEl.naturalWidth) || t.width;
    const natH = (imgEl && imgEl.naturalHeight) || t.height;

    if (imageObj.crop) {
      const c = imageObj.crop;
      const scaleX = t.width / c.width;
      const scaleY = t.height / c.height;

      imgWorld = {
        x: worldX - c.x * scaleX,
        y: worldY - c.y * scaleY,
        width: natW * scaleX,
        height: natH * scaleY
      };
      cropWorld = {
        x: worldX,
        y: worldY,
        width: t.width,
        height: t.height
      };
    } else {
      // Belum pernah di-crop: imgWorld sama persis dengan bounding box saat ini
      imgWorld = {
        x: worldX,
        y: worldY,
        width: t.width,
        height: t.height
      };
      cropWorld = {
        x: worldX,
        y: worldY,
        width: t.width,
        height: t.height
      };
    }

    lockedRatio = null;
    isCircle = false;

    // Munculkan Floating Crop Toolbar
    if (window.CropUI) {
      window.CropUI.show(targetObj);
    }

    if (typeof requestRender === 'function') requestRender();
  };

  // Batalkan pemotongan (Cancel / Esc)
  const cancel = () => {
    if (!active || !targetObj) return;
    // Kembalikan ke state awal
    if (initialTransform) {
      targetObj.transform = JSON.parse(JSON.stringify(initialTransform));
    }
    if (initialCrop) {
      targetObj.crop = JSON.parse(JSON.stringify(initialCrop));
    } else {
      delete targetObj.crop;
    }

    exit();
  };

  // Konfirmasi pemotongan (Apply / Enter)
  const apply = () => {
    if (!active || !targetObj || !imgEl) return;

    // Hitung crop rect dalam koordinat natural gambar
    const natW = imgEl.naturalWidth || targetObj.transform.width;
    const natH = imgEl.naturalHeight || targetObj.transform.height;

    // Rasio transformasi antara imgWorld dan ukuran natural gambar
    const scaleX = natW / imgWorld.width;
    const scaleY = natH / imgWorld.height;

    const cropX = Math.max(0, (cropWorld.x - imgWorld.x) * scaleX);
    const cropY = Math.max(0, (cropWorld.y - imgWorld.y) * scaleY);
    const cropW = Math.min(natW, cropWorld.width * scaleX);
    const cropH = Math.min(natH, cropWorld.height * scaleY);

    targetObj.crop = {
      x: r2(cropX),
      y: r2(cropY),
      width: r2(cropW),
      height: r2(cropH)
    };

    // Update transform objek di canvas (konversikan kembali ke koordinat lokal parent jika bersarang)
    let localX = cropWorld.x;
    let localY = cropWorld.y;
    let parentGroup = null;

    if (typeof Geo !== 'undefined' && typeof Geo.find === 'function') {
      const found = Geo.find(targetObj.id);
      if (found && found.origin) {
        localX = cropWorld.x - found.origin.x;
        localY = cropWorld.y - found.origin.y;
      }
      if (found && found.parent && found.parent.type === 'group') {
        parentGroup = found.parent;
      }
    }

    targetObj.transform.x = r2(localX);
    targetObj.transform.y = r2(localY);
    targetObj.transform.width = r2(cropWorld.width);
    targetObj.transform.height = r2(cropWorld.height);

    if (isCircle) {
      const rad = Math.min(cropWorld.width, cropWorld.height) / 2;
      targetObj.geometry = targetObj.geometry || {};
      targetObj.geometry.cornerRadius = [rad, rad, rad, rad];
    }

    // Perbarui geometry nodes
    if (window.ImageTool && typeof window.ImageTool.buildNodes === 'function') {
      targetObj.geometry.nodes = window.ImageTool.buildNodes(cropWorld.width, cropWorld.height);
    }

    // Hitung ulang bounds group jika gambar berada di dalam group
    if (parentGroup && window.Grouping && typeof window.Grouping.recalculateBounds === 'function') {
      window.Grouping.recalculateBounds(parentGroup);
    }

    $(document).trigger('object:change');
    exit();
  };

  const exit = () => {
    active = false;
    targetObj = null;
    dragMode = null;
    activeHandle = null;
    if (window.CropUI && window.CropUI.isOpen()) {
      window.CropUI.hide();
    }
    if (typeof requestRender === 'function') requestRender();
  };

  // Handler: Ubah Rasio dari CropUI
  $(document).on('crop:ratioChange', (e, ratio) => {
    if (!active || !targetObj) return;

    if (ratio === 'custom') {
      lockedRatio = null;
      isCircle = false;
    } else if (ratio === 'original') {
      const natW = (imgEl && imgEl.naturalWidth) || imgWorld.width;
      const natH = (imgEl && imgEl.naturalHeight) || imgWorld.height;
      lockedRatio = natW / natH;
      isCircle = false;
      adjustCropToRatio(lockedRatio);
    } else if (ratio === 'circle') {
      lockedRatio = 1;
      isCircle = true;
      adjustCropToRatio(1);
    } else if (ratio.includes(':')) {
      const [rw, rh] = ratio.split(':').map(Number);
      if (rw > 0 && rh > 0) {
        lockedRatio = rw / rh;
        isCircle = false;
        adjustCropToRatio(lockedRatio);
      }
    }
    if (typeof requestRender === 'function') requestRender();
  });

  // Handler: Slider Scale / Zoom gambar di dalam crop
  $(document).on('crop:scaleChange', (e, scale) => {
    if (!active || !targetObj) return;

    // Skala relatif terhadap ukuran cropWorld saat ini
    const curCenter = {
      x: cropWorld.x + cropWorld.width / 2,
      y: cropWorld.y + cropWorld.height / 2
    };

    const baseW = cropWorld.width;
    const baseH = cropWorld.height;
    const newW = baseW * scale;
    const newH = baseH * scale;

    imgWorld.x = curCenter.x - newW / 2;
    imgWorld.y = curCenter.y - newH / 2;
    imgWorld.width = newW;
    imgWorld.height = newH;

    if (typeof requestRender === 'function') requestRender();
  });

  // Handler: Tombol Fit (Reset Crop)
  $(document).on('crop:fit', () => {
    if (!active || !targetObj) return;
    cropWorld = { ...imgWorld };
    lockedRatio = null;
    isCircle = false;
    if (typeof requestRender === 'function') requestRender();
  });

  $(document).on('crop:cancel', cancel);
  $(document).on('crop:apply', apply);

  // Sesuaikan cropWorld ke rasio tertentu
  const adjustCropToRatio = (ratio) => {
    if (!ratio || ratio <= 0) return;
    const curW = cropWorld.width;
    const curH = cropWorld.height;
    const curCenter = { x: cropWorld.x + curW / 2, y: cropWorld.y + curH / 2 };

    let newW = curW;
    let newH = curW / ratio;

    if (newH > curH) {
      newH = curH;
      newW = curH * ratio;
    }

    cropWorld.width = Math.round(newW);
    cropWorld.height = Math.round(newH);
    cropWorld.x = Math.round(curCenter.x - newW / 2);
    cropWorld.y = Math.round(curCenter.y - newH / 2);
  };

  // Deteksi klik handle crop
  const getCropHandleAt = (pt, zoom) => {
    if (!active) return null;
    const hitRadius = Math.max(10, 14 / zoom);
    const b = cropWorld;

    const handles = [
      { type: 'nw', x: b.x, y: b.y, cursor: 'nwse-resize' },
      { type: 'ne', x: b.x + b.width, y: b.y, cursor: 'nesw-resize' },
      { type: 'se', x: b.x + b.width, y: b.y + b.height, cursor: 'nwse-resize' },
      { type: 'sw', x: b.x, y: b.y + b.height, cursor: 'nesw-resize' },
      { type: 'n',  x: b.x + b.width / 2, y: b.y, cursor: 'ns-resize' },
      { type: 's',  x: b.x + b.width / 2, y: b.y + b.height, cursor: 'ns-resize' },
      { type: 'e',  x: b.x + b.width, y: b.y + b.height / 2, cursor: 'ew-resize' },
      { type: 'w',  x: b.x, y: b.y + b.height / 2, cursor: 'ew-resize' }
    ];

    for (const h of handles) {
      if (Math.abs(pt.x - h.x) <= hitRadius && Math.abs(pt.y - h.y) <= hitRadius) {
        return h;
      }
    }
    return null;
  };

  // -------------------------------------------------------------
  // RENDER OVERLAY CROP (ALA FIGMA)
  // -------------------------------------------------------------
  const drawOverlay = (ctx, zoom) => {
    if (!active || !targetObj || !imgEl) return;

    ctx.save();

    // 1. Gambar gambar asli penuh dengan transparansi redup (Dimmed background)
    ctx.globalAlpha = 0.35;
    ctx.drawImage(imgEl, imgWorld.x, imgWorld.y, imgWorld.width, imgWorld.height);

    // 2. Gambar area yang terpotong secara jernih (100% opacity)
    ctx.globalAlpha = 1.0;
    ctx.save();
    ctx.beginPath();
    if (isCircle) {
      const cx = cropWorld.x + cropWorld.width / 2;
      const cy = cropWorld.y + cropWorld.height / 2;
      const r = Math.min(cropWorld.width, cropWorld.height) / 2;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else {
      ctx.rect(cropWorld.x, cropWorld.y, cropWorld.width, cropWorld.height);
    }
    ctx.clip();
    ctx.drawImage(imgEl, imgWorld.x, imgWorld.y, imgWorld.width, imgWorld.height);
    ctx.restore();

    // 3. Grid Garis Pandu Rule of Thirds (Garis putus-putus halus di dalam area crop)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([3 / zoom, 3 / zoom]);

    const stepX = cropWorld.width / 3;
    const stepY = cropWorld.height / 3;

    ctx.beginPath();
    // 2 Garis vertikal
    ctx.moveTo(cropWorld.x + stepX, cropWorld.y);
    ctx.lineTo(cropWorld.x + stepX, cropWorld.y + cropWorld.height);
    ctx.moveTo(cropWorld.x + stepX * 2, cropWorld.y);
    ctx.lineTo(cropWorld.x + stepX * 2, cropWorld.y + cropWorld.height);
    // 2 Garis horizontal
    ctx.moveTo(cropWorld.x, cropWorld.y + stepY);
    ctx.lineTo(cropWorld.x + cropWorld.width, cropWorld.y + stepY);
    ctx.moveTo(cropWorld.x, cropWorld.y + stepY * 2);
    ctx.lineTo(cropWorld.x + cropWorld.width, cropWorld.y + stepY * 2);
    ctx.stroke();
    ctx.restore();

    // 4. Bounding Box Garis Biru Tebal
    ctx.save();
    ctx.strokeStyle = '#0D99FF';
    ctx.lineWidth = 2 / zoom;
    if (isCircle) {
      const cx = cropWorld.x + cropWorld.width / 2;
      const cy = cropWorld.y + cropWorld.height / 2;
      const r = Math.min(cropWorld.width, cropWorld.height) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(cropWorld.x, cropWorld.y, cropWorld.width, cropWorld.height);
    }

    // 5. Figma Thick Corner Bars (Siku-siku tebal khas crop Figma)
    const armLen = Math.min(18 / zoom, cropWorld.width * 0.25, cropWorld.height * 0.25);
    const cornerThick = 4 / zoom;
    ctx.fillStyle = '#0D99FF';

    const corners = [
      { x: cropWorld.x, y: cropWorld.y, dx: 1, dy: 1 },
      { x: cropWorld.x + cropWorld.width, y: cropWorld.y, dx: -1, dy: 1 },
      { x: cropWorld.x + cropWorld.width, y: cropWorld.y + cropWorld.height, dx: -1, dy: -1 },
      { x: cropWorld.x, y: cropWorld.y + cropWorld.height, dx: 1, dy: -1 }
    ];

    corners.forEach(c => {
      // Bar horizontal siku
      ctx.fillRect(c.dx > 0 ? c.x : c.x - armLen, c.dy > 0 ? c.y : c.y - cornerThick, armLen, cornerThick);
      // Bar vertikal siku
      ctx.fillRect(c.dx > 0 ? c.x : c.x - cornerThick, c.dy > 0 ? c.y : c.y - armLen, cornerThick, armLen);
    });

    // Handle sisi tengah (pill handle)
    const midBarLen = 14 / zoom;
    const midThick = 3 / zoom;
    // North
    ctx.fillRect(cropWorld.x + cropWorld.width / 2 - midBarLen / 2, cropWorld.y - midThick / 2, midBarLen, midThick);
    // South
    ctx.fillRect(cropWorld.x + cropWorld.width / 2 - midBarLen / 2, cropWorld.y + cropWorld.height - midThick / 2, midBarLen, midThick);
    // West
    ctx.fillRect(cropWorld.x - midThick / 2, cropWorld.y + cropWorld.height / 2 - midBarLen / 2, midThick, midBarLen);
    // East
    ctx.fillRect(cropWorld.x + cropWorld.width - midThick / 2, cropWorld.y + cropWorld.height / 2 - midBarLen / 2, midThick, midBarLen);

    // 6. Pill Dimensi di Bawah Crop Box
    const dimText = `${Math.round(cropWorld.width)} × ${Math.round(cropWorld.height)}`;
    ctx.font = `600 ${Math.max(11, 12 / zoom)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const textW = ctx.measureText(dimText).width;
    const textH = 14 / zoom;
    const padX = 8 / zoom;
    const padY = 4 / zoom;
    const pillW = textW + padX * 2;
    const pillH = textH + padY * 2;
    const pillX = cropWorld.x + cropWorld.width / 2 - pillW / 2;
    const pillY = cropWorld.y + cropWorld.height + 10 / zoom;

    ctx.fillStyle = '#0D99FF';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(pillX, pillY, pillW, pillH, 4 / zoom) : ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dimText, pillX + pillW / 2, pillY + pillH / 2);

    ctx.restore();
    ctx.restore();
  };

  // -------------------------------------------------------------
  // INTERAKSI POINTER (DRAG RESIZE CROP & PAN GAMBAR)
  // -------------------------------------------------------------
  const handlePointerDown = (e, worldPt) => {
    if (!active) return false;

    const handle = getCropHandleAt(worldPt, State.zoom);
    if (handle) {
      dragMode = 'crop-resize';
      activeHandle = handle.type;
      dragStart = { ...worldPt };
      origCropWorld = { ...cropWorld };
      return true;
    }

    // Jika klik di dalam bingkai crop -> geser posisi gambar (Image Pan)
    const isInsideCrop = worldPt.x >= cropWorld.x && worldPt.x <= cropWorld.x + cropWorld.width &&
                         worldPt.y >= cropWorld.y && worldPt.y <= cropWorld.y + cropWorld.height;

    if (isInsideCrop) {
      dragMode = 'img-pan';
      dragStart = { ...worldPt };
      origImgWorld = { ...imgWorld };
      return true;
    }

    // Jika klik di luar crop box -> selesaikan crop
    apply();
    return true;
  };

  const handlePointerMove = (e, worldPt) => {
    if (!active || !dragMode) return false;

    const dx = worldPt.x - dragStart.x;
    const dy = worldPt.y - dragStart.y;

    if (dragMode === 'img-pan') {
      imgWorld.x = Math.round(origImgWorld.x + dx);
      imgWorld.y = Math.round(origImgWorld.y + dy);
      if (typeof requestRender === 'function') requestRender();
      return true;
    }

    if (dragMode === 'crop-resize') {
      let newBox = { ...origCropWorld };
      const ratio = lockedRatio;

      if (activeHandle === 'se') {
        newBox.width = Math.max(20, origCropWorld.width + dx);
        newBox.height = ratio ? newBox.width / ratio : Math.max(20, origCropWorld.height + dy);
      } else if (activeHandle === 'sw') {
        const potentialW = origCropWorld.width - dx;
        if (potentialW >= 20) {
          newBox.width = potentialW;
          newBox.x = origCropWorld.x + dx;
        }
        newBox.height = ratio ? newBox.width / ratio : Math.max(20, origCropWorld.height + dy);
      } else if (activeHandle === 'ne') {
        newBox.width = Math.max(20, origCropWorld.width + dx);
        const potentialH = origCropWorld.height - dy;
        if (potentialH >= 20) {
          newBox.height = ratio ? newBox.width / ratio : potentialH;
          newBox.y = ratio ? origCropWorld.y - (newBox.height - origCropWorld.height) : origCropWorld.y + dy;
        }
      } else if (activeHandle === 'nw') {
        const potentialW = origCropWorld.width - dx;
        const potentialH = origCropWorld.height - dy;
        if (potentialW >= 20) {
          newBox.width = potentialW;
          newBox.x = origCropWorld.x + dx;
        }
        if (potentialH >= 20) {
          newBox.height = ratio ? newBox.width / ratio : potentialH;
          newBox.y = ratio ? origCropWorld.y - (newBox.height - origCropWorld.height) : origCropWorld.y + dy;
        }
      } else if (activeHandle === 'e') {
        newBox.width = Math.max(20, origCropWorld.width + dx);
        if (ratio) newBox.height = newBox.width / ratio;
      } else if (activeHandle === 'w') {
        const potentialW = origCropWorld.width - dx;
        if (potentialW >= 20) {
          newBox.width = potentialW;
          newBox.x = origCropWorld.x + dx;
          if (ratio) newBox.height = newBox.width / ratio;
        }
      } else if (activeHandle === 's') {
        newBox.height = Math.max(20, origCropWorld.height + dy);
        if (ratio) newBox.width = newBox.height * ratio;
      } else if (activeHandle === 'n') {
        const potentialH = origCropWorld.height - dy;
        if (potentialH >= 20) {
          newBox.height = potentialH;
          newBox.y = origCropWorld.y + dy;
          if (ratio) newBox.width = newBox.height * ratio;
        }
      }

      cropWorld = {
        x: Math.round(newBox.x),
        y: Math.round(newBox.y),
        width: Math.round(newBox.width),
        height: Math.round(newBox.height)
      };

      if (typeof requestRender === 'function') requestRender();
      return true;
    }

    return false;
  };

  const handlePointerUp = () => {
    if (!active) return false;
    dragMode = null;
    activeHandle = null;
    dragStart = null;
    return false;
  };

  return {
    enter,
    cancel,
    apply,
    isActive: () => active,
    getTarget: () => targetObj,
    drawOverlay,
    getCropHandleAt,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
})();

/* ================= CROP UI CONTROLLER ================= */
window.CropUI = (() => {
  const $tb = $('#crop-toolbar');
  const $ratioBtn = $('#crop-btn-ratio');
  const $ratioMenu = $('#crop-ratio-menu');
  const $slider = $('#crop-scale-slider');
  const $btnFit = $('#crop-btn-fit');
  const $btnCancel = $('#crop-btn-cancel');
  const $btnApply = $('#crop-btn-apply');

  let activeImageObj = null;
  let currentRatio = 'custom';
  let currentScale = 1.0;

  // Tampilkan toolbar crop dan aktifkan CropTool
  const show = (imageObj) => {
    activeImageObj = imageObj || null;
    $slider.val(100);
    currentScale = 1.0;
    currentRatio = 'custom';
    updateRatioSelection('custom');
    $tb.stop(true, true).fadeIn(150);

    if (window.CropTool && !window.CropTool.isActive()) {
      window.CropTool.enter(imageObj);
    }
  };

  // Sembunyikan toolbar crop
  const hide = () => {
    $ratioMenu.hide();
    $ratioBtn.removeClass('open');
    $tb.stop(true, true).fadeOut(120);
    activeImageObj = null;
  };

  // Update tanda centang / active di menu rasio
  const updateRatioSelection = (ratioVal) => {
    currentRatio = ratioVal;
    $ratioMenu.find('.crop-menu-item').removeClass('active');
    const $target = $ratioMenu.find(`[data-ratio="${ratioVal}"]`);
    if ($target.length) {
      $target.addClass('active');
    }
  };

  // Event: Toggle popover rasio
  $ratioBtn.on('click', function(e) {
    e.stopPropagation();
    const isOpen = $ratioMenu.is(':visible');
    if (isOpen) {
      $ratioMenu.hide();
      $ratioBtn.removeClass('open');
    } else {
      $ratioMenu.show();
      $ratioBtn.addClass('open');
    }
  });

  // Event: Pilih rasio dari dropdown menu
  $ratioMenu.on('click', '.crop-menu-item[data-ratio]', function(e) {
    e.stopPropagation();
    const ratio = $(this).data('ratio');
    updateRatioSelection(ratio);
    $ratioMenu.hide();
    $ratioBtn.removeClass('open');
    $(document).trigger('crop:ratioChange', [ratio]);
  });

  // Event: Slider Scale / Zoom
  $slider.on('input change', function() {
    const scale = parseInt(this.value, 10) / 100;
    currentScale = scale;
    $(document).trigger('crop:scaleChange', [scale]);
  });

  // Event: Tombol Resize to Fit
  $btnFit.on('click', function(e) {
    e.stopPropagation();
    $slider.val(100);
    currentScale = 1.0;
    $(document).trigger('crop:fit');
  });

  // Event: Tombol Cancel
  $btnCancel.on('click', function(e) {
    e.stopPropagation();
    hide();
    if (window.CropTool && window.CropTool.isActive()) {
      window.CropTool.cancel();
    }
  });

  // Event: Tombol Apply (Centang Biru)
  $btnApply.on('click', function(e) {
    e.stopPropagation();
    hide();
    if (window.CropTool && window.CropTool.isActive()) {
      window.CropTool.apply();
    }
  });

  // Tutup dropdown menu jika klik di luar
  $(document).on('pointerdown click', function(e) {
    if (!$(e.target).closest('#crop-ratio-menu, #crop-btn-ratio').length) {
      $ratioMenu.hide();
      $ratioBtn.removeClass('open');
    }
  });

  return {
    show,
    hide,
    isOpen: () => $tb.is(':visible'),
    getScale: () => currentScale,
    getRatio: () => currentRatio
  };
})();
