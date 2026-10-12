/* ================= DESIGN: FILL (panel kanan → Fill) ================= */
// Bergantung pada: variabel.js (State), geometry.js (Geo), colors.js (Color), paint.js (Paint),
//                  design/colorpicker.js (ColorPicker), canvas.js (requestRender).
// Daftar fill objek terpilih (paling depan di atas): swatch (membuka picker), hex, opasitas %, mata, hapus; tombol + menambah fill.
// Beberapa objek terpilih dengan fill sama → diedit bersama; fill berbeda → satu baris "Mixed" (memilih warna mengganti semuanya).
// Data: style.fills (lihat StructureJSON.md bagian 6). Tipe selain SOLID ditampilkan sebagai label, belum bisa diedit.
$(function() {
  const $list = $('#fill-list'),
    $add = $('[data-act="fill-add"]');
  if (!$list.length) return;
  const LABEL = { GRADIENT_LINEAR: 'Linear', GRADIENT_RADIAL: 'Radial', GRADIENT_ANGULAR: 'Angular', GRADIENT_DIAMOND: 'Diamond', PATTERN: 'Pattern', IMAGE: 'Image' };
  const strip = fills => fills.map(({ id, ...rest }) => rest);

  const targets = () => (State.selectedIds || []).map(id => Geo.find(String(id))).filter(f => f && f.obj);
  const model = () => {
    const ts = targets();
    if (!ts.length) return null;
    const sets = ts.map(f => Paint.fillsOf(f.obj.style)),
      first = JSON.stringify(strip(sets[0]));
    return { ts, fills: sets[0], mixed: !sets.every(s => JSON.stringify(strip(s)) === first) };
  };

  // tampilan satu baris
  const view = (p, mixed) => {
    if (mixed) return { sw: '#808080', hex: 'Mixed', op: '', vis: true, solid: false, ro: true };
    if (p.type !== 'SOLID') return { sw: '#808080', hex: LABEL[p.type] || p.type, op: Math.round((p.opacity == null ? 1 : p.opacity) * 100), vis: p.visible !== false, solid: false, ro: true };
    const c = Color.parseCss(p.color);
    return { sw: c ? Color.toHex(c) : '#000000', hex: c ? Color.toHex(c).slice(1) : '', op: Math.round((p.opacity == null ? 1 : p.opacity) * 100), vis: p.visible !== false, solid: true, ro: false };
  };
  const rowHtml = (v, i) => `
<div class="fg-grid fill" data-i="${i}">
  <div class="fg-color"><input type="color" class="fill-sw" value="${v.sw}" aria-label="Pilih warna fill"><input class="hex" value="${v.hex}" maxlength="9" spellcheck="false" aria-label="Kode hex"${v.ro ? ' readonly' : ''}><input class="op" type="number" min="0" max="100" value="${v.op}" aria-label="Opasitas fill (%)"${v.op === '' ? ' disabled' : ''}><span class="pc">%</span></div>
  <button type="button" class="fg-ib" data-act="fill-eye" title="Tampilkan / sembunyikan"${v.op === '' ? ' disabled' : ''}><i class="fa-regular ${v.vis ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
  <button type="button" class="fg-ib" data-act="fill-del" title="Hapus"><i class="fa-solid fa-minus"></i></button>
</div>`;

  let sig = null;
  const refresh = force => { // force=true: timpa juga kolom yang sedang fokus (mis. mengembalikan input tidak valid)
    const m = model();
    $add.prop('disabled', !m);
    if (!m) {
      if (sig !== '') $list.empty();
      sig = '';
      return;
    }
    const rows = m.mixed ? [null] : m.fills.slice().reverse(), // paling depan di atas
      views = rows.map(p => view(p, m.mixed)),
      s = m.mixed ? 'mixed' : rows.map(p => p.id + ':' + p.type).join('|') || 'none';
    if (s !== sig) { // jumlah / jenis fill berubah → bangun ulang
      $list.html(views.map(rowHtml).join(''));
      sig = s;
      return;
    }
    $list.children().each((i, el) => { // sama → perbarui nilainya saja (jangan timpa kolom yang sedang diketik)
      const v = views[i],
        $r = $(el),
        sw = $r.find('.fill-sw')[0],
        hx = $r.find('.hex')[0],
        op = $r.find('.op')[0];
      if (sw.value !== v.sw) sw.value = v.sw;
      if (force || document.activeElement !== hx) hx.value = v.hex;
      if (force || document.activeElement !== op) op.value = v.op;
      $r.find('[data-act="fill-eye"] i').attr('class', 'fa-regular ' + (v.vis ? 'fa-eye' : 'fa-eye-slash'));
    });
  };
  Geo.watch(refresh);

  // terapkan perubahan ke semua objek terpilih. final=false: saat masih di-drag (gambar ulang saja, belum simpan JSON)
  const apply = (fn, final = true) => {
    const m = model();
    if (!m) return;
    m.ts.forEach(f => {
      const st = f.obj.style || (f.obj.style = {});
      fn(Paint.ensureFills(st), f);
    });
    if (final) $(document).trigger('object:change'); // simpan JSON + gambar ulang + panel layer
    else {
      requestRender();
      scheduleSave();
      refresh();
    }
  };
  const rowIndex = el => +$(el).closest('.fg-grid').data('i');

  // latar untuk badge kontras: fill frame induk (bila ada) di atas warna latar workspace
  const backgroundFor = f => {
    const ws = document.getElementById('workspace');
    let bg = ws && Color.parseCss(getComputedStyle(ws).backgroundColor);
    if (!bg || bg.a === 0) bg = { r: 30, g: 30, b: 30, a: 1 };
    if (f.parent) {
      const top = Paint.fillsOf(f.parent.style).slice().reverse().find(p => p.type === 'SOLID' && p.visible !== false),
        c = top && Color.parseCss(top.color);
      if (c) bg = Color.blend(c, (top.opacity == null ? 1 : top.opacity) * c.a, bg);
    }
    return Color.toHex(bg);
  };
  const openFor = el => {
    const m = model();
    if (!m) return;
    const $row = $(el).closest('.fg-grid'),
      i = +$row.data('i'),
      p = m.mixed ? null : m.fills[m.fills.length - 1 - i];
    if (p && p.type !== 'SOLID') return; // gradient / pattern / image: tahap berikutnya
    const key = m.mixed ? 'mixed' : p.id;
    if (ColorPicker.isOpen() && ColorPicker.key() === key) return ColorPicker.close();
    const base = p || Paint.fillsOf(m.ts[0].obj.style).slice().reverse().find(q => q.type === 'SOLID') || Paint.solid();
    const sessionIds = new Map(); // mode Mixed: id fill baru per objek, stabil selama picker terbuka
    ColorPicker.open({
      key,
      anchor: $row.find('.fill-sw')[0],
      color: base.color,
      opacity: base.opacity,
      background: backgroundFor(m.ts[0]),
      onChange: ({ color, opacity }, final) => {
        if (m.mixed) {
          apply((fills, f) => {
            if (!sessionIds.has(f.obj.id)) sessionIds.set(f.obj.id, Paint.uid());
            fills.length = 0;
            fills.push({ id: sessionIds.get(f.obj.id), type: 'SOLID', visible: true, opacity, color });
          }, final);
        } else {
          apply(fills => {
            const q = fills[fills.length - 1 - i];
            if (q && q.type === 'SOLID') {
              q.color = color;
              q.opacity = opacity;
            }
          }, final);
        }
      }
    });
  };

  // swatch: buka picker kita, bukan dialog warna bawaan browser
  $list.on('click', '.fill-sw', function(e) {
    e.preventDefault();
    openFor(this);
  });
  $list.on('keydown', '.fill-sw', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFor(this);
    }
  });
  $list.on('change', '.hex', function() {
    const raw = String(this.value).trim().replace('#', ''),
      c = Color.parseHex(raw),
      i = rowIndex(this);
    if (!c) return refresh(true); // tidak valid → kembalikan nilai lama
    apply(fills => {
      const q = fills[fills.length - 1 - i];
      if (!q || q.type !== 'SOLID') return;
      q.color = Color.toHex(c);
      if (raw.length === 4 || raw.length === 8) q.opacity = Math.round(c.a * 100) / 100; // hex dengan alpha
    });
  });
  $list.on('change', '.op', function() {
    const v = parseFloat(this.value),
      i = rowIndex(this);
    if (!isFinite(v)) return refresh(true);
    apply(fills => {
      const q = fills[fills.length - 1 - i];
      if (q) q.opacity = Math.min(100, Math.max(0, v)) / 100;
    });
  });
  $list.on('click', '[data-act="fill-eye"]', function() {
    const i = rowIndex(this);
    apply(fills => {
      const q = fills[fills.length - 1 - i];
      if (q) q.visible = q.visible === false;
    });
  });
  $list.on('click', '[data-act="fill-del"]', function() {
    const m = model(),
      i = rowIndex(this);
    ColorPicker.close();
    apply(fills => {
      if (m && m.mixed) fills.length = 0;
      else fills.splice(fills.length - 1 - i, 1);
    });
  });
  $add.on('click', () => {
    ColorPicker.close();
    apply(fills => fills.push(Paint.solid('#D9D9D9', 1)));
  });

  // target picker berubah → tutup agar tidak mengedit objek yang salah
  $(document).on('selection:change project:load object:remove', () => ColorPicker.close());
});