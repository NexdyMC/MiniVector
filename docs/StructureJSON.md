# 📐 Structure JSON Specification

Spesifikasi format data proyek **MiniVector**. Format yang sama dipakai untuk **localStorage**, **export**, dan **import**.

Sumber kebenaran di kode: 
- `js/variabel.js` (`serializeProject`, `loadProject`, `State`)
- `js/tools/rectangle.js` (bentuk objek `rectangle`)
- `js/design/frame.js` (bentuk objek `frame`)
- `js/paint.js` dan `js/design/fill.js` (data `fills`, bagian 6)

Penanda status: 
- ✅ sudah dipakai & aktif di kode saat ini
- 🔜 sudah ada di skema / disiapkan untuk fitur selanjutnya

---

## 1. Amplop Proyek (Root Schema)

```json
{
  "schemaVersion": 1,
  "nextId": 3,
  "objects": []
}
```

| Field | Tipe | Keterangan | Status |
| :--- | :--- | :--- | :---: |
| `schemaVersion` | integer ≥ 1 | Versi format. Dipakai untuk migrasi dan untuk menolak file dari versi yang lebih baru. | ✅ |
| `nextId` | integer ≥ 1 | Penghitung id berikutnya, dipakai bersama oleh semua tipe objek. | ✅ |
| `objects` | array | Daftar objek/elemen tingkat root di kanvas. | ✅ |

> **State Sesi Sementara (Tidak Disimpan di JSON Proyek):**  
> `State.zoom`, `State.panX`, `State.panY`, `State.tool`, `State.drawing`, `State.selectedIds`, dan `State.marquee`.

---

## 2. Penyimpanan localStorage

- **Key:** `minivector:project`
- **Isi:** `JSON.stringify(serializeProject())`
- **Debounce Save:** Disimpan otomatis 300 ms setelah event `object:add`, `object:change`, atau `object:remove`, serta saat `pagehide` jika masih ada antrean simpan.
- **Auto-Load:** Dimuat otomatis saat inisialisasi aplikasi (`loadFromStorage`). Data rusak / tidak valid $\rightarrow$ reset proyek dan log peringatan ke Console.

---

## 3. Aturan Validasi & Muat Data (`loadProject`)

1. Data harus berupa objek dengan `objects` bertipe Array.
2. `schemaVersion` harus integer antara 1 sampai versi aplikasi saat ini (`SCHEMA_VERSION = 1`).
3. Elemen yang tidak memiliki `id` bertipe string atau `type` bertipe string dibuang.
4. `nextId` dihitung otomatis dari nilai tertinggi `nextId` atau ID objek terbesar + 1.
5. Setelah sukses dimuat, event `project:load` dipicu.

---

## 4. Spesifikasi Struktur Elemen Berdasarkan Tipe (`type`)

Setiap elemen di MiniVector memiliki field dasar umum (*Common Fields*):
* `id` *(string)*: Identitas unik (contoh: `"rect-1"`, `"frame-1"`).
* `type` *(string)*: Tipe elemen (`"frame"`, `"rectangle"`, `"ellipse"`, `"text"`, dll).
* `name` *(string)*: Nama label layer (contoh: `"Frame 1"`, `"Rectangle 1"`).
* `visible` *(boolean)*: `true` = tampil, `false` = disembunyikan.
* `locked` *(boolean)*: `true` = terkunci dari pengeditan langsung.

---

## 5. Structure Json Bagian Tools

### 5.1 Tipe: `frame` (Wadah / Container Kanvas Lokal)

Frame adalah wadah penampung elemen yang memiliki sistem koordinat lokal sendiri dan memotong visual anak elemennya jika keluar batas (*content clipping*).

```json
{
  "id": "frame-1",
  "type": "frame",
  "name": "Frame 1",
  "visible": true,
  "locked": false,
  "open": true,
  "clipContent": true,
  "transform": {
    "x": 100,
    "y": 100,
    "width": 400,
    "height": 300,
    "rotation": 0,
    "pivot": { "x": 0.5, "y": 0.5 }
  },
  "geometry": {
    "cornerRadius": [0, 0, 0, 0]
  },
  "style": {
    "fill": "#FFFFFF",
    "stroke": "#E5E5E5",
    "strokeWidth": 1
  },
  "children": [
    {
      "id": "rect-1",
      "type": "rectangle",
      "name": "Rectangle 1",
      "visible": true,
      "locked": false,
      "transform": {
        "x": 20,
        "y": 20,
        "width": 80,
        "height": 50,
        "rotation": 0,
        "pivot": { "x": 0.5, "y": 0.5 }
      },
      "geometry": {
        "isCustomPath": false,
        "cornerRadius": [0, 0, 0, 0],
        "nodes": []
      },
      "style": {
        "fill": "#D9D9D9",
        "stroke": "#000000",
        "strokeWidth": 1
      }
    }
  ]
}
```

