# Dokumentasi Kebutuhan dan Spesifikasi Aset Custom Cursor MiniVector

## 1. Deskripsi (Description)
Dokumen ini merupakan panduan spesifikasi dan daftar kebutuhan aset kursor kustom (*Custom Cursor*) untuk aplikasi editor vektor **MiniVector**. Implementasi kursor kustom bertujuan meniru pengalaman antarmuka grafis profesional ala Figma, di mana kursor berubah bentuk, tekstur, dan orientasi secara kontekstual ketika berinteraksi dengan kanvas desain serta objek-objek di dalamnya.

---

## 2. Tujuan (Tujuan)
1. **Meningkatkan Pengalaman Pengguna (UX Polish):** Memberikan umpan balik visual (*visual feedback*) yang instan dan intuitif terhadap aksi yang sedang aktif (seleksi, rotasi, perubahan ukuran, navigasi, dan pembuatan objek).
2. **Keterbacaan & Kontras Tinggi (High Contrast Dual-Tone):** Menggunakan desain dwi-warna (isi gelap dengan garis luar putih $1.5\text{px}$) sehingga kursor selalu terlihat jelas di atas kanvas gelap, terang, maupun di atas gambar/objek warna-warni.
3. **Presisi Titik Klik (Pixel-Perfect Hotspot):** Memastikan titik sentuh (*hotspot*) kursor berada tepat pada posisi geometris yang presisi (misalnya ujung lancip jarum pada panah atau titik tengah pada bidikan bidik).
4. **Konsistensi Visual Antar Platform:** Menghadirkan tampilan kursor yang seragam di semua sistem operasi (Windows, macOS, Linux) tanpa terpengaruh perbedaan kursor bawaan sistem operasi pengguna.

---

## 3. Daftar Kursor dalam Bentuk List Checkbox

### 3.1 Kursor Navigasi & Seleksi Utama (Navigation & Selection)
- [x] **`cursor-select` (Panah Utama)** : Sebagai kursor penunjuk utama di dalam area kanvas kerja | Ditampilkan saat Tool Select (`V`) aktif dan mouse berada di atas kanvas kosong atau objek netral. Titik hotspot berada pada ujung kiri atas jarum `(4, 3)`.
- [x] **`cursor-move-4way` (Panah 4 Arah)** : Menggeser/memindahkan posisi objek terpilih di kanvas | Aktif saat mengarahkan mouse ke badan objek terseleksi atau saat drag memindahkan objek. Hotspot di `(12, 12)`.
- [x] **`cursor-grab` (Tangan Terbuka)** : Memberi petunjuk visual bahwa kanvas siap digeser (*pan mode*) | Aktif saat menahan tombol `Space` atau mengaktifkan Hand Tool (`H`). Hotspot berada di tengah telapak tangan `(12, 12)`.
- [x] **`cursor-grabbing` (Tangan Mengepal)** : Memberi umpan balik bahwa kanvas sedang aktif ditarik/digeser | Aktif saat tombol kiri mouse ditekan dan diseret (*mouse drag*) dalam mode pan atau saat panning dengan tombol tengah mouse. Hotspot berada di `(12, 12)`.

### 3.2 Kursor Transformasi & Manipulasi Objek (Transformation & Handles)
- [x] **`cursor-rotate` (Dua Panah Melengkung $90^\circ$)** : Menunjukkan objek dapat diputar secara bebas | Ditampilkan saat kursor berada tepat di luar 4 sudut seleksi objek (zona rotasi luar). Hotspot berada tepat di titik pusat lingkaran lengkung `(12, 12)`.
- [x] **`cursor-resize-nwse` (Diagonal Kiri-Atas ke Kanan-Bawah)** : Mengubah ukuran objek secara diagonal dari sudut barat laut / tenggara | Aktif saat kursor berada di atas handle `nw` atau `se`. Hotspot di `(12, 12)`.
- [x] **`cursor-resize-nesw` (Diagonal Kanan-Atas ke Kiri-Bawah)** : Mengubah ukuran objek secara diagonal dari sudut timur laut / barat daya | Aktif saat kursor berada di atas handle `ne` atau `sw`. Hotspot di `(12, 12)`.
- [x] **`cursor-resize-ew` (Horizontal Kiri-Kanan)** : Mengubah lebar objek dari sisi samping | Aktif saat kursor berada di atas handle sisi `e` (kanan) atau `w` (kiri). Hotspot di `(12, 12)`.
- [x] **`cursor-resize-ns` (Vertikal Atas-Bawah)** : Mengubah tinggi objek dari sisi atas/bawah | Aktif saat kursor berada di atas handle sisi `n` (atas) atau `s` (bawah). Hotspot di `(12, 12)`.

