/* ================= CANVAS (render + koordinat + zoom/pan) ================= */



const cvEl = document.getElementById('canvas');
const cvCtx = cvEl.getContext('2d');
let cvW = 0,
    cvH = 0,
    cvDpr = 1,
    cvDirty = false;

/* ---------- konversi koordinat (dipakai tool) ---------- */
const screenToWorld = (x, y) => ({
    x: (x - State.panX) / State.zoom,
    y: (y - State.panY) / State.zoom
});
const worldToScreen = (x, y) => ({
    x: x * State.zoom + State.panX,
    y: y * State.zoom + State.panY
});
const eventToWorld = e => { 
    const r = cvEl.getBoundingClientRect();
    return screenToWorld(e.clientX - r.left, e.clientY - r.top);
};

const snapWorld = (pt, e) => {
    if (e && (e.ctrlKey || e.metaKey)) return pt;
    return { x: Math.round(pt.x), y: Math.round(pt.y) };
};

/* ---------- render (hanya saat ada perubahan) ---------- */

const GRID_ZOOM_THRESHOLD = 8;
const drawGrid = () => {
    if (State.zoom < GRID_ZOOM_THRESHOLD) return;
    
    const x0 = Math.floor(-State.panX / State.zoom);
    const y0 = Math.floor(-State.panY / State.zoom);
    const x1 = Math.ceil((cvW - State.panX) / State.zoom);
    const y1 = Math.ceil((cvH - State.panY) / State.zoom);
    const pxPerUnit = cvDpr * State.zoom; 
    cvCtx.save();
    cvCtx.setTransform(1, 0, 0, 1, 0, 0); 
    cvCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    cvCtx.lineWidth = 1;
    cvCtx.beginPath();
    for (let xi = x0; xi <= x1; xi++) {
        const sx = Math.round(xi * pxPerUnit + cvDpr * State.panX) + 0.5;
        cvCtx.moveTo(sx, 0);
        cvCtx.lineTo(sx, cvEl.height);
    }
    for (let yi = y0; yi <= y1; yi++) {
        const sy = Math.round(yi * pxPerUnit + cvDpr * State.panY) + 0.5;
        cvCtx.moveTo(0, sy);
        cvCtx.lineTo(cvEl.width, sy);
    }
    cvCtx.stroke();
    cvCtx.restore();
};
const drawObject = o => {
    if (!o || o.visible === false || !o.transform) return;
    const t = o.transform,
        s = o.style || {};

    if (o.type === 'frame') {
        
        Paint.fillRect(cvCtx, s, t.x, t.y, t.width, t.height); 
        if (s.stroke && s.strokeWidth > 0) {
            cvCtx.lineWidth = s.strokeWidth;
            cvCtx.strokeStyle = s.stroke;
            cvCtx.strokeRect(t.x, t.y, t.width, t.height);
        }

        
        cvCtx.save();
        cvCtx.font = `${Math.max(11, 12 / State.zoom)}px sans-serif`;
        cvCtx.fillStyle = '#8C8C8C';
        cvCtx.fillText(o.name || 'Frame', t.x, t.y - (4 / State.zoom));
        cvCtx.restore();

        
        if (Array.isArray(o.children) && o.children.length > 0) {
            cvCtx.save();
            if (o.clipContent !== false) {
                cvCtx.beginPath();
                cvCtx.rect(t.x, t.y, t.width, t.height);
                cvCtx.clip();
            }
            
            cvCtx.translate(t.x, t.y);
            o.children.forEach(drawObject);
            cvCtx.restore();
        }
    } else if (o.type === 'rectangle') {
        Paint.fillRect(cvCtx, s, t.x, t.y, t.width, t.height); 
        if (s.stroke && s.strokeWidth > 0) {
            cvCtx.lineWidth = s.strokeWidth; 
            cvCtx.strokeStyle = s.stroke;
            cvCtx.strokeRect(t.x, t.y, t.width, t.height);
        }
    } else if (o.type === 'ellipse') {
        const rx = Math.abs(t.width) / 2;
        const ry = Math.abs(t.height) / 2;
        const cx = t.x + rx;
        const cy = t.y + ry;

        cvCtx.beginPath();
        cvCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

        Paint.fillPath(cvCtx, s, t);
        if (s.stroke && s.strokeWidth > 0) {
            cvCtx.lineWidth = s.strokeWidth;
            cvCtx.strokeStyle = s.stroke;
            cvCtx.stroke();
        }
    } else if (o.type === 'line') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length >= 2) {
            cvCtx.save();
            cvCtx.beginPath();
            cvCtx.moveTo(t.x + nodes[0].x, t.y + nodes[0].y);
            cvCtx.lineTo(t.x + nodes[1].x, t.y + nodes[1].y);
            cvCtx.lineWidth = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
            cvCtx.strokeStyle = s.stroke || '#000000';
            cvCtx.lineCap = 'round';
            cvCtx.stroke();
            cvCtx.restore();
        }
    } else if (o.type === 'text') {
        // Jangan render jika sedang diedit secara inline (akan ditimpa overlay editor)
        if (o._editing) return;
        
        cvCtx.save();
        const fontStyle = o.italic ? 'italic ' : '';
        const weight = o.fontWeight || '400';
        const size = o.fontSize || 16;
        const fontFam = o.fontFamily || 'Inter, sans-serif';
        cvCtx.font = `${fontStyle}${weight} ${size}px ${fontFam}`;
        cvCtx.textAlign = o.textAlign || 'left';
        cvCtx.textBaseline = 'top';

        // Dukungan letterSpacing (jika ada dan didukung canvas)
        const letterSpacingVal = parseFloat(o.letterSpacing);
        if (isFinite(letterSpacingVal) && letterSpacingVal !== 0) {
            try { cvCtx.letterSpacing = `${letterSpacingVal}px`; } catch (_) {}
        } else {
            try { cvCtx.letterSpacing = '0px'; } catch (_) {}
        }

        // Tentukan warna fill: dukung SOLID maupun GRADIENT dari Paint.js
        const fills = (o.style && Array.isArray(o.style.fills)) ? o.style.fills : [];
        const topFill = fills.length > 0 ? fills[fills.length - 1] : null;

        if (topFill && topFill.type && topFill.type.startsWith('GRADIENT_')) {
            // Render text dengan fill gradient memakai paintShape / pattern
            if (topFill.type === 'GRADIENT_LINEAR') {
                const s = topFill.start || { x: 0, y: 0.5 },
                      e = topFill.end || { x: 1, y: 0.5 };
                const grad = cvCtx.createLinearGradient(
                    t.x + s.x * t.width, t.y + s.y * t.height,
                    t.x + e.x * t.width, t.y + e.y * t.height
                );
                const st = Paint.sortedStops(topFill);
                st.forEach(stop => {
                    const css = Paint.stopCss(stop, topFill.opacity == null ? 1 : topFill.opacity);
                    if (css) grad.addColorStop(stop.offset, css);
                });
                cvCtx.fillStyle = grad;
            } else if (topFill.type === 'GRADIENT_RADIAL') {
                const c = topFill.center || { x: 0.5, y: 0.5 };
                const grad = cvCtx.createRadialGradient(
                    t.x + c.x * t.width, t.y + c.y * t.height, 0,
                    t.x + c.x * t.width, t.y + c.y * t.height, Math.max(t.width, t.height) / 2
                );
                const st = Paint.sortedStops(topFill);
                st.forEach(stop => {
                    const css = Paint.stopCss(stop, topFill.opacity == null ? 1 : topFill.opacity);
                    if (css) grad.addColorStop(stop.offset, css);
                });
                cvCtx.fillStyle = grad;
            } else {
                cvCtx.fillStyle = '#000000';
            }
        } else if (topFill && topFill.color) {
            cvCtx.fillStyle = Paint.cssOf(topFill) || topFill.color;
        } else if (o.style && o.style.fill) {
            cvCtx.fillStyle = o.style.fill;
        } else if (o.color) {
            cvCtx.fillStyle = o.color;
        } else {
            cvCtx.fillStyle = '#FFFFFF';
        }

        const rawContent = o.content || '';
        const lineHeight = o.lineHeight || (size * 1.25);

        // Word wrap jika mode fixed dan batas lebar ditentukan
        const lines = [];
        if (o.resizing === 'fixed' && t.width > 20) {
            const rawParagraphs = rawContent.split('\n');
            rawParagraphs.forEach(para => {
                const words = para.split(' ');
                let curLine = '';
                words.forEach(w => {
                    const testLine = curLine ? (curLine + ' ' + w) : w;
                    const metrics = cvCtx.measureText(testLine);
                    if (metrics.width > t.width && curLine) {
                        lines.push(curLine);
                        curLine = w;
                    } else {
                        curLine = testLine;
                    }
                });
                if (curLine) lines.push(curLine);
                else if (!words.length || para === '') lines.push('');
            });
        } else {
            lines.push(...rawContent.split('\n'));
        }

        let renderX = t.x;
        if (o.textAlign === 'center') renderX = t.x + (t.width / 2);
        else if (o.textAlign === 'right') renderX = t.x + t.width;

        lines.forEach((line, idx) => {
            const lineY = t.y + (idx * lineHeight);
            cvCtx.fillText(line, renderX, lineY);

            // Dekorasi Underline & Strikethrough
            if (o.underline || o.strikethrough) {
                const m = cvCtx.measureText(line);
                let lineStartX = renderX;
                if (o.textAlign === 'center') lineStartX = renderX - (m.width / 2);
                else if (o.textAlign === 'right') lineStartX = renderX - m.width;

                cvCtx.save();
                cvCtx.strokeStyle = cvCtx.fillStyle;
                cvCtx.lineWidth = Math.max(1, size / 16);

                if (o.underline) {
                    const uY = lineY + size + 2;
                    cvCtx.beginPath();
                    cvCtx.moveTo(lineStartX, uY);
                    cvCtx.lineTo(lineStartX + m.width, uY);
                    cvCtx.stroke();
                }

                if (o.strikethrough) {
                    const sY = lineY + (size / 2);
                    cvCtx.beginPath();
                    cvCtx.moveTo(lineStartX, sY);
                    cvCtx.lineTo(lineStartX + m.width, sY);
                    cvCtx.stroke();
                }
                cvCtx.restore();
            }
        });

        cvCtx.restore();
    }
};


