/** @type {import('tailwindcss').Config} */
/* ============================================================
   Mini Vector — tailwind.config.js
   Palet meniru UI Figma (dark): abu-abu gelap + teks putih.
   Konfigurasi ini hanya dipakai jika Tailwind dibuild secara lokal.
   Aplikasi memakai CDN; tema aktifnya diatur di index.html sebelum script CDN.
   ============================================================ */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        /* ---------- BACKGROUND ---------- */
        bg:    '#1E1E1E',   // kanvas / area kerja
        panel: '#2C2C2C',   // top bar, sidebar, toolbar, popup
        input: '#383838',   // kotak input, select, tombol segmented
        hover: 'rgba(255, 255, 255, 0.08)',  // hover tombol / baris layer

        /* ---------- BORDER ---------- */
        line: {
          DEFAULT: '#444444',  // garis pemisah panel
          strong:  '#5A5A5A',  // hover input, dropzone, swatch
        },

        /* ---------- TEKS ---------- */
        ink:  '#FFFFFF',    // teks utama
        mute: '#B3B3B3',    // label, ikon sekunder
        dim:  '#8C8C8C',    // placeholder, teks tersier

        /* ---------- AKSEN & STATUS ---------- */
        accent: {
          DEFAULT: '#0D99FF',                 // fokus, tool aktif, tombol utama
          soft:    'rgba(13, 153, 255, 0.22)', // layer terpilih, dropzone aktif
        },
        success: '#14AE5C',
        danger:  '#F24822',
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      /* [EDIT] Ukuran teks diserahkan ke kamu (besar -> kecil, mirip Figma).
         Contoh, buka komentar lalu isi sesuai selera:
      fontSize: {
        title: ['16px', '24px'],
        body:  ['13px', '20px'],
        small: ['12px', '16px'],
        tiny:  ['11px', '16px'],
      },
      */
    },
  },
  plugins: [],
};