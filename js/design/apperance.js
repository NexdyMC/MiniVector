/* ================= DESIGN: APPEARANCE ================= */
// Mengelola kontrol di section Appearance pada Inspector Panel:
// 1. Opacity (#prop-opacity, 0 - 100%)
// 2. Corner Radius (#prop-radius, px) untuk Rectangle, Frame, Polygon, Star
// 3. Count (#prop-count) -> Jumlah sisi Polygon (3-60) atau titik sudut Star (3-60)
// 4. Ratio (#prop-ratio) -> Rasio kedalaman lekukan dalam Star (5% - 95%)
// Bergantung pada: variabel.js (State), geometry.js (Geo), canvas.js (requestRender).

$(function () {
    const $opacity = $('#prop-opacity');
    const $radius = $('#prop-radius');
    const $count = $('#prop-count');
    const $ratio = $('#prop-ratio');

    // Label pembungkus untuk show/hide
    const $countLabel = $count.closest('.fg-grid').find('.fg-label:contains("Count")');
    const $ratioLabel = $count.closest('.fg-grid').find('.fg-label:contains("Ratio")');
    const $countInputWrap = $count.closest('.fg-in');
    const $ratioInputWrap = $ratio.closest('.fg-in');

    const targets = () => {
        const sel = Geo.selection();
        return sel.map(f => f.obj).filter(Boolean);
    };

    const single = () => {
        const sel = Geo.selection();
        return sel.length === 1 ? sel[0].obj : null;
    };

    const commit = () => {
        $(document).trigger('object:change');
        if (typeof requestRender === 'function') requestRender();
    };

    const refresh = force => {
        const selObjs = targets();
        const obj = single();

        if (selObjs.length === 0) {
            $opacity.val('').prop('disabled', true);
            $radius.val('').prop('disabled', true);
            $('#btn-corner-matrix').prop('disabled', true);
            $count.val('').prop('disabled', true);
            $ratio.val('').prop('disabled', true);
            $countLabel.add($countInputWrap).css('opacity', '0.35');
            $ratioLabel.add($ratioInputWrap).css('opacity', '0.35');
            return;
        }

        // 1. Opacity (Mendukung multi-selection)
        $opacity.prop('disabled', false);
        const firstOpacity = selObjs[0].opacity !== undefined ? selObjs[0].opacity : 1;
        const allSameOpacity = selObjs.every(o => (o.opacity !== undefined ? o.opacity : 1) === firstOpacity);
        if (force || document.activeElement !== $opacity[0]) {
            $opacity.val(allSameOpacity ? Math.round(firstOpacity * 100) : '');
            $opacity.attr('placeholder', allSameOpacity ? '' : 'Mixed');
        }

        // 2. Corner Radius (Mendukung multi-selection)
        const canHaveRadius = selObjs.some(o => o.type === 'rectangle' || o.type === 'frame' || o.type === 'polygon' || o.type === 'star');
        $radius.prop('disabled', !canHaveRadius);
        $('#btn-corner-matrix').prop('disabled', !canHaveRadius);

        if (canHaveRadius) {
            const getObjRadius = o => {
                const geom = o.geometry || {};
                const sty = o.style || {};
                const cr = geom.cornerRadius !== undefined ? geom.cornerRadius : sty.cornerRadius;
                if (Array.isArray(cr)) return cr[0] || 0;
                if (cr !== undefined) return parseFloat(cr) || 0;
                return 0;
            };
            const firstRad = getObjRadius(selObjs[0]);
            const allSameRad = selObjs.every(o => getObjRadius(o) === firstRad);

            if (force || document.activeElement !== $radius[0]) {
                $radius.val(allSameRad ? firstRad : '');
                $radius.attr('placeholder', allSameRad ? '' : 'Mixed');
            }
        } else {
            $radius.val('').attr('placeholder', '');
        }

        // 3. Count & Ratio (Khusus Polygon & Star)
        if (obj && obj.type === 'star') {
            const geom = obj.geometry || {};
            $count.prop('disabled', false);
            $ratio.prop('disabled', false);
            $countLabel.add($countInputWrap).css('opacity', '1');
            $ratioLabel.add($ratioInputWrap).css('opacity', '1');

            if (force || document.activeElement !== $count[0]) {
                $count.val(geom.pointCount !== undefined ? geom.pointCount : 5);
            }
            if (force || document.activeElement !== $ratio[0]) {
                $ratio.val(geom.innerRadiusRatio !== undefined ? geom.innerRadiusRatio : 38.2);
            }
        } else if (obj && obj.type === 'polygon') {
            const geom = obj.geometry || {};
            $count.prop('disabled', false);
            $ratio.prop('disabled', true);
            $countLabel.add($countInputWrap).css('opacity', '1');
            $ratioLabel.add($ratioInputWrap).css('opacity', '0.35');

            if (force || document.activeElement !== $count[0]) {
                $count.val(geom.pointCount !== undefined ? geom.pointCount : 3);
            }
            $ratio.val('');
        } else {
            // Objek selain Polygon / Star atau Multi-selection
            $count.prop('disabled', true).val('');
            $ratio.prop('disabled', true).val('');
            $countLabel.add($countInputWrap).css('opacity', '0.35');
            $ratioLabel.add($ratioInputWrap).css('opacity', '0.35');
        }
    };

    Geo.watch(refresh);

    /* -------------------------------------------------------------
     * Event Input Handlers
     * ------------------------------------------------------------- */
    // A. Opacity
    $opacity.on('input change', function () {
        const selObjs = targets();
        if (!selObjs.length) return;
        let val = parseFloat($(this).val());
        if (!isFinite(val)) val = 100;
        val = Math.max(0, Math.min(100, val)) / 100;
        selObjs.forEach(obj => {
            obj.opacity = val;
        });
        commit();
    });

    // B. Corner Radius
    $radius.on('input change', function () {
        const selObjs = targets();
        if (!selObjs.length) return;
        let val = Math.max(0, parseFloat($(this).val()) || 0);
        selObjs.forEach(obj => {
            if (!obj.geometry) obj.geometry = {};
            if (!obj.style) obj.style = {};

            if (obj.type === 'rectangle' || obj.type === 'frame') {
                obj.geometry.cornerRadius = [val, val, val, val];
                obj.style.cornerRadius = [val, val, val, val];
            } else {
                obj.geometry.cornerRadius = val;
                obj.style.cornerRadius = val;
            }
        });
        commit();
    });

    // C. Count (Sisi Polygon / Sudut Star)
    $count.on('input change', function () {
        const obj = single();
        if (!obj || (obj.type !== 'polygon' && obj.type !== 'star')) return;
        let val = parseInt($(this).val(), 10);
        if (!isFinite(val)) val = (obj.type === 'polygon' ? 3 : 5);
        val = Math.max(3, Math.min(60, val)); // minimal 3 titik, maks 60
        if (!obj.geometry) obj.geometry = {};
        obj.geometry.pointCount = val;
        commit();
    });

    // D. Ratio (Kedalaman lekukan Star)
    $ratio.on('input change', function () {
        const obj = single();
        if (!obj || obj.type !== 'star') return;
        let val = parseFloat($(this).val());
        if (!isFinite(val)) val = 38.2;
        val = Math.max(5, Math.min(95, Math.round(val * 10) / 10)); // 5% hingga 95%
        if (!obj.geometry) obj.geometry = {};
        obj.geometry.innerRadiusRatio = val;
        commit();
    });
});