const getWorldBounds = (objId, list = State.objects, parentOffset = { x: 0, y: 0 }) => {
    for (const o of list) {
        if (!o || !o.transform) continue;
        const absX = parentOffset.x + o.transform.x;
        const absY = parentOffset.y + o.transform.y;
        if (o.id === objId) {
            return { x: absX, y: absY, width: o.transform.width, height: o.transform.height };
        }
        if (Array.isArray(o.children) && o.children.length > 0) {
            const res = getWorldBounds(objId, o.children, { x: absX, y: absY });
            if (res) return res;
        }
    }
    return null;
};

const drawSelection = () => {
    
    if (State.marquee) {
        const m = State.marquee;
        cvCtx.save();
        cvCtx.fillStyle = 'rgba(13, 153, 255, 0.12)';
        cvCtx.strokeStyle = '#0D99FF';
        cvCtx.lineWidth = Math.max(1 / State.zoom, 1 / (cvDpr * State.zoom));
        cvCtx.fillRect(m.x, m.y, m.width, m.height);
        cvCtx.strokeRect(m.x, m.y, m.width, m.height);
        cvCtx.restore();
    }

    
    if (!State.selectedIds || !State.selectedIds.length) return;

    const handleSize = 7 / State.zoom; 
    const half = handleSize / 2;
    const lw = 1 / State.zoom;

    State.selectedIds.forEach(id => {
        const bounds = getWorldBounds(id);
        if (!bounds) return;

        // Bounding box outline
        cvCtx.save();
        cvCtx.strokeStyle = '#0D99FF';
        cvCtx.lineWidth = lw;
        cvCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // 8 Handles ala Figma: 4 Sudut + 4 Sisi Tengah
        cvCtx.fillStyle = '#FFFFFF';
        const handles = [
            // Sudut: nw, ne, se, sw
            [bounds.x, bounds.y],
            [bounds.x + bounds.width, bounds.y],
            [bounds.x + bounds.width, bounds.y + bounds.height],
            [bounds.x, bounds.y + bounds.height],
            // Sisi: n, s, e, w
            [bounds.x + bounds.width / 2, bounds.y],
            [bounds.x + bounds.width / 2, bounds.y + bounds.height],
            [bounds.x + bounds.width, bounds.y + bounds.height / 2],
            [bounds.x, bounds.y + bounds.height / 2]
        ];
        handles.forEach(([cx, cy]) => {
            cvCtx.fillRect(cx - half, cy - half, handleSize, handleSize);
            cvCtx.strokeRect(cx - half, cy - half, handleSize, handleSize);
        });
        cvCtx.restore();
    });
};

