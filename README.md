# Delphi Sports Longshot-Fade Bot

Bot otonom buat kompetisi **Delphi Agent Arena** (Gensyn). Strategi: **longshot-fade**
di pasar olahraga — fade outcome yang harganya 5-15% (statistik: longshot menang jauh
lebih jarang dari harganya), plus buy outcome favorit di 75-92% (statistik: favorit
menang lebih sering dari harganya). Setiap sinyal harga di-cross-check ke LLM
(Claude) sebagai sanity-check sebelum eksekusi, biar nggak ngikutin bias buta kalau
ada alasan konkret (cedera pemain dll) yang justru mendukung harga pasar.

## Struktur

```
src/
  config.ts        semua parameter strategi & env vars
  delphiClient.ts   setup DelphiClient (signing pakai private key lokal)
  marketScanner.ts  ambil semua pasar olahraga open + harga live
  longshotFade.ts   deteksi sinyal mispricing dari harga doang
  newsSignal.ts     LLM cross-check pakai konteks berita/cedera
  riskManager.ts    position sizing (scaled by edge, capped by balance)
  executor.ts       eksekusi buy + redeem posisi yang udah settle
  index.ts          loop utama, jalan terus tiap POLL_INTERVAL_SECONDS
```

## Setup

```bash
npm install
cp .env.example .env
# isi .env: WALLET_PRIVATE_KEY (wallet yang didaftarin ke kompetisi),
# DELPHI_API_ACCESS_KEY, dan GROQ_API_KEY (gratis, https://console.groq.com)
```

**PENTING:** `WALLET_PRIVATE_KEY` harus private key dari wallet yang SAMA persis
dengan yang lo daftarin di DoraHacks buat kompetisi ini. Jangan pernah commit
file `.env` ke git — sudah di-`.gitignore`.

## Jalanin

```bash
npm run typecheck   # pastikan semua kompilasi bersih dulu
npm run dev          # jalan langsung pakai tsx, buat testing
npm run build && npm start   # build ke JS lalu jalanin, buat production/VPS
```

Buat jalan 24/7 di VPS, pakai process manager biar auto-restart kalau crash:

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name delphi-bot
pm2 save
pm2 startup   # ikutin instruksi biar auto-start pas reboot
```

## Plugging in news (opsional tapi direkomendasikan)

`newsSignal.ts` saat ini kirim `newsContext: null` ke LLM — artinya LLM cuma
nebak dari teks pertanyaan pasar doang, tanpa berita terkini. Buat hasil lebih
akurat, sambungin sumber berita beneran sebelum call `assessOutcomeWithNews`:

1. Pilih API berita olahraga (contoh: NewsAPI.org, TheSportsDB, atau scraping RSS
   resmi liga terkait)
2. Di `src/index.ts`, sebelum `assessOutcomeWithNews(signal, null)`, fetch
   headline terkini yang relevan sama `signal.market.metadata?.question`, terus
   pass sebagai string ke parameter kedua

## Tuning strategi

Semua parameter ada di `.env` (lihat `.env.example`), yang paling penting:

- `MIN_EDGE` — makin tinggi, makin selektif (lebih sedikit trade tapi lebih yakin)
- `MAX_POSITION_FRACTION` — % max saldo yang dipertaruhkan di 1 posisi
- `MAX_HOURS_TO_SETTLEMENT` — filter biar cuma pasar yang settle sebelum
  kompetisi tutup (24 Agustus) yang ditradingin

## Yang PERLU lo tau sebelum jalanin serius

- Ini kerangka kerja, bukan strategi yang udah terbukti profit — nggak ada
  bot yang jamin menang.
- Sinyal `priorEdge` di `longshotFade.ts` pakai angka rata-rata dari riset
  umum (bukan spesifik pasar Delphi) — kalibrasi ulang kalau lo punya data
  sendiri dari hasil trading di kompetisi ini.
- Selalu jalanin `npm run typecheck` sebelum deploy ulang ke VPS.
- Test dulu di testnet dengan `MAX_POSITION_FRACTION` kecil sebelum naikin size.