### 3.3 Kursor Alat Pembuatan & Vektor (Creation & Drawing Tools)
- [x] **`cursor-crosshair` (Bidikan Garis Silang Presisi)** : Membantu penempatan awal titik koordinat bentuk dengan presisi tinggi | Aktif saat pengguna memilih alat pembuat bentuk: Rectangle (`R`), Frame (`F`), Ellipse (`O`), Polygon, atau Star. Hotspot di pusat persilangan `(12, 12)`.
- [x] **`cursor-pen` (Mata Pena Fountain)** : Menggambar titik kurva vektor bebas | Aktif saat Pen Tool (`P`) aktif untuk menambahkan node/anchor point baru di kanvas. Hotspot tepat di ujung mata pena `(3, 21)`.
- [x] **`cursor-pen-close` (Mata Pena dengan Lingkaran Kecil)** : Menandakan bahwa klik berikutnya akan menutup jalur path menjadi kurva tertutup (*closed path*) | Aktif saat kursor didekatkan ke titik awal pertama kurva pada mode Pen Tool. Hotspot di `(3, 21)`.
- [x] **`cursor-pencil` (Pensil Bebas)** : Menggambar garis bebas (*freehand vector stroke*) | Aktif saat Pencil Tool aktif. Hotspot tepat di ujung mata pensil `(3, 21)`.
- [x] **`cursor-text` (I-Beam Kontras)** : Menentukan posisi awal pengetikan teks | Aktif saat Text Tool (`T`) aktif di atas kanvas. Hotspot di tengah garis vertikal `(12, 12)`.

### 3.4 Kursor Modifikasi & Alat Bantu (Modifiers & Utilities)
- [x] **`cursor-duplicate` (Panah Ganda Hitam-Putih)** : Menandakan aksi duplikasi instan saat objek diseret | Ditampilkan saat objek sedang diseleksi dan pengguna menahan tombol `Alt` (Windows) / `Option` (macOS) sambil menyeret objek. Hotspot di ujung panah utama `(4, 3)`.
- [x] **`cursor-pipette` (Pipet Eyedropper)** : Mengambil sampel warna langsung dari pixel kanvas | Aktif saat pengguna membuka Color Picker dan mengklik ikon pipet sampel warna (`I`). Hotspot tepat di ujung tetesan pipet `(3, 21)`.
- [x] **`cursor-zoom-in` (Kaca Pembesar Plus)** : Memperbesar tampilan area kanvas | Aktif saat Zoom Tool aktif atau menahan shortcut pembesar. Hotspot di pusat lensa kaca `(10, 10)`.
- [x] **`cursor-zoom-out` (Kaca Pembesar Minus)** : Memperkecil tampilan area kanvas | Aktif saat Zoom Tool aktif disertai tombol `Alt`. Hotspot di `(10, 10)`.

---

## 4. Spesifikasi Aset (Spesifikasi Assets)

Untuk memastikan kompatibilitas penuh dengan engine browser dan tidak menimbulkan lag:

1. **Format File Utama:** **SVG (Scalable Vector Graphics)**
   - Format teks XML vektor (`.svg`), sangat ringan ($< 1\text{ KB}$ per berkas).
   - Dapat disematkan langsung sebagai CSS *Data-URI* (`data:image/svg+xml,...`) tanpa memicu permintaan HTTP jaringan (*zero network request*).