const drawGuides = () => {
    const lw = 1 / State.zoom;
    const dpr = cvDpr || 1;

    // 1. Render Magnet / Snapping Lines
    if (window.Magnet && Array.isArray(window.Magnet.activeGuides) && window.Magnet.activeGuides.length > 0) {
        cvCtx.save();
        cvCtx.strokeStyle = '#FF0055'; // Figma-like bright alignment color
        cvCtx.lineWidth = lw;
        cvCtx.setLineDash([4 / State.zoom, 4 / State.zoom]);

        window.Magnet.activeGuides.forEach(g => {
            cvCtx.beginPath();
            if (g.type === 'v') {
                cvCtx.moveTo(g.pos, g.fromY);
                cvCtx.lineTo(g.pos, g.toY);
            } else if (g.type === 'h') {
                cvCtx.moveTo(g.fromX, g.pos);
                cvCtx.lineTo(g.toX, g.pos);
            }
            cvCtx.stroke();
        });
        cvCtx.restore();
    }

    // 2. Render Distance & Padding Measurements
    if (window.Padding && Array.isArray(window.Padding.activeMeasurements) && window.Padding.activeMeasurements.length > 0) {
        cvCtx.save();
        cvCtx.strokeStyle = '#FF0055';
        cvCtx.lineWidth = lw;

        window.Padding.activeMeasurements.forEach(m => {
            // Draw measurement line with end caps
            cvCtx.beginPath();
            cvCtx.moveTo(m.x1, m.y1);
            cvCtx.lineTo(m.x2, m.y2);
            cvCtx.stroke();

            // End caps (tick marks)
            const capSize = 3 / State.zoom;
            cvCtx.beginPath();
            if (m.orientation === 'h') {
                cvCtx.moveTo(m.x1, m.y1 - capSize);
                cvCtx.lineTo(m.x1, m.y1 + capSize);
                cvCtx.moveTo(m.x2, m.y2 - capSize);
                cvCtx.lineTo(m.x2, m.y2 + capSize);
            } else {
                cvCtx.moveTo(m.x1 - capSize, m.y1);
                cvCtx.lineTo(m.x1 + capSize, m.y1);
                cvCtx.moveTo(m.x2 - capSize, m.y2);
                cvCtx.lineTo(m.x2 + capSize, m.y2);
            }
            cvCtx.stroke();

            // Badge Teks Jarak (Pixel Pill)
            const text = `${Math.round(m.distance)}`;
            cvCtx.font = `600 ${Math.max(10, 11 / State.zoom)}px -apple-system, BlinkMacSystemFont, sans-serif`;
            const textMetrics = cvCtx.measureText(text);
            const textW = textMetrics.width;
            const textH = 12 / State.zoom;
            const padX = 4 / State.zoom;
            const padY = 2 / State.zoom;

            const badgeX = m.labelX - textW / 2 - padX;
            const badgeY = m.labelY - textH / 2 - padY;
            const badgeW = textW + padX * 2;
            const badgeH = textH + padY * 2;
            const radius = 3 / State.zoom;

            // Draw rounded pill background
            cvCtx.fillStyle = '#FF0055';
            cvCtx.beginPath();
            cvCtx.roundRect ? cvCtx.roundRect(badgeX, badgeY, badgeW, badgeH, radius) : cvCtx.rect(badgeX, badgeY, badgeW, badgeH);
            cvCtx.fill();

            // Draw text
            cvCtx.fillStyle = '#FFFFFF';
            cvCtx.textAlign = 'center';
            cvCtx.textBaseline = 'middle';
            cvCtx.fillText(text, m.labelX, m.labelY);
        });
        cvCtx.restore();
    }
};

