/* ================= GROUP / UNGROUP MODULE ================= */
// Mengelompokkan (Group) dan membongkar kelompok (Ungroup) elemen seperti di Figma.
// Shortcut: Ctrl+B (Group) / Ctrl+Shift+B (Ungroup) dan Klik Kanan -> Group / Ungroup Selection.
// Bergantung pada: variabel.js (State, newObjectId), geometry.js (Geo), canvas.js (requestRender).

const Grouping = (() => {
  const r2 = n => Math.round(n * 100) / 100;

  // Mencari array induk penampung objek (root State.objects atau children dari frame/group)
  const findContainer = (id, list = State.objects, parent = null) => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return { list, index: i, parent };
      if (Array.isArray(list[i].children) && list[i].children.length > 0) {
        const r = findContainer(id, list[i].children, list[i]);
        if (r) return r;
      }
    }
    return null;
  };

  /* -------------------------------------------------------------
   * 1. GROUP SELECTION (Ctrl + B)
   * ------------------------------------------------------------- */
  const groupSelection = () => {
    const sel = Geo.selection();
    if (!sel || sel.length < 2) return false; // Butuh minimal 2 objek untuk membentuk grup

    // Hitung bounding box gabungan dalam koordinat dunia
    const unionBox = Geo.union(sel);
    if (!unionBox) return false;

    // Tentukan container penampung group baru (mengikuti induk objek pertama)
    const firstObj = sel[0];
    const targetParent = firstObj.parent;
    const parentOrigin = firstObj.origin; // Posisi (0,0) relatif frame jika bersarang

    // Posisi grup relatif terhadap frame induknya (atau koordinat dunia jika di root)
    const groupLocalX = r2(unionBox.x - parentOrigin.x);
    const groupLocalY = r2(unionBox.y - parentOrigin.y);

    // Kumpulkan ID objek yang terpilih
    const selIds = new Set(sel.map(f => f.obj.id));

    // Buat objek group baru
    const groupCount = (typeof State !== 'undefined' ? State.objects : []).filter(o => o.type === 'group').length + 1;
    const groupObj = {
      id: `group-${newObjectId()}`,
      type: 'group',
      name: `Group ${groupCount}`,
      visible: true,
      locked: false,
      open: true,
      transform: {
        x: groupLocalX,
        y: groupLocalY,
        width: r2(unionBox.width),
        height: r2(unionBox.height),
        rotation: 0,
        pivot: { x: 0.5, y: 0.5 }
      },
      children: []
    };

    // Ambil list tempat objek berada
    const containerList = targetParent && Array.isArray(targetParent.children)
      ? targetParent.children
      : State.objects;

    // Urutkan objek yang digrupkan sesuai z-index aslinya di container
    const childrenToGroup = [];
    const remainingInContainer = [];

    containerList.forEach(item => {
      if (selIds.has(item.id)) {
        // Sesuaikan koordinat elemen menjadi relatif terhadap titik sudut grup baru
        const itemAbsoluteWorldX = (targetParent ? parentOrigin.x : 0) + item.transform.x;
        const itemAbsoluteWorldY = (targetParent ? parentOrigin.y : 0) + item.transform.y;

        item.transform.x = r2(itemAbsoluteWorldX - unionBox.x);
        item.transform.y = r2(itemAbsoluteWorldY - unionBox.y);

        childrenToGroup.push(item);
      } else {
        remainingInContainer.push(item);
      }
    });

    groupObj.children = childrenToGroup;

    // Masukkan groupObj ke posisi elemen terakhir yang digrup
    remainingInContainer.push(groupObj);

    if (targetParent && Array.isArray(targetParent.children)) {
      targetParent.children = remainingInContainer;
    } else {
      State.objects = remainingInContainer;
    }

    // Set seleksi langsung ke grup baru
    State.selectedIds = [groupObj.id];

    // Trigger update riwayat (Undo/Redo), layers, dan canvas
    $(document).trigger('object:change');
    $(document).trigger('selection:change');
    if (typeof requestRender === 'function') requestRender();
    return true;
  };

  /* -------------------------------------------------------------
   * 2. UNGROUP SELECTION (Ctrl + Shift + B)
   * ------------------------------------------------------------- */
  const ungroupSelection = () => {
    const sel = Geo.selection();
    if (!sel || !sel.length) return false;

    let hasUngrouped = false;
    const newlySelectedIds = [];

    sel.forEach(f => {
      const obj = f.obj;
      if (obj.type !== 'group' || !Array.isArray(obj.children) || !obj.children.length) return;

      const containerInfo = findContainer(obj.id);
      if (!containerInfo) return;

      const { list, index, parent } = containerInfo;

      // Ambil seluruh anak dari grup dan kembalikan posisinya relatif terhadap induk container
      const releasedChildren = obj.children.map(child => {
        child.transform.x = r2(child.transform.x + obj.transform.x);
        child.transform.y = r2(child.transform.y + obj.transform.y);
        newlySelectedIds.push(child.id);
        return child;
      });

      // Ganti objek group di array list dengan anak-anaknya
      list.splice(index, 1, ...releasedChildren);
      hasUngrouped = true;
    });

    if (hasUngrouped) {
      State.selectedIds = newlySelectedIds;
      $(document).trigger('object:change');
      $(document).trigger('selection:change');
      if (typeof requestRender === 'function') requestRender();
      return true;
    }

    return false;
  };

  /* -------------------------------------------------------------
   * 3. RECALCULATE GROUP BOUNDS
   * Menghitung ulang bounding box group berdasarkan anak-anaknya
   * ------------------------------------------------------------- */
  const recalculateBounds = (groupObj) => {
    if (!groupObj || groupObj.type !== 'group' || !Array.isArray(groupObj.children) || !groupObj.children.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    groupObj.children.forEach(c => {
      if (!c.transform) return;
      const x = c.transform.x;
      const y = c.transform.y;
      const w = c.transform.width;
      const h = c.transform.height;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    });

    if (minX === Infinity) return;

    // Geser titik sudut grup dan sesuaikan posisi anak-anaknya agar tetap berada di tempat yang sama
    groupObj.transform.x = r2(groupObj.transform.x + minX);
    groupObj.transform.y = r2(groupObj.transform.y + minY);
    groupObj.transform.width = r2(maxX - minX);
    groupObj.transform.height = r2(maxY - minY);

    groupObj.children.forEach(c => {
      if (!c.transform) return;
      c.transform.x = r2(c.transform.x - minX);
      c.transform.y = r2(c.transform.y - minY);
    });
  };

  return {
    group: groupSelection,
    ungroup: ungroupSelection,
    recalculateBounds
  };
})();

window.Grouping = Grouping;
