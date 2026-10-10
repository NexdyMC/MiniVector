# 📐 Structure JSON Specification

Spesifikasi format data proyek **MiniVector**. Format yang sama dipakai untuk **localStorage**, **export**, dan **import**.

Sumber kebenaran di kode: `js/variabel.js` (`serializeProject`, `loadProject`) dan `js/tools/rectangle.js` (bentuk objek persegi).

Penanda status: ✅ sudah dipakai kode saat ini · 🔜 sudah ada di skema tetapi belum dipakai / belum diimplementasi.

## 1. Amplop Proyek (root)

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
| `objects` | array | Daftar objek vektor (bagian 4). | ✅ |

**Tidak disimpan:** zoom, pan, tool aktif, dan objek yang sedang digambar (`State.drawing`).

## 2. Penyimpanan localStorage

- Key: `minivector:project`
- Isi: `JSON.stringify(serializeProject())`
- Disimpan otomatis 300 ms setelah event `object:add`, `object:change`, atau `object:remove`, dan saat halaman ditutup bila masih ada simpanan yang tertunda.
- Dimuat otomatis saat halaman dibuka (`loadFromStorage`). Data rusak atau ditolak validasi → proyek kosong dan peringatan di Console.
- Jika penyimpanan penuh, penyimpanan gagal dengan peringatan di Console (data di memori tidak hilang).

## 3. Aturan Memuat (`loadProject`, juga untuk import)

1. Data harus berupa objek dengan `objects` berupa array. Jika tidak → ditolak.
2. `schemaVersion` harus bilangan bulat dari 1 sampai versi aplikasi (sekarang 1). Tanpa versi, bukan angka, atau lebih baru dari aplikasi → ditolak. Saat ditolak, `loadProject` mengembalikan `false` dan state tidak berubah.
3. Objek yang tidak punya `id` bertipe string atau `type` bertipe string dibuang.
4. `nextId` = nilai terbesar antara `nextId` tersimpan dan (angka di akhir `id` terbesar + 1). Impor tanpa `nextId` atau dengan id bentrok tetap aman.
5. Setelah sukses, event `project:load` dipicu.

> `loadProject` **tidak** menulis ke localStorage. Kode import (`import/json.js`) harus memanggil `saveProject()` setelah `loadProject` berhasil.

## 4. Objek: Rectangle

