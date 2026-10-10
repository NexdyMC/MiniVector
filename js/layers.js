/* ================= LAYERS (tree + drag & drop) ================= */
var drag = null, endDrag = null, nudgeLayer = null;
$(function() {
  const ico = n => `<svg class="ico"><use href="#i-${n}"/></svg>`;
  const esc = s => $('<div>').text(s).html();

  // tree dibuat dari State.objects dalam urutan terbalik (objek paling depan di atas)
  let tree = [];
  let sel = null,
    query = '';
  const ICON = {
    frame: 'frame',
    rect: 'rect',
    rectangle: 'rect',
    ellipse: 'ellipse'
  };

  const syncTreeFromState = () => {
    tree = (typeof State !== 'undefined' && Array.isArray(State.objects))
      ? State.objects.slice().reverse()
      : [];
  };

  const commitTreeToState = () => {
    if (typeof State !== 'undefined') {
      State.objects = tree.slice().reverse();
      $(document).trigger('object:change');
    }
  };

  const find = (id, list = tree, parent = null) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return {
        node: n,
        arr: list,
        index: i,
        parent
      };
      if (n.children) {
        const r = find(id, n.children, n);
        if (r) return r;
      }
    }
    return null;
  };
  const contains = (a, id) => !!(a.children && find(id, a.children));

  const render = () => {
    const matches = n => !query || (n.name || '').toLowerCase().includes(query);
    const visible = n => matches(n) || (n.children || []).some(visible);
    const rows = [];
    const walk = (list, d) => list.forEach(n => {
      if (!visible(n)) return;
      rows.push([n, d]);
      if (n.children && (n.open || query)) walk(n.children, d + 1);
    });
    walk(tree, 0);
    $('#layer-list').html(rows.map(([n, d]) => {
      const open = n.children && (n.open || query);
      return `<li class="layer${n.children ? ' frame' : ''}${open ? ' open' : ''}${n.id === sel ? ' selected' : ''}" data-id="${n.id}" style="--depth:${d}"
  role="treeitem" aria-level="${d + 1}" aria-selected="${n.id === sel}"${n.children ? ` aria-expanded="${!!open}"` : ''}>` +
        (n.children ? `<button class="twirl" tabindex="-1" aria-label="Buka / tutup ${esc(n.name || '')}">${ico('chev')}</button>` : '<span class="twirl"></span>') +
        ico(ICON[n.type] || 'rect') + `<span class="name">${esc(n.name || '')}</span></li>`;
    }).join('') + '<li class="layer-end" aria-hidden="true"></li>');
    $('#empty-state').prop('hidden', tree.length > 0);
  };

  // Dengarkan project:load, object:add, dan object:change untuk membangun ulang panel
  $(document).on('project:load', () => {
    syncTreeFromState();
    sel = State.selectedId ? String(State.selectedId) : null;
    render();
  });
  $(document).on('object:add', (e, obj) => {
    syncTreeFromState();
    if (obj && obj.id) {
      sel = String(obj.id);
      State.selectedId = obj.id;
    }
    render();
  });
  $(document).on('object:change', () => {
    syncTreeFromState();
    sel = State.selectedId ? String(State.selectedId) : null;
    render();
  });
  $(document).on('selection:change', (e, obj) => {
    sel = obj ? String(obj.id) : null;
    $('#layer-list .layer').removeClass('selected').attr('aria-selected', false);
    if (sel) {
      const $el = $(`#layer-list .layer[data-id="${sel}"]`);
      $el.addClass('selected').attr('aria-selected', true);
      if ($el.length && $el[0].scrollIntoView) {
        $el[0].scrollIntoView({ block: 'nearest' });
      }
    }
  });

  syncTreeFromState();
  sel = State.selectedId ? String(State.selectedId) : null;
  render();

  // pilih + search + collapse
  let justDragged = false;
  $('#layer-list').on('click', '.twirl', function(e) {
    e.stopPropagation();
    const r = find($(this).closest('.layer').data('id'));
    if (r) {
      r.node.open = !r.node.open;
      render();
    }
  });
  $('#layer-list').on('click', '.layer', function() {
    if (justDragged) return;
    sel = String($(this).data('id'));
    State.selectedId = sel;
    $('#layer-list .layer').removeClass('selected').attr('aria-selected', false);
    $(this).addClass('selected').attr('aria-selected', true);
    const obj = (State.objects || []).find(o => String(o.id) === sel);
    $(document).trigger('selection:change', [obj]);
  });
  $('#layer-search').on('input', function() {
    query = this.value.trim().toLowerCase();
    render();
  });
  $('#btn-collapse-layers').on('click', () => {
    const frames = [];
    (function collect(l) {
      l.forEach(n => {
        if (n.children) {
          frames.push(n);
          collect(n.children);
        }
      });
    })(tree);
    const anyOpen = frames.some(f => f.open);
    frames.forEach(f => f.open = !anyOpen);
    render();
  });

  const moveNode = (id, drop) => {
    const src = find(id);
    if (!src) return;
    src.arr.splice(src.index, 1); // cabut dulu, cari target SETELAH itu
    if (drop.pos === 'end') tree.push(src.node);
    else if (drop.pos === 'inside') {
      const t = find(drop.ref).node;
      t.children.unshift(src.node);
      t.open = true;
    } else {
      const t = find(drop.ref);
      t.arr.splice(t.index + (drop.pos === 'after' ? 1 : 0), 0, src.node);
    }
    sel = id;
    commitTreeToState();
    render();
  };
  // Alt+↑/↓: pindah urutan di antara saudara (alternatif keyboard untuk drag & drop)
  nudgeLayer = dir => {
    const r = sel && find(sel);
    if (!r) return;
    const i = r.index + dir;
    if (i < 0 || i >= r.arr.length) return;
    r.arr.splice(r.index, 1);
    r.arr.splice(i, 0, r.node);
    commitTreeToState();
    render();
  };

  // ---- drag & drop pakai pointer events (mouse + touch; touch = tahan 250 ms) ----
  drag = null;
  const clearMarks = () => $('#layer-list .layer, #layer-list .layer-end').removeClass('drop-before drop-after drop-inside drop-end');
  const startDrag = () => {
    if (!drag || drag.started) return;
    drag.started = true;
    const n = find(drag.id).node;
    $('<div class="drag-ghost">').html(ico(ICON[n.type]) + '<span>' + esc(n.name) + '</span>').appendTo('body');
    $('body').addClass('dragging-layer');
    $(`#layer-list .layer[data-id="${drag.id}"]`).addClass('dragging');
    moveGhost(drag.x, drag.y);
    if (drag.touch && navigator.vibrate) navigator.vibrate(10);
  };
  const moveGhost = (x, y) => $('.drag-ghost').css({
    left: x + 14,
    top: y + 14
  });
  const computeDrop = e => {
    clearMarks();
    drag.drop = null;
    const list = $('#layer-list')[0],
      lr = list.getBoundingClientRect();
    if (e.clientY < lr.top + 28) list.scrollTop -= 10;
    else if (e.clientY > lr.bottom - 28) list.scrollTop += 10;
    const $row = $(document.elementFromPoint(e.clientX, e.clientY)).closest('.layer, .layer-end');
    if (!$row.length || !list.contains($row[0])) return;
    if ($row.hasClass('layer-end')) {
      drag.drop = {
        pos: 'end'
      };
      $row.addClass('drop-end');
      return;
    }
    const id = String($row.data('id'));
    const src = find(drag.id).node;
    if (id === drag.id || contains(src, id)) return; // tidak boleh ke diri sendiri / anaknya
    const node = find(id).node,
      r = $row[0].getBoundingClientRect(),
      t = (e.clientY - r.top) / r.height;
    let pos;
    if (node.children) pos = t < .25 ? 'before' : (t > .75 && !node.open ? 'after' : 'inside');
    else pos = t < .5 ? 'before' : 'after';
    drag.drop = {
      ref: id,
      pos
    };
    $row.addClass('drop-' + pos);
  };
  endDrag = commit => {
    if (!drag) return;
    clearTimeout(drag.timer);
    const d = drag;
    drag = null;
    if (!d.started) return;
    $('.drag-ghost').remove();
    $('body').removeClass('dragging-layer');
    clearMarks();
    justDragged = true;
    setTimeout(() => {
      justDragged = false;
    }, 60);
    if (commit && d.drop) moveNode(d.id, d.drop);
    else $('#layer-list .layer').removeClass('dragging');
  };
  $('#layer-list').on('pointerdown', '.layer', function(e) {
    if (e.button !== 0 || query || $(e.target).closest('.twirl').length) return; // saat search aktif, drag dimatikan
    drag = {
      id: String($(this).data('id')),
      x: e.clientX,
      y: e.clientY,
      started: false,
      drop: null,
      touch: e.pointerType === 'touch',
      timer: null
    };
    if (drag.touch) drag.timer = setTimeout(startDrag, 250);
  });
  $(document).on('pointermove', e => {
    if (!drag) return;
    if (!drag.started) {
      const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
      if (drag.touch) {
        if (moved > 8) {
          clearTimeout(drag.timer);
          drag = null;
        }
        return;
      } // geser = scroll biasa
      if (moved < 5) return;
      startDrag();
    }
    moveGhost(e.clientX, e.clientY);
    computeDrop(e);
  });
  $(document).on('pointerup', () => endDrag(true)).on('pointercancel', () => endDrag(false));
  document.addEventListener('touchmove', e => {
    if (drag && drag.started) e.preventDefault();
  }, {
    passive: false
  });


})