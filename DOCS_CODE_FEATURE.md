# Dokumentasi Arsitektur & Spesifikasi Fitur: Code Mode (HTML, CSS & Tailwind)

Dokumen ini menjelaskan rancangan komprehensif untuk fitur **Code Mode** pada MiniVector. Dokumen ini mencakup pemetaan kategori CSS, klasifikasi properti statis vs dinamis, sistem ukuran Tailwind terintegrasi, serta spesifikasi struktur data JSON anti-bedrock.

---

## 1. Filosofi & Konsep Utama

MiniVector memisahkan antarmuka inspeksi menjadi dua mode kerja:
1. **Design Mode**: Fokus pada manipulasi grafis, kanvas visual, vektor, dan properti visual instan.
2. **Code Mode**: Fokus pada paradigma pengembangan web (HTML5, CSS murni, dan Tailwind CSS), di mana elemen baru di dalam kontainer mengikuti alur dokumen web alami (*natural document flow*) dari sudut kiri-atas.

### Prinsip "Anti-Bedrock" (Pemisahan Peran Data)
* **Single Source of Truth**: Engine render kanvas (`js/canvas.js`) hanya bergantung pada nilai numerik piksel murni (`transform` dan `style`).
* **Decoupled Code Block**: Pengaturan khusus kode disimpan di dalam blok terisolasi `code: {}`. Jika blok ini ditiadakan atau kosong, kanvas tetap berjalan 60 FPS tanpa error.
* **Compute on the Fly**: Sintaks CSS dan utility class Tailwind dihitung secara dinamis di memori saat tab *Code* dibuka, sehingga file JSON proyek tetap ringan dan tidak mudah rusak.

---

## 2. Pemetaan Kategori CSS

Untuk memberikan pengalaman inspeksi ala browser DevTools dan editor modern (Framer/Webflow), seluruh properti CSS dikelompokkan ke dalam kategori yang terstruktur:

### A. Kelompok Statis (Bawaan / Single-Value)
Kategori-kategori ini adalah fondasi alur web yang selalu melekat pada elemen dan bernilai tunggal:

1. **`Display & Auto Layout`** *(Berada pada Objek Kontainer/Parent)*:
   - `display`: `flex` | `block` | `grid` | `none`
   - `flex-direction`: `row` | `column`
   - `gap`: Jarak antar elemen anak
   - `padding`: Padding dalam kontainer (`padding-top`, `padding-right`, `padding-bottom`, `padding-left`)
   - `align-items` & `justify-content`: Penyejajaran anak
2. **`Dimensions (Size)`**:
   - `width` & `height`: Nilai ukuran dengan dukungan unit (`px`, `rem`, `em`, `full`)
   - `min-width`, `max-width`, `min-height`, `max-height`
   - `box-sizing`: `border-box`
3. **`Appearance`**:
   - `border-radius`: Kelengkungan sudut (seragam atau 4 sisi independen `TL`, `TR`, `BR`, `BL`)
   - `opacity`: Transparansi elemen (0% s/d 100%)
   - `overflow`: `hidden` (Clip content) | `visible`
4. **`Typography`** *(Aktif otomatis untuk elemen Teks)*:
   - `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-align`, `text-transform`

### B. Kelompok Dinamis (Dapat Ditambah `+` & Dihapus Sesuai Kebutuhan)
Kategori dekoratif yang dapat ditumpuk berlapis-lapis (*multi-layer*):

1. **`[+] Position (Absolute Positioning)`**:
   - Secara default bernilai normal/statis agar tata letak web responsif dan tidak berantakan saat diekspor.
   - Ketika tombol `+` Position ditekan, elemen dilepas dari alur kontainer dan mengaktifkan:
     - `position: absolute;`
     - `top`, `right`, `bottom`, `left`, `z-index`
2. **`[+] Fill (Background)`**:
   - Multi-layer warna solid (`background-color`), gradasi linear/radial (`linear-gradient`), dan gambar (`url(...)`).
3. **`[+] Stroke / Border`**:
   - Multi-border dengan opsi ketebalan (`border-width`), tipe (`solid`, `dashed`, `dotted`), dan posisi garis (*inside*, *center*, *outside*).
4. **`[+] Effects`**:
   - Multi-layer bayangan luar (`box-shadow` drop shadow), bayangan dalam (*inner shadow*), dan kaca buram (`backdrop-filter: blur(...)`).
5. **`[+] Export`**:
   - Konfigurasi generator ekspor (Tailwind component, CSS stylesheet, atau raw HTML).

---

## 3. Sistem Dimensi: Input Number + Preset Select Tailwind

Pada panel dimensi `Width` (W) dan `Height` (H), antarmuka menyediakan 2 kontrol yang tersinkronisasi dua arah:
1. **`[input : number]`**: Input angka piksel bebas untuk desainer yang menginginkan dimensi presisi.
2. **`[select : option]`**: Dropdown skala Tailwind CSS standar lengkap dengan konversi `rem` dan `px`.

