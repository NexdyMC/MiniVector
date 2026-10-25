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
    activeSpacingGuides: [], // Garis panduan equal spacing aktif

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
      if (this.activeSpacingGuides && this.activeSpacingGuides.length > 0) {
        this.activeSpacingGuides = [];
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

      // ==============================================================
      // FITUR: SMART EQUAL SPACING SNAPPING
      // Deteksi ketika jarak antar objek berurutan sama persis (Gap A-B == Gap B-C)
      // ==============================================================
      const spacingGuides = [];

      // 1. EQUAL SPACING PADA SUMBU X (Horizontal)
      if (candidates.length >= 2) {
        // Cari kandidat yang berada pada rentang vertikal yang bertumpang tindih (overlapping Y)
        const currentSnapX = bestGuideX ? snapX : box.x;
        const curBox = { x: currentSnapX, y: box.y, width: box.width, height: box.height };

        const hCandidates = candidates.filter(c => {
          const overlapY = Math.min(curBox.y + curBox.height, c.y + c.height) - Math.max(curBox.y, c.y);
          return overlapY > 0;
        });

        if (hCandidates.length >= 2) {
          // Cari pasangan (A, B) di mana keduanya adalah kandidat statis
          for (let i = 0; i < hCandidates.length; i++) {
            for (let j = 0; j < hCandidates.length; j++) {
              if (i === j) continue;
              const a = hCandidates[i];
              const b = hCandidates[j];

              // Pastikan a berada di sebelah kiri b tanpa overlap horizontal besar
              const gapAB = b.x - (a.x + a.width);
              if (gapAB < 2) continue; // jarak minimal positif

              // KASUS 1: curBox berada di sebelah kanan B -> (A, B, curBox)
              // Jarak curBox ke B harus sama dengan gapAB: targetX = (b.x + b.width) + gapAB
              const targetX1 = (b.x + b.width) + gapAB;
              const diff1 = Math.abs(curBox.x - targetX1);
              if (diff1 <= worldThreshold && (!bestGuideX || diff1 < bestDiffX)) {
                snapX = targetX1;
                bestGuideX = null; // Prioritaskan atau lengkapi dengan equal spacing
                bestDiffX = diff1;

                const midY = (Math.max(a.y, b.y, curBox.y) + Math.min(a.y + a.height, b.y + b.height, curBox.y + curBox.height)) / 2;
                spacingGuides.push({
                  orientation: 'h',
                  gap: gapAB,
                  segments: [
                    { x1: a.x + a.width, x2: b.x, y: midY },
                    { x1: b.x + b.width, x2: snapX, y: midY }
                  ]
                });
              }

              // KASUS 2: curBox berada di sebelah kiri A -> (curBox, A, B)
              // Jarak A ke curBox harus sama dengan gapAB: targetX = a.x - gapAB - curBox.width
              const targetX2 = a.x - gapAB - curBox.width;
              const diff2 = Math.abs(curBox.x - targetX2);
              if (diff2 <= worldThreshold && (!bestGuideX || diff2 < bestDiffX)) {
                snapX = targetX2;
                bestGuideX = null;
                bestDiffX = diff2;

                const midY = (Math.max(a.y, b.y, curBox.y) + Math.min(a.y + a.height, b.y + b.height, curBox.y + curBox.height)) / 2;
                spacingGuides.push({
                  orientation: 'h',
                  gap: gapAB,
                  segments: [
                    { x1: snapX + curBox.width, x2: a.x, y: midY },
                    { x1: a.x + a.width, x2: b.x, y: midY }
                  ]
                });
              }

              // KASUS 3: curBox berada di tengah antara A dan B -> (A, curBox, B)
              // gap1 = curBox.x - (a.x + a.width), gap2 = b.x - (curBox.x + curBox.width)
              // gap1 == gap2 => targetX = (a.x + a.width + b.x - curBox.width) / 2
              const availableSpace = b.x - (a.x + a.width);
              if (availableSpace > curBox.width) {
                const targetGap = (availableSpace - curBox.width) / 2;
                const targetX3 = a.x + a.width + targetGap;
                const diff3 = Math.abs(curBox.x - targetX3);
                if (diff3 <= worldThreshold && (!bestGuideX || diff3 < bestDiffX)) {
                  snapX = targetX3;
                  bestGuideX = null;
                  bestDiffX = diff3;

                  const midY = (Math.max(a.y, b.y, curBox.y) + Math.min(a.y + a.height, b.y + b.height, curBox.y + curBox.height)) / 2;
                  spacingGuides.push({
                    orientation: 'h',
                    gap: Math.round(targetGap),
                    segments: [
                      { x1: a.x + a.width, x2: snapX, y: midY },
                      { x1: snapX + curBox.width, x2: b.x, y: midY }
                    ]
                  });
                }
              }
            }
          }
        }
      }

      // 2. EQUAL SPACING PADA SUMBU Y (Vertical)
      if (candidates.length >= 2) {
        const currentSnapY = bestGuideY ? snapY : box.y;
        const curBox = { x: box.x, y: currentSnapY, width: box.width, height: box.height };

        const vCandidates = candidates.filter(c => {
          const overlapX = Math.min(curBox.x + curBox.width, c.x + c.width) - Math.max(curBox.x, c.x);
          return overlapX > 0;
        });

        if (vCandidates.length >= 2) {
          for (let i = 0; i < vCandidates.length; i++) {
            for (let j = 0; j < vCandidates.length; j++) {
              if (i === j) continue;
              const a = vCandidates[i];
              const b = vCandidates[j];

              // Pastikan a berada di atas b
              const gapAB = b.y - (a.y + a.height);
              if (gapAB < 2) continue;

              // KASUS 1: curBox di bawah B -> (A, B, curBox)
              const targetY1 = (b.y + b.height) + gapAB;
              const diff1 = Math.abs(curBox.y - targetY1);
              if (diff1 <= worldThreshold && (!bestGuideY || diff1 < bestDiffY)) {
                snapY = targetY1;
                bestGuideY = null;
                bestDiffY = diff1;

                const midX = (Math.max(a.x, b.x, curBox.x) + Math.min(a.x + a.width, b.x + b.width, curBox.x + curBox.width)) / 2;
                spacingGuides.push({
                  orientation: 'v',
                  gap: gapAB,
                  segments: [
                    { y1: a.y + a.height, y2: b.y, x: midX },
                    { y1: b.y + b.height, y2: snapY, x: midX }
                  ]
                });
              }

              // KASUS 2: curBox di atas A -> (curBox, A, B)
              const targetY2 = a.y - gapAB - curBox.height;
              const diff2 = Math.abs(curBox.y - targetY2);
              if (diff2 <= worldThreshold && (!bestGuideY || diff2 < bestDiffY)) {
                snapY = targetY2;
                bestGuideY = null;
                bestDiffY = diff2;

                const midX = (Math.max(a.x, b.x, curBox.x) + Math.min(a.x + a.width, b.x + b.width, curBox.x + curBox.width)) / 2;
                spacingGuides.push({
                  orientation: 'v',
                  gap: gapAB,
                  segments: [
                    { y1: snapY + curBox.height, y2: a.y, x: midX },
                    { y1: a.y + a.height, y2: b.y, x: midX }
                  ]
                });
              }

              // KASUS 3: curBox berada di tengah antara A dan B -> (A, curBox, B)
              const availableSpace = b.y - (a.y + a.height);
              if (availableSpace > curBox.height) {
                const targetGap = (availableSpace - curBox.height) / 2;
                const targetY3 = a.y + a.height + targetGap;
                const diff3 = Math.abs(curBox.y - targetY3);
                if (diff3 <= worldThreshold && (!bestGuideY || diff3 < bestDiffY)) {
                  snapY = targetY3;
                  bestGuideY = null;
                  bestDiffY = diff3;

                  const midX = (Math.max(a.x, b.x, curBox.x) + Math.min(a.x + a.width, b.x + b.width, curBox.x + curBox.width)) / 2;
                  spacingGuides.push({
                    orientation: 'v',
                    gap: Math.round(targetGap),
                    segments: [
                      { y1: a.y + a.height, y2: snapY, x: midX },
                      { y1: snapY + curBox.height, y2: b.y, x: midX }
                    ]
                  });
                }
              }
            }
          }
        }
      }

      this.activeGuides = guides;
      this.activeSpacingGuides = spacingGuides;

      const hasSnapX = (bestGuideX !== null) || (Math.abs(snapX - box.x) > 0.001);
      const hasSnapY = (bestGuideY !== null) || (Math.abs(snapY - box.y) > 0.001);

      return {
        x: hasSnapX ? snapX : box.x,
        y: hasSnapY ? snapY : box.y,
        deltaX: hasSnapX ? snapX - box.x : 0,
        deltaY: hasSnapY ? snapY - box.y : 0,
        snappedX: hasSnapX,
        snappedY: hasSnapY
      };
    },
    /**
     * Menghitung koreksi snap saat me-resize bounding box melalui handle tertentu
     * @param {Object} box - { x, y, width, height } hasil resize saat ini (sebelum magnet)
     * @param {string} handle - jenis handle aktif: 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'
     * @param {Array<Object>} candidates - daftar kandidat objek lain di kanvas
     * @param {number} zoom - level zoom
     * @returns {Object} { x, y, width, height, snappedX, snappedY }
     */
    snapResize(box, handle, candidates, zoom = 1) {
      if (!this.enabled || !candidates || candidates.length === 0) {
        this.clear();
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          snappedX: false,
          snappedY: false
        };
      }

      const worldThreshold = this.threshold / (zoom || 1);
      const guides = [];

      let newX = box.x;
      let newY = box.y;
      let newW = box.width;
      let newH = box.height;

      let bestDiffX = worldThreshold + 1;
      let bestGuideX = null;
      let bestDiffY = worldThreshold + 1;
      let bestGuideY = null;

      const hasWest = handle.includes('w');
      const hasEast = handle.includes('e');
      const hasNorth = handle.includes('n');
      const hasSouth = handle.includes('s');

      for (const target of candidates) {
        if (!target) continue;

        const targetXPoints = [
          { type: 'left', val: target.x },
          { type: 'center', val: target.x + target.width / 2 },
          { type: 'right', val: target.x + target.width }
        ];

        const targetYPoints = [
          { type: 'top', val: target.y },
          { type: 'center', val: target.y + target.height / 2 },
          { type: 'bottom', val: target.y + target.height }
        ];

        // Sumbu X: Handle Barat (w) menggerakkan sisi kiri (box.x)
        if (hasWest) {
          const currentLeft = box.x;
          for (const tx of targetXPoints) {
            const diff = Math.abs(currentLeft - tx.val);
            if (diff <= worldThreshold && diff < bestDiffX) {
              const proposedW = (box.x + box.width) - tx.val;
              if (proposedW >= 1) {
                bestDiffX = diff;
                newX = tx.val;
                newW = proposedW;
                bestGuideX = {
                  type: 'v',
                  pos: tx.val,
                  fromY: Math.min(box.y, target.y) - 20,
                  toY: Math.max(box.y + box.height, target.y + target.height) + 20
                };
              }
            }
          }
        }
        // Sumbu X: Handle Timur (e) menggerakkan sisi kanan (box.x + box.width)
        else if (hasEast) {
          const currentRight = box.x + box.width;
          for (const tx of targetXPoints) {
            const diff = Math.abs(currentRight - tx.val);
            if (diff <= worldThreshold && diff < bestDiffX) {
              const proposedW = tx.val - box.x;
              if (proposedW >= 1) {
                bestDiffX = diff;
                newW = proposedW;
                bestGuideX = {
                  type: 'v',
                  pos: tx.val,
                  fromY: Math.min(box.y, target.y) - 20,
                  toY: Math.max(box.y + box.height, target.y + target.height) + 20
                };
              }
            }
          }
        }

        // Sumbu Y: Handle Utara (n) menggerakkan sisi atas (box.y)
        if (hasNorth) {
          const currentTop = box.y;
          for (const ty of targetYPoints) {
            const diff = Math.abs(currentTop - ty.val);
            if (diff <= worldThreshold && diff < bestDiffY) {
              const proposedH = (box.y + box.height) - ty.val;
              if (proposedH >= 1) {
                bestDiffY = diff;
                newY = ty.val;
                newH = proposedH;
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
        // Sumbu Y: Handle Selatan (s) menggerakkan sisi bawah (box.y + box.height)
        else if (hasSouth) {
          const currentBottom = box.y + box.height;
          for (const ty of targetYPoints) {
            const diff = Math.abs(currentBottom - ty.val);
            if (diff <= worldThreshold && diff < bestDiffY) {
              const proposedH = ty.val - box.y;
              if (proposedH >= 1) {
                bestDiffY = diff;
                newH = proposedH;
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
      }

      if (bestGuideX) guides.push(bestGuideX);
      if (bestGuideY) guides.push(bestGuideY);

      this.activeGuides = guides;
      this.activeSpacingGuides = [];

      return {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
        snappedX: bestGuideX !== null,
        snappedY: bestGuideY !== null
      };
    }
  };
})();
