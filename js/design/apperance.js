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

    const single = () => {
        const sel = Geo.selection();
        return sel.length === 1 ? sel[0].obj : null;
    };

    const commit = () => {
        $(document).trigger('object:change');
        if (typeof requestRender === 'function') requestRender();
    };

    const refresh = force => {
        const obj = single();

        if (!obj) {
            $opacity.val('').prop('disabled', true);
            $radius.val('').prop('disabled', true);
            $count.val('').prop('disabled', true);
            $ratio.val('').prop('disabled', true);
            $countLabel.add($countInputWrap).css('opacity', '0.35');
            $ratioLabel.add($ratioInputWrap).css('opacity', '0.35');
            return;
        }

        // 1. Opacity
        $opacity.prop('disabled', false);
        const curOpacity = obj.opacity !== undefined ? obj.opacity : 1;
        if (force || document.activeElement !== $opacity[0]) {
            $opacity.val(Math.round(curOpacity * 100));
        }

        // 2. Corner Radius
        const geom = obj.geometry || {};
        $radius.prop('disabled', false);
        let curRadius = 0;
        if (Array.isArray(geom.cornerRadius)) {
            curRadius = geom.cornerRadius[0] || 0;
        } else if (geom.cornerRadius !== undefined) {
            curRadius = geom.cornerRadius;
        }
        if (force || document.activeElement !== $radius[0]) {
            $radius.val(curRadius);
        }

        // 3. Count & Ratio (Khusus Polygon & Star)
        if (obj.type === 'star') {
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
        } else if (obj.type === 'polygon') {
            $count.prop('disabled', false);
            $ratio.prop('disabled', true);
            $countLabel.add($countInputWrap).css('opacity', '1');
            $ratioLabel.add($ratioInputWrap).css('opacity', '0.35');

            if (force || document.activeElement !== $count[0]) {
                $count.val(geom.pointCount !== undefined ? geom.pointCount : 3);
            }
            $ratio.val('');
        } else {
            // Objek selain Polygon / Star
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
        const obj = single();
        if (!obj) return;
        let val = parseFloat($(this).val());
        if (!isFinite(val)) val = 100;
        val = Math.max(0, Math.min(100, val)) / 100;
        obj.opacity = val;
        commit();
    });

    // B. Corner Radius
    $radius.on('input change', function () {
        const obj = single();
        if (!obj) return;
        let val = Math.max(0, parseFloat($(this).val()) || 0);
        if (!obj.geometry) obj.geometry = {};

        if (obj.type === 'rectangle' || obj.type === 'frame') {
            obj.geometry.cornerRadius = [val, val, val, val];
        } else {
            obj.geometry.cornerRadius = val;
        }
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
