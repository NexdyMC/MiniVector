# 📂 Arsitektur & Struktur Direktori Codebase

Penjelasan pembagian tanggung jawab modul pada proyek Mini Figma.

| Direktori / File | Fungsi Utama |
| :--- | :--- |
| `src/core/Engine.js` | Mengelola main loop Canvas, requestAnimationFrame, dan re-render |
| `src/core/Matrix2D.js` | Utilitas matematika transformasi matriks 2D dan kalkulasi koordinat lokal/global |
| `src/geometry/VectorRectangle.js` | Logika kalkulasi bentuk kotak, bounding box, dan path fillet corner |
| `src/geometry/Fillet.js` | Algoritma *clamping* radius untuk mencegah bug tumpang tindih garis |
| `src/interaction/SelectMode.js` | Penanganan *bounding box handles*, drag resize, dan rotasi |
| `src/interaction/NodeEditMode.js` | Penanganan interaksi edit titik sudut saat *double click* |