### Tabel Skala Dimensi Tailwind
| Pilihan Select | Class Tailwind | Nilai Rem (Base 16px) | Nilai Piksel | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `w-auto` | `w-auto` | `auto` | Otomatis | Mengikuti konten |
| `w-full` | `w-full` | `100%` | Penuh | Mengisi lebar container |
| `w-1` | `w-1` | `0.25rem` | `4px` | Sangat kecil |
| `w-2` | `w-2` | `0.5rem` | `8px` | Icon kecil / spacing |
| `w-3` | `w-3` | `0.75rem` | `12px` | Icon standar |
| `w-4` | `w-4` | `1rem` | `16px` | 1 unit dasar web |
| `w-5` | `w-5` | `1.25rem` | `20px` | Avatar mini / badge |
| `w-6` | `w-6` | `1.5rem` | `24px` | Tombol kecil |
| `w-8` | `w-8` | `2rem` | `32px` | Avatar / tombol medium |
| `w-10` | `w-10` | `2.5rem` | `40px` | Ukuran input standar |
| `w-12` | `w-12` | `3rem` | `48px` | Tinggi navbar |
| `w-16` | `w-16` | `4rem` | `64px` | Thumbnail |
| `w-20` | `w-20` | `5rem` | `80px` | Sidebar mini |
| `w-24` | `w-24` | `6rem` | `96px` | Foto profil besar |
| `w-32` | `w-32` | `8rem` | `128px` | Banner kecil |
| `w-48` | `w-48` | `12rem` | `192px` | Kartu produk |
| `w-64` | `w-64` | `16rem` | `256px` | Sidebar standar |
| `w-80` | `w-80` | `20rem` | `320px` | Dialog / modal |
| `w-96` | `w-96` | `24rem` | `384px` | Kartu lebar |
| `Custom...` | `w-[...px]` | Dihitung otomatis | Nilai bebas | Aktif jika angka di luar skala |

---

## 4. Spesifikasi Struktur Data JSON Objek

Berikut adalah spesifikasi skema JSON yang memisahkan data visual kanvas dan konfigurasi kode:

```json
{
  "id": "frame_card_01",
  "type": "frame",
  "name": "User Profile Card",
  "visible": true,
  "locked": false,

  "transform": {
    "x": 120,
    "y": 80,
    "width": 320,
    "height": 180,
    "rotation": 0,
    "flipX": false,
    "flipY": false
  },

  "geometry": {
    "cornerRadius": [12, 12, 12, 12]
  },

  "style": {
    "fill": "#FFFFFF",
    "stroke": "#E2E8F0",
    "strokeWidth": 1,
    "opacity": 1,
    "effects": [
      {
        "type": "drop-shadow",
        "x": 0,
        "y": 4,
        "blur": 12,
        "color": "rgba(0, 0, 0, 0.08)"
      }
    ]
  },

  "layout": {
    "display": "flex",
    "direction": "column",
    "gap": 12,
    "padding": [16, 16, 16, 16],
    "alignItems": "flex-start",
    "justifyContent": "flex-start"
  },

  "code": {
    "htmlTag": "article",
    "customClasses": "hover:shadow-lg transition-all",
    "sizing": {
      "width": {
        "unit": "preset",
        "tailwindClass": "w-80",
        "rawPx": 320
      },
      "height": {
        "unit": "preset",
        "tailwindClass": "h-auto",
        "rawPx": 180
      }
    },
    "position": {
      "isAbsolute": false,
      "top": null,
      "left": null,
      "right": null,
      "bottom": null,
      "zIndex": 1
    }
  },

  "children": []
}
```

---

## 5. Alur Generator Output Kode

### A. Output HTML & Tailwind (`js/code/tailwind.js`)
```html
<article class="flex flex-col gap-3 p-4 w-80 bg-white border border-slate-200 rounded-xl shadow-md hover:shadow-lg transition-all">
  <!-- Elemen Anak -->
</article>
```

### B. Output CSS Murni (`js/code/css.js`)
```css
.user-profile-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  width: 20rem; /* 320px */
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
```

---

## 6. Rencana Implementasi Bertahap

1. **Tahap 1: Fondasi Modul Kode**
   - Mengisi [`js/code/css.js`](file:///f:/Project%20Website/MiniVector/js/code/css.js) dan [`js/code/tailwind.js`](file:///f:/Project%20Website/MiniVector/js/code/tailwind.js) dengan parser konversi numerik-ke-CSS/Tailwind murni.
2. **Tahap 2: UI Panel Code**
   - Menambahkan section kelompok statis (*Layout, Dimensions, Appearance*) dan kelompok dinamis (*Position, Fill, Stroke, Effects*) pada tab Code di sidebar kanan.
3. **Tahap 3: Two-Way Sizing Binding**
   - Menautkan input angka dimensi dan dropdown skala preset Tailwind pada file [`js/design/size.js`](file:///f:/Project%20Website/MiniVector/js/design/size.js) dan [`js/code/layout.js`](file:///f:/Project%20Website/MiniVector/js/code/layout.js).
4. **Tahap 4: Toggle Absolute Position**
   - Menghubungkan tombol `+` Position agar elemen dapat dialihkan antara alur normal flexbox dan mengambang bebas.