| Field | Tipe | Keterangan | Status |
| :--- | :--- | :--- | :---: |
| `open` | boolean | Status expand (`true`) atau collapse (`false`) pada panel daftar layer. | ✅ |
| `clipContent` | boolean | `true` = memotong tampilan elemen anak yang melebihi batas frame (`ctx.clip()`). | ✅ |
| `transform.x`, `transform.y` | number | Posisi frame di koordinat dunia. | ✅ |
| `transform.width`, `height` | number ≥ 0 | Dimensi frame. | ✅ |
| `geometry.cornerRadius` | [number, number, number, number] | Sudut melengkung `[tl, tr, br, bl]`. | 🔜 |
| `style.fill` | string | Warna latar belakang frame (hex / rgba). | ✅ |
| `style.stroke` | string | Warna garis tepi frame. | ✅ |
| `style.strokeWidth` | number | Tebal border frame. | ✅ |
| `children` | array of objects | Daftar elemen anak yang bersarang di dalam frame (menggunakan koordinat relatif terhadap frame). | ✅ |

---

### 5.2 Tipe: `rectangle` (Bentuk Persegi Panjang)

```json
{
  "id": "rect-106",
  "type": "rectangle",
  "name": "Rectangle 106",
  "visible": true,
  "locked": false,
  "transform": {
    "x": 150,
    "y": 200,
    "width": 120,
    "height": 80,
    "rotation": 0,
    "pivot": { "x": 0.5, "y": 0.5 }
  },
  "geometry": {
    "isCustomPath": false,
    "cornerRadius": [0, 0, 0, 0],
    "nodes": [
      { "id": "p0", "x": 0, "y": 0 },
      { "id": "p1", "x": 120, "y": 0 },
      { "id": "p2", "x": 120, "y": 80 },
      { "id": "p3", "x": 0, "y": 80 }
    ]
  },
  "style": {
    "fill": "#D9D9D9",
    "stroke": "#000000",
    "strokeWidth": 1
  }
}
```

| Field | Tipe | Keterangan | Status |
| :--- | :--- | :--- | :---: |
| `transform.x`, `transform.y` | number | Posisi pojok kiri-atas. Jika berada di root = koordinat dunia; jika di dalam frame = koordinat relatif frame. | ✅ |
| `transform.width`, `height` | number ≥ 0 | Ukuran lebar dan tinggi objek. | ✅ |
| `transform.rotation` | number | Sudut putar dalam derajat. Default `0`. | 🔜 |
| `transform.pivot` | `{x, y}` | Titik pusat rotasi (0.0 sampai 1.0). Default `{x: 0.5, y: 0.5}`. | 🔜 |
| `geometry.isCustomPath` | boolean | `false` = geometri dihitung dari `width` & `height`. `true` = mengikuti `nodes`. | 🔜 |
| `geometry.cornerRadius` | [number, number, number, number] | Radius lengkungan 4 sudut: `[kiri-atas, kanan-atas, kanan-bawah, kiri-bawah]`. | 🔜 |
| `geometry.nodes` | array of point `{id, x, y}` | Titik sudut lokal searah jarum jam (`p0`, `p1`, `p2`, `p3`). | 🔜 |
| `style.fill` | string | Warna isian hex / rgba. | ✅ |
| `style.stroke` | string | Warna garis tepi hex / rgba. | ✅ |
| `style.strokeWidth` | number | Tebal garis (satuan dunia). `0` = tanpa garis. | ✅ |


---

## 6 Structure Json Bagian Property
properti fill didefinisikan sebagai sebuah atribut berbasis array yang berfungsi layaknya tumpukan lapisan visual (layers) independen untuk mengisi area dalam dari sebuah objek atau shape geometris.

