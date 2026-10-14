/* ================= EXPORTER (SVG, PNG, JPEG, WEBP, JSON) ================= */
// Modul tunggal untuk mengekspor desain MiniVector ke berbagai format.
// Bergantung pada: variabel.js (State, serializeProject), geometry.js (Geo).

class Exporter {
  // Helper internal untuk memicu unduhan file di browser
  static _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  // Mengambil daftar objek yang akan diexport (objek terpilih atau semua objek di canvas)
  static _getTargets() {
    const sel = Geo.selection();
    if (sel && sel.length > 0) {
      return {
        isSelection: true,
        items: sel.map(f => f.obj),
        bounds: Geo.union(sel)
      };
    }

    if (!State.objects || State.objects.length === 0) {
      return null;
    }

    // Jika tidak ada seleksi, hitung batas seluruh objek kanvas
    const allWrapped = State.objects.map(obj => ({
      obj,
      origin: { x: 0, y: 0 }
    }));
    return {
      isSelection: false,
      items: State.objects,
      bounds: Geo.union(allWrapped)
    };
  }

  // Sanitasi nama file
  static _getFilename(extension) {
    const raw = ($('#file-name').text() || 'minivector').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `${clean || 'design'}.${extension}`;
  }

  /* -------------------------------------------------------------
   * 1. EXPORT JSON (Format Proyek)
   * ------------------------------------------------------------- */
  static json() {
    try {
      const data = typeof serializeProject === 'function' ? serializeProject() : { objects: State.objects };
      const str = JSON.stringify(data, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      this._download(blob, this._getFilename('json'));
      return true;
    } catch (err) {
      console.error('Gagal export JSON:', err);
      return false;
    }
  }

  /* -------------------------------------------------------------
   * 2. EXPORT SVG (Vektor Standar W3C)
   * ------------------------------------------------------------- */
  static svg() {
    const target = this._getTargets();
    if (!target || !target.bounds) {
      alert('Tidak ada elemen untuk diekspor!');
      return false;
    }

    const b = target.bounds;
    const w = Math.max(1, Math.round(b.width));
    const h = Math.max(1, Math.round(b.height));
    const ox = b.x;
    const oy = b.y;

    const renderObjectToSVG = (o, parentOffset = { x: 0, y: 0 }) => {
      if (!o || o.visible === false || !o.transform) return '';
      const t = o.transform;
      const s = o.style || {};
      const x = parentOffset.x + t.x - ox;
      const y = parentOffset.y + t.y - oy;
      const fill = s.fill || 'none';
      const stroke = s.stroke || 'none';
      const sw = s.strokeWidth !== undefined ? s.strokeWidth : 0;

      if (o.type === 'frame') {
        const frameFill = s.fill || '#FFFFFF';
        let inner = `<rect x="${x}" y="${y}" width="${t.width}" height="${t.height}" fill="${frameFill}" stroke="${stroke}" stroke-width="${sw}" />`;
        if (Array.isArray(o.children)) {
          const childrenSvg = o.children
            .map(c => renderObjectToSVG(c, { x: parentOffset.x + t.x, y: parentOffset.y + t.y }))
            .join('\n');
          if (o.clipContent !== false) {
            const clipId = `clip-${o.id || Math.random().toString(36).substr(2, 6)}`;
            inner += `
            <defs>
              <clipPath id="${clipId}">
                <rect x="${x}" y="${y}" width="${t.width}" height="${t.height}" />
              </clipPath>
            </defs>
            <g clip-path="url(#${clipId})">
              ${childrenSvg}
            </g>`;
          } else {
            inner += `\n<g>${childrenSvg}</g>`;
          }
        }
        return inner;
      }

      if (o.type === 'rectangle') {
        return `<rect x="${x}" y="${y}" width="${t.width}" height="${t.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`;
      }

      if (o.type === 'ellipse') {
        const rx = t.width / 2;
        const ry = t.height / 2;
        const cx = x + rx;
        const cy = y + ry;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`;
      }

      if (o.type === 'line') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length >= 2) {
          const x1 = x + nodes[0].x;
          const y1 = y + nodes[0].y;
          const x2 = x + nodes[1].x;
          const y2 = y + nodes[1].y;
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw || 1}" stroke-linecap="round" />`;
        }
      }

      if (o.type === 'path') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length >= 2) {
          let d = `M ${x + nodes[0].x} ${y + nodes[0].y}`;
          for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];
            if (prev.handleOut || curr.handleIn) {
              const cp1x = x + (prev.handleOut ? prev.handleOut.x : prev.x);
              const cp1y = y + (prev.handleOut ? prev.handleOut.y : prev.y);
              const cp2x = x + (curr.handleIn ? curr.handleIn.x : curr.x);
              const cp2y = y + (curr.handleIn ? curr.handleIn.y : curr.y);
              d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x + curr.x} ${y + curr.y}`;
            } else {
              d += ` L ${x + curr.x} ${y + curr.y}`;
            }
          }
          if (o.closed && nodes.length > 2) {
            const last = nodes[nodes.length - 1];
            const first = nodes[0];
            if (last.handleOut || first.handleIn) {
              const cp1x = x + (last.handleOut ? last.handleOut.x : last.x);
              const cp1y = y + (last.handleOut ? last.handleOut.y : last.y);
              const cp2x = x + (first.handleIn ? first.handleIn.x : first.x);
              const cp2y = y + (first.handleIn ? first.handleIn.y : first.y);
              d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x + first.x} ${y + first.y} Z`;
            } else {
              d += ` Z`;
            }
          }
          return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw || 1}" stroke-linecap="${s.strokeCap || 'round'}" stroke-linejoin="${s.strokeJoin || 'round'}" />`;
        }
      }

      if (o.type === 'polygon' || o.type === 'star') {
        const cx = x + t.width / 2;
        const cy = y + t.height / 2;
        const rx = t.width / 2;
        const ry = t.height / 2;
        const g = o.geometry || {};
        const count = Math.max(3, parseInt(g.pointCount, 10) || (o.type === 'polygon' ? 3 : 5));
        const pts = [];

        if (o.type === 'polygon') {
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
            pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
          }
        } else {
          const ratio = Math.max(0.05, Math.min(0.95, (parseFloat(g.innerRadiusRatio) || 38.2) / 100));
          const totalPts = count * 2;
          for (let i = 0; i < totalPts; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalPts;
            const rFactor = (i % 2 === 0) ? 1 : ratio;
            pts.push(`${cx + rx * rFactor * Math.cos(angle)},${cy + ry * rFactor * Math.sin(angle)}`);
          }
        }
        return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw || 1}" stroke-linejoin="round" />`;
      }

      return '';
    };

    const elementsSvg = target.items.map(obj => renderObjectToSVG(obj)).join('\n');
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${elementsSvg}
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    this._download(blob, this._getFilename('svg'));
    return true;
  }

  /* -------------------------------------------------------------
   * 3. EXPORT RASTER (PNG, JPEG, WEBP)
   * ------------------------------------------------------------- */
  static raster(format = 'png', scale = 1) {
    const target = this._getTargets();
    if (!target || !target.bounds) {
      alert('Tidak ada elemen untuk diekspor!');
      return false;
    }

    const b = target.bounds;
    const safeScale = Math.max(0.25, Math.min(Number(scale) || 1, 4));
    const w = Math.max(1, Math.round(b.width * safeScale));
    const h = Math.max(1, Math.round(b.height * safeScale));
    const ox = b.x;
    const oy = b.y;

    // Canvas virtual off-screen
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');

    // Untuk JPEG, beri latar belakang putih agar transparan tidak menjadi hitam pekat
    const mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    ctx.scale(safeScale, safeScale);
    ctx.translate(-ox, -oy);

    const renderObj = (o) => {
      if (!o || o.visible === false || !o.transform) return;
      const t = o.transform;
      const s = o.style || {};

      if (o.type === 'frame') {
        if (s.fill) {
          ctx.fillStyle = s.fill;
          ctx.fillRect(t.x, t.y, t.width, t.height);
        }
        if (s.stroke && s.strokeWidth > 0) {
          ctx.lineWidth = s.strokeWidth;
          ctx.strokeStyle = s.stroke;
          ctx.strokeRect(t.x, t.y, t.width, t.height);
        }
        if (Array.isArray(o.children) && o.children.length > 0) {
          ctx.save();
          if (o.clipContent !== false) {
            ctx.beginPath();
            ctx.rect(t.x, t.y, t.width, t.height);
            ctx.clip();
          }
          ctx.translate(t.x, t.y);
          o.children.forEach(renderObj);
          ctx.restore();
        }
      } else if (o.type === 'rectangle') {
        if (s.fill) {
          ctx.fillStyle = s.fill;
          ctx.fillRect(t.x, t.y, t.width, t.height);
        }
        if (s.stroke && s.strokeWidth > 0) {
          ctx.lineWidth = s.strokeWidth;
          ctx.strokeStyle = s.stroke;
          ctx.strokeRect(t.x, t.y, t.width, t.height);
        }
      } else if (o.type === 'ellipse') {
        const rx = Math.abs(t.width) / 2;
        const ry = Math.abs(t.height) / 2;
        const cx = t.x + rx;
        const cy = t.y + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (s.fill) {
          ctx.fillStyle = s.fill;
          ctx.fill();
        }
        if (s.stroke && s.strokeWidth > 0) {
          ctx.lineWidth = s.strokeWidth;
          ctx.strokeStyle = s.stroke;
          ctx.stroke();
        }
      } else if (o.type === 'line') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length >= 2) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(t.x + nodes[0].x, t.y + nodes[0].y);
          ctx.lineTo(t.x + nodes[1].x, t.y + nodes[1].y);
          ctx.lineWidth = s.strokeWidth !== undefined ? s.strokeWidth : 1;
          ctx.strokeStyle = s.stroke || '#000000';
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    target.items.forEach(renderObj);
    ctx.restore();

    // Konversi ke Blob dan download
    offCanvas.toBlob(
      blob => {
        if (blob) {
          this._download(blob, this._getFilename(format === 'jpeg' ? 'jpg' : format));
        }
      },
      mimeType,
      0.95
    );

    return true;
  }

  /* -------------------------------------------------------------
   * 4. LIVE PREVIEW GENERATOR (CANVAS MURNI)
   * ------------------------------------------------------------- */
  static updatePreview() {
    const $sec = $('#sec-export');
    if ($sec.is(':hidden')) return; // Hemat CPU & cegah error saat accordion tertutup

    const cv = document.getElementById('export-preview-cv');
    const $empty = $('#export-preview-empty');
    const $w = $('#export-w');
    const $h = $('#export-h');
    const $scale = $('#export-scale');

    if (!cv) return;
    const ctx = cv.getContext('2d');

    const target = this._getTargets();
    if (!target || !target.bounds || target.items.length === 0) {
      cv.style.display = 'none';
      $empty.show();
      $w.val('');
      $h.val('');
      return;
    }

    $empty.hide();
    cv.style.display = 'block';

    const b = target.bounds;
    const scale = parseFloat($scale.val()) || 1;
    const baseW = Math.max(1, Math.round(b.width));
    const baseH = Math.max(1, Math.round(b.height));

    if (document.activeElement !== $w[0] && document.activeElement !== $h[0]) {
      $w.val(Math.round(baseW * scale));
      $h.val(Math.round(baseH * scale));
    }

    // Resolusi canvas preview proporsional (max 240px)
    const maxThumb = 240;
    const thumbScale = Math.min(maxThumb / baseW, maxThumb / baseH, 1);
    const tw = Math.max(1, Math.round(baseW * thumbScale));
    const th = Math.max(1, Math.round(baseH * thumbScale));

    cv.width = tw;
    cv.height = th;

    const format = $('#export-format').val() || 'png';
    if (format === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, tw, th);
    } else {
      ctx.clearRect(0, 0, tw, th);
    }

    ctx.save();
    ctx.scale(thumbScale, thumbScale);
    ctx.translate(-b.x, -b.y);

    const renderObj = (o) => {
      if (!o || o.visible === false || !o.transform) return;
      const t = o.transform;
      const s = o.style || {};

      if (o.type === 'frame') {
        if (s.fill) {
          ctx.fillStyle = s.fill;
          ctx.fillRect(t.x, t.y, t.width, t.height);
        }
        if (s.stroke && s.strokeWidth > 0) {
          ctx.lineWidth = s.strokeWidth;
          ctx.strokeStyle = s.stroke;
          ctx.strokeRect(t.x, t.y, t.width, t.height);
        }
        if (Array.isArray(o.children) && o.children.length > 0) {
          ctx.save();
          if (o.clipContent !== false) {
            ctx.beginPath();
            ctx.rect(t.x, t.y, t.width, t.height);
            ctx.clip();
          }
          ctx.translate(t.x, t.y);
          o.children.forEach(renderObj);
          ctx.restore();
        }
      } else if (o.type === 'rectangle') {
        if (s.fill) {
          ctx.fillStyle = s.fill;
          ctx.fillRect(t.x, t.y, t.width, t.height);
        }
        if (s.stroke && s.strokeWidth > 0) {
          ctx.lineWidth = s.strokeWidth;
          ctx.strokeStyle = s.stroke;
          ctx.strokeRect(t.x, t.y, t.width, t.height);
        }
      } else if (o.type === 'ellipse') {
        const rx = Math.abs(t.width) / 2;
        const ry = Math.abs(t.height) / 2;
        const cx = t.x + rx;
        const cy = t.y + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (s.fill) {
          ctx.fillStyle = s.fill;
          ctx.fill();
        }
        if (s.stroke && s.strokeWidth > 0) {
          ctx.lineWidth = s.strokeWidth;
          ctx.strokeStyle = s.stroke;
          ctx.stroke();
        }
      } else if (o.type === 'line') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length >= 2) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(t.x + nodes[0].x, t.y + nodes[0].y);
          ctx.lineTo(t.x + nodes[1].x, t.y + nodes[1].y);
          ctx.lineWidth = s.strokeWidth !== undefined ? s.strokeWidth : 1;
          ctx.strokeStyle = s.stroke || '#000000';
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    target.items.forEach(renderObj);
    ctx.restore();
  }
}

// Pasang ke window global agar mudah dipanggil di panel export UI
window.Exporter = Exporter;
