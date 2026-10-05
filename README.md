# Latihan 7K: PWA pelatih lari & gym

Aplikasi web progresif (PWA) untuk menjalankan program latihan 10 minggu menuju **UI Ultra 7K (5 Des 2026)**: jadwal harian, log lari dan gym, catatan tensi & HR istirahat dengan aturan keamanan hipertensi, zona HR, dan grafik progres. Bisa dipasang di layar utama HP tanpa Play Store / App Store dan tetap jalan tanpa internet.

> Dibuat untuk satu atlet dengan hipertensi terkontrol obat. Aplikasi ini alat bantu catatan, bukan alat medis.

## Fitur

| Layar | Isi |
|---|---|
| **Hari ini** | Hitung mundur ke race, hasil race (2 minggu setelahnya), pengingat cadangan bila >7 hari belum ekspor, **cek kesiapan** (tensi, HR istirahat, tidur → hijau / kuning / merah), sesi hari ini yang otomatis disesuaikan (mis. strides dicoret saat tensi 140–159), lari terakhir + catatan coach otomatis, 3 sesi berikutnya, tanda bahaya. |
| **Jadwal** | 10 minggu × 7 hari dari rencana coach, minggu berjalan terbuka otomatis, status per sesi (selesai / diganti / dilewati), progres `selesai/rencana` per minggu. |
| **Catat** | Lari (jarak, durasi, pace live, HR rata/maks + zona, cadence, split), Gym A/B (beban per latihan, tombol set, timer istirahat 60/90", saran naik beban setelah 2 sesi "ringan" berturut-turut, diblok saat tensi kuning), Tensi & HR harian. |
| **Progres** | Konsistensi, tensi pagi dengan garis 140/160, HR istirahat, pace, HR saat lari vs batas 145, **efisiensi aerobik (meter per detak)**, sesi & km per minggu. Semua grafik punya tooltip dan tampilan tabel. |
| **Info** | Zona HR Karvonen (dihitung dari profil), aturan tensi, panduan gym, strategi race, ekspor/impor data, profil. |

### Aturan keamanan yang dikodekan (`src/lib/safety.ts`)
- Tensi < 140/90 → sesuai rencana. 140–159 / 90–99 → boleh, tapi tanpa naik beban, tanpa strides, HR ≤145. ≥160/100 → jangan latihan. ≥180/110 → hubungi dokter.
- HR istirahat ≥ baseline + 7 (58 → 65) → ganti jalan santai.
- Tidur < 6 jam → jalan kaki atau skip.
- Lari easy dengan HR rata-rata > 145 diberi peringatan "terlalu cepat".

## Teknologi

- **Vite + React 19 + TypeScript** (strict).
- **vite-plugin-pwa / Workbox**: manifest, service worker precache, prompt "versi baru tersedia".
- **IndexedDB** lewat `idb`: data offline-first di perangkat, tanpa backend, tanpa akun.
- **Font Barlow / Barlow Condensed** di-bundle (tetap tampil offline) dan **ikon SVG sendiri** (`src/components/icons.tsx`), bukan emoji.
- **Grafik SVG buatan sendiri** (`src/components/charts.tsx`), tanpa library chart: bundel tetap kecil (~90 kB gzip total).
- **Vitest** + `fake-indexeddb`: 40 tes untuk aturan keamanan, sinkron Strava, zona HR (dicocokkan dengan tabel di rencana), jadwal, statistik, dan ekspor/impor.
- Router hash sederhana supaya bisa dihosting di hosting statis mana pun (GitHub Pages, Netlify, Vercel, Cloudflare Pages).
- Mode gelap mengikuti sistem.

## Struktur

```
src/
  data/plan.ts      Rencana 10 minggu (satu-satunya sumber jadwal)
  data/gym.ts       Program Gym A/B
  lib/safety.ts     Aturan tensi, HR istirahat, tidur → kesiapan
  lib/zones.ts      Zona Karvonen, MAF, umur
  lib/pace.ts       Parse durasi, pace, meter per detak
  lib/stats.ts      Status sesi, statistik mingguan, ringkasan untuk coach
  lib/db.ts         IndexedDB: CRUD, seed, ekspor/impor (merge by updatedAt)
  lib/store.tsx     Context React untuk data
  pages/            Today, Schedule, Log, Progress, Info
  components/       UI kecil, grafik, prompt update PWA
```

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # output di dist/ (termasuk sw.js dan manifest)
npm run preview    # uji build + service worker
```

Service worker hanya aktif di `npm run preview` atau setelah deploy (butuh HTTPS atau localhost).

## Memasang di HP

1. Deploy `dist/` ke hosting statis berbasis HTTPS (contoh: GitHub Pages).
2. Buka URL-nya di HP.
   - **Android/Chrome:** menu ⋮ › *Tambahkan ke layar utama* (atau tombol *Pasang aplikasi* di tab Info).
   - **iPhone/Safari:** tombol Bagikan › *Tambah ke Layar Utama*.

## Sinkron Huawei Health (lewat Strava)

Lari dari jam Huawei masuk otomatis: Huawei Health → Strava → aplikasi. OAuth Strava memakai
Cloudflare Worker kecil (`worker/`) untuk menukar token, karena `client_secret` tidak boleh ada
di frontend. Token disimpan di IndexedDB; aktivitas diambil langsung dari Strava API di browser,
dipetakan ke format log lari (HR, cadence, split per km), dan duplikat dengan catatan manual
dilewati. Setup: [docs/strava-setup.md](docs/strava-setup.md).

## Data & sinkron dengan coach

Semua data tinggal di perangkat (IndexedDB) dan aplikasi meminta penyimpanan persisten. Untuk berbagi:
- **Salin ringkasan 7 hari**: teks siap tempel ke chat coach (lari, gym, tensi, rata-rata tensi).
- **Ekspor JSON**: cadangan lengkap; **Impor JSON** menggabungkan data (entri yang lebih baru menang), jadi aman dipakai untuk pindah HP.

Format ekspor (`schemaVersion: 1`):
```json
{ "app": "pwa-latihan", "schemaVersion": 1, "exportedAt": "...",
  "profile": {}, "runs": [], "daily": [], "gym": [], "marks": [] }
```

## Rencana berikutnya

- Sinkron otomatis antar perangkat / dengan coach lewat backend kecil (mis. Supabase atau Cloudflare D1 + Workers), memakai format ekspor di atas sebagai kontrak data.
- Impor otomatis dari Strava / Huawei Health (GPX/FIT).
- Pengingat ukur tensi lewat Web Push.
- Rencana blok berikutnya setelah UI Ultra (menuju 5K sub 35 → sub 30).

## Lisensi

MIT
