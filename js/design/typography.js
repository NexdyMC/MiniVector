/* ================= DESIGN: TYPOGRAPHY ================= */
// Panel kanan -> Design -> Typography
// Mengatur font-family, font-weight, font-size, line-height, letter-spacing, text-align, dekorasi, dan resizing
$(function () {
    const $sec = $('#sec-typography');
    if (!$sec.length) return;

    const $font = $('#prop-font'),
        $weight = $('#prop-fontweight'),
        $size = $('#prop-fontsize'),
        $lineHeight = $('#prop-lineheight'),
        $letterSpacing = $('#prop-letterspacing'),
        $alignButtons = $('#text-align-seg button'),
        $styleButtons = $('#text-style-seg button'),
        $resizeButtons = $('#text-resize-seg button');

    // Ambil objek teks yang sedang dipilih
    const selectedTextObjects = () => {
        if (!State.selectedIds || !State.selectedIds.length) return [];
        return State.selectedIds.map(id => {
            const found = Geo.find(String(id));
            return found && found.obj && found.obj.type === 'text' ? found.obj : null;
        }).filter(Boolean);
    };

    // Sinkronisasi form dengan objek yang dipilih
    const refresh = () => {
        const texts = selectedTextObjects();
        if (!texts.length) {
            $sec.hide();
            return;
        }

        $sec.show();
        const first = texts[0];

        $font.val(first.fontFamily || 'Inter, sans-serif');
        $weight.val(String(first.fontWeight || '400'));
        $size.val(first.fontSize || 16);

        // Line height
        if (first.lineHeightCustom) {
            $lineHeight.val(first.lineHeight);
        } else {
            $lineHeight.val('Auto');
        }

        // Letter spacing
        $letterSpacing.val(first.letterSpacing || 0);

        // Text Align
        const align = first.textAlign || 'left';
        $alignButtons.removeClass('on');
        $alignButtons.filter(`[data-align="${align}"]`).addClass('on');

        // Style buttons (Underline, Strikethrough, Italic)
        $styleButtons.filter('[data-style="underline"]').toggleClass('on', !!first.underline);
        $styleButtons.filter('[data-style="strikethrough"]').toggleClass('on', !!first.strikethrough);
        $styleButtons.filter('[data-style="italic"]').toggleClass('on', !!first.italic);

        // Resize buttons
        const resizeMode = first.resizing || 'auto';
        $resizeButtons.removeClass('on');
        $resizeButtons.filter(`[data-resize="${resizeMode}"]`).addClass('on');
    };

    Geo.watch(refresh);
    $(document).on('selection:change object:change', refresh);

    // Helper update dimensi teks saat font/size/spacing berubah
    const updateDimensions = (obj) => {
        if (obj.resizing === 'fixed') {
            // Mode fixed: lebar tetap dipertahankan, hanya hitung tinggi baris
            const rawContent = obj.content || 'Text';
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const fontStyle = obj.italic ? 'italic ' : '';
            ctx.font = `${fontStyle}${obj.fontWeight || '400'} ${obj.fontSize || 16}px ${obj.fontFamily || 'Inter, sans-serif'}`;
            try { ctx.letterSpacing = `${obj.letterSpacing || 0}px`; } catch (_) {}

            const lines = [];
            const rawParagraphs = rawContent.split('\n');
            const wLimit = Math.max(20, obj.transform.width);

            rawParagraphs.forEach(para => {
                const words = para.split(' ');
                let curLine = '';
                words.forEach(w => {
                    const testLine = curLine ? (curLine + ' ' + w) : w;
                    if (ctx.measureText(testLine).width > wLimit && curLine) {
                        lines.push(curLine);
                        curLine = w;
                    } else {
                        curLine = testLine;
                    }
                });
                if (curLine) lines.push(curLine);
                else lines.push('');
            });

            const lh = obj.lineHeight || ((obj.fontSize || 16) * 1.25);
            obj.transform.height = Math.ceil(lines.length * lh) + 4;
            return;
        }

        // Mode auto: hitung lebar terpanjang dan tinggi total
        const lines = (obj.content || 'Text').split('\n');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontStyle = obj.italic ? 'italic ' : '';
        ctx.font = `${fontStyle}${obj.fontWeight || '400'} ${obj.fontSize || 16}px ${obj.fontFamily || 'Inter, sans-serif'}`;
        try { ctx.letterSpacing = `${obj.letterSpacing || 0}px`; } catch (_) {}

        let maxW = 20;
        lines.forEach(l => {
            const m = ctx.measureText(l);
            if (m.width > maxW) maxW = m.width;
        });

        const lh = obj.lineHeight || ((obj.fontSize || 16) * 1.25);
        obj.transform.width = Math.ceil(maxW) + 4;
        obj.transform.height = Math.ceil(lines.length * lh) + 2;
    };

    // Event handlers perubahan properti
    $font.on('change', function () {
        const val = this.value;
        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.fontFamily = val;
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    $weight.on('change', function () {
        const val = this.value;
        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.fontWeight = val;
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    $size.on('input change', function () {
        const val = Math.max(6, Math.min(256, parseFloat(this.value) || 16));
        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.fontSize = val;
            if (!t.lineHeightCustom) {
                t.lineHeight = val * 1.25;
            }
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    $lineHeight.on('change', function () {
        const val = this.value.trim().toLowerCase();
        const texts = selectedTextObjects();
        texts.forEach(t => {
            if (val === 'auto' || val === '' || isNaN(parseFloat(val))) {
                t.lineHeightCustom = false;
                t.lineHeight = (t.fontSize || 16) * 1.25;
            } else {
                t.lineHeightCustom = true;
                t.lineHeight = Math.max(8, parseFloat(val));
            }
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    $letterSpacing.on('input change', function () {
        const val = parseFloat(this.value) || 0;
        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.letterSpacing = val;
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    $alignButtons.on('click', function () {
        const align = $(this).data('align');
        if (!align) return;

        $alignButtons.removeClass('on');
        $(this).addClass('on');

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.textAlign = align;
        });
        $(document).trigger('object:change');
        requestRender();
    });

    // Style buttons toggle (Underline, Strikethrough, Italic)
    $styleButtons.on('click', function () {
        const style = $(this).data('style');
        if (!style) return;

        const isNowOn = !$(this).hasClass('on');
        $(this).toggleClass('on', isNowOn);

        const texts = selectedTextObjects();
        texts.forEach(t => {
            if (style === 'underline') t.underline = isNowOn;
            else if (style === 'strikethrough') t.strikethrough = isNowOn;
            else if (style === 'italic') {
                t.italic = isNowOn;
                updateDimensions(t);
            }
        });
        $(document).trigger('object:change');
        requestRender();
    });

    // Resizing mode toggle (Auto Width / Fixed Width)
    $resizeButtons.on('click', function () {
        const mode = $(this).data('resize');
        if (!mode) return;

        $resizeButtons.removeClass('on');
        $(this).addClass('on');

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.resizing = mode;
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    /* ================= CUSTOM FONT IMPORT ================= */
    const $btnImportFont = $('#btn-import-font'),
        $fontFileInput = $('#font-file-input'),
        $optgroupCustom = $('#optgroup-custom-fonts');

    $btnImportFont.on('click', function () {
        $fontFileInput.trigger('click');
    });

    $fontFileInput.on('change', async function () {
        const file = this.files && this.files[0];
        if (!file) return;

        // Nama font diambil dari nama file (tanpa ekstensi)
        const rawName = file.name.replace(/\.[^/.]+$/, "");
        const cleanFontName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
            const buffer = await file.arrayBuffer();
            const fontFace = new FontFace(cleanFontName, buffer);
            await fontFace.load();
            document.fonts.add(fontFace);

            // Tampilkan optgroup jika sebelumnya tersembunyi
            $optgroupCustom.show();

            // Tambahkan option baru jika belum ada
            const fontVal = `'${cleanFontName}', sans-serif`;
            let $existingOpt = $font.find(`option[value="${fontVal}"]`);
            if (!$existingOpt.length) {
                $existingOpt = $(`<option value="${fontVal}">${rawName}</option>`).appendTo($optgroupCustom);
            }

            // Terapkan langsung ke teks yang sedang aktif
            $font.val(fontVal);
            const texts = selectedTextObjects();
            texts.forEach(t => {
                t.fontFamily = fontVal;
                updateDimensions(t);
            });
            $(document).trigger('object:change');
            requestRender();

        } catch (err) {
            console.error('Gagal memuat custom font:', err);
            alert('Gagal memuat font: Format file tidak didukung atau berkas rusak.');
        }

        // Reset input file
        $fontFileInput.val('');
    });

    // Inisialisasi awal
    refresh();
});
