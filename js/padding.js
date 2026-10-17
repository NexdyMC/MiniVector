/* ================= PADDING & DISTANCE MEASUREMENT ENGINE =================
 * Mengelola kalkulasi jarak (gap) antar objek dan padding
 * di dalam container / frame ala Figma.
 * ======================================================================= */

(function () {
  'use strict';

  const STORAGE_KEY_ENABLED = 'minivector_padding_enabled';

  const defaultEnabled = localStorage.getItem(STORAGE_KEY_ENABLED) !== null
    ? localStorage.getItem(STORAGE_KEY_ENABLED) === 'true'
    : true;

  window.Padding = {
    enabled: defaultEnabled,
    activeMeasurements: [], // Daftar pengukuran aktif yang akan digambar canvas.js

    setEnabled(val) {
      this.enabled = !!val;
      localStorage.setItem(STORAGE_KEY_ENABLED, this.enabled);
    },

    clear() {
      if (this.activeMeasurements.length > 0) {
        this.activeMeasurements = [];
      }
    },

    /**
     * Mengukur jarak antara 2 bounding box (misal objek terpilih dan objek target di hover)
     * @param {Object} a - { x, y, width, height }
     * @param {Object} b - { x, y, width, height }
     */
    measureBetween(a, b) {
      if (!this.enabled || !a || !b) {
        this.clear();
        return;
      }

      const measurements = [];

      const aRight = a.x + a.width;
      const aBottom = a.y + a.height;
      const bRight = b.x + b.width;
      const bBottom = b.y + b.height;

      // 1. Horizontal Gap
      // B di sebelah kanan A
      if (b.x >= aRight) {
        const gap = Math.round(b.x - aRight);
        const midY = (Math.max(a.y, b.y) + Math.min(aBottom, bBottom)) / 2;
        measurements.push({
          x1: aRight,
          y1: midY,
          x2: b.x,
          y2: midY,
          distance: gap,
          orientation: 'h',
          labelX: (aRight + b.x) / 2,
          labelY: midY
        });
      }
      // B di sebelah kiri A
      else if (a.x >= bRight) {
        const gap = Math.round(a.x - bRight);
        const midY = (Math.max(a.y, b.y) + Math.min(aBottom, bBottom)) / 2;
        measurements.push({
          x1: bRight,
          y1: midY,
          x2: a.x,
          y2: midY,
          distance: gap,
          orientation: 'h',
          labelX: (bRight + a.x) / 2,
          labelY: midY
        });
      }

      // 2. Vertical Gap
      // B di bawah A
      if (b.y >= aBottom) {
        const gap = Math.round(b.y - aBottom);
        const midX = (Math.max(a.x, b.x) + Math.min(aRight, bRight)) / 2;
        measurements.push({
          x1: midX,
          y1: aBottom,
          x2: midX,
          y2: b.y,
          distance: gap,
          orientation: 'v',
          labelX: midX,
          labelY: (aBottom + b.y) / 2
        });
      }
      // B di atas A
      else if (a.y >= bBottom) {
        const gap = Math.round(a.y - bBottom);
        const midX = (Math.max(a.x, b.x) + Math.min(aRight, bRight)) / 2;
        measurements.push({
          x1: midX,
          y1: bBottom,
          x2: midX,
          y2: a.y,
          distance: gap,
          orientation: 'v',
          labelX: midX,
          labelY: (bBottom + a.y) / 2
        });
      }

      this.activeMeasurements = measurements;
    },

    /**
     * Mengukur padding objek anak terhadap Frame induknya (Top, Right, Bottom, Left)
     * @param {Object} child - { x, y, width, height }
     * @param {Object} frame - { x, y, width, height }
     */
    measureInsideFrame(child, frame) {
      if (!this.enabled || !child || !frame) {
        this.clear();
        return;
      }

      const measurements = [];
      const childCenterX = child.x + child.width / 2;
      const childCenterY = child.y + child.height / 2;

      // Top padding
      const pTop = Math.round(child.y - frame.y);
      if (pTop >= 0) {
        measurements.push({
          x1: childCenterX,
          y1: frame.y,
          x2: childCenterX,
          y2: child.y,
          distance: pTop,
          orientation: 'v',
          labelX: childCenterX,
          labelY: (frame.y + child.y) / 2
        });
      }

      // Bottom padding
      const pBottom = Math.round((frame.y + frame.height) - (child.y + child.height));
      if (pBottom >= 0) {
        measurements.push({
          x1: childCenterX,
          y1: child.y + child.height,
          x2: childCenterX,
          y2: frame.y + frame.height,
          distance: pBottom,
          orientation: 'v',
          labelX: childCenterX,
          labelY: (child.y + child.height + frame.y + frame.height) / 2
        });
      }

      // Left padding
      const pLeft = Math.round(child.x - frame.x);
      if (pLeft >= 0) {
        measurements.push({
          x1: frame.x,
          y1: childCenterY,
          x2: child.x,
          y2: childCenterY,
          distance: pLeft,
          orientation: 'h',
          labelX: (frame.x + child.x) / 2,
          labelY: childCenterY
        });
      }

      // Right padding
      const pRight = Math.round((frame.x + frame.width) - (child.x + child.width));
      if (pRight >= 0) {
        measurements.push({
          x1: child.x + child.width,
          y1: childCenterY,
          x2: frame.x + frame.width,
          y2: childCenterY,
          distance: pRight,
          orientation: 'h',
          labelX: (child.x + child.width + frame.x + frame.width) / 2,
          labelY: childCenterY
        });
      }

      this.activeMeasurements = measurements;
    }
  };
})();
