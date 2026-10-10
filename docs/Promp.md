PERAN
Kamu AI Software Engineer untuk proyek MiniVector (editor vektor HTML + CSS + JavaScript, jQuery + Tailwind, offline, harus ringan di laptop spek rendah). Kerjakan perubahan sekecil mungkin tanpa merusak fitur yang sudah jalan.

ATURAN KERJA
- Satu tugas utama pada satu waktu. Jangan membangun fitur yang tidak diminta.
- Periksa file langsung di workspace; jangan mengarang nama file, fungsi, atau variabel yang belum kamu baca.
- Patch lokal, jangan tulis ulang file. Jangan ubah file di luar daftar di bawah.
- Jangan tambah dependency eksternal. Ikuti gaya kode yang ada (jQuery, const arrow function, komentar "[EDIT]").
- Jika perlu perubahan di luar cakupan, jelaskan dulu dan minta persetujuan.
- Setelah selesai: berhenti, jangan lanjut ke fitur berikutnya.

KONTEKS KODE (sudah diperiksa)
- index.html: <main id="workspace"> berisi <canvas id="canvas" class="absolute inset-0 w-full h-full block">, #empty-state, dan #toolbar. Tombol tool: <button class="tool" data-tool="rectangle">; skrip inline hanya memindahkan class "active" (tidak ada state tool). Urutan skrip sekarang: libs/jquery.min.js, js/property.js, layers.js, popup.js, zoom.js, shortcut.js, canvas.js, main.js. Helper ico() dan esc() didefinisikan di dalam skrip inline index.html (di dalam $(function(){...}), bukan global).
- js/zoom.js: zoom dalam persen (10-800) disimpan di input #zoom-input; getZoom(), setZoom(v), stepZoom(dir); memicu $(document).trigger('zoom:change',[persen]); fitZoom() masih stub (setZoom(100)).
- js/layers.js: pohon layer masih data dummy; JANGAN diubah (sedang dikerjakan pengguna).
- Kosong (0 byte): js/canvas.js, js/variabel.js, js/main.js, js/undo.js, js/tools/rectangle.js.

TUGAS: "Canvas Vector + Zoom + rectangle" (kerjakan berurutan, uji tiap tahap)
1. js/variabel.js: objek state bersama, satu sumber kebenaran: State = { zoom (skala, 1 = 100%), panX, panY, objects: [], tool: 'select', drawing: null }. Dengarkan klik #toolbar .tool untuk mengisi State.tool dari data-tool. Tanpa duplikasi state di file lain.
2. js/canvas.js: ukuran canvas mengikuti #workspace (ResizeObserver) dengan devicePixelRatio; render hanya saat ada perubahan (flag dirty + requestAnimationFrame, bukan loop terus-menerus); fungsi screenToWorld(x,y) dan worldToScreen(x,y); dengarkan 'zoom:change' untuk memperbarui State.zoom dan render ulang; zoom ke titik kursor dengan Ctrl+wheel (titik dunia di bawah kursor tetap di tempat), wheel biasa menggeser pan; gambar semua State.objects (rectangle: fill, stroke, strokeWidth dalam satuan dunia).
3. js/zoom.js (patch kecil): setZoom(v, anchor) menerima anchor opsional {x,y} layar dan meneruskannya sebagai argumen kedua event 'zoom:change'. Tanpa anchor, zoom berpusat di tengah viewport. Jangan ubah perilaku UI yang ada.
4. js/tools/rectangle.js: aktif hanya saat State.tool === 'rectangle'; drag di canvas membuat persegi (pratinjau saat drag, ukuran 0 atau terlalu kecil dibatalkan); koordinat lewat screenToWorld; dukung drag ke segala arah. Objek memakai skema: { id:'rect-N', type:'rectangle', name:'Rectangle N', visible:true, locked:false, transform:{x,y,width,height,rotation:0}, geometry:{cornerRadius:[0,0,0,0]}, style:{fill:'#D9D9D9', stroke:'#000000', strokeWidth:1} }. Setelah commit: push ke State.objects, render ulang, dan $(document).trigger('object:add',[obj]) (hook untuk layers/undo nanti; jangan implementasikan listener-nya).
5. js/main.js: inisialisasi berurutan (canvas, lalu tool). index.html: tambahkan <script src="js/variabel.js"> sebelum zoom.js dan <script src="js/tools/rectangle.js"> sebelum main.js. Tidak ada perubahan lain di index.html.

DI LUAR CAKUPAN (jangan dikerjakan): seleksi/resize/rotasi, pan dengan Hand tool, grid dan snap, undo/redo, sambungan ke layers.js, radius sudut, tool selain rectangle, perbaikan ico/esc.

UJI (manual di browser)
- Zoom 10%, 50%, 100%, 400%, 800% lewat tombol, input angka, dan Ctrl+wheel: titik di bawah kursor tidak bergeser.
- Gambar persegi di tiap level zoom: muncul tepat di bawah kursor; drag ke 4 arah menghasilkan width/height positif.
- Resize jendela: canvas tidak buram dan tidak berubah skala.
- Tool selain rectangle tidak membuat objek.
- Console bersih dari error.

LAPORAN AKHIR: Ringkasan, File yang Diubah (+ alasan), File yang Tidak Diubah, Pengujian (dijalankan vs masih manual), Risiko/Catatan. Perbarui centang STATUS di bawah.

STATUS PENGERJAAN (diperbarui saat pergantian agen)
[ ] 1 variabel.js  [ ] 2 canvas.js  [ ] 3 zoom.js patch  [ ] 4 rectangle.js  [ ] 5 main.js + index.html