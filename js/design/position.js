/* ================= DESIGN: POSITION (X / Y, alignment, Rotation, Flip) ================= */
// Panel kanan → Design → Position. Bergantung pada: variabel.js (State), geometry.js (Geo).
// X/Y = posisi pojok kiri-atas relatif terhadap frame induk (objek di root: koordinat dunia).
// Banyak objek terpilih: X/Y = kotak pembatas seluruh seleksi; mengubahnya menggeser semua objek.
$(function() {
  const r2 = n => Math.round(n * 100) / 100;
  const $x = $('#prop-x'),
    $y = $('#prop-y'),
    $rot = $('#prop-rotation'),
    $align = $('[data-act^="align-"]'),
    $rotate90 = $('[data-act="rotate90"]'),
    $flipX = $('[data-act="flip-x"]'),
    $flipY = $('[data-act="flip-y"]');
  $x.add($y).attr('step', 'any'); // desimal boleh; panah atas/bawah tetap menambah 1

  const model = () => {
    const sel = Geo.selection();
    if (!sel.length) return null;
    // induk sama → relatif terhadap induk itu; induk berbeda → koordinat dunia
    const same = sel.every(f => f.parent === sel[0].parent);
    return { sel, b: Geo.union(sel), origin: same ? sel[0].origin : { x: 0, y: 0 } };
  };
  const commit = () => {
    // Jika ada elemen terpilih yang memiliki parent group, perbarui bounds group tersebut
    const sel = Geo.selection();
    const groupsToRecalc = new Set();
    sel.forEach(f => {
      if (f.parent && f.parent.type === 'group') {
        groupsToRecalc.add(f.parent);
      }
    });
    if (groupsToRecalc.size > 0 && window.Grouping && typeof window.Grouping.recalculateBounds === 'function') {
      groupsToRecalc.forEach(grp => window.Grouping.recalculateBounds(grp));
    }
    $(document).trigger('object:change'); // simpan JSON + gambar ulang canvas + panel layer
    if (window.History && typeof window.History.record === 'function') {
      window.History.record();
    }
  };
  const show = ($el, v, force) => {
    if (force || document.activeElement !== $el[0]) $el.val(r2(v)); // jangan timpa angka yang sedang diketik
  };

  const refresh = force => {
    const m = model();
    $x.add($y).add($rot).prop('disabled', !m);
    $rotate90.add($flipX).add($flipY).prop('disabled', !m);

    if (m) {
      show($x, m.b.x - m.origin.x, force);
      show($y, m.b.y - m.origin.y, force);
      // Rotation: tampilkan rotasi objek jika single selection, atau 0 jika multi
      if (m.sel.length === 1) {
        show($rot, m.sel[0].obj.transform.rotation || 0, force);
        $flipX.attr('aria-pressed', !!m.sel[0].obj.transform.flipX);
        $flipY.attr('aria-pressed', !!m.sel[0].obj.transform.flipY);
      } else {
        show($rot, 0, force);
        $flipX.attr('aria-pressed', false);
        $flipY.attr('aria-pressed', false);
      }
    } else {
      $x.val('');
      $y.val('');
      $rot.val('0');
      $flipX.attr('aria-pressed', false);
      $flipY.attr('aria-pressed', false);
    }
    // align butuh acuan: induk frame (satu objek di dalam frame) atau kotak seleksi (lebih dari satu objek)
    $align.prop('disabled', !(m && (m.sel.length > 1 || m.sel[0].parent)));
  };
  Geo.watch(refresh);

  const move = (axis, raw) => {
    const m = model(),
      v = parseFloat(raw);
    if (!m || !isFinite(v)) return refresh(true); // kosong / tidak valid → kembalikan angka lama
    const d = v - (m.b[axis] - m.origin[axis]);
    if (!d) return refresh(true);
    m.sel.forEach(f => {
      f.obj.transform[axis] = r2(f.obj.transform[axis] + d);
    });
    commit();
  };
  $x.on('input change', function() {
    move('x', this.value);
  });
  $y.on('input change', function() {
    move('y', this.value);
  });
  $x.add($y).add($rot).on('keydown', function(e) {
    if (e.key === 'Escape') {
      refresh(true);
      this.blur();
    }
  });

  // ---- Rotation input ----
  $rot.on('change', function() {
    const m = model();
    if (!m) return refresh(true);
    let deg = parseFloat(this.value);
    if (!isFinite(deg)) return refresh(true);
    // Normalisasi -180° s.d. 180° atau 0° s.d. 360°
    deg = ((deg % 360) + 360) % 360;
    if (deg > 180) deg -= 360;
    m.sel.forEach(f => {
      f.obj.transform.rotation = Math.round(deg);
    });
    commit();
  });

  // ---- Rotate 90 deg button ----
  $('#view-design').on('click', '[data-act="rotate90"]', function() {
    const m = model();
    if (!m) return;
    m.sel.forEach(f => {
      let cur = f.obj.transform.rotation || 0;
      let next = (cur + 90) % 360;
      if (next > 180) next -= 360;
      f.obj.transform.rotation = Math.round(next);
    });
    commit();
    refresh(true);
  });

  // ---- Flip horizontal button ----
  $('#view-design').on('click', '[data-act="flip-x"]', function() {
    const m = model();
    if (!m) return;
    m.sel.forEach(f => {
      f.obj.transform.flipX = !f.obj.transform.flipX;
    });
    commit();
    refresh(true);
  });

  // ---- Flip vertical button ----
  $('#view-design').on('click', '[data-act="flip-y"]', function() {
    const m = model();
    if (!m) return;
    m.sel.forEach(f => {
      f.obj.transform.flipY = !f.obj.transform.flipY;
    });
    commit();
    refresh(true);
  });

  // ---- alignment ----
  const align = act => {
    const m = model();
    if (!m) return;
    let ref;
    if (m.sel.length > 1) ref = m.b; // kotak seleksi
    else if (m.sel[0].parent) { // satu objek di dalam frame → rata terhadap frame
      const p = m.sel[0].parent.transform;
      ref = { x: m.sel[0].origin.x, y: m.sel[0].origin.y, width: p.width, height: p.height };
    } else return;
    m.sel.forEach(f => {
      const b = Geo.bounds(f);
      let dx = 0,
        dy = 0;
      if (act === 'align-left') dx = ref.x - b.x;
      else if (act === 'align-hcenter') dx = ref.x + ref.width / 2 - (b.x + b.width / 2);
      else if (act === 'align-right') dx = ref.x + ref.width - (b.x + b.width);
      else if (act === 'align-top') dy = ref.y - b.y;
      else if (act === 'align-vcenter') dy = ref.y + ref.height / 2 - (b.y + b.height / 2);
      else if (act === 'align-bottom') dy = ref.y + ref.height - (b.y + b.height);
      f.obj.transform.x = r2(f.obj.transform.x + dx);
      f.obj.transform.y = r2(f.obj.transform.y + dy);
    });
    commit();
  };

  // ---- Distribute Spacing ----
  const distribute = (axis) => {
    const m = model();
    if (!m || m.sel.length < 3) return; // Butuh minimal 3 objek untuk distribute
    
    // Urutkan objek berdasarkan posisi
    const items = [...m.sel].sort((a, b) => {
      const bA = Geo.bounds(a);
      const bB = Geo.bounds(b);
      return axis === 'h' ? (bA.x - bB.x) : (bA.y - bB.y);
    });

    const firstB = Geo.bounds(items[0]);
    const lastB = Geo.bounds(items[items.length - 1]);

    if (axis === 'h') {
      const totalSpan = (lastB.x + lastB.width) - firstB.x;
      const totalWidths = items.reduce((sum, it) => sum + Geo.bounds(it).width, 0);
      const remainingGap = totalSpan - totalWidths;
      const gap = remainingGap / (items.length - 1);

      let currentX = firstB.x;
      items.forEach((it) => {
        const b = Geo.bounds(it);
        const dx = currentX - b.x;
        it.obj.transform.x = r2(it.obj.transform.x + dx);
        currentX += b.width + gap;
      });
    } else {
      const totalSpan = (lastB.y + lastB.height) - firstB.y;
      const totalHeights = items.reduce((sum, it) => sum + Geo.bounds(it).height, 0);
      const remainingGap = totalSpan - totalHeights;
      const gap = remainingGap / (items.length - 1);

      let currentY = firstB.y;
      items.forEach((it) => {
        const b = Geo.bounds(it);
        const dy = currentY - b.y;
        it.obj.transform.y = r2(it.obj.transform.y + dy);
        currentY += b.height + gap;
      });
    }

    commit();
    refresh(true);
  };

  $('#view-design').on('click', '[data-act="distribute-h"]', function() {
    distribute('h');
  });

  $('#view-design').on('click', '[data-act="distribute-v"]', function() {
    distribute('v');
  });
  $('#view-design').on('click', '[data-act^="align-"]', function() {
    align(String($(this).data('act')));
  });
});