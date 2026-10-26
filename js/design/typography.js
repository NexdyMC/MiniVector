/* ================= DESIGN: TYPOGRAPHY ================= */
// Panel kanan -> Design -> Typography
// Mengatur font-family, font-weight, font-size, line-height, letter-spacing, text-align, dekorasi, dan resizing
$(function () {
    const $sec = $('#sec-typography');
    if (!$sec.length) return;

    const $fontHidden = $('#prop-font'),
        $weightHidden = $('#prop-fontweight'),
        $size = $('#prop-fontsize'),
        $lineHeight = $('#prop-lineheight'),
        $letterSpacing = $('#prop-letterspacing'),
        $alignButtons = $('#text-align-seg button'),
        $styleButtons = $('#text-style-seg button'),
        $resizeButtons = $('#text-resize-seg button'),
        $valignButtons = $('#text-valign-seg button');

    // Custom select elements
    const $wrapFont = $('#wrap-font-family'),
        $triggerFont = $('#trigger-font-family'),
        $labelFont = $('#label-font-family'),
        $menuFont = $('#menu-font-family');

    const $wrapWeight = $('#wrap-font-weight'),
        $triggerWeight = $('#trigger-font-weight'),
        $labelWeight = $('#label-font-weight'),
        $menuWeight = $('#menu-font-weight');

    // Mapping bobot ketebalan font ke nama label elegan
    const WEIGHT_NAMES = {
        '100': 'Thin',
        '200': 'Extra Light',
        '300': 'Light',
        '400': 'Regular',
        '500': 'Medium',
        '600': 'Semi Bold',
        '700': 'Bold',
        '800': 'Extra Bold',
        '900': 'Black',
        '950': 'Extra Black',
        '1000': 'Ultra Black'
    };

    // Ambil nama font yang bersih untuk label trigger
    const getCleanFontName = (fontFamilyStr) => {
        if (!fontFamilyStr) return 'Inter';
        const clean = fontFamilyStr.split(',')[0].replace(/['"]/g, '').trim();
        return clean || 'Inter';
    };

    // Toggle dropdown modern
    const closeAllCustomSelects = () => {
        $('.mv-custom-select-wrap').removeClass('open');
        $('.mv-custom-select-trigger').removeClass('active').attr('aria-expanded', 'false');
    };

    $triggerFont.on('click', function (e) {
        e.stopPropagation();
        const isOpen = $wrapFont.hasClass('open');
        closeAllCustomSelects();
        if (!isOpen) {
            $wrapFont.addClass('open');
            $(this).addClass('active').attr('aria-expanded', 'true');
        }
    });

    $triggerWeight.on('click', function (e) {
        e.stopPropagation();
        const isOpen = $wrapWeight.hasClass('open');
        closeAllCustomSelects();
        if (!isOpen) {
            $wrapWeight.addClass('open');
            $(this).addClass('active').attr('aria-expanded', 'true');
        }
    });

    $(document).on('click', function () {
        closeAllCustomSelects();
    });

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

        // 1. Font Family
        const curFont = first.fontFamily || 'Inter, sans-serif';
        $fontHidden.val(curFont);
        $labelFont.text(getCleanFontName(curFont));
        $menuFont.find('.mv-custom-select-item').removeClass('selected');
        $menuFont.find(`.mv-custom-select-item[data-val="${curFont}"]`).addClass('selected');

        // 2. Font Weight
        const curWeight = String(first.fontWeight || '400');
        $weightHidden.val(curWeight);
        $labelWeight.text(WEIGHT_NAMES[curWeight] || curWeight);
        $menuWeight.find('.mv-custom-select-item').removeClass('selected');
        $menuWeight.find(`.mv-custom-select-item[data-val="${curWeight}"]`).addClass('selected');

        // 3. Font Size (Hanya tampilkan jika input tidak sedang difokuskan user)
        if (document.activeElement !== $size[0]) {
            $size.val(first.fontSize || 16);
        }

        // 4. Line height
        if (document.activeElement !== $lineHeight[0]) {
            if (first.lineHeightCustom) {
                $lineHeight.val(first.lineHeight);
            } else {
                $lineHeight.val('Auto');
            }
        }

        // 5. Letter spacing
        if (document.activeElement !== $letterSpacing[0]) {
            $letterSpacing.val(first.letterSpacing || 0);
        }

        // 6. Text Align
        const align = first.textAlign || 'left';
        $alignButtons.removeClass('on');
        $alignButtons.filter(`[data-align="${align}"]`).addClass('on');

        // 7. Style buttons (Underline, Strikethrough, Italic)
        $styleButtons.filter('[data-style="underline"]').toggleClass('on', !!first.underline);
        $styleButtons.filter('[data-style="strikethrough"]').toggleClass('on', !!first.strikethrough);
        $styleButtons.filter('[data-style="italic"]').toggleClass('on', !!first.italic);

        // 8. Resize buttons
        const resizeMode = first.resizing || 'auto';
        $resizeButtons.removeClass('on');
        $resizeButtons.filter(`[data-resize="${resizeMode}"]`).addClass('on');

        // 9. Vertical Align buttons
        const vAlignMode = first.verticalAlign || 'top';
        $valignButtons.removeClass('on');
        $valignButtons.filter(`[data-valign="${vAlignMode}"]`).addClass('on');
    };

    Geo.watch(refresh);
    $(document).on('selection:change object:change', refresh);

    // Helper update dimensi teks saat font/size/spacing berubah
    const updateDimensions = (obj) => {
        const rawContent = obj.content || 'Text';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontStyle = obj.italic ? 'italic ' : '';
        ctx.font = `${fontStyle}${obj.fontWeight || '400'} ${obj.fontSize || 16}px ${obj.fontFamily || 'Inter, sans-serif'}`;
        try { ctx.letterSpacing = `${obj.letterSpacing || 0}px`; } catch (_) {}

        const lh = obj.lineHeight || ((obj.fontSize || 16) * 1.25);

        if (obj.resizing === 'fixed' || obj.resizing === 'auto-height') {
            // Mode wrapping: lebar dipertahankan, sesuaikan tinggi
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

            obj.transform.height = Math.ceil(Math.max(1, lines.length) * lh);
            return;
        }

        // Mode auto width: hitung lebar dan tinggi pas tanpa margin kosong
        const lines = rawContent.split('\n');
        let maxW = 20;
        lines.forEach(l => {
            const m = ctx.measureText(l);
            if (m.width > maxW) maxW = m.width;
        });

        obj.transform.width = Math.ceil(maxW);
        obj.transform.height = Math.ceil(lines.length * lh);
    };

    // Item select handler: Font Family
    $menuFont.on('click', '.mv-custom-select-item', function () {
        const val = $(this).data('val');
        if (!val) return;

        $menuFont.find('.mv-custom-select-item').removeClass('selected');
        $(this).addClass('selected');
        $labelFont.text(getCleanFontName(val));
        $fontHidden.val(val);
        closeAllCustomSelects();

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.fontFamily = val;
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    // Item select handler: Font Weight
    $menuWeight.on('click', '.mv-custom-select-item', function () {
        const val = String($(this).data('val'));
        if (!val) return;

        $menuWeight.find('.mv-custom-select-item').removeClass('selected');
        $(this).addClass('selected');
        $labelWeight.text(WEIGHT_NAMES[val] || val);
        $weightHidden.val(val);
        closeAllCustomSelects();

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.fontWeight = val;
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    // Font size input: dukung pengetikan bebas tanpa paksaan 6/16 saat masih mengetik
    $size.on('input', function () {
        const raw = this.value.trim();
        if (raw === '') return; // Jangan paksa nilai saat user sedang menghapus/mengetik
        const val = parseFloat(raw);
        if (isNaN(val) || val <= 0) return;

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

    $size.on('change blur', function () {
        const raw = this.value.trim();
        let val = parseFloat(raw);
        if (isNaN(val) || val < 1) val = 16;
        val = Math.min(500, Math.max(1, Math.round(val)));
        this.value = val;

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

    $size.on('keydown', function (e) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const current = parseFloat(this.value) || 16;
            this.value = current + step;
            $(this).trigger('change');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const current = parseFloat(this.value) || 16;
            this.value = Math.max(1, current - step);
            $(this).trigger('change');
        } else if (e.key === 'Enter') {
            $(this).trigger('change');
            this.blur();
        }
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
                t.lineHeight = Math.max(4, parseFloat(val));
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

    // Resizing mode toggle (auto / auto-height / fixed)
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

    // Vertical Align toggle (top / middle / bottom)
    $valignButtons.on('click', function () {
        const vAlign = $(this).data('valign');
        if (!vAlign) return;

        $valignButtons.removeClass('on');
        $(this).addClass('on');

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.verticalAlign = vAlign;
        });
        $(document).trigger('object:change');
        requestRender();
    });

    /* ================= CUSTOM FONT IMPORT ================= */
    const $btnImportFont = $('#btn-import-font'),
        $fontFileInput = $('#font-file-input'),
        $groupCustom = $('#group-custom-fonts'),
        $itemsCustom = $('#items-custom-fonts');

    $btnImportFont.on('click', function () {
        $fontFileInput.trigger('click');
    });

    $fontFileInput.on('change', async function () {
        const file = this.files && this.files[0];
        if (!file) return;

        const rawName = file.name.replace(/\.[^/.]+$/, "");
        const cleanFontName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const fontFace = new FontFace(cleanFontName, arrayBuffer);
            await fontFace.load();
            document.fonts.add(fontFace);

            $groupCustom.show();
            const $newItem = $(`<div class="mv-custom-select-item" data-val="${cleanFontName}" style="font-family:'${cleanFontName}', sans-serif">${rawName}</div>`);
            $itemsCustom.append($newItem);

            // Pilih otomatis font baru
            $newItem.trigger('click');

            if (typeof showToast === 'function') {
                showToast(`Font "${rawName}" berhasil dimuat!`);
            }
        } catch (err) {
            console.error('Gagal memuat font:', err);
            alert('Gagal memuat file font: ' + err.message);
        }

        this.value = '';
    });
});