const drawScene = () => {
    cvDirty = false;
    cvCtx.setTransform(1, 0, 0, 1, 0, 0);
    cvCtx.clearRect(0, 0, cvEl.width, cvEl.height);
    drawGrid(); 
    const k = cvDpr * State.zoom;
    cvCtx.setTransform(k, 0, 0, k, cvDpr * State.panX, cvDpr * State.panY);
    State.objects.forEach(drawObject);
    if (State.drawing) drawObject(State.drawing); 
    drawSelection(); 
    drawGuides();
};
const requestRender = () => {
    if (cvDirty) return;
    cvDirty = true;
    requestAnimationFrame(drawScene);
};

/* ---------- ukuran canvas ---------- */
const resizeCanvas = () => {
    cvW = Math.max(1, cvEl.clientWidth);
    cvH = Math.max(1, cvEl.clientHeight);
    cvDpr = Math.min(window.devicePixelRatio || 1, 2); 
    cvEl.width = Math.round(cvW * cvDpr); 
    cvEl.height = Math.round(cvH * cvDpr);
    requestRender();
};
new ResizeObserver(resizeCanvas).observe(cvEl);
resizeCanvas();
cvEl.style.touchAction = 'none'; 

/* ---------- zoom: titik di bawah anchor tetap di tempatnya ---------- */

