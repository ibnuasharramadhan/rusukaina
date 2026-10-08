# Setup sinkron Huawei Health → Strava → aplikasi

Huawei Health tidak menyediakan API yang bisa dipakai PWA pribadi (Health Kit butuh
review developer Huawei; Health Connect hanya untuk aplikasi Android native). Jadi
alurnya:

```
Jam Huawei → Huawei Health → (sinkron otomatis) Strava → Strava API → PWA
                                                          ↑
                                     Cloudflare Worker (tukar token OAuth)
```

Worker diperlukan karena `client_secret` Strava tidak boleh ada di kode PWA. Worker
tidak menyimpan data apa pun; token disimpan di IndexedDB HP.

## 1. Huawei Health → Strava
Di app Huawei Health: **Saya › Privasi › Berbagi data dan otorisasi › Strava** (nama menu
bisa sedikit beda per versi), login Strava, aktifkan sinkron. Cek satu lari sudah muncul
di Strava beserta denyut jantungnya.

## 2. Buat aplikasi API Strava
Buka <https://www.strava.com/settings/api>:
- **Application Name:** Latihan 7K (bebas)
- **Website:** `https://ibnuasharramadhan.github.io/rusukaina/`
- **Authorization Callback Domain:** `ibnuasharramadhan.github.io`

Catat **Client ID** dan **Client Secret**. (Aplikasi baru Strava berstatus "single player":
hanya pemilik akun yang bisa terhubung. Itu cukup untuk aplikasi pribadi.)

## 3. Deploy Worker (gratis, Cloudflare)
```bash
cd worker
npx wrangler login
npx wrangler secret put STRAVA_CLIENT_ID      # tempel Client ID
npx wrangler secret put STRAVA_CLIENT_SECRET  # tempel Client Secret
npx wrangler deploy
```
Catat URL yang muncul, mis. `https://latihan-strava-token.<akun>.workers.dev`.
`ALLOWED_ORIGIN` di `wrangler.toml` sudah diisi `https://ibnuasharramadhan.github.io`;
ubah kalau aplikasinya pindah domain.

## 4. Isi variabel build di GitHub
Repo › **Settings › Secrets and variables › Actions › Variables › New repository variable**:
- `STRAVA_CLIENT_ID` = Client ID (bukan secret, aman di frontend)
- `STRAVA_TOKEN_URL` = URL Worker dari langkah 3

Lalu jalankan ulang workflow **Deploy ke GitHub Pages** (atau push apa saja ke `master`).
Selama variabel ini kosong, kartu Strava tidak tampil.

## 5. Hubungkan
Buka aplikasi › **Info › Huawei Health › Strava › Hubungkan Strava**, izinkan
"lihat aktivitas". Setelah itu lari baru diambil otomatis setiap aplikasi dibuka,
atau tekan **Sinkron Strava** di Catat › Lari.

Yang diambil: tanggal & jam, jarak, durasi (moving time), HR rata-rata & maks, cadence
(dikali 2, karena Strava menghitung per kaki), split per km, dan jenis (treadmill / luar /
race). Lari yang sudah dicatat manual di hari yang sama dengan jarak selisih ≤0,1 km
dilewati supaya tidak dobel.

## Lokal
```bash
VITE_STRAVA_CLIENT_ID=... VITE_STRAVA_TOKEN_URL=... npm run dev
```
Tambahkan `localhost` sebagai Authorization Callback Domain dan set `ALLOWED_ORIGIN`
Worker ke `http://localhost:5173` untuk tes.
