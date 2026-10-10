# 📐 Structure JSON Specification

Spesifikasi format data proyek **MiniVector**. Format yang sama dipakai untuk **localStorage**, **export**, dan **import**.

Sumber kebenaran di kode: 
- `js/variabel.js` (`serializeProject`, `loadProject`, `State`)
- `js/tools/rectangle.js` (bentuk objek `rectangle`)
- `js/design/frame.js` (bentuk objek `frame`)

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

### A. Tipe: `frame` (Wadah / Container Kanvas Lokal)

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

### B. Tipe: `rectangle` (Bentuk Persegi Panjang)

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

## 5. Contoh Lengkap File Proyek

```json
{
  "schemaVersion": 1,
  "nextId": 3,
  "objects": [
    {
      "id": "frame-1",
      "type": "frame",
      "name": "Frame 1",
      "visible": true,
      "locked": false,
      "open": true,
      "clipContent": true,
      "transform": { "x": 100, "y": 100, "width": 300, "height": 200, "rotation": 0, "pivot": { "x": 0.5, "y": 0.5 } },
      "geometry": { "cornerRadius": [0, 0, 0, 0] },
      "style": { "fill": "#FFFFFF", "stroke": "#E5E5E5", "strokeWidth": 1 },
      "children": [
        {
          "id": "rect-1",
          "type": "rectangle",
          "name": "Rectangle 1",
          "visible": true,
          "locked": false,
          "transform": { "x": 20, "y": 20, "width": 80, "height": 50, "rotation": 0, "pivot": { "x": 0.5, "y": 0.5 } },
          "geometry": {
            "isCustomPath": false,
            "cornerRadius": [0, 0, 0, 0],
            "nodes": [
              { "id": "p0", "x": 0, "y": 0 },
              { "id": "p1", "x": 80, "y": 0 },
              { "id": "p2", "x": 80, "y": 50 },
              { "id": "p3", "x": 0, "y": 50 }
            ]
          },
          "style": { "fill": "#0D99FF", "stroke": "#000000", "strokeWidth": 1 }
        }
      ]
    },
    {
      "id": "rect-2",
      "type": "rectangle",
      "name": "Rectangle 2",
      "visible": true,
      "locked": false,
      "transform": { "x": 450, "y": 100, "width": 100, "height": 100, "rotation": 0, "pivot": { "x": 0.5, "y": 0.5 } },
      "geometry": {
        "isCustomPath": false,
        "cornerRadius": [0, 0, 0, 0],
        "nodes": [
          { "id": "p0", "x": 0, "y": 0 },
          { "id": "p1", "x": 100, "y": 0 },
          { "id": "p2", "x": 100, "y": 100 },
          { "id": "p3", "x": 0, "y": 100 }
        ]
      },
      "style": { "fill": "#D9D9D9", "stroke": "#000000", "strokeWidth": 1 }
    }
  ]
}
```