State.zoom = getZoom() / 100;
$(document).on('zoom:change', (e, persen, anchor) => {
    const prev = State.zoom,
        next = persen / 100;
    if (next === prev) return;
    const ax = anchor ? anchor.x : cvW / 2,
        ay = anchor ? anchor.y : cvH / 2;
    State.panX = ax - (ax - State.panX) / prev * next;
    State.panY = ay - (ay - State.panY) / prev * next;
    State.zoom = next;
    requestRender();
});

/* ---------- wheel: Ctrl+wheel (juga pinch trackpad) = zoom, wheel biasa = geser ---------- */
cvEl.addEventListener('wheel', e => {
    e.preventDefault();
    const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cvH : 1; 
    const dx = e.deltaX * m,
        dy = e.deltaY * m;
    if (e.ctrlKey) {
        const r = cvEl.getBoundingClientRect(),
            cur = getZoom();
        let next = Math.round(cur * Math.exp(-dy * 0.002));
        if (next === cur && dy) next = cur + (dy < 0 ? 1 : -1); 
        setZoom(next, {
            x: e.clientX - r.left,
            y: e.clientY - r.top
        });
    } else {
        State.panX -= dx;
        State.panY -= dy;
        requestRender();
    }
}, {
    passive: false
});

/* ---------- pan dengan tombol tengah mouse (middle click) ---------- */
let isMiddlePanning = false,
    midStartX = 0,
    midStartY = 0;

cvEl.addEventListener('pointerdown', e => {
    if (e.button !== 1) return; 
    e.preventDefault();
    isMiddlePanning = true;
    midStartX = e.clientX;
    midStartY = e.clientY;
    cvEl.setPointerCapture(e.pointerId);
    cvEl.style.cursor = 'grabbing';
});

cvEl.addEventListener('pointermove', e => {
    if (!isMiddlePanning) return;
    const dx = e.clientX - midStartX,
        dy = e.clientY - midStartY;
    midStartX = e.clientX;
    midStartY = e.clientY;
    State.panX += dx;
    State.panY += dy;
    requestRender();
});

const endMiddlePan = e => {
    if (!isMiddlePanning) return;
    isMiddlePanning = false;
    cvEl.style.cursor = '';
};

cvEl.addEventListener('pointerup', e => {
    if (e.button === 1) endMiddlePan(e);
});
cvEl.addEventListener('pointercancel', endMiddlePan);
cvEl.addEventListener('auxclick', e => {
    if (e.button === 1) e.preventDefault(); 
});

/* ---------- render ulang saat data berubah ---------- */
$(document).on('project:load object:add object:change object:remove', requestRender);