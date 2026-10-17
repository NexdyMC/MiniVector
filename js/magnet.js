/* ================= MAGNET (SNAPPING) ENGINE =================
 * Mengelola deteksi alignment snapping pada sumbu X & Y
 * untuk pergerakan objek dan resize.
 * ========================================================== */

(function () {
  'use strict';

  const STORAGE_KEY_ENABLED = 'minivector_magnet_enabled';
  const STORAGE_KEY_THRESHOLD = 'minivector_magnet_threshold';

  const defaultEnabled = localStorage.getItem(STORAGE_KEY_ENABLED) !== null
    ? localStorage.getItem(STORAGE_KEY_ENABLED) === 'true'
    : true;

  const defaultThreshold = localStorage.getItem(STORAGE_KEY_THRESHOLD) !== null
    ? Math.max(1, parseInt(localStorage.getItem(STORAGE_KEY_THRESHOLD), 10) || 6)
    : 6;

  window.Magnet = {
    enabled: defaultEnabled,
    threshold: defaultThreshold, // dalam screen pixel (dibagi zoom saat kalkulasi world)
    activeGuides: [], // Garis panduan aktif yang akan dirender oleh canvas.js

    setEnabled(val) {
      this.enabled = !!val;
      localStorage.setItem(STORAGE_KEY_ENABLED, this.enabled);
    },

    setThreshold(val) {
      this.threshold = Math.max(1, Math.min(50, parseInt(val, 10) || 6));
      localStorage.setItem(STORAGE_KEY_THRESHOLD, this.threshold);
    },

    clear() {
      if (this.activeGuides.length > 0) {
        this.activeGuides = [];
      }
    },

    /**
     * Menghitung koreksi posisi snap untuk bounding box target terhadap daftar candidate bounds
     * @param {Object} box - { x, y, width, height }
     * @param {Array<Object>} candidates - Daftar { id, x, y, width, height } selain objek yang digeser
     * @param {number} zoom - State.zoom saat ini untuk normalisasi threshold
     * @returns {Object} { x, y, deltaX, deltaY, snappedX, snappedY }
     */
    snap(box, candidates, zoom = 1) {
      if (!this.enabled || !candidates || candidates.length === 0) {
        this.clear();
        return {
          x: box.x,
          y: box.y,
          deltaX: 0,
          deltaY: 0,
          snappedX: false,
          snappedY: false
        };
      }

      const worldThreshold = this.threshold / (zoom || 1);
      const guides = [];

      let bestDiffX = worldThreshold + 1;
      let snapX = box.x;
      let bestGuideX = null;

      let bestDiffY = worldThreshold + 1;
      let snapY = box.y;
      let bestGuideY = null;

      // Titik referensi objek yang digeser: Left, Center, Right
      const xPoints = [
        { type: 'left', val: box.x, offset: 0 },
        { type: 'center', val: box.x + box.width / 2, offset: box.width / 2 },
        { type: 'right', val: box.x + box.width, offset: box.width }
      ];

      // Titik referensi objek yang digeser: Top, Center, Bottom
      const yPoints = [
        { type: 'top', val: box.y, offset: 0 },
        { type: 'center', val: box.y + box.height / 2, offset: box.height / 2 },
        { type: 'bottom', val: box.y + box.height, offset: box.height }
      ];

      for (const target of candidates) {
        if (!target) continue;

        // Titik target X
        const targetXPoints = [
          { type: 'left', val: target.x },
          { type: 'center', val: target.x + target.width / 2 },
          { type: 'right', val: target.x + target.width }
        ];

        // Titik target Y
        const targetYPoints = [
          { type: 'top', val: target.y },
          { type: 'center', val: target.y + target.height / 2 },
          { type: 'bottom', val: target.y + target.height }
        ];

        // Sumbu X
        for (const xp of xPoints) {
          for (const tx of targetXPoints) {
            const diff = Math.abs(xp.val - tx.val);
            if (diff <= worldThreshold && diff < bestDiffX) {
              bestDiffX = diff;
              snapX = tx.val - xp.offset;
              bestGuideX = {
                type: 'v',
                pos: tx.val,
                fromY: Math.min(box.y, target.y) - 20,
                toY: Math.max(box.y + box.height, target.y + target.height) + 20
              };
            }
          }
        }

        // Sumbu Y
        for (const yp of yPoints) {
          for (const ty of targetYPoints) {
            const diff = Math.abs(yp.val - ty.val);
            if (diff <= worldThreshold && diff < bestDiffY) {
              bestDiffY = diff;
              snapY = ty.val - yp.offset;
              bestGuideY = {
                type: 'h',
                pos: ty.val,
                fromX: Math.min(box.x, target.x) - 20,
                toX: Math.max(box.x + box.width, target.x + target.width) + 20
              };
            }
          }
        }
      }

      if (bestGuideX) guides.push(bestGuideX);
      if (bestGuideY) guides.push(bestGuideY);

      this.activeGuides = guides;

      return {
        x: bestGuideX ? snapX : box.x,
        y: bestGuideY ? snapY : box.y,
        deltaX: bestGuideX ? snapX - box.x : 0,
        deltaY: bestGuideY ? snapY - box.y : 0,
        snappedX: !!bestGuideX,
        snappedY: !!bestGuideY
      };
    }
  };
})();
