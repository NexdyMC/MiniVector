/* ================= DESIGN: POSITION (X / Y, alignment) ================= */
// Panel kanan → Design → Position. Bergantung pada: variabel.js (State), geometry.js (Geo).
// Rotation, putar 90° dan flip dikerjakan di tahap berikutnya (belum tersambung).
// X/Y = posisi pojok kiri-atas relatif terhadap frame induk (objek di root: koordinat dunia).
// Banyak objek terpilih: X/Y = kotak pembatas seluruh seleksi; mengubahnya menggeser semua objek.
$(function() {
  const r2 = n => Math.round(n * 100) / 100;
  const $x = $('#prop-x'),
    $y = $('#prop-y'),
    $align = $('[data-act^="align-"]');
  $x.add($y).attr('step', 'any'); // desimal boleh; panah atas/bawah tetap menambah 1

  const model = () => {
    const sel = Geo.selection();
    if (!sel.length) return null;
    // induk sama → relatif terhadap induk itu; induk berbeda → koordinat dunia
    const same = sel.every(f => f.parent === sel[0].parent);
    return { sel, b: Geo.union(sel), origin: same ? sel[0].origin : { x: 0, y: 0 } };
  };
  const commit = () => $(document).trigger('object:change'); // simpan JSON + gambar ulang canvas + panel layer
  const show = ($el, v, force) => {
    if (force || document.activeElement !== $el[0]) $el.val(r2(v)); // jangan timpa angka yang sedang diketik
  };

  const refresh = force => {
    const m = model();
    $x.add($y).prop('disabled', !m);
    if (m) {
      show($x, m.b.x - m.origin.x, force);
      show($y, m.b.y - m.origin.y, force);
    } else {
      $x.val('');
      $y.val('');
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
  $x.on('change', function() {
    move('x', this.value);
  });
  $y.on('change', function() {
    move('y', this.value);
  });
  $x.add($y).on('keydown', function(e) {
    if (e.key === 'Escape') {
      refresh(true);
      this.blur();
    }
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
  $('#view-design').on('click', '[data-act^="align-"]', function() {
    align(String($(this).data('act')));
  });
});