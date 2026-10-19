/* ================= CONTEXT MENU CONTROLLER ================= */
// Mengelola klik kanan (Context Menu) pada Layer List dan Canvas.
// Termasuk Rename (Ctrl+R), Copy (Ctrl+C), Paste (Ctrl+V), Duplicate (Ctrl+D), Delete (Del).

window.ContextMenu = (() => {
  const $menu = $('#context-menu');
  let currentTargetId = null;
  let currentSource = 'canvas'; // 'layer' atau 'canvas'

  const show = (clientX, clientY, targetId, source = 'canvas') => {
    currentTargetId = targetId || null;
    currentSource = source;

    // Batasi posisi agar tidak keluar dari tepi layar
    const menuW = 190;
    const menuH = 170;
    let posX = clientX;
    let posY = clientY;

    if (posX + menuW > window.innerWidth) posX = window.innerWidth - menuW - 10;
    if (posY + menuH > window.innerHeight) posY = window.innerHeight - menuH - 10;

    const hasTarget = !!currentTargetId;
    const hasMultiple = (State.selectedIds && State.selectedIds.length >= 2);
    let isImageTarget = false;
    if (currentTargetId) {
      const found = (typeof findObjectWithParent === 'function') ? findObjectWithParent(currentTargetId) : null;
      const targetObj = found ? found.obj : (State.objects && State.objects.find(o => o.id === currentTargetId));
      isImageTarget = !!(targetObj && targetObj.type === 'image');
    }

    $menu.find('[data-action="rename"]').toggleClass('disabled', !hasTarget);
    $menu.find('[data-action="crop"]').toggle(isImageTarget);
    $menu.find('[data-action="copy"]').toggleClass('disabled', !hasTarget);
    $menu.find('[data-action="duplicate"]').toggleClass('disabled', !hasTarget);
    $menu.find('[data-action="delete"]').toggleClass('disabled', !hasTarget);

    // Boolean items
    $menu.find('.ctx-boolean-item').toggle(hasMultiple);

    const hasClipboard = window.Clipboard && window.Clipboard.hasBuffer();
    $menu.find('[data-action="paste"]').toggleClass('disabled', !hasClipboard);

    $menu.css({
      left: `${posX}px`,
      top: `${posY}px`
    }).stop(true, true).fadeIn(100);
  };

  const hide = () => {
    $menu.stop(true, true).fadeOut(80);
    currentTargetId = null;
  };

  // Trigger Rename
  const triggerRename = () => {
    const targetId = currentTargetId || (State.selectedIds && State.selectedIds[0]);
    if (!targetId) return;

    if (currentSource === 'layer') {
      if (typeof window.startLayerRename === 'function') {
        window.startLayerRename(targetId);
      }
    } else {
      // Jika sumbernya dari canvas, cek apakah ini frame
      const obj = State.objects.find(o => o.id === targetId);
      if (obj && obj.type === 'frame' && typeof window.startCanvasFrameRename === 'function') {
        window.startCanvasFrameRename(targetId);
      } else if (typeof window.startLayerRename === 'function') {
        // Fallback ke rename di layer list
        window.startLayerRename(targetId);
      }
    }
  };

  // Trigger Crop Image
  const triggerCrop = () => {
    const targetId = currentTargetId || (State.selectedIds && State.selectedIds[0]);
    if (!targetId) return;
    const found = (typeof findObjectWithParent === 'function') ? findObjectWithParent(targetId) : null;
    const targetObj = found ? found.obj : (State.objects && State.objects.find(o => o.id === targetId));
    if (targetObj && targetObj.type === 'image' && window.CropUI) {
      window.CropUI.show(targetObj);
    }
  };

  // Event klik pada item menu
  $menu.on('click', '.ctx-item', function(e) {
    e.stopPropagation();
    const action = $(this).data('action');
    hide();

    switch (action) {
      case 'rename':
        triggerRename();
        break;
      case 'crop':
        triggerCrop();
        break;
      case 'copy':
        if (window.Clipboard) window.Clipboard.copy();
        break;
      case 'paste':
        if (window.Clipboard) window.Clipboard.paste();
        break;
      case 'duplicate':
        if (window.Clipboard) window.Clipboard.duplicate();
        break;
      case 'delete':
        if (typeof window.deleteSelected === 'function') window.deleteSelected();
        break;
      case 'boolean-union':
        if (window.BooleanOps) window.BooleanOps.union();
        break;
      case 'boolean-subtract':
        if (window.BooleanOps) window.BooleanOps.subtract();
        break;
      case 'boolean-intersect':
        if (window.BooleanOps) window.BooleanOps.intersect();
        break;
      case 'boolean-exclude':
        if (window.BooleanOps) window.BooleanOps.exclude();
        break;
    }
  });

  // Sembunyikan context menu saat klik sembarang tempat di luar
  $(document).on('pointerdown click', function(e) {
    if (!$(e.target).closest('#context-menu').length) {
      hide();
    }
  });

  // Shortcut Ctrl + R untuk Rename objek terseleksi
  $(document).on('keydown', function(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === 'KeyR') {
      e.preventDefault();
      const selId = State.selectedIds && State.selectedIds[0];
      if (selId) {
        currentSource = 'layer';
        currentTargetId = selId;
        triggerRename();
      }
    }
  });

  return {
    show,
    hide,
    triggerRename,
    isOpen: () => $menu.is(':visible')
  };
})();