```json
{
  "id": "rect-106",
  "type": "rectangle",
  "name": "Rectangle 106",
  "visible": true,
  "locked": false,
  "transform": {
    "x": 2940.78,
    "y": -1976.85,
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
| `id` | string | `rect-N`, dengan N dari `nextId`. Unik di seluruh proyek. | ✅ |
| `type` | string | Selalu `"rectangle"`. | ✅ |
| `name` | string | `Rectangle N`. Nama tampil di panel layer. | ✅ |
| `visible` | boolean | `false` → tidak digambar. | ✅ |
| `locked` | boolean | Terkunci dari pengeditan. | 🔜 |
| `transform.x`, `transform.y` | number | Posisi pojok kiri-atas objek (sebelum rotasi) dalam koordinat dunia. Boleh negatif. Tool membulatkan ke 2 desimal. | ✅ |
| `transform.width`, `transform.height` | number ≥ 0 | Ukuran dalam satuan dunia. | ✅ |
| `transform.rotation` | number | Derajat. Tool selalu menulis `0`. | 🔜 |
| `transform.pivot` | `{x, y}` | Titik putar sebagai pecahan 0–1 dari `width` / `height`. Default `0.5, 0.5`. | 🔜 |
| `geometry.isCustomPath` | boolean | `false` = bentuk persegi murni. | 🔜 |
| `geometry.cornerRadius` | 4 angka | Urutan sama dengan `nodes`: kiri-atas, kanan-atas, kanan-bawah, kiri-bawah. Urutan ini baru usulan, renderer belum menggambar sudut membulat. | 🔜 |
| `geometry.nodes` | 4 titik | Titik sudut dalam koordinat **lokal** (relatif pojok kiri-atas objek, sebelum rotasi), searah jarum jam: `p0` kiri-atas, `p1` kanan-atas, `p2` kanan-bawah, `p3` kiri-bawah. Dibuat oleh tool; renderer belum membacanya. | 🔜 |
| `style.fill` | string | Warna hex. Saat ini hanya warna solid. | ✅ |
| `style.stroke` | string | Warna garis hex. | ✅ |
| `style.strokeWidth` | number | Tebal garis dalam satuan dunia (ikut membesar saat zoom). `0` = tanpa garis. | ✅ |

### Aturan konsistensi

- **Urutan gambar:** indeks `0` di `objects` paling belakang, indeks terakhir paling depan. Panel layer nanti menampilkannya terbalik (paling depan di atas).
- **Selama `isCustomPath` = `false`:** `nodes` diturunkan dari ukuran, yaitu `p0 (0,0)`, `p1 (w,0)`, `p2 (w,h)`, `p3 (0,h)`. Sumber kebenarannya adalah `width` dan `height`.
- **Rencana, belum diimplementasi (edit titik):** saat sebuah titik digeser, `isCustomPath` menjadi `true` dan `nodes` menjadi sumber kebenaran. `width` dan `height` dihitung ulang dari kotak pembatas `nodes`, sedangkan rotasi dan pivot dipertahankan.

## 5. Contoh File Export

```json
{
  "schemaVersion": 1,
  "nextId": 3,
  "objects": [
    {
      "id": "rect-1",
      "type": "rectangle",
      "name": "Rectangle 1",
      "visible": true,
      "locked": false,
      "transform": { "x": 100, "y": 100, "width": 200, "height": 150, "rotation": 0, "pivot": { "x": 0.5, "y": 0.5 } },
      "geometry": {
        "isCustomPath": false,
        "cornerRadius": [0, 0, 0, 0],
        "nodes": [
          { "id": "p0", "x": 0, "y": 0 },
          { "id": "p1", "x": 200, "y": 0 },
          { "id": "p2", "x": 200, "y": 150 },
          { "id": "p3", "x": 0, "y": 150 }
        ]
      },
      "style": { "fill": "#D9D9D9", "stroke": "#000000", "strokeWidth": 1 }
    },
    {
      "id": "rect-2",
      "type": "rectangle",
      "name": "Rectangle 2",
      "visible": true,
      "locked": false,
      "transform": { "x": 320, "y": 140, "width": 80, "height": 80, "rotation": 0, "pivot": { "x": 0.5, "y": 0.5 } },
      "geometry": {
        "isCustomPath": false,
        "cornerRadius": [0, 0, 0, 0],
        "nodes": [
          { "id": "p0", "x": 0, "y": 0 },
          { "id": "p1", "x": 80, "y": 0 },
          { "id": "p2", "x": 80, "y": 80 },
          { "id": "p3", "x": 0, "y": 80 }
        ]
      },
      "style": { "fill": "#D9D9D9", "stroke": "#000000", "strokeWidth": 1 }
    }
  ]
}
```

## 6. Export dan Import

- **Export:** `JSON.stringify(serializeProject(), null, 2)` → unduh sebagai file `.json`. Kode `export/json.js` belum dikerjakan.
- **Import:** `loadProject(JSON.parse(teks))`. Hasil `false` berarti file ditolak (bagian 3). Jika sukses, panggil `saveProject()`. Kode `import/json.js` belum dikerjakan.
- Ekspor dan import hanya perlu dua fungsi itu; keduanya tidak perlu tahu isi tiap tipe objek.

## 7. Aturan Perubahan Format

Naikkan `SCHEMA_VERSION` (di `variabel.js`) dan tambahkan satu langkah di `migrateProject` bila:

- ada field baru yang wajib dan tidak bisa diberi nilai default,
- tipe field berubah (contoh: `style.fill` dari string menjadi objek untuk gradient atau pattern),
- struktur berubah (contoh: `children` untuk frame dan grup).

Menambah field **opsional** yang punya default tidak perlu menaikkan versi. Setiap kenaikan versi harus diikuti pembaruan dokumen ini.