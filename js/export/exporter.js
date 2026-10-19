/* ================= EXPORTER (PNG, JPEG, WEBP, SVG, PDF, JSON) ================= */
// Modul ekspor MiniVector ke berbagai format grafis dan resolusi ala Figma.
// Mendukung: PNG (transparan), JPEG/JPG (latar putih), WEBP, SVG (vektor murni), PDF (dokumen), JSON (proyek).
// Skala resolusi: 0.5x, 1x, 2x, 3x, 4x, atau custom pixel W x H.
// Bergantung pada: variabel.js (State, serializeProject), geometry.js (Geo), paint.js (Paint), colors.js (Color).

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
   * 1. EXPORT JSON (Format Proyek MiniVector)
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
   * 2. EXPORT RASTER (PNG, JPEG, WEBP)
   * ------------------------------------------------------------- */
  static raster(format = 'png', scale = 1) {
    const target = this._getTargets();
    if (!target || !target.bounds || target.items.length === 0) {
      alert('Tidak ada elemen untuk diekspor!');
      return false;
    }

    const b = target.bounds;
    const safeScale = Math.max(0.1, Math.min(Number(scale) || 1, 8));
    const w = Math.max(1, Math.round(b.width * safeScale));
    const h = Math.max(1, Math.round(b.height * safeScale));
    const ox = b.x;
    const oy = b.y;

    // Canvas virtual off-screen resolusi tinggi
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');

    // Untuk JPEG, beri latar belakang putih agar transparan tidak menjadi hitam pekat
    const mimeType = (format === 'jpeg' || format === 'jpg') ? 'image/jpeg' : (format === 'webp' ? 'image/webp' : 'image/png');
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.save();
    ctx.scale(safeScale, safeScale);
    ctx.translate(-ox, -oy);

    // Render objek menggunakan rendering engine canvas
    if (typeof window.renderObjectsToContext === 'function') {
      window.renderObjectsToContext(ctx, target.items);
    } else if (typeof window.drawObject === 'function') {
      target.items.forEach(window.drawObject);
    }

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
   * 3. EXPORT SVG (Vektor Standar W3C Lengkap)
   * ------------------------------------------------------------- */
  static svg() {
    const target = this._getTargets();
    if (!target || !target.bounds || target.items.length === 0) {
      alert('Tidak ada elemen untuk diekspor!');
      return false;
    }

    const b = target.bounds;
    const w = Math.max(1, Math.round(b.width));
    const h = Math.max(1, Math.round(b.height));
    const ox = b.x;
    const oy = b.y;

    let defsList = [];
    let defIdCounter = 0;

    // Helper membuat linear/radial gradient di SVG
    const getGradientSvg = (paint, objBox) => {
      if (!paint || !Paint.isGradient(paint)) return null;
      const gradId = `mv-grad-${++defIdCounter}`;
      const opacity = paint.opacity == null ? 1 : paint.opacity;
      const stops = Paint.sortedStops(paint).map(st => {
        const c = Color.parseHex(st.color) || Color.parseCss(st.color) || { r: 0, g: 0, b: 0, a: 1 };
        const stopAlpha = (st.opacity == null ? 1 : st.opacity) * opacity * c.a;
        return `<stop offset="${Math.round(st.offset * 100)}%" stop-color="rgb(${c.r},${c.g},${c.b})" stop-opacity="${+stopAlpha.toFixed(4)}" />`;
      }).join('\n      ');

      if (paint.type === 'GRADIENT_LINEAR') {
        const s = paint.start || { x: 0, y: 0.5 };
        const e = paint.end || { x: 1, y: 0.5 };
        defsList.push(`
    <linearGradient id="${gradId}" x1="${(s.x * 100).toFixed(1)}%" y1="${(s.y * 100).toFixed(1)}%" x2="${(e.x * 100).toFixed(1)}%" y2="${(e.y * 100).toFixed(1)}%">
      ${stops}
    </linearGradient>`);
        return `url(#${gradId})`;
      } else if (paint.type === 'GRADIENT_RADIAL') {
        const c = paint.center || { x: 0.5, y: 0.5 };
        defsList.push(`
    <radialGradient id="${gradId}" cx="${(c.x * 100).toFixed(1)}%" cy="${(c.y * 100).toFixed(1)}%" r="50%">
      ${stops}
    </radialGradient>`);
        return `url(#${gradId})`;
      }
      return null;
    };

    // Helper menghasilkan atribut fill SVG
    const getFillAttr = (s, box) => {
      if (!s) return 'fill="none"';
      const fills = Array.isArray(s.fills) && s.fills.length > 0 ? s.fills : null;
      if (fills) {
        const top = fills.slice().reverse().find(p => p.visible !== false);
        if (top) {
          if (top.type === 'SOLID') {
            const c = Color.parseHex(top.color) || Color.parseCss(top.color);
            if (c) {
              const a = (top.opacity == null ? 1 : top.opacity) * c.a;
              return `fill="rgb(${c.r},${c.g},${c.b})" fill-opacity="${+a.toFixed(4)}"`;
            }
          } else if (Paint.isGradient(top)) {
            const url = getGradientSvg(top, box);
            if (url) return `fill="${url}"`;
          }
        }
      }
      if (s.fill && s.fill !== 'none') {
        const c = Color.parseHex(s.fill) || Color.parseCss(s.fill);
        if (c) {
          return `fill="rgb(${c.r},${c.g},${c.b})" fill-opacity="${+c.a.toFixed(4)}"`;
        }
        return `fill="${s.fill}"`;
      }
      return 'fill="none"';
    };

    // Helper menghasilkan atribut stroke SVG
    const getStrokeAttr = (s, box) => {
      if (!s) return 'stroke="none"';
      const sw = s.strokeWidth !== undefined ? s.strokeWidth : (s.stroke ? 1 : 0);
      if (sw <= 0) return 'stroke="none"';

      let strokeVal = 'none';
      let strokeOpacityVal = 1;

      const strokes = Array.isArray(s.strokes) && s.strokes.length > 0 ? s.strokes : null;
      if (strokes) {
        const top = strokes.slice().reverse().find(p => p.visible !== false);
        if (top) {
          if (top.type === 'SOLID') {
            const c = Color.parseHex(top.color) || Color.parseCss(top.color);
            if (c) {
              strokeVal = `rgb(${c.r},${c.g},${c.b})`;
              strokeOpacityVal = (top.opacity == null ? 1 : top.opacity) * c.a;
            }
          } else if (Paint.isGradient(top)) {
            const url = getGradientSvg(top, box);
            if (url) strokeVal = url;
          }
        }
      }

      if (strokeVal === 'none' && s.stroke && s.stroke !== 'none') {
        const c = Color.parseHex(s.stroke) || Color.parseCss(s.stroke);
        if (c) {
          strokeVal = `rgb(${c.r},${c.g},${c.b})`;
          strokeOpacityVal = c.a;
        } else {
          strokeVal = s.stroke;
        }
      }

      if (strokeVal === 'none') return 'stroke="none"';

      let res = `stroke="${strokeVal}" stroke-width="${sw}" stroke-opacity="${+strokeOpacityVal.toFixed(4)}"`;
      if (s.strokeCap) res += ` stroke-linecap="${s.strokeCap === 'arrow' ? 'round' : s.strokeCap}"`;
      if (s.strokeJoin) res += ` stroke-linejoin="${s.strokeJoin}"`;
      if (Array.isArray(s.strokeDashes) && s.strokeDashes.length > 0) {
        res += ` stroke-dasharray="${s.strokeDashes.join(' ')}"`;
      }
      return res;
    };

    // Render rekursif tiap objek ke markup SVG
    const renderObjectToSVG = (o, parentOffset = { x: 0, y: 0 }) => {
      if (!o || o.visible === false || !o.transform) return '';
      const t = o.transform;
      const s = o.style || {};
      const x = parentOffset.x + t.x - ox;
      const y = parentOffset.y + t.y - oy;
      const w = t.width;
      const h = t.height;

      // Transformasi matriks rotasi & flip
      const rot = t.rotation || 0;
      const flipX = !!t.flipX;
      const flipY = !!t.flipY;
      const hasTransform = rot !== 0 || flipX || flipY;

      let transformAttr = '';
      if (hasTransform) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const parts = [];
        if (rot !== 0) parts.push(`rotate(${rot} ${cx} ${cy})`);
        if (flipX || flipY) {
          parts.push(`translate(${cx} ${cy}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1}) translate(${-cx} ${-cy})`);
        }
        transformAttr = ` transform="${parts.join(' ')}"`;
      }

      const fillAttr = getFillAttr(s, { x, y, width: w, height: h });
      const strokeAttr = getStrokeAttr(s, { x, y, width: w, height: h });

      if (o.type === 'frame') {
        let frameMarkup = `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fillAttr} ${strokeAttr} />`;
        if (Array.isArray(o.children) && o.children.length > 0) {
          const childrenSvg = o.children
            .map(c => renderObjectToSVG(c, { x: parentOffset.x + t.x, y: parentOffset.y + t.y }))
            .join('\n');
          if (o.clipContent !== false) {
            const clipId = `clip-${o.id || Math.random().toString(36).substr(2, 6)}`;
            defsList.push(`
    <clipPath id="${clipId}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" />
    </clipPath>`);
            frameMarkup += `\n    <g clip-path="url(#${clipId})">\n      ${childrenSvg}\n    </g>`;
          } else {
            frameMarkup += `\n    <g>\n      ${childrenSvg}\n    </g>`;
          }
        }
        return `<g id="${o.name || 'Frame'}"${transformAttr}>\n      ${frameMarkup}\n    </g>`;
      }

      if (o.type === 'group') {
        if (Array.isArray(o.children) && o.children.length > 0) {
          const childrenSvg = o.children
            .map(c => renderObjectToSVG(c, { x: parentOffset.x + t.x, y: parentOffset.y + t.y }))
            .join('\n');
          return `<g id="${o.name || 'Group'}"${transformAttr}>\n      ${childrenSvg}\n    </g>`;
        }
        return '';
      }

      if (o.type === 'rectangle') {
        const cr = (o.geometry && o.geometry.cornerRadius) || (s && s.cornerRadius) || 0;
        const radius = Array.isArray(cr) ? cr[0] : (parseFloat(cr) || 0);
        const rxAttr = radius > 0 ? ` rx="${radius}" ry="${radius}"` : '';
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rxAttr} ${fillAttr} ${strokeAttr}${transformAttr} />`;
      }

      if (o.type === 'ellipse') {
        const rx = Math.abs(w) / 2;
        const ry = Math.abs(h) / 2;
        const cx = x + rx;
        const cy = y + ry;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${fillAttr} ${strokeAttr}${transformAttr} />`;
      }

      if (o.type === 'line') {
        const x2 = x + (w !== undefined ? w : 100);
        const y2 = y + (h !== undefined ? h : 0);
        return `<line x1="${x}" y1="${y1}" x2="${x2}" y2="${y2}" ${strokeAttr}${transformAttr} />`;
      }

      if (o.type === 'vector' || o.type === 'path') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length > 1) {
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
          return `<path d="${d}" ${fillAttr} ${strokeAttr}${transformAttr} />`;
        }
      }

      if (o.type === 'polygon' || o.type === 'star') {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w / 2;
        const ry = h / 2;
        const g = o.geometry || {};
        const count = Math.max(3, parseInt(g.pointCount, 10) || (o.type === 'polygon' ? 3 : 5));
        const pts = [];

        if (o.type === 'polygon') {
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
            pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
          }
        } else {
          const innerRatio = parseFloat(g.innerRadius) || 0.382;
          const totalPts = count * 2;
          for (let i = 0; i < totalPts; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalPts;
            const rFactorX = (i % 2 === 0) ? rx : rx * innerRatio;
            const rFactorY = (i % 2 === 0) ? ry : ry * innerRatio;
            pts.push(`${cx + rFactorX * Math.cos(angle)},${cy + rFactorY * Math.sin(angle)}`);
          }
        }
        return `<polygon points="${pts.join(' ')}" ${fillAttr} ${strokeAttr}${transformAttr} />`;
      }

      if (o.type === 'text') {
        const textContent = (o.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const fontFam = o.fontFamily || 'Inter, sans-serif';
        const fontSize = o.fontSize || 16;
        const fontWeight = o.fontWeight || '400';
        const fontStyle = o.italic ? 'italic' : 'normal';
        const textAnchor = o.textAlign === 'center' ? 'middle' : (o.textAlign === 'right' ? 'end' : 'start');
        let textX = x;
        if (o.textAlign === 'center') textX = x + w / 2;
        else if (o.textAlign === 'right') textX = x + w;

        return `<text x="${textX}" y="${y + fontSize}" font-family="${fontFam}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${textAnchor}" ${fillAttr}${transformAttr}>${textContent}</text>`;
      }

      if (o.type === 'image' && o.src) {
        return `<image href="${o.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"${transformAttr} />`;
      }

      return '';
    };

    const elementsSvg = target.items.map(obj => renderObjectToSVG(obj)).filter(Boolean).join('\n  ');
    const defsBlock = defsList.length > 0 ? `  <defs>\n  ${defsList.join('\n  ')}\n  </defs>\n` : '';

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
${defsBlock}  ${elementsSvg}
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    this._download(blob, this._getFilename('svg'));
    return true;
  }

  /* -------------------------------------------------------------
   * 4. EXPORT PDF (Dokumen PDF Portabel Siap Cetak)
   * ------------------------------------------------------------- */
  static pdf() {
    const target = this._getTargets();
    if (!target || !target.bounds || target.items.length === 0) {
      alert('Tidak ada elemen untuk diekspor!');
      return false;
    }

    const b = target.bounds;
    // Skala 2x agar hasil PDF tajam (Retina display)
    const scale = 2;
    const pxW = Math.max(1, Math.round(b.width * scale));
    const pxH = Math.max(1, Math.round(b.height * scale));

    const offCanvas = document.createElement('canvas');
    offCanvas.width = pxW;
    offCanvas.height = pxH;
    const ctx = offCanvas.getContext('2d');

    // Latar belakang putih untuk dokumen PDF
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pxW, pxH);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-b.x, -b.y);

    if (typeof window.renderObjectsToContext === 'function') {
      window.renderObjectsToContext(ctx, target.items);
    } else if (typeof window.drawObject === 'function') {
      target.items.forEach(window.drawObject);
    }

    ctx.restore();

    // Ambil data JPEG dari kanvas
    const imgDataUrl = offCanvas.toDataURL('image/jpeg', 0.95);
    const base64Data = imgDataUrl.split(',')[1];
    const binaryImg = atob(base64Data);
    const imgLen = binaryImg.length;
    const imgBytes = new Uint8Array(imgLen);
    for (let i = 0; i < imgLen; i++) {
      imgBytes[i] = binaryImg.charCodeAt(i);
    }

    // Ukuran PDF dalam Point (1 pt = 1/72 inci, standar PDF)
    const ptW = Math.round(b.width * 0.75 * 100) / 100;
    const ptH = Math.round(b.height * 0.75 * 100) / 100;

    // Susun struktur internal dokumen PDF 1.4 murni
    const header = `%PDF-1.4\n%âãÏÓ\n`;
    const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
    const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
    const obj4Head = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLen} >>\nstream\n`;
    const obj4Tail = `\nendstream\nendobj\n`;

    const streamContent = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im1 Do\nQ\n`;
    const obj5 = `5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;

    // Kalkulasi xref table offset
    const enc = new TextEncoder();
    const hBytes = enc.encode(header);
    const o1Bytes = enc.encode(obj1);
    const o2Bytes = enc.encode(obj2);
    const o3Bytes = enc.encode(obj3);
    const o4hBytes = enc.encode(obj4Head);
    const o4tBytes = enc.encode(obj4Tail);
    const o5Bytes = enc.encode(obj5);

    const off1 = hBytes.length;
    const off2 = off1 + o1Bytes.length;
    const off3 = off2 + o2Bytes.length;
    const off4 = off3 + o3Bytes.length;
    const off5 = off4 + o4hBytes.length + imgBytes.length + o4tBytes.length;
    const xrefOffset = off5 + o5Bytes.length;

    const pad10 = n => ('0000000000' + n).slice(-10);
    const xref = `xref\n0 6\n0000000000 65535 f \n${pad10(off1)} 00000 n \n${pad10(off2)} 00000 n \n${pad10(off3)} 00000 n \n${pad10(off4)} 00000 n \n${pad10(off5)} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    const xrefBytes = enc.encode(xref);

    const totalLen = xrefOffset + xrefBytes.length;
    const pdfBuf = new Uint8Array(totalLen);

    let cur = 0;
    pdfBuf.set(hBytes, cur); cur += hBytes.length;
    pdfBuf.set(o1Bytes, cur); cur += o1Bytes.length;
    pdfBuf.set(o2Bytes, cur); cur += o2Bytes.length;
    pdfBuf.set(o3Bytes, cur); cur += o3Bytes.length;
    pdfBuf.set(o4hBytes, cur); cur += o4hBytes.length;
    pdfBuf.set(imgBytes, cur); cur += imgBytes.length;
    pdfBuf.set(o4tBytes, cur); cur += o4tBytes.length;
    pdfBuf.set(o5Bytes, cur); cur += o5Bytes.length;
    pdfBuf.set(xrefBytes, cur);

    const blob = new Blob([pdfBuf], { type: 'application/pdf' });
    this._download(blob, this._getFilename('pdf'));
    return true;
  }

  /* -------------------------------------------------------------
   * 5. LIVE PREVIEW GENERATOR (CANVAS MURNI)
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
    if (format === 'jpeg' || format === 'pdf') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, tw, th);
    } else {
      ctx.clearRect(0, 0, tw, th);
    }

    ctx.save();
    ctx.scale(thumbScale, thumbScale);
    ctx.translate(-b.x, -b.y);

    if (typeof window.renderObjectsToContext === 'function') {
      window.renderObjectsToContext(ctx, target.items);
    } else if (typeof window.drawObject === 'function') {
      target.items.forEach(window.drawObject);
    }

    ctx.restore();
  }
}

// Pasang ke window global agar mudah dipanggil di panel export UI
window.Exporter = Exporter;
