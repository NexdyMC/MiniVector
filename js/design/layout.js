/* ================= AUTO-FLOW & AUTO-LAYOUT ENGINE (js/design/layout.js) ================= */
// Mengatur penataan elemen anak di dalam Frame ala model alur dokumen HTML / CSS Flexbox & CSS Grid.
// Mendukung:
// 1. display: 'none' (Canvas Bebas), 'flex' (Alur 1 Dimensi), 'grid' (Tabel / Matriks 2 Dimensi)
// 2. Mode Flex: direction ('column'/'row'), gap, padding, alignItems, justifyContent, hugContent
// 3. Mode Grid: columns (1 s/d 12), colGap, rowGap, padding, showGridGuides (garis putus-putus)
// 4. Shortcut Shift + A untuk membungkus seleksi ke dalam Auto Layout Frame baru.

(function () {
  'use strict';

  const LayoutEngine = {
    /**
     * Menghitung posisi koordinat lokal (x, y) untuk elemen baru yang akan dimasukkan ke Frame
     * agar langsung menempel di sudut kiri-atas (atau slot aliran berikutnya).
     */
    getNextSlotPosition(frame, newObjW = 0, newObjH = 0) {
      if (!frame || !frame.transform) return { x: 0, y: 0 };

      const l = frame.layout || {
        display: 'flex',
        direction: 'column',
        gap: 8,
        padding: [16, 16, 16, 16],
        alignItems: 'flex-start',
        justifyContent: 'flex-start'
      };

      const padding = Array.isArray(l.padding) ? l.padding : [16, 16, 16, 16];
      const [padTop, padRight, padBottom, padLeft] = padding;

      const flowChildren = (frame.children || []).filter(c => {
        return c && c.visible !== false && (!c.code || !c.code.position || !c.code.position.isAbsolute);
      });

      // --- A. JIKA MODE GRID ---
      if (l.display === 'grid') {
        const columns = Math.max(1, parseInt(l.columns, 10) || 3);
        const colGap = typeof l.colGap === 'number' ? l.colGap : (typeof l.gap === 'number' ? l.gap : 12);
        const rowGap = typeof l.rowGap === 'number' ? l.rowGap : (typeof l.gap === 'number' ? l.gap : 12);

        const availableW = Math.max(20, frame.transform.width - padLeft - padRight);
        const colWidth = (availableW - (columns - 1) * colGap) / columns;
        const rowHeight = newObjH > 0 ? newObjH : 80;

        const nextIndex = flowChildren.length;
        const colIdx = nextIndex % columns;
        const rowIdx = Math.floor(nextIndex / columns);

        const nextX = padLeft + colIdx * (colWidth + colGap);
        const nextY = padTop + rowIdx * (rowHeight + rowGap);

        return { x: Math.round(nextX), y: Math.round(nextY) };
      }

      // --- B. JIKA MODE FLEX ---
      const gap = typeof l.gap === 'number' ? l.gap : 8;
      const dir = l.direction || 'column';

      if (flowChildren.length === 0) {
        return { x: padLeft, y: padTop };
      }

      if (dir === 'column') {
        const last = flowChildren[flowChildren.length - 1];
        const nextY = last.transform.y + last.transform.height + gap;
        let nextX = padLeft;

        if (l.alignItems === 'center') {
          const availW = frame.transform.width - padLeft - padRight;
          nextX = padLeft + Math.max(0, (availW - newObjW) / 2);
        } else if (l.alignItems === 'flex-end') {
          nextX = frame.transform.width - padRight - newObjW;
        }

        return { x: Math.round(nextX), y: Math.round(nextY) };
      } else {
        const last = flowChildren[flowChildren.length - 1];
        const nextX = last.transform.x + last.transform.width + gap;
        let nextY = padTop;

        if (l.alignItems === 'center') {
          const availH = frame.transform.height - padTop - padBottom;
          nextY = padTop + Math.max(0, (availH - newObjH) / 2);
        } else if (l.alignItems === 'flex-end') {
          nextY = frame.transform.height - padBottom - newObjH;
        }

        return { x: Math.round(nextX), y: Math.round(nextY) };
      }
    },

    /**
     * Menerapkan perhitungan alur flexbox atau grid pada semua elemen anak di dalam Frame.
     */
    applyAutoLayout(frame) {
      if (!frame || frame.type !== 'frame' || !Array.isArray(frame.children)) return;

      const l = frame.layout;
      if (!l || l.display === 'none') return; // None = canvas bebas

      const padding = Array.isArray(l.padding) ? l.padding : [16, 16, 16, 16];
      const [padTop, padRight, padBottom, padLeft] = padding;

      const flowChildren = frame.children.filter(c => {
        return c && c.transform && c.visible !== false && (!c.code || !c.code.position || !c.code.position.isAbsolute);
      });

      if (flowChildren.length === 0) return;

      // ==========================================
      // 1. KALKULASI DISPLAY GRID (2 DIMENSI) DENGAN COL/ROW SPAN
      // ==========================================
      if (l.display === 'grid') {
        const columns = Math.max(1, parseInt(l.columns, 10) || 3);
        const colGap = typeof l.colGap === 'number' ? l.colGap : (typeof l.gap === 'number' ? l.gap : 12);
        const rowGap = typeof l.rowGap === 'number' ? l.rowGap : (typeof l.gap === 'number' ? l.gap : 12);

        const availableW = Math.max(20, frame.transform.width - padLeft - padRight);
        const colWidth = Math.max(10, Math.floor((availableW - (columns - 1) * colGap) / columns));

        // Tentukan basis tinggi satu baris unit
        let baseRowH = 60;
        flowChildren.forEach(c => {
          const rSpan = (c.layout && c.layout.rowSpan) ? Math.max(1, parseInt(c.layout.rowSpan, 10)) : 1;
          const unitH = Math.round((c.transform.height - (rSpan - 1) * rowGap) / rSpan);
          if (unitH > baseRowH) baseRowH = unitH;
        });

        // 2D Occupancy Grid Matriks untuk penempatan otomatis (auto-placement algorithm)
        const occupied = {}; // key: `${r},${c}`
        let maxOccupiedRow = 0;

        flowChildren.forEach(child => {
          const childLayout = child.layout || {};
          const cSpan = Math.max(1, Math.min(columns, parseInt(childLayout.colSpan, 10) || 1));
          const rSpan = Math.max(1, Math.min(12, parseInt(childLayout.rowSpan, 10) || 1));

          // Cari sel kosong pertama (r, c) yang muat untuk ukuran cSpan x rSpan
          let r = 0;
          let c = 0;
          let found = false;

          while (!found) {
            if (c + cSpan > columns) {
              r++;
              c = 0;
              continue;
            }

            // Periksa apakah area sel (r .. r+rSpan-1, c .. c+cSpan-1) semuanya kosong
            let fits = true;
            for (let dr = 0; dr < rSpan; dr++) {
              for (let dc = 0; dc < cSpan; dc++) {
                if (occupied[`${r + dr},${c + dc}`]) {
                  fits = false;
                  break;
                }
              }
              if (!fits) break;
            }

            if (fits) {
              found = true;
            } else {
              c++;
              if (c >= columns) {
                r++;
                c = 0;
              }
            }
          }

          // Tandai sel sebagai occupied
          for (let dr = 0; dr < rSpan; dr++) {
            for (let dc = 0; dc < cSpan; dc++) {
              occupied[`${r + dr},${c + dc}`] = true;
            }
          }

          if (r + rSpan > maxOccupiedRow) {
            maxOccupiedRow = r + rSpan;
          }

          // Hitung posisi absolut dan dimensi anak berdasarkan span
          const cellX = padLeft + c * (colWidth + colGap);
          const cellY = padTop + r * (baseRowH + rowGap);
          const itemW = cSpan * colWidth + (cSpan - 1) * colGap;
          const itemH = rSpan * baseRowH + (rSpan - 1) * rowGap;

          child.transform.x = Math.round(cellX);
          child.transform.y = Math.round(cellY);

          if (child.type === 'rectangle' || child.type === 'frame' || child.type === 'image') {
            child.transform.width = Math.round(itemW);
            child.transform.height = Math.round(itemH);
          }
        });

        // Simpan metadata baris terakhir untuk grid guides di canvas
        frame.layout._totalGridRows = Math.max(2, maxOccupiedRow);

        if (l.hugContent) {
          const totalH = padTop + maxOccupiedRow * baseRowH + Math.max(0, maxOccupiedRow - 1) * rowGap + padBottom;
          frame.transform.height = Math.max(40, Math.round(totalH));
        }
        return;
      }

      // ==========================================
      // 2. KALKULASI DISPLAY FLEX (1 DIMENSI)
      // ==========================================
      const gap = typeof l.gap === 'number' ? l.gap : 8;
      const dir = l.direction || 'column';
      const alignItems = l.alignItems || 'flex-start';
      const justifyContent = l.justifyContent || 'flex-start';

      let totalChildrenSize = 0;
      flowChildren.forEach(c => {
        totalChildrenSize += (dir === 'column' ? c.transform.height : c.transform.width);
      });
      const totalGap = Math.max(0, flowChildren.length - 1) * gap;

      let startOffset = (dir === 'column') ? padTop : padLeft;
      let effectiveGap = gap;

      if (!l.hugContent) {
        const availableMainSize = (dir === 'column')
          ? frame.transform.height - padTop - padBottom
          : frame.transform.width - padLeft - padRight;

        if (justifyContent === 'center') {
          const extra = Math.max(0, (availableMainSize - (totalChildrenSize + totalGap)) / 2);
          startOffset += extra;
        } else if (justifyContent === 'flex-end') {
          const extra = Math.max(0, availableMainSize - (totalChildrenSize + totalGap));
          startOffset += extra;
        } else if (justifyContent === 'space-between' && flowChildren.length > 1) {
          effectiveGap = Math.max(0, (availableMainSize - totalChildrenSize) / (flowChildren.length - 1));
        }
      }

      let currentOffset = startOffset;

      flowChildren.forEach(child => {
        const t = child.transform;

        if (dir === 'column') {
          t.y = Math.round(currentOffset);

          if (alignItems === 'center') {
            const availW = frame.transform.width - padLeft - padRight;
            t.x = Math.round(padLeft + Math.max(0, (availW - t.width) / 2));
          } else if (alignItems === 'flex-end') {
            t.x = Math.round(frame.transform.width - padRight - t.width);
          } else if (alignItems === 'stretch') {
            t.x = Math.round(padLeft);
            t.width = Math.max(1, Math.round(frame.transform.width - padLeft - padRight));
          } else {
            t.x = Math.round(padLeft);
          }

          currentOffset += t.height + effectiveGap;
        } else {
          t.x = Math.round(currentOffset);

          if (alignItems === 'center') {
            const availH = frame.transform.height - padTop - padBottom;
            t.y = Math.round(padTop + Math.max(0, (availH - t.height) / 2));
          } else if (alignItems === 'flex-end') {
            t.y = Math.round(frame.transform.height - padBottom - t.height);
          } else if (alignItems === 'stretch') {
            t.y = Math.round(padTop);
            t.height = Math.max(1, Math.round(frame.transform.height - padTop - padBottom));
          } else {
            t.y = Math.round(padTop);
          }

          currentOffset += t.width + effectiveGap;
        }
      });

      if (l.hugContent) {
        if (dir === 'column') {
          const totalH = (currentOffset - effectiveGap) + padBottom;
          frame.transform.height = Math.max(30, Math.round(totalH));
        } else {
          const totalW = (currentOffset - effectiveGap) + padRight;
          frame.transform.width = Math.max(30, Math.round(totalW));
        }
      }
    },

    /**
     * Memperbarui ukuran dan posisi elemen anak saat Frame di-resize,
     * berdasarkan aturan constraint / inset position (e.g. inset-0, pin right/bottom, fill)
     * serta auto-layout flow.
     */
    applyFrameResizeConstraints(frame, oldW, oldH, newW, newH) {
      if (!frame || frame.type !== 'frame' || !Array.isArray(frame.children)) return;
      if (!oldW || !oldH || oldW <= 0 || oldH <= 0) return;
      if (oldW === newW && oldH === newH) return;

      frame.children.forEach(child => {
        if (!child || !child.transform) return;

        const pos = (child.code && child.code.position) ? child.code.position : null;
        const hasPos = !!(pos && (pos.isActive || pos.isAbsolute));

        const hasTop = hasPos && (pos.top !== '' && pos.top !== null && pos.top !== undefined);
        const hasRight = hasPos && (pos.right !== '' && pos.right !== null && pos.right !== undefined);
        const hasBottom = hasPos && (pos.bottom !== '' && pos.bottom !== null && pos.bottom !== undefined);
        const hasLeft = hasPos && (pos.left !== '' && pos.left !== null && pos.left !== undefined);

        let targetW = child.transform.width;
        let targetH = child.transform.height;
        let targetX = child.transform.x;
        let targetY = child.transform.y;
        let changed = false;

        // 1. Horizontal Constraints / Insets
        if (hasLeft && hasRight) {
          // Stretch horizontally (e.g. inset-x-0 atau pin Left & Right)
          const padL = parseFloat(pos.left) || 0;
          const padR = parseFloat(pos.right) || 0;
          targetX = padL;
          targetW = Math.max(1, Math.round(newW - padL - padR));
          changed = true;
        } else if (hasRight && !hasLeft) {
          // Pin Right (jarak ke sisi kanan tetap)
          const padR = parseFloat(pos.right) || 0;
          targetX = Math.round(newW - (targetW + padR));
          changed = true;
        }

        // 2. Vertical Constraints / Insets
        if (hasTop && hasBottom) {
          // Stretch vertically (e.g. inset-y-0 atau pin Top & Bottom)
          const padT = parseFloat(pos.top) || 0;
          const padB = parseFloat(pos.bottom) || 0;
          targetY = padT;
          targetH = Math.max(1, Math.round(newH - padT - padB));
          changed = true;
        } else if (hasBottom && !hasTop) {
          // Pin Bottom (jarak ke sisi bawah tetap)
          const padB = parseFloat(pos.bottom) || 0;
          targetY = Math.round(newH - (targetH + padB));
          changed = true;
        }

        // Jika child memiliki sizing unit '%' (w-full / h-full)
        if (child.code && child.code.sizing) {
          if (child.code.sizing.width && child.code.sizing.width.unit === '%') {
            targetW = Math.max(1, Math.round(newW));
            changed = true;
          }
          if (child.code.sizing.height && child.code.sizing.height.unit === '%') {
            targetH = Math.max(1, Math.round(newH));
            changed = true;
          }
        }

        if (changed) {
          child.transform.x = targetX;
          child.transform.y = targetY;
          if (typeof Geo !== 'undefined' && typeof Geo.setSize === 'function') {
            Geo.setSize(child, targetW, targetH);
          } else {
            child.transform.width = targetW;
            child.transform.height = targetH;
            if (child.type === 'rectangle' && child.geometry && !child.geometry.isCustomPath) {
              child.geometry.nodes = [
                { id: 'p0', x: 0, y: 0 },
                { id: 'p1', x: targetW, y: 0 },
                { id: 'p2', x: targetW, y: targetH },
                { id: 'p3', x: 0, y: targetH }
              ];
            }
          }
        }
      });

      // Jika Frame menggunakan Auto Layout flex/grid, tata ulang flow children
      if (frame.layout && frame.layout.display && frame.layout.display !== 'none') {
        this.applyAutoLayout(frame);
      }
    },

    /**
     * Membungkus seleksi saat ini ke dalam Auto Layout Frame baru (Shortcut Shift + A)
     */
    wrapSelectionInAutoLayout() {
      if (!State.selectedIds || State.selectedIds.length === 0) return;

      // Kasus 1: Tepat satu objek terpilih dan itu adalah Frame
      if (State.selectedIds.length === 1) {
        const selOne = (typeof Geo !== 'undefined' && typeof Geo.find === 'function') ? Geo.find(State.selectedIds[0]) : null;
        if (selOne && selOne.obj.type === 'frame') {
          const targetObj = selOne.obj;
          targetObj.layout = targetObj.layout || {
            display: 'none',
            direction: 'column',
            gap: 8,
            padding: [16, 16, 16, 16],
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            hugContent: true
          };
          targetObj.layout.display = targetObj.layout.display === 'flex' ? 'none' : 'flex';
          this.applyAutoLayout(targetObj);
          $(document).trigger('object:change');
          if (typeof syncAutoLayoutUI === 'function') syncAutoLayoutUI();
          requestRender();
          return;
        }
      }

      // Kasus 2: Membungkus elemen-elemen terpilih ke dalam Auto Layout Frame baru
      if (typeof Geo === 'undefined' || typeof Geo.selection !== 'function') return;
      const sel = Geo.selection();
      if (!sel || sel.length === 0) return;

      const union = Geo.union(sel);
      if (!union) return;

      const firstEntry = sel[0];
      const targetParent = firstEntry.parent;
      const parentOrigin = firstEntry.origin || { x: 0, y: 0 };
      const selIds = new Set(sel.map(f => f.obj.id));

      const paddingVal = 16;
      const frameLocalX = Math.round(union.x - parentOrigin.x);
      const frameLocalY = Math.round(union.y - parentOrigin.y);

      let detectedDir = 'column';
      if (sel.length >= 2) {
        const dx = Math.abs(sel[1].obj.transform.x - sel[0].obj.transform.x);
        const dy = Math.abs(sel[1].obj.transform.y - sel[0].obj.transform.y);
        if (dx > dy) detectedDir = 'row';
      }

      const frameId = 'frame-' + newObjectId();
      const newFrame = {
        id: frameId,
        type: 'frame',
        name: 'Auto Layout Frame',
        visible: true,
        locked: false,
        open: true,
        clipContent: false,
        transform: {
          x: frameLocalX,
          y: frameLocalY,
          width: Math.round(union.width + (paddingVal * 2)),
          height: Math.round(union.height + (paddingVal * 2)),
          rotation: 0,
          pivot: { x: 0.5, y: 0.5 }
        },
        geometry: { cornerRadius: [8, 8, 8, 8] },
        style: { fill: 'none', stroke: '#0D99FF', strokeWidth: 1 },
        layout: {
          display: 'flex',
          direction: detectedDir,
          gap: 8,
          padding: [paddingVal, paddingVal, paddingVal, paddingVal],
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          hugContent: true
        },
        children: []
      };

      const containerList = (targetParent && Array.isArray(targetParent.children))
        ? targetParent.children
        : State.objects;

      const childrenToWrap = [];
      const remainingInContainer = [];

      containerList.forEach(item => {
        if (selIds.has(item.id)) {
          childrenToWrap.push(item);
        } else {
          remainingInContainer.push(item);
        }
      });

      if (detectedDir === 'row') {
        childrenToWrap.sort((a, b) => a.transform.x - b.transform.x);
      } else {
        childrenToWrap.sort((a, b) => a.transform.y - b.transform.y);
      }

      newFrame.children = childrenToWrap;
      remainingInContainer.push(newFrame);

      if (targetParent && Array.isArray(targetParent.children)) {
        targetParent.children = remainingInContainer;
      } else {
        State.objects = remainingInContainer;
      }

      this.applyAutoLayout(newFrame);

      if (targetParent && targetParent.type === 'frame' && targetParent.layout && targetParent.layout.display !== 'none') {
        this.applyAutoLayout(targetParent);
      }

      State.selectedIds = [newFrame.id];

      $(document).trigger('object:add', [newFrame]);
      $(document).trigger('selection:change');
      if (window.History && typeof window.History.record === 'function') {
        window.History.record();
      }
      requestRender();
    }
  };

  // Helper mencari objek terpilih beserta parentnya
  const findObjectAndParent = (id, list = State.objects, parent = null) => {
    for (const item of list) {
      if (item && item.id === id) {
        return { obj: item, parent };
      }
      if (item && Array.isArray(item.children)) {
        const found = findObjectAndParent(id, item.children, item);
        if (found) return found;
      }
    }
    return null;
  };

  // ================= UI CONTROLLER UNTUK PANEL AUTO LAYOUT & GRID ITEM =================
  const syncAutoLayoutUI = () => {
    const $sec = $('#sec-auto-layout');
    const $gridItemSec = $('#sec-grid-item-placement');

    if (!State.selectedIds || State.selectedIds.length !== 1) {
      if ($sec.length) $sec.hide();
      if ($gridItemSec.length) $gridItemSec.hide();
      return;
    }

    const id = State.selectedIds[0];
    const itemData = findObjectAndParent(id);
    const selectedObj = itemData ? itemData.obj : null;
    const parentFrame = itemData ? itemData.parent : null;

    // 1. Grid Item Placement Section (Ditampilkan jika objek terpilih adalah anak dari Grid Frame)
    if ($gridItemSec.length) {
      if (parentFrame && parentFrame.type === 'frame' && parentFrame.layout && parentFrame.layout.display === 'grid') {
        $gridItemSec.show();
        const objLayout = (selectedObj && selectedObj.layout) ? selectedObj.layout : {};
        const cSpan = objLayout.colSpan !== undefined ? objLayout.colSpan : 1;
        const rSpan = objLayout.rowSpan !== undefined ? objLayout.rowSpan : 1;
        $('#grid-item-colspan').val(cSpan);
        $('#grid-item-rowspan').val(rSpan);
      } else {
        $gridItemSec.hide();
      }
    }

    // 2. Auto Layout Frame Section (Ditampilkan jika objek terpilih adalah Frame)
    if (!$sec.length) return;

    let frame = null;
    if (selectedObj && selectedObj.type === 'frame') {
      frame = selectedObj;
    }

    if (!frame) {
      $sec.hide();
      return;
    }

    $sec.show();
    const l = frame.layout = frame.layout || {
      display: 'none',
      direction: 'column',
      gap: 8,
      padding: [16, 16, 16, 16],
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      hugContent: false,
      columns: 3,
      rowGap: 12,
      colGap: 12,
      showGridGuides: true
    };

    const disp = l.display || 'none';

    // Update Segmented Buttons Display Mode
    $('[data-display-mode]').removeClass('on');
    $(`[data-display-mode="${disp}"]`).addClass('on');

    // Tampilkan panel sesuai mode aktif
    if (disp === 'none') {
      $('#layout-flex-controls').hide();
      $('#layout-grid-controls').hide();
      $('#layout-padding-container').hide();
      return;
    }

    $('#layout-padding-container').show();

    if (disp === 'flex') {
      $('#layout-flex-controls').show();
      $('#layout-grid-controls').hide();

      const dir = l.direction || 'column';
      $('[data-layout-act="dir-col"]').toggleClass('on', dir === 'column');
      $('[data-layout-act="dir-row"]').toggleClass('on', dir === 'row');
      $('#btn-layout-hug').toggleClass('on', !!l.hugContent);
      $('#layout-gap').val(l.gap !== undefined ? l.gap : 8);

      // Alignment 9-Dots mapping
      const aItems = l.alignItems || 'flex-start';
      const jContent = l.justifyContent || 'flex-start';

      let vertKey = 'top';
      if (dir === 'column') {
        if (jContent === 'center') vertKey = 'center';
        else if (jContent === 'flex-end') vertKey = 'bottom';
      } else {
        if (aItems === 'center') vertKey = 'center';
        else if (aItems === 'flex-end') vertKey = 'bottom';
      }

      let horizKey = 'left';
      if (dir === 'column') {
        if (aItems === 'center') horizKey = 'center';
        else if (aItems === 'flex-end') horizKey = 'right';
      } else {
        if (jContent === 'center') horizKey = 'center';
        else if (jContent === 'flex-end') horizKey = 'right';
      }

      let dotTag = `${vertKey}-${horizKey}`;
      if (vertKey === 'center' && horizKey === 'center') dotTag = 'center';

      $('.layout-align-dot').removeClass('on');
      $(`.layout-align-dot[data-align="${dotTag}"]`).addClass('on');
    } else if (disp === 'grid') {
      $('#layout-flex-controls').hide();
      $('#layout-grid-controls').show();

      $('#grid-columns').val(l.columns !== undefined ? l.columns : 3);
      $('#grid-col-gap').val(l.colGap !== undefined ? l.colGap : 12);
      $('#grid-row-gap').val(l.rowGap !== undefined ? l.rowGap : 12);
      $('#btn-toggle-grid-guides').toggleClass('on', l.showGridGuides !== false);
    }

    // Padding (Flex & Grid)
    const p = Array.isArray(l.padding) ? l.padding : [16, 16, 16, 16];
    $('#layout-pad-top').val(p[0]);
    $('#layout-pad-right').val(p[1]);
    $('#layout-pad-bottom').val(p[2]);
    $('#layout-pad-left').val(p[3]);

    $('#layout-pad-h').val(p[1]);
    $('#layout-pad-v').val(p[0]);
  };

  const getActiveFrame = () => {
    if (!State.selectedIds || State.selectedIds.length !== 1) return null;
    const id = State.selectedIds[0];
    for (const o of State.objects) {
      if (o.id === id && o.type === 'frame') return o;
    }
    return null;
  };

  const commitLayoutChange = (frame) => {
    LayoutEngine.applyAutoLayout(frame);
    $(document).trigger('object:change');
    syncAutoLayoutUI();
    requestRender();
  };

  // Event Listeners Auto Layout Panel:
  // --- Grid Item Placement Handlers (Col Span & Row Span) ---
  $(document).on('change input', '#grid-item-colspan, #grid-item-rowspan', function () {
    if (!State.selectedIds || State.selectedIds.length !== 1) return;
    const itemData = findObjectAndParent(State.selectedIds[0]);
    if (!itemData || !itemData.obj || !itemData.parent) return;

    const child = itemData.obj;
    const parentFrame = itemData.parent;
    if (parentFrame.type !== 'frame' || !parentFrame.layout || parentFrame.layout.display !== 'grid') return;

    child.layout = child.layout || {};
    const maxCols = Math.max(1, parseInt(parentFrame.layout.columns, 10) || 3);
    const cSpan = Math.max(1, Math.min(maxCols, parseInt($('#grid-item-colspan').val(), 10) || 1));
    const rSpan = Math.max(1, Math.min(12, parseInt($('#grid-item-rowspan').val(), 10) || 1));

    child.layout.colSpan = cSpan;
    child.layout.rowSpan = rSpan;

    LayoutEngine.applyAutoLayout(parentFrame);
    $(document).trigger('object:change');
    if (window.History && typeof window.History.record === 'function') {
      window.History.record();
    }
    requestRender();
  });

  // --- Switch Display Mode: None | Flex | Grid ---
  $(document).on('click', '[data-display-mode]', function () {
    const frame = getActiveFrame();
    if (!frame) return;
    const mode = $(this).data('display-mode');
    frame.layout = frame.layout || {
      display: 'none',
      direction: 'column',
      gap: 8,
      padding: [16, 16, 16, 16],
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      hugContent: true,
      columns: 3,
      colGap: 12,
      rowGap: 12,
      showGridGuides: true
    };
    frame.layout.display = mode;
    commitLayoutChange(frame);
  });

  // --- Grid Column & Gap Handlers ---
  $(document).on('change', '#grid-columns', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.columns = Math.max(1, Math.min(12, parseInt(this.value, 10) || 3));
    commitLayoutChange(frame);
  });

  $(document).on('change', '#grid-col-gap', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.colGap = Math.max(0, parseInt(this.value, 10) || 0);
    commitLayoutChange(frame);
  });

  $(document).on('change', '#grid-row-gap', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.rowGap = Math.max(0, parseInt(this.value, 10) || 0);
    commitLayoutChange(frame);
  });

  $(document).on('click', '#btn-toggle-grid-guides', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.showGridGuides = frame.layout.showGridGuides === false;
    $(this).toggleClass('on', frame.layout.showGridGuides);
    requestRender();
  });

  // --- Flex Handlers ---
  $(document).on('click', '[data-layout-act="dir-col"]', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.direction = 'column';
    commitLayoutChange(frame);
  });

  $(document).on('click', '[data-layout-act="dir-row"]', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.direction = 'row';
    commitLayoutChange(frame);
  });

  $(document).on('click', '#btn-layout-hug', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.hugContent = !frame.layout.hugContent;
    commitLayoutChange(frame);
  });

  $(document).on('change', '#layout-gap', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    frame.layout.gap = Math.max(0, parseInt(this.value, 10) || 0);
    commitLayoutChange(frame);
  });

  // Alignment 9-Dots click
  $(document).on('click', '.layout-align-dot', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    const align = $(this).data('align');
    const dir = frame.layout.direction || 'column';

    let aItems = 'flex-start';
    let jContent = 'flex-start';

    if (align === 'top-left') {
      aItems = 'flex-start'; jContent = 'flex-start';
    } else if (align === 'top-center') {
      if (dir === 'column') { aItems = 'center'; jContent = 'flex-start'; }
      else { aItems = 'flex-start'; jContent = 'center'; }
    } else if (align === 'top-right') {
      if (dir === 'column') { aItems = 'flex-end'; jContent = 'flex-start'; }
      else { aItems = 'flex-start'; jContent = 'flex-end'; }
    } else if (align === 'center-left') {
      if (dir === 'column') { aItems = 'flex-start'; jContent = 'center'; }
      else { aItems = 'center'; jContent = 'flex-start'; }
    } else if (align === 'center') {
      aItems = 'center'; jContent = 'center';
    } else if (align === 'center-right') {
      if (dir === 'column') { aItems = 'flex-end'; jContent = 'center'; }
      else { aItems = 'center'; jContent = 'flex-end'; }
    } else if (align === 'bottom-left') {
      if (dir === 'column') { aItems = 'flex-start'; jContent = 'flex-end'; }
      else { aItems = 'flex-end'; jContent = 'flex-start'; }
    } else if (align === 'bottom-center') {
      if (dir === 'column') { aItems = 'center'; jContent = 'flex-end'; }
      else { aItems = 'flex-end'; jContent = 'center'; }
    } else if (align === 'bottom-right') {
      aItems = 'flex-end'; jContent = 'flex-end';
    }

    frame.layout.alignItems = aItems;
    frame.layout.justifyContent = jContent;
    commitLayoutChange(frame);
  });

  // Toggle mode padding 4 sisi
  $(document).on('click', '#btn-toggle-padding-sides', function () {
    $('#padding-detailed-grid').toggle();
    $('#padding-simple-grid').toggle();
  });

  // Padding input handlers
  $(document).on('change', '#layout-pad-h', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    const v = Math.max(0, parseInt(this.value, 10) || 0);
    const p = frame.layout.padding || [16, 16, 16, 16];
    frame.layout.padding = [p[0], v, p[2], v];
    commitLayoutChange(frame);
  });

  $(document).on('change', '#layout-pad-v', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    const v = Math.max(0, parseInt(this.value, 10) || 0);
    const p = frame.layout.padding || [16, 16, 16, 16];
    frame.layout.padding = [v, p[1], v, p[3]];
    commitLayoutChange(frame);
  });

  $(document).on('change', '#layout-pad-top, #layout-pad-right, #layout-pad-bottom, #layout-pad-left', function () {
    const frame = getActiveFrame();
    if (!frame || !frame.layout) return;
    const t = Math.max(0, parseInt($('#layout-pad-top').val(), 10) || 0);
    const r = Math.max(0, parseInt($('#layout-pad-right').val(), 10) || 0);
    const b = Math.max(0, parseInt($('#layout-pad-bottom').val(), 10) || 0);
    const l = Math.max(0, parseInt($('#layout-pad-left').val(), 10) || 0);
    frame.layout.padding = [t, r, b, l];
    commitLayoutChange(frame);
  });

  $(document).on('selection:change object:change project:load', syncAutoLayoutUI);

  window.LayoutEngine = LayoutEngine;
  window.syncAutoLayoutUI = syncAutoLayoutUI;
})();
