
    // Helper mendapatkan teks terformat (textCase & listType)
    window.getFormattedTextContent = (rawText, textCase = 'none', listType = 'none') => {
        if (!rawText) return '';
        let txt = rawText;

        // 1. Text Case Transformation
        if (textCase === 'uppercase') {
            txt = txt.toUpperCase();
        } else if (textCase === 'lowercase') {
            txt = txt.toLowerCase();
        } else if (textCase === 'titlecase' || textCase === 'capitalize') {
            txt = txt.replace(/\b[a-z]/g, c => c.toUpperCase());
        }

        // 2. List Type prefixing
        if (listType === 'bullet') {
            txt = txt.split('\n').map(line => line.startsWith('• ') ? line : ('• ' + line)).join('\n');
        } else if (listType === 'numbered') {
            let num = 1;
            txt = txt.split('\n').map(line => {
                const cleaned = line.replace(/^\d+\.\s*/, '');
                return `${num++}. ${cleaned}`;
            }).join('\n');
        }

        return txt;
    };

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
        $valignButtons = $('#text-valign-seg button'),
        $caseButtons = $('#text-case-seg button'),
        $listButtons = $('#text-list-seg button');

    // Storage custom fonts
    const STORAGE_KEY_CUSTOM_FONTS = 'minivector_custom_fonts_v1';
    let customFonts = [];
    let selectedFontId = null;
    let currentPreviewWeight = '400';

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

    // Ambil nama font yang bersih untuk label trigger (mencocokkan font kustom jika ada)
    const getCleanFontName = (fontFamilyStr) => {
        if (!fontFamilyStr) return 'Inter';
        const clean = fontFamilyStr.split(',')[0].replace(/['"]/g, '').trim();
        if (typeof customFonts !== 'undefined' && customFonts && customFonts.length) {
            const found = customFonts.find(f => f.family === clean || f.name === clean);
            if (found) return found.name;
        }
        if (clean.startsWith('mv_')) {
            return clean.substring(3).replace(/_/g, ' ');
        }
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

        // 10. Text Case buttons
        const caseMode = first.textCase || 'none';
        $caseButtons.removeClass('on');
        $caseButtons.filter(`[data-case="${caseMode}"]`).addClass('on');

        // 11. List Mode buttons
        const listMode = first.listType || 'none';
        $listButtons.removeClass('on');
        $listButtons.filter(`[data-list="${listMode}"]`).addClass('on');
    };

    Geo.watch(refresh);
    $(document).on('selection:change object:change', refresh);

    // Helper update dimensi teks saat font/size/spacing berubah
    const updateDimensions = (obj) => {
        const rawContent = window.getFormattedTextContent(obj.content || 'Text', obj.textCase, obj.listType);
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


    // Text Case buttons toggle (none / uppercase / lowercase / titlecase)
    $caseButtons.on('click', function () {
        const tCase = $(this).data('case') || 'none';
        $caseButtons.removeClass('on');
        $(this).addClass('on');

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.textCase = tCase;
            updateDimensions(t);
        });
        $(document).trigger('object:change');
        requestRender();
    });

    // List Mode buttons toggle (none / bullet / numbered)
    $listButtons.on('click', function () {
        const lType = $(this).data('list') || 'none';
        $listButtons.removeClass('on');
        $(this).addClass('on');

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.listType = lType;
            updateDimensions(t);
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

    /* ================= CUSTOM FONT MANAGER & POPUP ================= */

    const $btnImportFont = $('#btn-import-font'),
        $groupCustom = $('#group-custom-fonts'),
        $itemsCustom = $('#items-custom-fonts'),
        $modalFontManager = $('#modal-font-manager'),
        $fontDropzone = $('#font-manager-dropzone'),
        $fontFileInput = $('#font-manager-file-input'),
        $fontList = $('#font-manager-list'),
        $fontCount = $('#custom-font-count'),
        $btnBrowse = $('#btn-browse-font'),
        $previewName = $('#font-preview-name'),
        $previewMeta = $('#font-preview-meta'),
        $previewFormat = $('#font-preview-format'),
        $weightSection = $('#font-weight-section'),
        $previewWeights = $('#font-preview-weights'),
        $sliderSection = $('#font-slider-section'),
        $previewSizeSlider = $('#font-preview-size-slider'),
        $previewSizeLabel = $('#font-preview-size-label'),
        $previewSample = $('#font-preview-sample'),
        $actionsBar = $('#font-actions-bar'),
        $btnApply = $('#btn-apply-font-to-selected'),
        $btnExport = $('#btn-export-current-font'),
        $btnDelete = $('#btn-delete-current-font'),
        $btnResetSample = $('#btn-reset-preview-text');

    // Default sample text
    const DEFAULT_SAMPLE_TEXT = 'The quick brown fox jumps over the lazy dog.\n0123456789 (!@#$%^&*?)';

    // Format bytes to KB/MB
    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 KB';
        const k = 1024;
        const dm = 1;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + ['Bytes', 'KB', 'MB', 'GB'][i];
    };

    // Load registered custom fonts from localStorage
    const loadStoredFonts = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_FONTS);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(f => {
                        if (f && f.base64 && f.family) {
                            try {
                                const binary = atob(f.base64);
                                const bytes = new Uint8Array(binary.length);
                                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                                const fontFace = new FontFace(f.family, bytes.buffer);
                                fontFace.load().then(loaded => {
                                    document.fonts.add(loaded);
                                }).catch(e => console.warn('Could not register font:', f.family, e));
                            } catch (_) {}
                        }
                    });
                    customFonts = parsed;
                }
            }
        } catch (e) {
            console.warn('Error reading stored custom fonts:', e);
            customFonts = [];
        }
        syncCustomFontDropdown();
    };

    // Save custom fonts metadata & base64 to localStorage
    const saveStoredFonts = () => {
        try {
            localStorage.setItem(STORAGE_KEY_CUSTOM_FONTS, JSON.stringify(customFonts));
        } catch (e) {
            console.warn('LocalStorage limit reached or error saving fonts:', e);
            if (typeof showToast === 'function') {
                showToast('Penyimpanan lokal penuh. Font tetap aktif untuk sesi ini.');
            }
        }
    };

    // Sync items in Typography Dropdown menu
    const syncCustomFontDropdown = () => {
        $itemsCustom.empty();
        if (!customFonts.length) {
            $groupCustom.hide();
            return;
        }
        $groupCustom.show();
        customFonts.forEach(f => {
            const $item = $(`<div class="mv-custom-select-item" data-val="'${f.family}', sans-serif" style="font-family:'${f.family}', sans-serif">${f.name}</div>`);
            $itemsCustom.append($item);
        });
    };

    // Render list cards in Font Manager popup
    const renderFontManagerList = () => {
        $fontCount.text(customFonts.length);
        $fontList.empty();

        if (!customFonts.length) {
            $fontList.html('<div style="font-size:12px;color:var(--c-mute);text-align:center;padding:24px 8px;">Belum ada font kustom yang diinstal.<br>Drag & drop font ke atas untuk menambahkan.</div>');
            showEmptyPreview();
            return;
        }

        customFonts.forEach(f => {
            const isActive = f.id === selectedFontId;
            const $card = $(`
                <div class="font-item-card ${isActive ? 'active' : ''}" data-id="${f.id}">
                    <div class="font-item-info">
                        <strong style="font-family:'${f.family}', sans-serif">${f.name}</strong>
                        <small>${f.weights.length} Bobot • ${formatBytes(f.size)}</small>
                    </div>
                    <span class="font-item-badge">${f.format}</span>
                </div>
            `);
            $fontList.append($card);
        });

        if (!selectedFontId && customFonts.length > 0) {
            selectFont(customFonts[0].id);
        } else if (selectedFontId) {
            const current = customFonts.find(f => f.id === selectedFontId);
            if (current) renderPreviewFor(current);
            else showEmptyPreview();
        }
    };

    const showEmptyPreview = () => {
        selectedFontId = null;
        $previewName.text('Pilih atau Upload Font').css('font-family', 'inherit');
        $previewMeta.text('Belum ada font kustom yang dipilih');
        $previewFormat.hide();
        $weightSection.hide();
        $sliderSection.hide();
        $actionsBar.hide();
        $previewSample.css({ 'font-family': 'inherit', 'font-weight': '400' }).text(DEFAULT_SAMPLE_TEXT);
    };

    const selectFont = (id) => {
        selectedFontId = id;
        $('.font-item-card').removeClass('active');
        $(`.font-item-card[data-id="${id}"]`).addClass('active');

        const font = customFonts.find(f => f.id === id);
        if (font) renderPreviewFor(font);
        else showEmptyPreview();
    };

    const renderPreviewFor = (font) => {
        $previewName.text(font.name).css('font-family', `'${font.family}', sans-serif`);
        $previewMeta.text(`${font.format.toUpperCase()} • ${formatBytes(font.size)} • Family: ${font.family}`);
        $previewFormat.text(font.format.toUpperCase()).show();

        // Render weight selector buttons
        $previewWeights.empty();
        currentPreviewWeight = font.weights.includes('400') ? '400' : (font.weights[0] || '400');
        font.weights.forEach(w => {
            const label = WEIGHT_NAMES[w] || w;
            const $wBtn = $(`<button class="font-weight-btn ${w === currentPreviewWeight ? 'active' : ''}" data-weight="${w}">${label} (${w})</button>`);
            $previewWeights.append($wBtn);
        });
        $weightSection.show();

        // Slider & sample
        $sliderSection.show();
        $actionsBar.show();

        const curSize = $previewSizeSlider.val() || 24;
        $previewSample.css({
            'font-family': `'${font.family}', sans-serif`,
            'font-weight': currentPreviewWeight,
            'font-size': `${curSize}px`
        });
    };

    // Process uploaded file (File / Blob)
    const processFontFile = async (file) => {
        if (!file || !/\.(ttf|otf|woff|woff2)$/i.test(file.name)) {
            alert('File bukan format font yang didukung (.ttf, .otf, .woff, .woff2)');
            return;
        }

        const extMatch = file.name.match(/\.([^.]+)$/);
        const format = extMatch ? extMatch[1].toUpperCase() : 'TTF';
        const rawName = file.name.replace(/\.[^/.]+$/, '');
        const cleanFamily = 'mv_' + rawName.replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const fontFace = new FontFace(cleanFamily, arrayBuffer);
            await fontFace.load();
            document.fonts.add(fontFace);

            // Convert to Base64 for persistence
            let binary = '';
            const bytes = new Uint8Array(arrayBuffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            const newFont = {
                id: 'font_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: rawName,
                family: cleanFamily,
                format: format,
                size: file.size,
                base64: base64,
                weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900']
            };

            // Remove if existing with same name
            customFonts = customFonts.filter(f => f.name !== rawName);
            customFonts.unshift(newFont);

            saveStoredFonts();
            syncCustomFontDropdown();
            renderFontManagerList();
            selectFont(newFont.id);

            if (typeof showToast === 'function') {
                showToast(`Font "${rawName}" berhasil diinstal!`);
            }
        } catch (err) {
            console.error('Gagal memuat font:', err);
            alert('Gagal membaca file font: ' + err.message);
        }
    };

    // Open Font Manager popup on icon click
    $btnImportFont.on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openModal === 'function') {
            openModal('font-manager');
        } else {
            $modalFontManager.addClass('open');
        }
        renderFontManagerList();
    });

    // Browse file button inside dropzone
    $btnBrowse.on('click', function (e) {
        e.stopPropagation();
        $fontFileInput.trigger('click');
    });

    $fontDropzone.on('click', function () {
        $fontFileInput.trigger('click');
    });

    $fontFileInput.on('change', async function () {
        const files = Array.from(this.files || []);
        for (const file of files) {
            await processFontFile(file);
        }
        this.value = '';
    });

    // Drag & Drop handlers on Dropzone
    $fontDropzone.on('dragover dragenter', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-over');
    }).on('dragleave drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
    });

    $fontDropzone.on('drop', async function (e) {
        const dt = e.originalEvent && e.originalEvent.dataTransfer;
        if (dt && dt.files && dt.files.length) {
            const files = Array.from(dt.files);
            for (const file of files) {
                await processFontFile(file);
            }
        }
    });

    // Select font from list cards
    $(document).on('click', '.font-item-card', function () {
        const id = $(this).data('id');
        selectFont(id);
    });

    // Weight buttons inside popup preview
    $(document).on('click', '.font-weight-btn', function () {
        const w = $(this).data('weight');
        currentPreviewWeight = String(w);
        $('.font-weight-btn').removeClass('active');
        $(this).addClass('active');
        $previewSample.css('font-weight', currentPreviewWeight);
    });

    // Size slider in preview
    $previewSizeSlider.on('input change', function () {
        const sz = $(this).val();
        $previewSizeLabel.text(sz + 'px');
        $previewSample.css('font-size', sz + 'px');
    });

    // Reset sample text
    $btnResetSample.on('click', function () {
        $previewSample.text(DEFAULT_SAMPLE_TEXT);
    });

    // Apply font to selected text objects in canvas
    $btnApply.on('click', function () {
        const font = customFonts.find(f => f.id === selectedFontId);
        if (!font) return;

        const fontVal = `'${font.family}', sans-serif`;
        $labelFont.text(font.name);
        $fontHidden.val(fontVal);

        // Apply weight if matched
        if (currentPreviewWeight) {
            $weightHidden.val(currentPreviewWeight);
            $labelWeight.text(WEIGHT_NAMES[currentPreviewWeight] || 'Regular');
        }

        const texts = selectedTextObjects();
        texts.forEach(t => {
            t.fontFamily = fontVal;
            if (currentPreviewWeight) t.fontWeight = currentPreviewWeight;
            updateDimensions(t);
        });

        if (texts.length) {
            $(document).trigger('object:change');
            if (typeof requestRender === 'function') requestRender();
            if (typeof showToast === 'function') {
                showToast(`Font "${font.name}" diterapkan ke objek!`);
            }
        }
        if (typeof closeModal === 'function') closeModal();
    });

    // Export / Download current font file
    $btnExport.on('click', function () {
        const font = customFonts.find(f => f.id === selectedFontId);
        if (!font || !font.base64) return;

        try {
            const binary = atob(font.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const ext = (font.format || 'ttf').toLowerCase();
            const blob = new Blob([bytes.buffer], { type: 'font/' + ext });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${font.name}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export font failed:', err);
            alert('Gagal mengunduh file font: ' + err.message);
        }
    });

    // Delete custom font
    $btnDelete.on('click', function () {
        const font = customFonts.find(f => f.id === selectedFontId);
        if (!font) return;

        if (!confirm(`Apakah Anda yakin ingin menghapus font "${font.name}" dari MiniVector?`)) {
            return;
        }

        customFonts = customFonts.filter(f => f.id !== selectedFontId);
        saveStoredFonts();
        syncCustomFontDropdown();
        selectedFontId = null;
        renderFontManagerList();

        if (typeof showToast === 'function') {
            showToast(`Font "${font.name}" berhasil dihapus.`);
        }
    });

    // Initialize custom fonts on page load
    loadStoredFonts();
});
