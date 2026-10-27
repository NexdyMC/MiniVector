/* ================= TOOL: TEXT ================= */
// Mengelola interaksi:
// 1. Tool Text aktif ('text') -> klik kanvas / frame -> inline textarea overlay untuk mengetik
// 2. Auto-size kotak teks berdasarkan canvas measureText
// 3. Teks selesai diketik -> simpan objek tipe 'text' ke State.objects atau anak Frame
// 4. Double click pada teks dengan tool select -> masuk mode editing
(function () {
    const TOOL = 'text';

    // Buat inline editor overlay sekali di dalam #workspace
    const $workspace = $('#workspace');
    let $editor = $('#text-inline-editor');
    if (!$editor.length) {
        $editor = $('<textarea id="text-inline-editor" spellcheck="false" autocomplete="off"></textarea>').appendTo($workspace);
        $editor.css({
            position: 'absolute',
            display: 'none',
            zIndex: 50,
            background: 'transparent',
            border: '1px dashed #0D99FF',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            padding: '0px',
            margin: '0px',
            lineHeight: '1.25',
            color: '#ffffff',
            boxSizing: 'border-box'
        });
    }

    let activeTextObj = null;
    let editingParentFrame = null;
    let isCreatingNew = false;

    // Helper ukur teks di canvas 2D
    const measureTextDimensions = (text, fontSize, fontFamily, fontWeight, lineHeight = null, letterSpacing = 0, italic = false, fixedWidth = null) => {
        const rawContent = text || 'Text';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontStyle = italic ? 'italic ' : '';
        ctx.font = `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;
        try { ctx.letterSpacing = `${letterSpacing || 0}px`; } catch (_) {}

        const formatted = (typeof window.getFormattedTextContent === 'function')
            ? window.getFormattedTextContent(rawContent)
            : rawContent;
        const singleLineH = lineHeight || (fontSize * 1.2);

        if (fixedWidth && fixedWidth > 20) {
            const lines = [];
            const rawParagraphs = formatted.split('\n');
            rawParagraphs.forEach(para => {
                const words = para.split(' ');
                let curLine = '';
                words.forEach(w => {
                    const testLine = curLine ? (curLine + ' ' + w) : w;
                    if (ctx.measureText(testLine).width > fixedWidth && curLine) {
                        lines.push(curLine);
                        curLine = w;
                    } else {
                        curLine = testLine;
                    }
                });
                if (curLine) lines.push(curLine);
                else lines.push('');
            });
            return {
                width: Math.ceil(fixedWidth),
                height: Math.ceil(Math.max(1, lines.length) * singleLineH)
            };
        }

        const lines = formatted.split('\n');
        let maxW = 0;
        lines.forEach(l => {
            const m = ctx.measureText(l);
            if (m.width > maxW) maxW = m.width;
        });

        const totalH = Math.max(1, lines.length) * singleLineH;
        return {
            width: Math.ceil(maxW),
            height: Math.ceil(totalH)
        };
    };
    window.measureTextDimensions = measureTextDimensions;

    // Cari Frame di bawah koordinat dunia
    const findFrameAt = (pt) => {
        for (let i = State.objects.length - 1; i >= 0; i--) {
            const obj = State.objects[i];
            if (!obj || obj.type !== 'frame' || obj.visible === false || obj.locked === true || !obj.transform) continue;
            const t = obj.transform;
            if (pt.x >= t.x && pt.x <= t.x + t.width && pt.y >= t.y && pt.y <= t.y + t.height) {
                return obj;
            }
        }
        return null;
    };

    // Buka editor inline di posisi dunia teks
    window.startTextEditing = (obj, parentFrame = null, isNew = false) => {
        if (!obj || obj.locked || obj.visible === false) return;

        activeTextObj = obj;
        editingParentFrame = parentFrame;
        isCreatingNew = isNew;
        obj._editing = true;

        const parentOffset = parentFrame ? { x: parentFrame.transform.x, y: parentFrame.transform.y } : { x: 0, y: 0 };
        const worldX = parentOffset.x + obj.transform.x;
        const worldY = parentOffset.y + obj.transform.y;

        const screenPos = worldToScreen(worldX, worldY);
        const screenW = Math.max(80, (obj.transform.width || 100) * State.zoom);
        const screenH = Math.max(30, (obj.transform.height || 30) * State.zoom);

        const screenFontSize = (obj.fontSize || 16) * State.zoom;

        // Ambil warna fill
        let color = '#ffffff';
        if (obj.style && Array.isArray(obj.style.fills) && obj.style.fills.length > 0) {
            const topFill = obj.style.fills[obj.style.fills.length - 1];
            if (topFill && topFill.color) color = topFill.color;
        } else if (obj.style && obj.style.fill) {
            color = obj.style.fill;
        } else if (obj.color) {
            color = obj.color;
        }

        $editor.val(obj.content || '').css({
            display: 'block',
            left: screenPos.x + 'px',
            top: screenPos.y + 'px',
            width: screenW + 'px',
            height: screenH + 'px',
            fontSize: screenFontSize + 'px',
            fontFamily: obj.fontFamily || 'Inter, sans-serif',
            fontStyle: obj.italic ? 'italic' : 'normal',
            fontWeight: obj.fontWeight || '400',
            textAlign: obj.textAlign || 'left',
            letterSpacing: (obj.letterSpacing || 0) * State.zoom + 'px',
            lineHeight: (obj.lineHeight ? (obj.lineHeight * State.zoom) : (screenFontSize * 1.2)) + 'px',
            textDecoration: (obj.underline && obj.strikethrough) ? 'underline line-through' : (obj.underline ? 'underline' : (obj.strikethrough ? 'line-through' : 'none')),
            color: color
        }).focus();

        // Otomatis select all jika teks baru default
        if (isNew) {
            $editor.select();
        }

        requestRender();
    };

    const finishTextEditing = () => {
        if (!activeTextObj) return;

        const textVal = $editor.val().trim();
        const obj = activeTextObj;
        obj._editing = false;
        $editor.hide();

        if (!textVal) {
            // Jika kosong dan merupakan objek baru yang belum di-commit, batalkan/hapus
            if (isCreatingNew) {
                if (editingParentFrame && Array.isArray(editingParentFrame.children)) {
                    const idx = editingParentFrame.children.indexOf(obj);
                    if (idx >= 0) editingParentFrame.children.splice(idx, 1);
                } else {
                    const idx = State.objects.indexOf(obj);
                    if (idx >= 0) State.objects.splice(idx, 1);
                }
                State.selectedIds = [];
            }
        } else {
            obj.content = textVal;
            // Update dimensi bounding box
            const fixedW = obj.resizing === 'fixed' ? obj.transform.width : null;
            const dims = measureTextDimensions(
                obj.content,
                obj.fontSize || 16,
                obj.fontFamily || 'Inter, sans-serif',
                obj.fontWeight || '400',
                obj.lineHeight,
                obj.letterSpacing || 0,
                !!obj.italic,
                fixedW
            );
            obj.transform.width = dims.width;
            obj.transform.height = dims.height;

            State.selectedIds = [obj.id];
            $(document).trigger('object:change');
            $(document).trigger('selection:change');
        }

        if (isCreatingNew) {
            State.tool = 'select';
            $('#toolbar .tool').removeClass('active');
            $(`#toolbar .tool[data-tool="select"]`).addClass('active');
            $(document).trigger('tool:change', ['select']);
        }

        activeTextObj = null;
        editingParentFrame = null;
        isCreatingNew = false;
        requestRender();
    };

    // Auto resize textarea saat user mengetik
    $editor.on('input', function () {
        if (!activeTextObj) return;
        const val = this.value;
        const fixedW = activeTextObj.resizing === 'fixed' ? activeTextObj.transform.width : null;
        const dims = measureTextDimensions(
            val,
            activeTextObj.fontSize || 16,
            activeTextObj.fontFamily || 'Inter, sans-serif',
            activeTextObj.fontWeight || '400',
            activeTextObj.lineHeight,
            activeTextObj.letterSpacing || 0,
            !!activeTextObj.italic,
            fixedW
        );
        const screenW = Math.max(80, dims.width * State.zoom);
        const screenH = Math.max(30, dims.height * State.zoom);
        $editor.css({ width: screenW + 'px', height: screenH + 'px' });
    });

    // Selesai jika blur atau tekan Esc (Enter membuat baris baru, Shift+Enter juga)
    $editor.on('blur', finishTextEditing);
    $editor.on('keydown', function (e) {
        if (e.key === 'Escape') {
            finishTextEditing();
        }
    });

    // Update posisi textarea overlay saat zoom atau pan canvas
    $(document).on('zoom:change canvas:pan', function () {
        if (!activeTextObj || $editor.is(':hidden')) return;
        const parentOffset = editingParentFrame ? { x: editingParentFrame.transform.x, y: editingParentFrame.transform.y } : { x: 0, y: 0 };
        const worldX = parentOffset.x + activeTextObj.transform.x;
        const worldY = parentOffset.y + activeTextObj.transform.y;
        const screenPos = worldToScreen(worldX, worldY);
        const screenFontSize = (activeTextObj.fontSize || 16) * State.zoom;
        const dims = measureTextDimensions($editor.val(), activeTextObj.fontSize || 16, activeTextObj.fontFamily || 'Inter, sans-serif', activeTextObj.fontWeight || '400');
        $editor.css({
            left: screenPos.x + 'px',
            top: screenPos.y + 'px',
            fontSize: screenFontSize + 'px',
            width: Math.max(80, dims.width * State.zoom) + 'px',
            height: Math.max(30, dims.height * State.zoom) + 'px'
        });
    });

    // Drag to create Text Box ala Figma (Click = Auto width, Drag = Fixed width text box)
    let isDraggingText = false;
    let dragStartWorld = null;

    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0) return;
        if (activeTextObj) {
            finishTextEditing();
            return;
        }

        dragStartWorld = snapWorld(eventToWorld(e), e);
        isDraggingText = true;
        State.marquee = { x: dragStartWorld.x, y: dragStartWorld.y, width: 0, height: 0 };
        cvEl.setPointerCapture(e.pointerId);
    });

    cvEl.addEventListener('pointermove', e => {
        if (!isDraggingText || !dragStartWorld) return;

        const curWorld = snapWorld(eventToWorld(e), e);
        const x = Math.min(dragStartWorld.x, curWorld.x);
        const y = Math.min(dragStartWorld.y, curWorld.y);
        const width = Math.abs(curWorld.x - dragStartWorld.x);
        const height = Math.abs(curWorld.y - dragStartWorld.y);

        State.marquee = { x, y, width, height };

        // Tampilkan distance / smart guides ke objek lain jika menekan Alt atau drag
        if (window.Padding && window.Padding.enabled && width > 10 && height > 10) {
            const dragBox = { x, y, width, height };
            let nearest = null;
            let minDist = Infinity;
            State.objects.forEach(o => {
                if (!o.visible || o.locked || !o.transform) return;
                const b = getWorldBounds(o.id);
                if (!b) return;
                const dx = Math.min(Math.abs(b.x - (x + width)), Math.abs((b.x + b.width) - x));
                const dy = Math.min(Math.abs(b.y - (y + height)), Math.abs((b.y + b.height) - y));
                const d = Math.hypot(dx, dy);
                if (d < minDist && d < (250 / State.zoom)) {
                    minDist = d;
                    nearest = b;
                }
            });
            if (nearest) {
                window.Padding.measureBetween(dragBox, nearest);
            } else {
                window.Padding.clear();
            }
        }

        requestRender();
    });

    const onPointerUpText = e => {
        if (!isDraggingText || !dragStartWorld) return;
        isDraggingText = false;
        try { cvEl.releasePointerCapture(e.pointerId); } catch (_) {}

        const marqueeBox = State.marquee;
        State.marquee = null;
        if (window.Padding) window.Padding.clear();

        const endWorld = snapWorld(eventToWorld(e), e);
        const dragDist = Math.hypot(endWorld.x - dragStartWorld.x, endWorld.y - dragStartWorld.y);
        const isDragged = dragDist > 8 && marqueeBox && marqueeBox.width > 30;

        const spawnX = isDragged ? marqueeBox.x : dragStartWorld.x;
        const spawnY = isDragged ? marqueeBox.y : dragStartWorld.y;
        const targetFrame = findFrameAt({ x: spawnX, y: spawnY });

        const localX = targetFrame ? spawnX - targetFrame.transform.x : spawnX;
        const localY = targetFrame ? spawnY - targetFrame.transform.y : spawnY;

        const defaultContent = 'Type something';
        const defaultSize = 16;
        const defaultFont = 'Inter, sans-serif';
        const defaultWeight = '400';
        const defaultLineHeight = defaultSize * 1.2;

        const dims = measureTextDimensions(
            defaultContent, 
            defaultSize, 
            defaultFont, 
            defaultWeight, 
            defaultLineHeight, 
            0, 
            false, 
            isDragged ? marqueeBox.width : null
        );

        const finalW = isDragged ? Math.max(marqueeBox.width, dims.width) : dims.width;
        const finalH = isDragged ? Math.max(marqueeBox.height, dims.height) : dims.height;

        const n = newObjectId();
        const newObj = {
            id: 'text-' + n,
            type: 'text',
            name: 'Text ' + n,
            visible: true,
            locked: false,
            content: defaultContent,
            fontSize: defaultSize,
            fontFamily: defaultFont,
            fontWeight: defaultWeight,
            textAlign: 'left',
            verticalAlign: 'top',
            resizing: isDragged ? 'fixed' : 'auto',
            lineHeight: defaultLineHeight,
            transform: {
                x: localX,
                y: localY,
                width: Math.round(finalW),
                height: Math.round(finalH),
                rotation: 0
            },
            style: {
                fill: '#FFFFFF',
                fills: [
                    { id: 'fill-' + newObjectId(), type: 'SOLID', color: '#FFFFFF', opacity: 1, visible: true }
                ]
            }
        };

        if (targetFrame) {
            if (!Array.isArray(targetFrame.children)) targetFrame.children = [];
            if (window.LayoutEngine && targetFrame.layout && targetFrame.layout.display !== 'none') {
                const slot = window.LayoutEngine.getNextSlotPosition(targetFrame, newObj.transform.width, newObj.transform.height);
                newObj.transform.x = slot.x;
                newObj.transform.y = slot.y;
                targetFrame.children.push(newObj);
                window.LayoutEngine.applyAutoLayout(targetFrame);
            } else {
                targetFrame.children.push(newObj);
            }
        } else {
            State.objects.push(newObj);
        }

        State.selectedIds = [newObj.id];
        $(document).trigger('object:add', [newObj]);
        $(document).trigger('selection:change');

        // Buka inline editor langsung
        setTimeout(() => {
            window.startTextEditing(newObj, targetFrame, true);
        }, 10);

        dragStartWorld = null;
        requestRender();
    };

    cvEl.addEventListener('pointerup', onPointerUpText);
    cvEl.addEventListener('pointercancel', onPointerUpText);

    // Shortcut 'T' untuk mengaktifkan tool text
    $(document).on('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.key === 't' || e.key === 'T') {
            State.tool = TOOL;
            $('#toolbar .tool').removeClass('active');
            $(`#toolbar .tool[data-tool="text"]`).addClass('active');
            $(document).trigger('tool:change', [TOOL]);
        }
    });

})();
