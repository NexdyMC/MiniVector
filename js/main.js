/* ================= MAIN (titik masuk) ================= */
// Urutan muat di index.html: variabel.js → zoom.js → canvas.js → tools/rectangle.js → main.js.
// Tiap modul menginisialisasi dirinya saat dimuat; main.js hanya memastikan gambar pertama
// muncul setelah DOM siap (termasuk proyek yang dimuat dari localStorage).
$(function () {
    requestRender();
});