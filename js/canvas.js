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
/* ---------- Image Cache untuk render gambar canvas tanpa lag ---------- */
const imageCache = new Map();
const getImageElement = (src) => {
    if (!src) return null;
    if (imageCache.has(src)) {
        return imageCache.get(src);
    }
    const img = new Image();
    img.src = src;
    img.onload = () => {
        if (typeof requestRender === 'function') requestRender();
    };
    imageCache.set(src, img);
    return img;
};

/* ---------- Stroke Style & Alignment Helper (Figma Style) ---------- */
const applyStrokeStyle = (ctx, style, box) => {
    const sw = (style.strokeWidth !== undefined ? style.strokeWidth : 1);
    ctx.lineWidth = sw;

    // Line cap & join
    const cap = style.strokeCap || 'round';
    ctx.lineCap = (cap === 'arrow') ? 'round' : (cap === 'butt' ? 'butt' : 'round');
    ctx.lineJoin = style.strokeJoin || 'round';

    // Dashed lines
    if (Array.isArray(style.strokeDashes) && style.strokeDashes.length > 0) {
        ctx.setLineDash(style.strokeDashes);
    } else {
        ctx.setLineDash([]);
    }

    // Hitung warna / gradient stroke
    const strokes = Array.isArray(style.strokes) && style.strokes.length > 0 ? style.strokes : null;
    let strokePaintApplied = false;

    if (strokes) {
        const top = strokes.slice().reverse().find(p => p.visible !== false);
        if (top) {
            if (top.type === 'SOLID') {
                const c = Color.parseHex(top.color) || Color.parseCss(top.color);
                if (c) {
                    const a = (top.opacity == null ? 1 : top.opacity) * c.a;
                    ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${+a.toFixed(4)})`;
                    strokePaintApplied = true;
                }
            } else if (Paint.isGradient(top) && box) {
                // Gradient stroke
                const { x, y, width: w, height: h } = box;
                if (top.type === 'GRADIENT_LINEAR') {
                    const s = top.start || { x: 0, y: 0.5 }, e = top.end || { x: 1, y: 0.5 };
                    const g = ctx.createLinearGradient(x + s.x * w, y + s.y * h, x + e.x * w, y + e.y * h);
                    Paint.sortedStops(top).forEach(st => g.addColorStop(st.offset, Paint.stopCss(st, top.opacity == null ? 1 : top.opacity)));
                    ctx.strokeStyle = g;
                    strokePaintApplied = true;
                }
            }
        }
    }

    if (!strokePaintApplied) {
        ctx.strokeStyle = style.stroke || '#000000';
    }

    return sw;
};

// Gambar ujung panah segitiga (Triangle Arrow ala Figma) di titik akhir (x2, y2) dari garis (x1, y1)
const drawArrowhead = (ctx, x1, y1, x2, y2, sw, strokeStyle) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLen = Math.max(10, sw * 3.5);
    const arrowHalfW = Math.max(5, sw * 2);

    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowLen, -arrowHalfW);
    ctx.lineTo(-arrowLen * 0.75, 0);
    ctx.lineTo(-arrowLen, arrowHalfW);
    ctx.closePath();

    ctx.fillStyle = strokeStyle || '#000000';
    ctx.fill();
    ctx.restore();
};

/* ---------- Effects Rendering Helpers (Figma Style) ---------- */
// Noise generator cache
const noiseCanvasCache = new Map();
const getNoisePattern = (ctx, amount, mode) => {
    const key = `${amount}_${mode}`;
    if (noiseCanvasCache.has(key)) return noiseCanvasCache.get(key);

    const size = 128;
    const nCv = document.createElement('canvas');
    nCv.width = size;
    nCv.height = size;
    const nCtx = nCv.getContext('2d');
    const imgData = nCtx.createImageData(size, size);
    const data = imgData.data;
    const factor = (amount || 15) / 100;

    for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < factor) {
            if (mode === 'color') {
                data[i] = Math.random() * 255;
                data[i + 1] = Math.random() * 255;
                data[i + 2] = Math.random() * 255;
            } else {
                const val = Math.random() * 255;
                data[i] = val;
                data[i + 1] = val;
                data[i + 2] = val;
            }
            data[i + 3] = Math.random() * 180 * factor;
        } else {
            data[i + 3] = 0;
        }
    }
    nCtx.putImageData(imgData, 0, 0);
    const pat = ctx.createPattern(nCv, 'repeat');
    noiseCanvasCache.set(key, pat);
    return pat;
};

// Texture generator cache
const textureCanvasCache = new Map();
const getTexturePattern = (ctx, patternType) => {
    if (textureCanvasCache.has(patternType)) return textureCanvasCache.get(patternType);
    const size = 64;
    const tCv = document.createElement('canvas');
    tCv.width = size;
    tCv.height = size;
    const tCtx = tCv.getContext('2d');

    if (patternType === 'dots') {
        tCtx.fillStyle = 'rgba(255,255,255,0.15)';
        for (let x = 8; x < size; x += 16) {
            for (let y = 8; y < size; y += 16) {
                tCtx.beginPath();
                tCtx.arc(x, y, 2.5, 0, Math.PI * 2);
                tCtx.fill();
            }
        }
    } else if (patternType === 'canvas') {
        tCtx.strokeStyle = 'rgba(255,255,255,0.08)';
        tCtx.lineWidth = 1;
        for (let i = 0; i < size; i += 4) {
            tCtx.beginPath();
            tCtx.moveTo(0, i);
            tCtx.lineTo(size, i);
            tCtx.stroke();
            tCtx.beginPath();
            tCtx.moveTo(i, 0);
            tCtx.lineTo(i, size);
            tCtx.stroke();
        }
    } else if (patternType === 'grunge') {
        tCtx.strokeStyle = 'rgba(255,255,255,0.1)';
        tCtx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            tCtx.beginPath();
            tCtx.moveTo(Math.random() * size, Math.random() * size);
            tCtx.lineTo(Math.random() * size, Math.random() * size);
            tCtx.stroke();
        }
    } else {
        // Paper grain default
        tCtx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let i = 0; i < 150; i++) {
            tCtx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
        }
    }

    const pat = ctx.createPattern(tCv, 'repeat');
    textureCanvasCache.set(patternType, pat);
    return pat;
};

// Pasang efek sebelum menggambar shape (Drop shadow, Layer blur)
const applyEffectsBefore = (ctx, style) => {
    const effects = Array.isArray(style && style.effects) ? style.effects : [];
    if (!effects.length) return;

    effects.forEach(fx => {
        if (fx.visible === false) return;
        if (fx.type === 'DROP_SHADOW') {
            const c = Color.parseHex(fx.color) || Color.parseCss(fx.color) || { r: 0, g: 0, b: 0, a: 1 };
            const op = (fx.opacity == null ? 0.25 : fx.opacity) * c.a;
            ctx.shadowColor = `rgba(${c.r}, ${c.g}, ${c.b}, ${+op.toFixed(3)})`;
            ctx.shadowBlur = Math.max(0, fx.blur || 0);
            ctx.shadowOffsetX = fx.x || 0;
            ctx.shadowOffsetY = fx.y || 0;
        } else if (fx.type === 'LAYER_BLUR') {
            const b = Math.max(0, fx.blur || 0);
            if (b > 0) {
                ctx.filter = `blur(${b}px)`;
            }
        }
    });
};

// Pasang efek sesudah shape digambar (Inner shadow, Noise, Texture, Glass, Shader)
const applyEffectsAfter = (ctx, style, box, tracePathFn) => {
    const effects = Array.isArray(style && style.effects) ? style.effects : [];
    if (!effects.length) return;

    effects.forEach(fx => {
        if (fx.visible === false) return;

        if (fx.type === 'INNER_SHADOW') {
            ctx.save();
            tracePathFn();
            ctx.clip();

            const c = Color.parseHex(fx.color) || Color.parseCss(fx.color) || { r: 0, g: 0, b: 0, a: 1 };
            const op = (fx.opacity == null ? 0.25 : fx.opacity) * c.a;
            const ox = fx.x || 0;
            const oy = fx.y || 0;
            const blur = Math.max(0, fx.blur || 0);
            const spread = fx.spread || 0;

            // Offset besar di luar batas untuk melemparkan bayangan ke dalam
            const offsetDist = 10000;
            ctx.shadowColor = `rgba(${c.r}, ${c.g}, ${c.b}, ${+op.toFixed(3)})`;
            ctx.shadowBlur = blur;
            ctx.shadowOffsetX = ox;
            ctx.shadowOffsetY = oy - offsetDist;

            ctx.beginPath();
            // Outer bounding box besar
            ctx.rect(box.x - 200, box.y - 200, box.width + 400, box.height + 400);
            tracePathFn();
            ctx.closePath();

            ctx.fillStyle = '#000000';
            ctx.translate(0, offsetDist);
            ctx.fill('evenodd');
            ctx.restore();
        } else if (fx.type === 'NOISE') {
            ctx.save();
            tracePathFn();
            ctx.clip();
            const pat = getNoisePattern(ctx, fx.amount || 15, fx.mode || 'monochrome');
            if (pat) {
                ctx.fillStyle = pat;
                ctx.fillRect(box.x, box.y, box.width, box.height);
            }
            ctx.restore();
        } else if (fx.type === 'TEXTURE') {
            ctx.save();
            tracePathFn();
            ctx.clip();
            const pat = getTexturePattern(ctx, fx.pattern || 'paper');
            if (pat) {
                ctx.globalAlpha = Math.min(1, Math.max(0, fx.opacity || 0.15));
                ctx.fillStyle = pat;
                ctx.fillRect(box.x, box.y, box.width, box.height);
            }
            ctx.restore();
        } else if (fx.type === 'GLASS') {
            ctx.save();
            tracePathFn();
            ctx.clip();

            // Glass specular gradient highlight di bagian atas
            const g = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.height);
            const tint = Color.parseHex(fx.tint || '#FFFFFF') || { r: 255, g: 255, b: 255, a: 1 };
            const op = Math.min(1, Math.max(0, fx.opacity == null ? 0.2 : fx.opacity));
            const shine = (fx.specular || 30) / 100;

            g.addColorStop(0, `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${+(op * shine).toFixed(3)})`);
            g.addColorStop(0.4, `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${+(op * 0.3).toFixed(3)})`);
            g.addColorStop(1, `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${+(op * 0.1).toFixed(3)})`);

            ctx.fillStyle = g;
            ctx.fillRect(box.x, box.y, box.width, box.height);

            // Specular border
            ctx.strokeStyle = `rgba(255, 255, 255, ${+(shine * 0.5).toFixed(2)})`;
            ctx.lineWidth = 1;
            tracePathFn();
            ctx.stroke();

            ctx.restore();
        } else if (fx.type === 'SHADER') {
            ctx.save();
            tracePathFn();
            ctx.clip();

            const st = fx.shaderType || 'wave';
            const intensity = (fx.intensity || 20) / 100;

            if (st === 'vignette') {
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                const r = Math.max(box.width, box.height) / 2;
                const radG = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
                radG.addColorStop(0, 'rgba(0,0,0,0)');
                radG.addColorStop(1, `rgba(0,0,0,${+intensity.toFixed(2)})`);
                ctx.fillStyle = radG;
                ctx.fillRect(box.x, box.y, box.width, box.height);
            } else if (st === 'chromatic') {
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `rgba(255, 0, 0, ${+(intensity * 0.4).toFixed(2)})`;
                ctx.fillRect(box.x - 3, box.y, box.width, box.height);
                ctx.fillStyle = `rgba(0, 0, 255, ${+(intensity * 0.4).toFixed(2)})`;
                ctx.fillRect(box.x + 3, box.y, box.width, box.height);
            } else if (st === 'duotone') {
                ctx.globalCompositeOperation = 'multiply';
                const dg = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
                dg.addColorStop(0, `rgba(255, 45, 85, ${+intensity.toFixed(2)})`);
                dg.addColorStop(1, `rgba(13, 153, 255, ${+intensity.toFixed(2)})`);
                ctx.fillStyle = dg;
                ctx.fillRect(box.x, box.y, box.width, box.height);
            } else {
                // Sine wave lines pattern overlay
                ctx.strokeStyle = `rgba(13, 153, 255, ${+(intensity * 0.5).toFixed(2)})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                const step = 8;
                for (let y = box.y; y < box.y + box.height; y += step) {
                    ctx.moveTo(box.x, y);
                    for (let x = box.x; x < box.x + box.width; x += 10) {
                        ctx.lineTo(x, y + Math.sin(x * 0.05) * 4);
                    }
                }
                ctx.stroke();
            }

            ctx.restore();
        }
    });
};

