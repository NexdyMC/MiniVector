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

        const singleLineH = lineHeight || (fontSize * 1.25);

        if (fixedWidth && fixedWidth > 20) {
            const lines = [];
            const rawParagraphs = rawContent.split('\n');
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
                width: fixedWidth,
                height: Math.ceil(lines.length * singleLineH) + 4
            };
        }

        const lines = rawContent.split('\n');
        let maxW = 20;
        lines.forEach(l => {
            const m = ctx.measureText(l);
            if (m.width > maxW) maxW = m.width;
        });

        const totalH = lines.length * singleLineH;
        return {
            width: Math.ceil(maxW) + 4,
            height: Math.ceil(totalH) + 2
        };
    };

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
            lineHeight: (obj.lineHeight ? (obj.lineHeight * State.zoom) : (screenFontSize * 1.25)) + 'px',
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

    // Klik kanvas saat tool 'text' aktif -> buat objek text baru
    cvEl.addEventListener('pointerdown', e => {
        if (State.tool !== TOOL || e.button !== 0) return;
        if (activeTextObj) {
            finishTextEditing();
            return;
        }

        const clickWorld = snapWorld(eventToWorld(e), e);
        const targetFrame = findFrameAt(clickWorld);

        const localX = targetFrame ? clickWorld.x - targetFrame.transform.x : clickWorld.x;
        const localY = targetFrame ? clickWorld.y - targetFrame.transform.y : clickWorld.y;

        const defaultContent = 'Type something';
        const defaultSize = 16;
        const defaultFont = 'Inter, sans-serif';
        const defaultWeight = '400';
        const dims = measureTextDimensions(defaultContent, defaultSize, defaultFont, defaultWeight);

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
            lineHeight: defaultSize * 1.25,
            transform: {
                x: localX,
                y: localY,
                width: dims.width,
                height: dims.height,
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
            targetFrame.children.push(newObj);
        } else {
            State.objects.push(newObj);
        }

        State.selectedIds = [newObj.id];
        $(document).trigger('object:add', [newObj]);
        $(document).trigger('selection:change');

        // Kembalikan ke tool 'select' seperti kebiasaan di Figma setelah menempatkan teks
        // Buka inline editor langsung
        setTimeout(() => {
            window.startTextEditing(newObj, targetFrame, true);
        }, 10);
    });

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