### 6.1 Property Fill Object 
```json
{
  "fills": [
    {
      "id": "fill_linear",
      "type": "GRADIENT_LINEAR",
      "visible": true,
      "opacity": 1.0,
      "start": { "x": 0, "y": 0.5 },
      "end": { "x": 1, "y": 0.5 },
      "stops": [
        { "offset": 0.0, "color": "#FFF000", "opacity": 1.0 },
        { "offset": 1.0, "color": "#FFFFFF", "opacity": 1.0 }
      ]
    },
    {
      "id": "fill_radial",
      "type": "GRADIENT_RADIAL",
      "visible": true,
      "opacity": 1.0,
      "center": { "x": 0.5, "y": 0.5 },
      "radius": { "rx": 0.5, "ry": 0.5 },
      "stops": [
        { "offset": 0.0, "color": "#FFF000", "opacity": 1.0 },
        { "offset": 1.0, "color": "#FFFFFF", "opacity": 1.0 }
      ]
    },
    {
      "id": "fill_angular",
      "type": "GRADIENT_ANGULAR",
      "visible": true,
      "opacity": 1.0,
      "center": { "x": 0.5, "y": 0.5 },
      "startAngle": 0,
      "stops": [
        { "offset": 0.0, "color": "#FFF000", "opacity": 1.0 },
        { "offset": 0.5, "color": "#FF0000", "opacity": 1.0 },
        { "offset": 1.0, "color": "#FFF000", "opacity": 1.0 }
      ]
    },
    {
      "id": "fill_diamond",
      "type": "GRADIENT_DIAMOND",
      "visible": true,
      "opacity": 1.0,
      "center": { "x": 0.5, "y": 0.5 },
      "size": { "width": 0.5, "height": 0.5 },
      "angle": 0,
      "stops": [
        { "offset": 0.0, "color": "#FFF000", "opacity": 1.0 },
        { "offset": 1.0, "color": "#FFFFFF", "opacity": 1.0 }
      ]
    },
    {
      "id": "fill_image",
      "type": "IMAGE",
      "visible": true,
      "opacity": 1.0,
      "scaleMode": "FILL",
      "source": "https://assets.minivector.app/uploads/sample-photo.jpg",
      "adjustments": {
        "exposure": 0.0,
        "contrast": 0.0,
        "saturation": 0.0,
        "temperature": 0.0,
        "tint": 0.0,
        "highlights": 0.0,
        "shadows": 0.0
      }
    }
  ]
}
```

| Properti | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `fills` | `Array of Objects` | Ya | Wadah utama (berupa tumpukan/layer) yang menampung seluruh konfigurasi pengisian area *shape*. |
| `id` | `String` | Ya | Identifier unik untuk spesifik layer *fill* (berguna untuk manipulasi atau *reordering* layer di sistem). |
| `type` | `String` | Ya | Menentukan jenis *fill* (Enum: `SOLID`, `GRADIENT_LINEAR`, `GRADIENT_RADIAL`, `PATTERN`, `IMAGE`, dll). |
| `visible` | `Boolean` | Ya | Status visibilitas layer. `true` berarti layer ditampilkan (ikon mata terbuka), `false` berarti disembunyikan. |
| `opacity` | `Number (Float)` | Ya | Opasitas keseluruhan untuk satu layer *fill* ini. Menggunakan skala desimal `0.0` (transparan) hingga `1.0` (solid). |
| `start` | `Object {x, y}` | Ya* | Koordinat awal garis arah (*handle*) gradien. (*Wajib untuk tipe `GRADIENT_LINEAR`). |
| `start.x` / `start.y` | `Number` | Ya | Koordinat X dan Y awal gradien, **relatif terhadap kotak pembatas objek** (`0.0` = tepi kiri / atas, `1.0` = tepi kanan / bawah). |
| `end` | `Object {x, y}` | Ya* | Koordinat akhir garis arah (*handle*) gradien. (*Wajib untuk tipe `GRADIENT_LINEAR`). |
| `end.x` / `end.y` | `Number` | Ya | Koordinat X dan Y titik akhir gradien, dengan satuan yang sama (0–1 relatif terhadap kotak pembatas). |
| `stops` | `Array of Objects` | Ya* | Kumpulan titik henti warna (*color stops*) pembentuk transisi gradien. Minimal butuh 2 objek. (*Wajib untuk semua tipe gradien). |
| `stops[n].offset` | `Number (Float)` | Ya | Posisi berhentinya warna pada bentangan garis gradien. Skala rasio desimal dari `0.0` hingga `1.0`. |
| `stops[n].color` | `String` | Ya | Nilai warna pengisi pada *stop* tersebut, biasanya menggunakan format kode *Hexadecimal* (contoh: `#FFF000`). |
| `stops[n].opacity` | `Number (Float)` | Ya | Opasitas pada titik warna (*stop*) spesifik ini. Menggunakan skala `0.0` hingga `1.0`. |

> **Catatan Implementasi Engine:** 
> Pastikan nilai offset pada array `stops` selalu diurutkan dari nilai terkecil (`0.0`) ke nilai terbesar (`1.0`) untuk mencegah *error* saat diterjemahkan ke fungsi bawaan Canvas `addColorStop()`.


### 6.2 Tipe `SOLID` (Warna Polos) ✅

```json
{
  "id": "fill_a1b2c3",
  "type": "SOLID",
  "visible": true,
  "opacity": 1.0,
  "color": "#D9D9D9"
}
```