const drawObject = o => {
    if (!o || o.visible === false || !o.transform) return;
    const t = o.transform,
        s = o.style || {};

    const hasTransform = (t.rotation && t.rotation !== 0) || t.flipX || t.flipY;
    if (hasTransform) {
        cvCtx.save();
        const cx = t.x + t.width / 2;
        const cy = t.y + t.height / 2;
        cvCtx.translate(cx, cy);
        if (t.rotation) {
            cvCtx.rotate((t.rotation * Math.PI) / 180);
        }
        if (t.flipX || t.flipY) {
            cvCtx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
        }
        cvCtx.translate(-cx, -cy);
    }

    if (o.type === 'image') {
        const imgEl = getImageElement(o.src);
        if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
            cvCtx.save();
            const cr = (o.geometry && o.geometry.cornerRadius) || (s && s.cornerRadius) || 0;
            const radius = Array.isArray(cr) ? cr[0] : (parseFloat(cr) || 0);

            // Jika objek sedang di-crop secara aktif, jangan potong gambar dulu saat rendering objek utama
            // melainkan gambar akan digambar oleh drawCropOverlay
            const isBeingCropped = window.CropTool && window.CropTool.isActive() && window.CropTool.getTarget() && window.CropTool.getTarget().id === o.id;

            if (isBeingCropped) {
                // Di mode crop, canvas.js akan menggambar gambar penuh yang redup dan frame crop di atasnya
                cvCtx.restore();
                if (hasTransform) cvCtx.restore();
                return;
            }

            if (radius > 0 && typeof cvCtx.roundRect === 'function') {
                cvCtx.beginPath();
                cvCtx.roundRect(t.x, t.y, t.width, t.height, radius);
                cvCtx.clip();
            }

            const c = o.crop;
            if (c && typeof c.x === 'number' && typeof c.width === 'number' && c.width > 0 && c.height > 0) {
                // Gambar bagian crop dari gambar asli
                cvCtx.drawImage(imgEl, c.x, c.y, c.width, c.height, t.x, t.y, t.width, t.height);
            } else {
                cvCtx.drawImage(imgEl, t.x, t.y, t.width, t.height);
            }

            // Stroke jika ada
            const sw = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
            const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
            const traceImgBorder = () => {
                cvCtx.beginPath();
                if (radius > 0 && typeof cvCtx.roundRect === 'function') {
                    cvCtx.roundRect(t.x, t.y, t.width, t.height, radius);
                } else {
                    cvCtx.rect(t.x, t.y, t.width, t.height);
                }
            };

            // Pasang efek inner shadow, noise, texture, glass, shader
            applyEffectsAfter(cvCtx, s, t, traceImgBorder);

            if (hasStroke && sw > 0) {
                applyStrokeStyle(cvCtx, s, t);
                const align = s.strokeAlign || 'inside';

                if (align === 'inside') {
                    traceImgBorder();
                    cvCtx.clip();
                    cvCtx.lineWidth = sw * 2;
                    traceImgBorder();
                    cvCtx.stroke();
                } else if (align === 'outside') {
                    cvCtx.save();
                    cvCtx.beginPath();
                    cvCtx.rect(t.x - sw * 2, t.y - sw * 2, t.width + sw * 4, t.height + sw * 4);
                    traceImgBorder();
                    cvCtx.clip('evenodd');
                    cvCtx.lineWidth = sw * 2;
                    traceImgBorder();
                    cvCtx.stroke();
                    cvCtx.restore();
                } else {
                    traceImgBorder();
                    cvCtx.stroke();
                }
            }
            cvCtx.restore();
        } else {
            // Placeholder saat gambar sedang loading
            cvCtx.save();
            cvCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            cvCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            cvCtx.lineWidth = 1;
            cvCtx.fillRect(t.x, t.y, t.width, t.height);
            cvCtx.strokeRect(t.x, t.y, t.width, t.height);
            cvCtx.restore();
        }
    } else if (o.type === 'frame') {
        Paint.fillRect(cvCtx, s, t.x, t.y, t.width, t.height); 
        const sw = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
        const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
        if (hasStroke && sw > 0) {
            cvCtx.save();
            applyStrokeStyle(cvCtx, s, t);
            const align = s.strokeAlign || 'inside';
            if (align === 'inside') {
                cvCtx.beginPath();
                cvCtx.rect(t.x, t.y, t.width, t.height);
                cvCtx.clip();
                cvCtx.lineWidth = sw * 2;
                cvCtx.strokeRect(t.x, t.y, t.width, t.height);
            } else if (align === 'outside') {
                cvCtx.save();
                cvCtx.beginPath();
                cvCtx.rect(t.x - sw * 2, t.y - sw * 2, t.width + sw * 4, t.height + sw * 4);
                cvCtx.rect(t.x, t.y, t.width, t.height);
                cvCtx.clip('evenodd');
                cvCtx.lineWidth = sw * 2;
                cvCtx.strokeRect(t.x, t.y, t.width, t.height);
                cvCtx.restore();
            } else {
                cvCtx.strokeRect(t.x, t.y, t.width, t.height);
            }
            cvCtx.restore();
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
    } else if (o.type === 'group') {
        if (Array.isArray(o.children) && o.children.length > 0) {
            cvCtx.save();
            cvCtx.translate(t.x, t.y);
            o.children.forEach(drawObject);
            cvCtx.restore();
        }
    } else if (o.type === 'rectangle') {
        const cr = (o.geometry && o.geometry.cornerRadius) || (s && s.cornerRadius) || 0;
        const radius = Array.isArray(cr) ? cr[0] : (parseFloat(cr) || 0);
        const traceRect = () => {
            cvCtx.beginPath();
            if (radius > 0 && typeof cvCtx.roundRect === 'function') {
                cvCtx.roundRect(t.x, t.y, t.width, t.height, radius);
            } else {
                cvCtx.rect(t.x, t.y, t.width, t.height);
            }
        };

        cvCtx.save();
        applyEffectsBefore(cvCtx, s);
        Paint.fillRect(cvCtx, s, t.x, t.y, t.width, t.height); 
        cvCtx.restore();

        // Pasang efek inner shadow, noise, texture, glass, shader
        applyEffectsAfter(cvCtx, s, t, traceRect);

        const sw = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
        const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
        if (hasStroke && sw > 0) {
            cvCtx.save();
            applyStrokeStyle(cvCtx, s, t);
            const align = s.strokeAlign || 'inside';

            if (align === 'inside') {
                traceRect();
                cvCtx.clip();
                cvCtx.lineWidth = sw * 2;
                traceRect();
                cvCtx.stroke();
            } else if (align === 'outside') {
                cvCtx.save();
                cvCtx.beginPath();
                cvCtx.rect(t.x - sw * 2, t.y - sw * 2, t.width + sw * 4, t.height + sw * 4);
                if (radius > 0 && typeof cvCtx.roundRect === 'function') {
                    cvCtx.roundRect(t.x, t.y, t.width, t.height, radius);
                } else {
                    cvCtx.rect(t.x, t.y, t.width, t.height);
                }
                cvCtx.clip('evenodd');
                cvCtx.lineWidth = sw * 2;
                traceRect();
                cvCtx.stroke();
                cvCtx.restore();
            } else {
                traceRect();
                cvCtx.stroke();
            }
            cvCtx.restore();
        }
    } else if (o.type === 'ellipse') {
        const rx = Math.abs(t.width) / 2;
        const ry = Math.abs(t.height) / 2;
        const cx = t.x + rx;
        const cy = t.y + ry;

        const traceEllipse = () => {
            cvCtx.beginPath();
            cvCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        };

        cvCtx.save();
        applyEffectsBefore(cvCtx, s);
        traceEllipse();
        Paint.fillPath(cvCtx, s, t);
        cvCtx.restore();

        // Pasang efek inner shadow, noise, texture, glass, shader
        applyEffectsAfter(cvCtx, s, t, traceEllipse);

        const sw = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
        const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
        if (hasStroke && sw > 0) {
            cvCtx.save();
            applyStrokeStyle(cvCtx, s, t);
            const align = s.strokeAlign || 'inside';

            if (align === 'inside') {
                traceEllipse();
                cvCtx.clip();
                cvCtx.lineWidth = sw * 2;
                traceEllipse();
                cvCtx.stroke();
            } else if (align === 'outside') {
                cvCtx.save();
                cvCtx.beginPath();
                cvCtx.rect(t.x - sw * 2, t.y - sw * 2, t.width + sw * 4, t.height + sw * 4);
                cvCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                cvCtx.clip('evenodd');
                cvCtx.lineWidth = sw * 2;
                traceEllipse();
                cvCtx.stroke();
                cvCtx.restore();
            } else {
                traceEllipse();
                cvCtx.stroke();
            }
            cvCtx.restore();
        }
    } else if (o.type === 'line') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length >= 2) {
            cvCtx.save();
            const sw = applyStrokeStyle(cvCtx, s, t);
            const x1 = t.x + nodes[0].x, y1 = t.y + nodes[0].y;
            const x2 = t.x + nodes[1].x, y2 = t.y + nodes[1].y;

            cvCtx.beginPath();
            cvCtx.moveTo(x1, y1);
            cvCtx.lineTo(x2, y2);
            cvCtx.stroke();

            // Arrowhead jika cap === 'arrow'
            if (s.strokeCap === 'arrow') {
                drawArrowhead(cvCtx, x1, y1, x2, y2, sw, cvCtx.strokeStyle);
            }
            cvCtx.restore();
        }
    } else if (o.type === 'path') {
        const nodes = (o.geometry && o.geometry.nodes) || [];
        if (nodes.length >= 2) {
            cvCtx.save();
            cvCtx.beginPath();
            const startNode = nodes[0];
            cvCtx.moveTo(t.x + startNode.x, t.y + startNode.y);

            for (let i = 1; i < nodes.length; i++) {
                const prev = nodes[i - 1];
                const curr = nodes[i];
                if (prev.handleOut || curr.handleIn) {
                    const cp1x = t.x + (prev.handleOut ? prev.handleOut.x : prev.x);
                    const cp1y = t.y + (prev.handleOut ? prev.handleOut.y : prev.y);
                    const cp2x = t.x + (curr.handleIn ? curr.handleIn.x : curr.x);
                    const cp2y = t.y + (curr.handleIn ? curr.handleIn.y : curr.y);
                    cvCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, t.x + curr.x, t.y + curr.y);
                } else {
                    cvCtx.lineTo(t.x + curr.x, t.y + curr.y);
                }
            }

            if (o.closed && nodes.length > 2) {
                const last = nodes[nodes.length - 1];
                if (last.handleOut || startNode.handleIn) {
                    const cp1x = t.x + (last.handleOut ? last.handleOut.x : last.x);
                    const cp1y = t.y + (last.handleOut ? last.handleOut.y : last.y);
                    const cp2x = t.x + (startNode.handleIn ? startNode.handleIn.x : startNode.x);
                    const cp2y = t.y + (startNode.handleIn ? startNode.handleIn.y : startNode.y);
                    cvCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, t.x + startNode.x, t.y + startNode.y);
                }
                cvCtx.closePath();
            }

            // Fill (bila ada)
            if (s.fills && s.fills.length > 0) {
                Paint.fillPath(cvCtx, s, t);
            } else if (s.fill && s.fill !== 'none' && o.closed) {
                cvCtx.fillStyle = s.fill;
                cvCtx.fill();
            }

            // Stroke
            const sw = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
            const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
            if (sw > 0 && hasStroke) {
                const appliedSw = applyStrokeStyle(cvCtx, s, t);
                cvCtx.stroke();

                // Arrowhead jika tidak tertutup dan cap === 'arrow'
                if (!o.closed && s.strokeCap === 'arrow' && nodes.length >= 2) {
                    const last = nodes[nodes.length - 1];
                    const prev = nodes[nodes.length - 2];
                    drawArrowhead(cvCtx, t.x + prev.x, t.y + prev.y, t.x + last.x, t.y + last.y, appliedSw, cvCtx.strokeStyle);
                }
            }
            cvCtx.restore();
        }
    } else if (o.type === 'polygon' || o.type === 'star') {
        const w = t.width, h = t.height;
        if (w > 0 && h > 0) {
            cvCtx.save();
            const cx = t.x + w / 2;
            const cy = t.y + h / 2;
            const rx = w / 2;
            const ry = h / 2;
            const g = o.geometry || {};
            const count = Math.max(3, parseInt(g.pointCount, 10) || (o.type === 'polygon' ? 3 : 5));
            const radius = Math.max(0, parseFloat(g.cornerRadius) || 0);

            // Bangun titik-titik sudut
            const pts = [];
            if (o.type === 'polygon') {
                for (let i = 0; i < count; i++) {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
                    pts.push({
                        x: cx + rx * Math.cos(angle),
                        y: cy + ry * Math.sin(angle)
                    });
                }
            } else {
                // Star: titik luar dan dalam bergantian
                const ratio = Math.max(0.05, Math.min(0.95, (parseFloat(g.innerRadiusRatio) || 38.2) / 100));
                const totalPts = count * 2;
                for (let i = 0; i < totalPts; i++) {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalPts;
                    const rFactor = (i % 2 === 0) ? 1 : ratio;
                    pts.push({
                        x: cx + rx * rFactor * Math.cos(angle),
                        y: cy + ry * rFactor * Math.sin(angle)
                    });
                }
            }

            const tracePoly = () => {
                cvCtx.beginPath();
                if (radius > 0 && typeof cvCtx.roundRect === 'function' && pts.length >= 3) {
                    for (let i = 0; i < pts.length; i++) {
                        const p1 = pts[i];
                        const p2 = pts[(i + 1) % pts.length];
                        const p0 = pts[(i - 1 + pts.length) % pts.length];
                        if (i === 0) {
                            const midX = (p0.x + p1.x) / 2;
                            const midY = (p0.y + p1.y) / 2;
                            cvCtx.moveTo(midX, midY);
                        }
                        cvCtx.arcTo(p1.x, p1.y, p2.x, p2.y, radius);
                    }
                    cvCtx.closePath();
                } else {
                    pts.forEach((pt, i) => {
                        if (i === 0) cvCtx.moveTo(pt.x, pt.y);
                        else cvCtx.lineTo(pt.x, pt.y);
                    });
                    cvCtx.closePath();
                }
            };

            tracePoly();

            // Fills dengan efek bayangan luar & layer blur
            cvCtx.save();
            applyEffectsBefore(cvCtx, s);
            tracePoly();
            if (s.fills && s.fills.length > 0) {
                Paint.fillPath(cvCtx, s, t);
            } else if (s.fill && s.fill !== 'none') {
                cvCtx.fillStyle = s.fill;
                cvCtx.fill();
            }
            cvCtx.restore();

            // Pasang efek inner shadow, noise, texture, glass, shader
            applyEffectsAfter(cvCtx, s, t, tracePoly);

            // Stroke
            const sw = (s.strokeWidth !== undefined ? s.strokeWidth : 1);
            const hasStroke = (s.strokes && s.strokes.length > 0) || (s.stroke && s.stroke !== 'none');
            if (sw > 0 && hasStroke) {
                applyStrokeStyle(cvCtx, s, t);
                const align = s.strokeAlign || 'inside';
                if (align === 'inside') {
                    tracePoly();
                    cvCtx.clip();
                    cvCtx.lineWidth = sw * 2;
                    tracePoly();
                    cvCtx.stroke();
                } else if (align === 'outside') {
                    cvCtx.save();
                    cvCtx.beginPath();
                    cvCtx.rect(t.x - sw * 2, t.y - sw * 2, t.width + sw * 4, t.height + sw * 4);
                    tracePoly();
                    cvCtx.clip('evenodd');
                    cvCtx.lineWidth = sw * 2;
                    tracePoly();
                    cvCtx.stroke();
                    cvCtx.restore();
                } else {
                    tracePoly();
                    cvCtx.stroke();
                }
            }
            cvCtx.restore();
        }
    } else if (o.type === 'text') {
        // Jangan render jika sedang diedit secara inline (akan ditimpa overlay editor)
        if (o._editing) {
            if (hasTransform) cvCtx.restore();
            return;
        }
        
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

    if (hasTransform) {
        cvCtx.restore();
    }
};


