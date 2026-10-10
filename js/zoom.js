/* ================= ZOOM ================= */
const ZOOMS = [10, 25, 50, 70, 80, 90, 100, 110, 125, 135, 140, 150, 175, 200, 250, 300, 400, 600, 800, 1000, 1200, 1600, 2000, 3200, 4000, 6400, 8000]; // [EDIT] langkah tombol + / -
const ZMIN = 10,
  ZMAX = 8000; // [EDIT] dinaikkan dari 800 agar ada ruang zoom di atas ambang grid (800%)
const $zoom = $('#zoom-input');
const getZoom = () => parseFloat($zoom.val()) || 100;
// Event untuk canvas: $(document).on('zoom:change', (e, persen, anchor) => { ... })
// anchor (opsional) = {x,y} posisi layar yang dipertahankan saat zoom; tanpa anchor canvas memakai titik tengah
const setZoom = (v, anchor) => {
  v = Math.round(Math.min(ZMAX, Math.max(ZMIN, Number(v) || 100)));
  $zoom.val(v);
  $('#btn-zoom-out').prop('disabled', v <= ZMIN);
  $('#btn-zoom-in').prop('disabled', v >= ZMAX);
  $('#workspace').attr('data-zoom', v);
  $(document).trigger('zoom:change', [v, anchor]);
  return v;
};
const stepZoom = dir => {
  const v = getZoom();
  const next = dir > 0 ? ZOOMS.find(z => z > v) : [...ZOOMS].reverse().find(z => z < v);
  setZoom(next === undefined ? v : next);
};
const fitZoom = () => setZoom(100);
$('#btn-zoom-in').on('click', () => stepZoom(1));
$('#btn-zoom-out').on('click', () => stepZoom(-1));
$zoom.on('change', function () {
  setZoom(this.value);
})
  .on('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      setZoom(this.value);
      this.select();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepZoom(1);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepZoom(-1);
    }
  });
setZoom(100);