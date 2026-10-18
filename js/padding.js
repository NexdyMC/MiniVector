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
    targetBounds: null, // Bounding box objek target yang sedang di-hover untuk outline visual

    setEnabled(val) {
      this.enabled = !!val;
      localStorage.setItem(STORAGE_KEY_ENABLED, this.enabled);
    },

    clear() {
      if (this.activeMeasurements.length > 0) {
        this.activeMeasurements = [];
      }
      this.targetBounds = null;
    },

    /**
     * Mengukur jarak antara 2 bounding box (misal objek terpilih A dan objek target B di hover)
     * Menghasilkan garis pengukuran presisi 4 sisi (Top, Bottom, Left, Right) ala Figma
     * @param {Object} a - { x, y, width, height }
     * @param {Object} b - { x, y, width, height }
     */
    measureBetween(a, b) {
      if (!this.enabled || !a || !b) {
        this.clear();
        return;
      }

      this.targetBounds = { x: b.x, y: b.y, width: b.width, height: b.height };

      const measurements = [];

      const aRight = a.x + a.width;
      const aBottom = a.y + a.height;
      const bRight = b.x + b.width;
      const bBottom = b.y + b.height;

      const aCenterX = a.x + a.width / 2;
      const aCenterY = a.y + a.height / 2;
      const bCenterX = b.x + b.width / 2;
      const bCenterY = b.y + b.height / 2;

      // Cek apakah ada overlap pada rentang X dan rentang Y
      const overlapX = Math.min(aRight, bRight) - Math.max(a.x, b.x);
      const overlapY = Math.min(aBottom, bBottom) - Math.max(a.y, b.y);

      // KASUS 1: Overlap pada sumbu Y (Objek berdampingan horizontal)
      if (overlapY > 0) {
        const midY = (Math.max(a.y, b.y) + Math.min(aBottom, bBottom)) / 2;
        if (b.x >= aRight) {
          // B di kanan A
          measurements.push({
            x1: aRight, y1: midY, x2: b.x, y2: midY,
            distance: Math.round(b.x - aRight), orientation: 'h',
            labelX: (aRight + b.x) / 2, labelY: midY
          });
        } else if (a.x >= bRight) {
          // B di kiri A
          measurements.push({
            x1: bRight, y1: midY, x2: a.x, y2: midY,
            distance: Math.round(a.x - bRight), orientation: 'h',
            labelX: (bRight + a.x) / 2, labelY: midY
          });
        }
      }

      // KASUS 2: Overlap pada sumbu X (Objek berjejer vertikal)
      if (overlapX > 0) {
        const midX = (Math.max(a.x, b.x) + Math.min(aRight, bRight)) / 2;
        if (b.y >= aBottom) {
          // B di bawah A
          measurements.push({
            x1: midX, y1: aBottom, x2: midX, y2: b.y,
            distance: Math.round(b.y - aBottom), orientation: 'v',
            labelX: midX, labelY: (aBottom + b.y) / 2
          });
        } else if (a.y >= bBottom) {
          // B di atas A
          measurements.push({
            x1: midX, y1: bBottom, x2: midX, y2: a.y,
            distance: Math.round(a.y - bBottom), orientation: 'v',
            labelX: midX, labelY: (bBottom + a.y) / 2
          });
        }
      }

      // KASUS 3: Tidak ada overlap langsung (diagonal / cross-axis)
      // Tampilkan jarak proyeksi X dan Y seperti perilaku Figma
      if (overlapX <= 0 && overlapY <= 0) {
        // Horizontal distance
        if (b.x >= aRight) {
          // B di kanan
          measurements.push({
            x1: aRight, y1: aCenterY, x2: b.x, y2: aCenterY,
            distance: Math.round(b.x - aRight), orientation: 'h',
            labelX: (aRight + b.x) / 2, labelY: aCenterY
          });
        } else if (a.x >= bRight) {
          // B di kiri
          measurements.push({
            x1: bRight, y1: aCenterY, x2: a.x, y2: aCenterY,
            distance: Math.round(a.x - bRight), orientation: 'h',
            labelX: (bRight + a.x) / 2, labelY: aCenterY
          });
        }

        // Vertical distance
        if (b.y >= aBottom) {
          // B di bawah
          measurements.push({
            x1: aCenterX, y1: aBottom, x2: aCenterX, y2: b.y,
            distance: Math.round(b.y - aBottom), orientation: 'v',
            labelX: aCenterX, labelY: (aBottom + b.y) / 2
          });
        } else if (a.y >= bBottom) {
          // B di atas
          measurements.push({
            x1: aCenterX, y1: bBottom, x2: aCenterX, y2: a.y,
            distance: Math.round(a.y - bBottom), orientation: 'v',
            labelX: aCenterX, labelY: (bBottom + a.y) / 2
          });
        }
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

      this.targetBounds = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };

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
    },

    /**
     * Menghitung posisi handle gap interaktif untuk objek terpilih (Multi-Selection Tidy Up / Gap Dragging)
     * @param {Array<string>} selectedIds
     * @returns {Object|null}
     */
    calculateGapHandles(selectedIds) {
      if (!selectedIds || selectedIds.length < 2) return null;
      if (typeof Geo === 'undefined' || typeof Geo.selection !== 'function') return null;

      const sel = Geo.selection();
      if (sel.length < 2) return null;

      const items = sel.map(f => {
        const b = Geo.bounds(f);
        return {
          id: f.obj.id,
          obj: f.obj,
          parent: f.parent,
          origin: f.origin,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          right: b.x + b.width,
          bottom: b.y + b.height,
          centerX: b.x + b.width / 2,
          centerY: b.y + b.height / 2
        };
      });

      // Tentukan orientasi susunan: Horizontal atau Vertikal
      const spanX = Math.max(...items.map(i => i.right)) - Math.min(...items.map(i => i.x));
      const spanY = Math.max(...items.map(i => i.bottom)) - Math.min(...items.map(i => i.y));

      // Urutkan item berdasarkan sumbu dominan
      const isHorizontal = spanX >= spanY;
      if (isHorizontal) {
        items.sort((a, b) => a.x - b.x);
      } else {
        items.sort((a, b) => a.y - b.y);
      }

      // Hitung gap antara setiap pasangan berurutan
      const gapHandles = [];
      const gaps = [];

      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i];
        const b = items[i + 1];

        if (isHorizontal) {
          const gap = b.x - a.right;
          gaps.push(gap);
          const midX = a.right + gap / 2;
          const midY = (Math.max(a.y, b.y) + Math.min(a.bottom, b.bottom)) / 2;
          gapHandles.push({
            index: i,
            orientation: 'h',
            x: midX,
            y: midY,
            gap: Math.round(gap),
            x1: a.right,
            x2: b.x,
            y1: Math.min(a.y, b.y),
            y2: Math.max(a.bottom, b.bottom)
          });
        } else {
          const gap = b.y - a.bottom;
          gaps.push(gap);
          const midY = a.bottom + gap / 2;
          const midX = (Math.max(a.x, b.x) + Math.min(a.right, b.right)) / 2;
          gapHandles.push({
            index: i,
            orientation: 'v',
            x: midX,
            y: midY,
            gap: Math.round(gap),
            y1: a.bottom,
            y2: b.y,
            x1: Math.min(a.x, b.x),
            x2: Math.max(a.right, b.right)
          });
        }
      }

      const avgGap = gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0;
      const isEven = gaps.every(g => Math.abs(g - avgGap) <= 2);

      return {
        orientation: isHorizontal ? 'h' : 'v',
        items,
        handles: gapHandles,
        currentGap: Math.round(avgGap),
        isEven
      };
    },

    /**
     * Meratakan jarak (Tidy Up / Distribute) antar objek terpilih secara seragam
     * @param {Array<string>} selectedIds
     */
    tidyUp(selectedIds) {
      const info = this.calculateGapHandles(selectedIds);
      if (!info || info.items.length < 2) return;

      const items = info.items;
      if (info.orientation === 'h') {
        const totalObjWidth = items.reduce((s, it) => s + it.width, 0);
        const first = items[0];
        const last = items[items.length - 1];
        const totalSpan = last.right - first.x;
        const targetGap = Math.max(0, Math.round((totalSpan - totalObjWidth) / (items.length - 1)));

        let curX = first.x;
        items.forEach(it => {
          const dx = curX - it.x;
          it.obj.transform.x = Math.round(it.obj.transform.x + dx);
          curX += it.width + targetGap;
        });
      } else {
        const totalObjHeight = items.reduce((s, it) => s + it.height, 0);
        const first = items[0];
        const last = items[items.length - 1];
        const totalSpan = last.bottom - first.y;
        const targetGap = Math.max(0, Math.round((totalSpan - totalObjHeight) / (items.length - 1)));

        let curY = first.y;
        items.forEach(it => {
          const dy = curY - it.y;
          it.obj.transform.y = Math.round(it.obj.transform.y + dy);
          curY += it.height + targetGap;
        });
      }

      $(document).trigger('object:change');
      if (typeof requestRender === 'function') requestRender();
    },

    /**
     * Mengatur jarak gap serentak untuk semua objek yang terpilih
     * @param {Object} tidyInfo - Hasil dari calculateGapHandles
     * @param {number} newGap - Nilai jarak baru (px)
     * @param {Array<Object>} [initialPositions] - Posisi awal yang terekam saat mulai drag
     */
    applyGap(tidyInfo, newGap, initialPositions) {
      if (!tidyInfo || !tidyInfo.items || tidyInfo.items.length < 2) return;
      const items = tidyInfo.items;
      const targetGap = Math.max(0, Math.round(newGap));

      // Jika tersedia initialPositions yang terekam pada pointerdown, gunakan posisi awal tersebut sebagai acuan absolut
      const posMap = new Map();
      if (Array.isArray(initialPositions)) {
        initialPositions.forEach(p => posMap.set(p.id, p));
      }

      if (tidyInfo.orientation === 'h') {
        const firstP = posMap.get(items[0].id);
        let curX = firstP ? firstP.initialWorldX : items[0].x;

        items.forEach(it => {
          const initP = posMap.get(it.id);
          const currentWorldX = it.x;
          const origWorldX = initP ? initP.initialWorldX : it.x;
          const origTransX = initP ? initP.initialTransformX : it.obj.transform.x;

          // Hitung posisi baru
          const newWorldX = curX;
          const deltaX = newWorldX - origWorldX;
          it.obj.transform.x = Math.round(origTransX + deltaX);

          curX += it.width + targetGap;
        });
      } else {
        const firstP = posMap.get(items[0].id);
        let curY = firstP ? firstP.initialWorldY : items[0].y;

        items.forEach(it => {
          const initP = posMap.get(it.id);
          const currentWorldY = it.y;
          const origWorldY = initP ? initP.initialWorldY : it.y;
          const origTransY = initP ? initP.initialTransformY : it.obj.transform.y;

          const newWorldY = curY;
          const deltaY = newWorldY - origWorldY;
          it.obj.transform.y = Math.round(origTransY + deltaY);

          curY += it.height + targetGap;
        });
      }

      $(document).trigger('object:change');
      if (typeof requestRender === 'function') requestRender();
    }
  };
})();
