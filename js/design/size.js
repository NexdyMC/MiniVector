/* ================= DESIGN: SIZE (Layout → Dimensions W / H, kunci rasio) ================= */
// Panel kanan → Design → Layout. Bergantung pada: variabel.js (State), geometry.js (Geo).
// W/H hanya bisa diedit untuk satu objek; banyak objek terpilih → menampilkan ukuran kotak seleksi (hanya baca).
// Kunci rasio disimpan per objek di transform.constrainProportions (opsional, default false).
$(function() {
  const MIN = 0.01; // ukuran 0 membuat bentuk rusak untuk fitur lain
  const r2 = n => Math.round(n * 100) / 100;
  const $w = $('#prop-w'),
    $h = $('#prop-h'),
    $lock = $('[data-act="ratio-lock"]');
  $w.add($h).attr('step', 'any');

  const single = () => {
    const sel = Geo.selection();
    return sel.length === 1 ? sel[0] : null;
  };
  const commit = () => {
    const f = single();
    if (f && f.parent && f.parent.type === 'group' && window.Grouping && typeof window.Grouping.recalculateBounds === 'function') {
      window.Grouping.recalculateBounds(f.parent);
    }
    $(document).trigger('object:change');
  };
  const show = ($el, v, force) => {
    if (force || document.activeElement !== $el[0]) $el.val(r2(v));
  };

  const refresh = force => {
    const sel = Geo.selection(),
      b = Geo.union(sel),
      one = sel.length === 1 ? sel[0] : null;
    $w.add($h).prop('disabled', !one);
    if (b) {
      show($w, b.width, force);
      show($h, b.height, force);
    } else {
      $w.val('');
      $h.val('');
    }
    $lock.prop('disabled', !one).attr('aria-pressed', !!(one && one.obj.transform.constrainProportions));
  };
  Geo.watch(refresh);

  const resize = (dim, raw) => {
    const f = single(),
      v = parseFloat(raw);
    if (!f || !isFinite(v)) return refresh(true);
    const t = f.obj.transform,
      val = Math.max(MIN, r2(v));
    let w = t.width,
      h = t.height;
    if (t.constrainProportions && t.width > 0 && t.height > 0) { // rasio mengikuti ukuran saat ini
      const ratio = t.width / t.height;
      if (dim === 'w') {
        w = val;
        h = Math.max(MIN, r2(val / ratio));
      } else {
        h = val;
        w = Math.max(MIN, r2(val * ratio));
      }
    } else if (dim === 'w') w = val;
    else h = val;
    if (w === t.width && h === t.height) return refresh(true);
    Geo.setSize(f.obj, w, h);
    commit();
  };
  $w.on('change', function() {
    resize('w', this.value);
  });
  $h.on('change', function() {
    resize('h', this.value);
  });
  $w.add($h).on('keydown', function(e) {
    if (e.key === 'Escape') {
      refresh(true);
      this.blur();
    }
  });

  $('#view-design').on('click', '[data-act="ratio-lock"]', () => {
    const f = single();
    if (!f) return;
    if (f.obj.transform.constrainProportions) delete f.obj.transform.constrainProportions; // default false → JSON tetap bersih
    else f.obj.transform.constrainProportions = true;
    commit();
  });
});