| Properti | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `type` | `String` | Ya | `"SOLID"`. |
| `color` | `String` | Ya | Warna `#RRGGBB` (huruf besar). Hex 8 digit (`#RRGGBBAA`) tetap dibaca; alpha-nya dikalikan dengan `opacity`. |
| `opacity` | `Number` | Ya | `0.0`–`1.0`. Opasitas fill ini saja, terpisah dari opasitas objek. |

Format Hex, RGB, CSS, HSL, dan HSB di panel warna hanya cara menampilkan dan mengetik; data selalu disimpan sebagai `color` (hex) dan `opacity`.

### 6.3 Lokasi, Urutan, dan Kompatibilitas ✅

- **Lokasi:** `style.fills` (array) pada setiap objek: `frame`, `rectangle`, `ellipse`. `fills: []` berarti tanpa isian.
- **Urutan:** indeks `0` paling belakang, indeks terakhir paling depan (sama dengan `objects`). Panel Fill menampilkannya terbalik (paling depan di atas).
- **Format lama:** `style.fill` (string hex / rgba) tetap dibaca sebagai satu fill `SOLID`. Saat objek diedit lewat panel Fill, datanya dikonversi ke `style.fills` dan `style.fill` dihapus. Bila `style.fills` ada, `style.fill` diabaikan.
- **Yang tergambar saat ini:** `SOLID`, `GRADIENT_LINEAR`, `GRADIENT_RADIAL`, dan `GRADIENT_ANGULAR`. Tipe `GRADIENT_DIAMOND`, `PATTERN`, dan `IMAGE` boleh disimpan tetapi dilewati saat render sampai fiturnya dikerjakan.
- **Objek baru** dari tool Rectangle, Ellipse, dan Frame masih memakai `style.fill`; konversi terjadi otomatis saat fill-nya diedit.


### 6.4 Tipe Gradient ✅ (`GRADIENT_LINEAR`, `GRADIENT_RADIAL`, `GRADIENT_ANGULAR`)

Semua koordinat gradient berada di ruang **0–1 relatif terhadap kotak pembatas objek**, bukan piksel, sehingga gradient ikut menyesuaikan saat objek di-resize. (Contoh awal dokumen memakai angka 0–100; sekarang disesuaikan dengan aturan ini.)

```json
{
  "id": "fill_x1y2z3",
  "type": "GRADIENT_RADIAL",
  "visible": true,
  "opacity": 1.0,
  "center": { "x": 0.5, "y": 0.5 },
  "radius": { "rx": 0.5, "ry": 0.5 },
  "stops": [
    { "offset": 0.0, "color": "#FFFFFF", "opacity": 1.0 },
    { "offset": 1.0, "color": "#000000", "opacity": 1.0 }
  ]
}
```

| Tipe | Properti geometri | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `GRADIENT_LINEAR` | `start {x,y}`, `end {x,y}` | `(0, 0.5)` → `(1, 0.5)` | Garis arah gradient; kiri ke kanan. Panel warna menampilkannya sebagai sudut (°, `0` = ke kanan, searah jarum jam). |
| `GRADIENT_RADIAL` | `center {x,y}`, `radius {rx,ry}` | pusat `(0.5, 0.5)`, radius `0.5 / 0.5` | `rx` dan `ry` relatif terhadap lebar dan tinggi objek, jadi bentuknya elips. Warna setelah radius memakai stop terakhir. |
| `GRADIENT_ANGULAR` | `center {x,y}`, `startAngle` | pusat `(0.5, 0.5)`, `0` | `startAngle` dalam derajat, searah jarum jam, `0` = arah kanan (jam 3). Memakai `createConicGradient` milik browser. |
| `GRADIENT_DIAMOND` | `center`, `size`, `angle` | – | 🔜 Belum digambar dan belum bisa dipilih di panel warna. |

Aturan `stops`:

- Minimal 2 stop. Hanya `offset` (0.0–1.0), `color` (`#RRGGBB`), dan `opacity` (0.0–1.0) yang dibaca.
- Selalu disimpan **terurut naik** menurut `offset`.
- Opasitas akhir sebuah stop = `opacity` paint × `opacity` stop.
- Fill gradient tidak memiliki field `color`.
- Berganti tipe mengganti field geometri ke bawaan tipe baru (pusat dipertahankan antara radial dan angular) dan mempertahankan `stops`.
- Gradient baru dari warna polos: stop `0` = warna tadi, stop `1` = warna yang sama dibuat lebih gelap (mis. `#D9D9D9` → `#737373`). Kembali ke `SOLID` memakai stop pertama.