2. **Format Alternatif:** **PNG (Portable Network Graphics) 32-bit Alpha**
   - Resolusi Standar: $24 \times 24\text{ px}$ atau $32 \times 32\text{ px}$.
   - Resolusi Retina / HiDPI: $48 \times 48\text{ px}$ (faktor $2\times$ untuk layar resolusi tinggi).
3. **Palet Warna Desain (Dual-Tone Scheme):**
   - Warna Isi Utama (*Fill*): Hitam Pekat `#000000` (atau Dark Graphite `#1E1E1E`).
   - Warna Garis Tepi (*Stroke Outline*): Putih Bersih `#FFFFFF` dengan ketebalan $1.5\text{ px}$ (memberikan visibilitas tajam di latar belakang apapun).
   - Sudut Garis: `stroke-linejoin="round"` dan `stroke-linecap="round"` agar tepi kursor tidak bergerigi.
4. **Ketentuan CSS Browser:**
   - Wajib menyertakan *hotspot coordinate* $(x, y)$ dan *fallback keyword* bawaan:
     ```css
     cursor: url('assets/cursors/cursor-select.svg') 4 3, default;
     ```

---

## 5. Tempat Download Aset (Tempat Download Asetnya)

Aset-aset kursor di atas dapat diperoleh secara legal dan gratis dari sumber-sumber berikut:

1. **Figma Community (Rekomendasi Utama & Paling Presisi):**
   - Kunjungi: [figma.com/community](https://www.figma.com/community)
   - Kata Kunci Pencarian:
     - *"Figma Cursors Kit SVG"*
     - *"Design Tool Cursors Collection"*
     - *"Interactive Editor Cursors"*
   - Cara Ambil: Buka file di Figma $\rightarrow$ Pilih frame ikon kursor $\rightarrow$ Klik kanan $\rightarrow$ **Copy as SVG**.
2. **Koleksi Ikon Open Source:**
   - **Iconify:** [iconify.design](https://iconify.design/) (Cari: `cursor-pointer`, `cursor-rotate`, `pen-tool`, dll).
   - **Lucide Icons:** [lucide.dev](https://lucide.dev/) (Koleksi ikon open-source berbasis SVG yang konsisten).
   - **Tabler Icons:** [tabler-icons.io](https://tabler-icons.io/) (Menyediakan variasi ikon pointer dan navigasi gratis).
3. **Desain Mandiri di Vektor Editor:**
   - Buat frame kanvas berukuran $24 \times 24\text{ px}$ di Figma atau Illustrator.
   - Gambar siluet menggunakan Pen tool dengan warna hitam dan outline putih, lalu ekspor langsung ke format `.svg`.

---

## 6. Aturan Hukum & Lisensi (Aturan Hukum)

Saat mengunduh dan menyematkan aset kursor ke dalam MiniVector, wajib memperhatikan ketentuan hukum hak cipta berikut:

1. **Hak Cipta Merek Dagang (Trademark & Proprietary Assets):**
   - **DILARANG** mengekstrak atau menyalin secara mentah file binary kursor proprietari langsung dari paket instalasi aplikasi komersial (seperti Figma desktop app installer atau Adobe XD) jika berkas tersebut memiliki lisensi hak cipta tertutup.
2. **Lisensi yang Aman Digunakan:**
   - **MIT License / Apache 2.0:** Aset bebas digunakan, dimodifikasi, dan didistribusikan, baik untuk proyek non-komersial maupun komersial.
   - **Creative Commons Zero (CC0 / Public Domain):** Bebas digunakan tanpa kewajiban mencantumkan atribusi.
   - **CC-BY (Creative Commons Attribution):** Boleh digunakan secara bebas asalkan mencantumkan nama pembuat asli di file lisensi atau dokumentasi kredit aplikasi.
3. **Prinsip Kemiripan Fungsi (Functional Similarity):**
   - Bentuk fungsional umum (seperti panah sudut miring, panah lengkung rotasi, tanda silang crosshair, dan mata pena) adalah konvensi antarmuka grafis standar dunia (*standard UI conventions*) dan **tidak melanggar hak cipta** selama dibuat ulang (*re-created / redrawn*) secara independen dan tidak menyalin kode rahasia dagang milik pihak lain.