const getWorldBounds = (objId, list = State.objects, parentOffset = { x: 0, y: 0 }) => {
    for (const o of list) {
        if (!o || !o.transform) continue;
        const absX = parentOffset.x + o.transform.x;
        const absY = parentOffset.y + o.transform.y;
        if (o.id === objId) {
            // Jika objek bertipe group dan memiliki children, hitung bounding box aktual dari anak-anaknya
            if (o.type === 'group' && Array.isArray(o.children) && o.children.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                o.children.forEach(c => {
                    if (!c.transform) return;
                    const cX = absX + c.transform.x;
                    const cY = absY + c.transform.y;
                    const cW = c.transform.width;
                    const cH = c.transform.height;
                    if (cX < minX) minX = cX;
                    if (cY < minY) minY = cY;
                    if (cX + cW > maxX) maxX = cX + cW;
                    if (cY + cH > maxY) maxY = cY + cH;
                });
                if (minX !== Infinity) {
                    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: o.transform.rotation || 0, obj: o };
                }
            }
            return { x: absX, y: absY, width: o.transform.width, height: o.transform.height, rotation: o.transform.rotation || 0, obj: o };
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

        const rot = bounds.rotation || 0;
        cvCtx.save();

        if (rot !== 0) {
            const cx = bounds.x + bounds.width / 2;
            const cy = bounds.y + bounds.height / 2;
            cvCtx.translate(cx, cy);
            cvCtx.rotate((rot * Math.PI) / 180);
            cvCtx.translate(-cx, -cy);
        }

        // Bounding box outline
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

    // -------------------------------------------------------------
    // FITUR: Tidy Up & Interactive Gap Dragging Handles (Ala Figma)
    // -------------------------------------------------------------
    if (State.selectedIds.length >= 2 && window.Padding && typeof window.Padding.calculateGapHandles === 'function') {
        const gapInfo = window.Padding.calculateGapHandles(State.selectedIds);
        if (gapInfo && gapInfo.handles.length > 0) {
            cvCtx.save();
            const pillRadius = 4 / State.zoom;

            gapInfo.handles.forEach(gh => {
                cvCtx.fillStyle = '#FF0055';
                cvCtx.strokeStyle = '#FFFFFF';
                cvCtx.lineWidth = 1.5 / State.zoom;

                if (gh.orientation === 'h') {
                    // Garis handle vertikal di antara celah horizontal
                    const hH = Math.min(36 / State.zoom, (gh.y2 - gh.y1) * 0.6);
                    const hW = 6 / State.zoom;
                    const hX = gh.x - hW / 2;
                    const hY = gh.y - hH / 2;

                    cvCtx.beginPath();
                    cvCtx.roundRect ? cvCtx.roundRect(hX, hY, hW, hH, pillRadius) : cvCtx.rect(hX, hY, hW, hH);
                    cvCtx.fill();
                    cvCtx.stroke();

                    // Tampilkan angka jarak jika gap > 0
                    if (gh.gap >= 0) {
                        const text = `${Math.round(gh.gap)}`;
                        cvCtx.font = `bold ${Math.max(10, 11 / State.zoom)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                        const textW = cvCtx.measureText(text).width;
                        const textH = 12 / State.zoom;
                        const padX = 4 / State.zoom;
                        const padY = 2 / State.zoom;

                        const bX = gh.x - textW / 2 - padX;
                        const bY = hY - textH - padY * 2 - 4 / State.zoom;
                        const bW = textW + padX * 2;
                        const bH = textH + padY * 2;

                        cvCtx.fillStyle = '#FF0055';
                        cvCtx.beginPath();
                        cvCtx.roundRect ? cvCtx.roundRect(bX, bY, bW, bH, 2.5 / State.zoom) : cvCtx.rect(bX, bY, bW, bH);
                        cvCtx.fill();

                        cvCtx.fillStyle = '#FFFFFF';
                        cvCtx.textAlign = 'center';
                        cvCtx.textBaseline = 'middle';
                        cvCtx.fillText(text, gh.x, bY + bH / 2);
                    }
                } else {
                    // Garis handle horizontal di antara celah vertikal
                    const hW = Math.min(36 / State.zoom, (gh.x2 - gh.x1) * 0.6);
                    const hH = 6 / State.zoom;
                    const hX = gh.x - hW / 2;
                    const hY = gh.y - hH / 2;

                    cvCtx.beginPath();
                    cvCtx.roundRect ? cvCtx.roundRect(hX, hY, hW, hH, pillRadius) : cvCtx.rect(hX, hY, hW, hH);
                    cvCtx.fill();
                    cvCtx.stroke();

                    // Tampilkan angka jarak jika gap > 0
                    if (gh.gap >= 0) {
                        const text = `${Math.round(gh.gap)}`;
                        cvCtx.font = `bold ${Math.max(10, 11 / State.zoom)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                        const textW = cvCtx.measureText(text).width;
                        const textH = 12 / State.zoom;
                        const padX = 4 / State.zoom;
                        const padY = 2 / State.zoom;

                        const bX = hX + hW + 6 / State.zoom;
                        const bY = gh.y - textH / 2 - padY;
                        const bW = textW + padX * 2;
                        const bH = textH + padY * 2;

                        cvCtx.fillStyle = '#FF0055';
                        cvCtx.beginPath();
                        cvCtx.roundRect ? cvCtx.roundRect(bX, bY, bW, bH, 2.5 / State.zoom) : cvCtx.rect(bX, bY, bW, bH);
                        cvCtx.fill();

                        cvCtx.fillStyle = '#FFFFFF';
                        cvCtx.textAlign = 'center';
                        cvCtx.textBaseline = 'middle';
                        cvCtx.fillText(text, bX + bW / 2, gh.y);
                    }
                }
            });

            // Tidy Up Button di sudut kanan bawah multi-seleksi jika jarak belum rapi (isEven === false)
            if (!gapInfo.isEven && typeof Geo !== 'undefined' && typeof Geo.selection === 'function') {
                const union = Geo.union(Geo.selection());
                if (union) {
                    const btnRadius = 9 / State.zoom;
                    const btnX = union.x + union.width + 14 / State.zoom;
                    const btnY = union.y + union.height + 14 / State.zoom;

                    cvCtx.fillStyle = '#FF0055';
                    cvCtx.beginPath();
                    cvCtx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
                    cvCtx.fill();
                    cvCtx.strokeStyle = '#FFFFFF';
                    cvCtx.lineWidth = 1.5 / State.zoom;
                    cvCtx.stroke();

                    // Tidy Up Grid Icon (3 baris kecil)
                    cvCtx.fillStyle = '#FFFFFF';
                    const barW = 8 / State.zoom;
                    const barH = 1.5 / State.zoom;
                    cvCtx.fillRect(btnX - barW / 2, btnY - 4 / State.zoom, barW, barH);
                    cvCtx.fillRect(btnX - barW / 2, btnY - 0.75 / State.zoom, barW, barH);
                    cvCtx.fillRect(btnX - barW / 2, btnY + 2.5 / State.zoom, barW, barH);
                }
            }

            cvCtx.restore();
        }
    }
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

    // 1b. Render Smart Equal Spacing Snapping Guides & Distance Badges
    if (window.Magnet && Array.isArray(window.Magnet.activeSpacingGuides) && window.Magnet.activeSpacingGuides.length > 0) {
        cvCtx.save();
        cvCtx.strokeStyle = '#FF0055';
        cvCtx.lineWidth = lw;

        window.Magnet.activeSpacingGuides.forEach(sg => {
            const capSize = 4 / State.zoom;

            sg.segments.forEach(seg => {
                cvCtx.beginPath();
                if (sg.orientation === 'h') {
                    // Garis horizontal antar objek
                    cvCtx.moveTo(seg.x1, seg.y);
                    cvCtx.lineTo(seg.x2, seg.y);
                    cvCtx.stroke();

                    // Ticks / end caps
                    cvCtx.beginPath();
                    cvCtx.moveTo(seg.x1, seg.y - capSize);
                    cvCtx.lineTo(seg.x1, seg.y + capSize);
                    cvCtx.moveTo(seg.x2, seg.y - capSize);
                    cvCtx.lineTo(seg.x2, seg.y + capSize);
                    cvCtx.stroke();

                    // Badge Jarak
                    const labelX = (seg.x1 + seg.x2) / 2;
                    const labelY = seg.y;
                    const text = `${Math.round(sg.gap)}`;
                    cvCtx.font = `600 ${Math.max(10, 11 / State.zoom)}px -apple-system, BlinkMacSystemFont, sans-serif`;
                    const textMetrics = cvCtx.measureText(text);
                    const textW = textMetrics.width;
                    const textH = 12 / State.zoom;
                    const padX = 4 / State.zoom;
                    const padY = 2 / State.zoom;

                    const badgeX = labelX - textW / 2 - padX;
                    const badgeY = labelY - textH / 2 - padY;
                    const badgeW = textW + padX * 2;
                    const badgeH = textH + padY * 2;
                    const radius = 3 / State.zoom;

                    cvCtx.fillStyle = '#FF0055';
                    cvCtx.beginPath();
                    cvCtx.roundRect ? cvCtx.roundRect(badgeX, badgeY, badgeW, badgeH, radius) : cvCtx.rect(badgeX, badgeY, badgeW, badgeH);
                    cvCtx.fill();

                    cvCtx.fillStyle = '#FFFFFF';
                    cvCtx.textAlign = 'center';
                    cvCtx.textBaseline = 'middle';
                    cvCtx.fillText(text, labelX, labelY);
                } else {
                    // Garis vertikal antar objek
                    cvCtx.moveTo(seg.x, seg.y1);
                    cvCtx.lineTo(seg.x, seg.y2);
                    cvCtx.stroke();

                    // Ticks / end caps
                    cvCtx.beginPath();
                    cvCtx.moveTo(seg.x - capSize, seg.y1);
                    cvCtx.lineTo(seg.x + capSize, seg.y1);
                    cvCtx.moveTo(seg.x - capSize, seg.y2);
                    cvCtx.lineTo(seg.x + capSize, seg.y2);
                    cvCtx.stroke();

                    // Badge Jarak
                    const labelX = seg.x;
                    const labelY = (seg.y1 + seg.y2) / 2;
                    const text = `${Math.round(sg.gap)}`;
                    cvCtx.font = `600 ${Math.max(10, 11 / State.zoom)}px -apple-system, BlinkMacSystemFont, sans-serif`;
                    const textMetrics = cvCtx.measureText(text);
                    const textW = textMetrics.width;
                    const textH = 12 / State.zoom;
                    const padX = 4 / State.zoom;
                    const padY = 2 / State.zoom;

                    const badgeX = labelX - textW / 2 - padX;
                    const badgeY = labelY - textH / 2 - padY;
                    const badgeW = textW + padX * 2;
                    const badgeH = textH + padY * 2;
                    const radius = 3 / State.zoom;

                    cvCtx.fillStyle = '#FF0055';
                    cvCtx.beginPath();
                    cvCtx.roundRect ? cvCtx.roundRect(badgeX, badgeY, badgeW, badgeH, radius) : cvCtx.rect(badgeX, badgeY, badgeW, badgeH);
                    cvCtx.fill();

                    cvCtx.fillStyle = '#FFFFFF';
                    cvCtx.textAlign = 'center';
                    cvCtx.textBaseline = 'middle';
                    cvCtx.fillText(text, labelX, labelY);
                }
            });
        });
        cvCtx.restore();
    }

    // 2. Render Distance & Padding Measurements
    if (window.Padding && Array.isArray(window.Padding.activeMeasurements) && window.Padding.activeMeasurements.length > 0) {
        cvCtx.save();

        // 2a. Gambar outline kotak target (Figma style red bounding box outline)
        if (window.Padding.targetBounds) {
            const tb = window.Padding.targetBounds;
            cvCtx.save();
            cvCtx.strokeStyle = '#FF0055';
            cvCtx.lineWidth = lw;
            cvCtx.strokeRect(tb.x, tb.y, tb.width, tb.height);
            cvCtx.restore();
        }

        cvCtx.strokeStyle = '#FF0055';
        cvCtx.lineWidth = lw;

        window.Padding.activeMeasurements.forEach(m => {
            // Draw measurement line with end caps
            cvCtx.beginPath();
            cvCtx.moveTo(m.x1, m.y1);
            cvCtx.lineTo(m.x2, m.y2);
            cvCtx.stroke();

            // End caps (tick marks pada ujung-ujung pengukuran)
            const capSize = 3.5 / State.zoom;
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

            // Badge Teks Jarak (Pixel Pill ala Figma)
            const text = `${Math.round(m.distance)}`;
            cvCtx.font = `bold ${Math.max(10, 11 / State.zoom)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            const textMetrics = cvCtx.measureText(text);
            const textW = textMetrics.width;
            const textH = 12 / State.zoom;
            const padX = 4.5 / State.zoom;
            const padY = 2 / State.zoom;

            const badgeX = m.labelX - textW / 2 - padX;
            const badgeY = m.labelY - textH / 2 - padY;
            const badgeW = textW + padX * 2;
            const badgeH = textH + padY * 2;
            const radius = 2.5 / State.zoom;

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
    if (typeof window.drawPenOverlay === 'function') {
        window.drawPenOverlay(cvCtx, State.zoom);
    }
    if (window.CropTool && typeof window.CropTool.drawOverlay === 'function') {
        window.CropTool.drawOverlay(cvCtx, State.zoom);
    }
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
    $(document).trigger('camera:change');
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
        $(document).trigger('camera:change');
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
    $(document).trigger('camera:change');
};

cvEl.addEventListener('pointerup', e => {
    if (e.button === 1) endMiddlePan(e);
});
cvEl.addEventListener('pointercancel', endMiddlePan);
cvEl.addEventListener('auxclick', e => {
    if (e.button === 1) e.preventDefault(); 
});

/* ---------- DRAG & DROP GAMBAR KE CANVAS DENGAN VISUAL FEEDBACK ---------- */
(() => {
    const overlay = document.getElementById('drag-overlay');
    let dragCounter = 0;

    const isImageTransfer = e => {
        const dt = e.dataTransfer;
        if (!dt) return false;
        if (dt.types) {
            for (let i = 0; i < dt.types.length; i++) {
                if (dt.types[i] === 'Files') return true;
            }
        }
        return false;
    };

    window.addEventListener('dragenter', e => {
        if (!isImageTransfer(e)) return;
        e.preventDefault();
        dragCounter++;
        if (overlay) overlay.classList.add('active');
    });

    window.addEventListener('dragover', e => {
        if (!isImageTransfer(e)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (overlay && !overlay.classList.contains('active')) {
            overlay.classList.add('active');
        }
    });

    window.addEventListener('dragleave', e => {
        if (!isImageTransfer(e)) return;
        e.preventDefault();
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0 && overlay) {
            overlay.classList.remove('active');
        }
    });

    window.addEventListener('drop', e => {
        dragCounter = 0;
        if (overlay) overlay.classList.remove('active');

        // Jika dilepas di dropzone modal import, biarkan handler dropzone modal bekerja
        if (e.target && e.target.closest && e.target.closest('#dropzone')) {
            return;
        }

        e.preventDefault();

        const dt = e.dataTransfer;
        if (!dt || !dt.files || !dt.files.length) return;

        // Ambil file gambar pertama yang sesuai
        const file = Array.from(dt.files).find(f => f.type.startsWith('image/'));
        if (!file) return;

        // Hitung posisi kursor saat di-drop dalam koordinat world canvas
        const rect = cvEl.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;

        // Jika dilepas di luar area canvas (misal di sidebar), defaultkan ke tengah viewport
        let worldDropPos = null;
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            worldDropPos = eventToWorld(e);
        }

        const reader = new FileReader();
        reader.onload = ev => {
            const dataUrl = ev.target.result;
            if (window.ImageTool && typeof window.ImageTool.placeImageAt === 'function') {
                window.ImageTool.placeImageAt(dataUrl, file.name, worldDropPos);
            }
        };
        reader.readAsDataURL(file);
    });
})();

/* ---------- render ulang saat data berubah ---------- */
$(document).on('project:load object:add object:change object:remove', requestRender);