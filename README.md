# Cashly WhatsApp Bot

Deployment Evolution API dan workflow n8n untuk pencatatan pengeluaran Cashly
melalui WhatsApp: chat, foto struk, dan voice note.

**Status:** Evolution telah diuji user untuk koneksi credential dan event teks.
Draft workflow 41 node sudah disimpan lewat MCP pada canvas Cashly WA, tetap
nonaktif. Backend linking OTP, status/disconnect dan outbox ber-lease sudah
diimplementasikan dan diuji lokal pada repo Cashly API; belum di-deploy staging.
Chat/OCR/VN finansial tetap diblokir sampai tahap adapter expense selesai.

## Pembagian layanan

| Layanan | Tanggung jawab |
| --- | --- |
| Evolution API | Koneksi nomor bot, event masuk, pengambilan media, pengiriman balasan |
| n8n yang sudah berjalan | Adapter event, routing, transfer media yang diotorisasi, pengiriman balasan |
| Backend Cashly | Linking OTP, otorisasi akun, AI, konteks klarifikasi, validasi, deduplikasi, commit dan laporan |

Repo ini mengelola Evolution beserta PostgreSQL/Redis khusus Evolution dan ekspor
workflow. n8n tetap memakai Compose-nya sendiri. Data finansial ditulis lewat
backend Cashly, tidak langsung dari n8n ke tabel database.

## Struktur

```text
compose.yaml                 # Evolution, PostgreSQL, Redis
.env.example                 # Nama variabel; bukan credential deployment
docs/setup-evolution.md      # Instalasi, pairing, credential n8n dan operasi
docs/setup-n8n.md             # Kontrak alur dan persiapan workflow
docs/backend-handoff.md       # Kontrak usulan yang dibutuhkan adapter backend
docs/reference/              # Referensi lama yang tidak dipakai stack
workflows/                   # Ekspor workflow yang sudah disanitasi
examples/                    # Contoh event tersanitasi, setelah provider diuji
```

`workflows/cashly-wa.json` adalah ekspor portable draft nonaktif, tanpa credential
atau pinData. `workflows/cashly-wa.sdk.ts` menyimpan source SDK, dan `code/` berisi
script runtime yang diuji. `examples/evolution-text.json` memakai struktur event
yang sudah diamati dengan identitas/message fiktif. Backend tetap harus siap
sebelum draft ini dapat mencatat transaksi atau membalas pengguna.

## Mulai di Azure

Clone sekali menggunakan akses GitHub yang sudah disiapkan untuk repo ini:

```bash
cd ~/ai-lab
git clone https://github.com/covryzne/cashly-whatsapp-bot.git
cd cashly-whatsapp-bot
```

Ikuti [setup Evolution](docs/setup-evolution.md) untuk membuat `.env` privat,
memeriksa network/port, menarik image, menjalankan stack, dan pairing nomor bot.
Jangan menjalankan stack sebelum `.env` disiapkan.

Jika sudah membuat stack dari folder `~/ai-lab/evolution`, gunakan nama project
tetap `cashly-whatsapp-staging` dan file `.env` yang sama saat beralih ke checkout
ini. Volume mengikuti nama project, bukan nama folder. Jangan menjalankan kedua
checkout bersamaan; periksa `docker compose ls` dan pindahkan pengelolaan ke satu
folder. Memindahkan repo tidak memindahkan atau mencadangkan volume secara otomatis.

Network yang diperlukan:

- Evolution bergabung ke `n8n_default`; credential n8n memakai
  `http://cashly-evolution:8080`.
- n8n sudah bergabung ke `cashly-staging`; backend dapat diakses dari n8n melalui
  `http://backend:8000`. Endpoint linking tersedia pada perubahan backend 0007;
  deploy dan isi credential sebelum mengaktifkan readiness.
- PostgreSQL/Redis Evolution hanya berada di network privat stack ini.
- Manager diakses melalui SSH tunnel ke host `127.0.0.1:8085`.

## Update di server

Sebelum upgrade, cadangkan `.env`, database dan sesi secara privat, periksa
perubahan image/konfigurasi dan migration notes. Setelah perubahan repo tersedia
di remote, jalankan dari checkout server:

```bash
git pull --ff-only
docker compose config --quiet
docker compose pull
df -h /
docker compose up -d
docker compose ps
```

Berhenti jika salah satu langkah gagal. `git pull` memperbarui file; ekspor JSON
di `workflows/` tetap perlu diimpor/diperbarui secara terpisah di n8n. Workflow
tidak diaktifkan otomatis oleh Compose.

## Validasi lokal

Untuk memvalidasi struktur tanpa credential nyata atau menyalakan service:

```bash
docker compose --env-file .env.example config --quiet
node workflows/tests/workflow-guards.test.cjs
```

Contoh `.env.example` hanya untuk validasi. Hasil ini tidak membuktikan image
tersedia, container sehat, pairing berhasil, atau transaksi staging tersimpan.

## Data privat

Jangan commit `.env`, API key, credential n8n, OTP, QR/sesi WhatsApp, database,
backup atau execution history. Ekspor workflow harus diperiksa sebelum commit;
credential secret harus berada di credential store n8n. Nomor bot dan webhook
instance nyata tidak perlu ditanam di template repo.

Detail tahap workflow ada di [setup n8n](docs/setup-n8n.md).
