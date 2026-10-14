# 📝 Roadmap & Progress Fitur

## Bab 1. Vector Primitives

### 1.1 Element Rectangle
- [x] Data Model & JSON Schema
- [x] Matrix Transformation (Local to World Space)
- [x] Oriented Bounding Box (OBB) & Rotasi
- [x] Global & Individual Corner Radius Control
- [x] Corner Radius Clamping Algorithm
- [x] Transisi Mode Select ke Node Edit Mode (Double Click)
- [x] Pergeseran titik vertex individual ($P_0, P_1, P_2, P_3$)
- [x] Bezier Handles pada titik vertex
- [ ] Multi-node Selection

### 1.2 Vector Pen Tool & Freeform Path
- [x] Pen Tool (`P`) interaktif pada canvas
- [x] Pembuatan titik sudut tajam (sharp corner / single click)
- [x] Penarikan handle kurva Bezier simetris (smooth curve / click & drag)
- [x] Penyesuaian sudut asimetris / patah (broken corner dengan Alt key)
- [x] Penutupan jalur (closed path) dengan klik titik awal ($P_0$)
- [x] Penyelesaian jalur terbuka (open path) dengan Enter / Escape
- [x] Mode Custom / Node Edit Mode (double click path untuk edit anchor & handles)
- [x] Toggle titik tajam $\leftrightarrow$ melengkung (double click node)
- [x] Export Vektor SVG & JSON Proyek untuk elemen path

### 1.3 Polygon & Star Primitives
- [x] Polygon Tool interaktif (`polygon.js`) dengan Shift (1:1) dan Alt (center drag)
- [x] Star Tool interaktif (`star.js`) dengan Shift (1:1) dan Alt (center drag)
- [x] Rendering canvas matematis $N$-sudut di `canvas.js`
- [x] Pengaturan Jumlah Sisi / Titik Sudut (**Count**) di panel Appearance
- [x] Pengaturan Kedalaman Lekukan Bintang (**Ratio**) di panel Appearance
- [x] Pengaturan Lengkungan Sudut (**Corner Radius**) di panel Appearance
- [x] Transisi otomatis kembali ke Select Tool setelah pembuatan
- [x] Dukungan penuh Export SVG `<polygon points="..." />`