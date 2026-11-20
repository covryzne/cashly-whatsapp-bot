# Evolution API untuk bot Cashly staging

Status: konfigurasi persiapan lokal, belum di-deploy atau diuji dengan WhatsApp.
Ini menyiapkan transport WhatsApp; belum memasang workflow bot, endpoint linking,
OTP, atau adapter integrasi backend Cashly.

## Susunan

- `cashly-evolution`: Evolution API `v2.3.7`, maksimum RAM 1536 MiB.
- `evolution-postgres`: PostgreSQL 15 Alpine, maksimum RAM 384 MiB.
- `evolution-redis`: Redis 7 Alpine, maksimum RAM 128 MiB.
- API terhubung ke network `n8n_default` yang sudah ada. n8n memanggil
  `http://cashly-evolution:8080`. n8n tetap mengakses Cashly melalui
  `http://backend:8000` di network `cashly-staging`.
- PostgreSQL dan Redis hanya terhubung ke network internal stack ini. Database
  Evolution terpisah dari database finansial Cashly.
- Manager/API hanya dipublikasikan di host `127.0.0.1:8085`, melalui SSH tunnel
  untuk akses laptop. Tidak perlu menambah domain saat tes awal.
- Tiga volume menyimpan sesi, database, dan Redis; log Docker dibatasi.

Limit RAM adalah batas awal, bukan hasil pengukuran kebutuhan. Pantau startup,
pairing dan beban foto/VN, termasuk OOM/restart. PostgreSQL/Redis memakai tag
major Alpine; catat image digest sesudah pull. Tag image Evolution belum ditarik
atau diuji pada host Azure oleh penyusun konfigurasi ini.

## 1. Siapkan checkout Azure

Clone repo mengikuti [README utama](../README.md). `compose.yaml` berada di root
repo. `.env.example` hanya contoh validasi, bukan credential deployment.

Di terminal Azure:

```bash
cd ~/ai-lab/cashly-whatsapp-bot
docker network inspect n8n_default --format '{{.Name}}'
ss -ltn 'sport = :8085'
df -h /
```

Pastikan port 8085 belum digunakan. Periksa lagi ruang disk sesudah image pull;
data database dan sesi akan bertambah seiring pemakaian.

## 2. Buat credential sekali

Jalankan di folder tersebut. Perintah menolak menimpa `.env` yang sudah ada dan
menulis secret dengan permission privat tanpa mencetak nilainya:

```bash
(
  umask 077
  set -eC
  evolution_key=$(openssl rand -hex 32)
  evolution_db_password=$(openssl rand -hex 32)
  printf 'EVOLUTION_API_KEY=%s\nPOSTGRES_PASSWORD=%s\n' "$evolution_key" "$evolution_db_password" > .env
)
```

Simpan cadangan `.env` secara privat. Jangan commit/kirim ke chat. Password DB
dipakai saat volume pertama kali diinisialisasi; mengedit `.env` saja tidak
mengganti password database yang sudah ada. API key ini khusus Evolution, bukan
credential database Cashly atau credential integrasi backend.

## 3. Validasi, pull, dan jalankan

```bash
docker compose config --quiet
docker compose pull
df -h /
docker compose up -d
docker compose ps
```

Jika pull gagal karena tag/registry tidak tersedia, berhenti dan verifikasi
image resmi; jangan otomatis mengganti dengan `latest`. Tunggu API sehat.
Image Evolution menjalankan migrasi databasenya sendiri saat startup, hanya
terhadap PostgreSQL stack ini. Tidak ada migrasi Cashly.

```bash
curl --fail --max-time 20 http://127.0.0.1:8085/
docker compose logs --tail=60 cashly-evolution
docker stats --no-stream
```

Root API menampilkan versi/metadata; ini belum membuktikan nomor terhubung.
Jika membagikan log, samarkan secret, QR, nomor dan isi pesan terlebih dahulu.

## 4. Buka Manager dan pairing

Dari terminal laptop, gunakan host/IP atau alias SSH Azure yang biasa dipakai
(ganti `HOST_AZURE`):

```bash
ssh -N -L 8085:127.0.0.1:8085 azureuser@HOST_AZURE
```

Pertahankan terminal tunnel, buka `http://localhost:8085/manager`, lalu gunakan
server URL `http://localhost:8085` dan API key dari `.env` lokal server melalui
editor privat. Jangan membagikan nilainya.

Buat instance `cashly-staging` dengan koneksi WhatsApp Baileys dan scan QR lewat
WhatsApp Business nomor bot. Biarkan webhook/integrasi chatbot nonaktif untuk
pairing awal. Nomor bot terhubung ke Evolution berbeda dari user Cashly yang
nantinya menautkan akun melalui OTP.

Jika `/manager` tidak termuat, verifikasi image/asset Manager dan versi runtime;
jangan membuka port publik untuk mengatasi masalah asset. Konfigurasi ini
mengandalkan Manager bawaan source rilis 2.3.7.

## 5. Credential n8n dan pemeriksaan awal

Pada credential community node `n8n-nodes-evolution-api`:

- Server URL: `http://cashly-evolution:8080` (tanpa slash akhir).
- ApiKey: key Evolution dari `.env`, simpan di credential store n8n.
- Instance pada node: `cashly-staging`.

Uji jaringan dari Azure:

```bash
docker exec n8n node -e "fetch('http://cashly-evolution:8080/',{signal:AbortSignal.timeout(15000)}).then(async r=>{console.log(r.status);console.log(await r.text())}).catch(e=>{console.error(e.message);process.exit(1)})"
```

Gunakan tes credential n8n untuk memeriksa autentikasi. Uji outbound memakai
workflow manual dan nomor penguji yang berbeda dari nomor bot. Jangan arahkan
pesan ke workflow finansial live sebelum flow gate akun dan dedup siap.

## Tahap berikutnya

Setelah pairing berhasil, siapkan workflow receiver khusus transport: autentikasi
webhook, filter instance/event/fromMe/grup/history, dan contoh payload tersanitasi.
Jangan memproses impor history sebagai pengeluaran baru.

Untuk workflow Cashly, gate verified link harus berjalan sebelum node mengambil
media. Webhook base64 otomatis tetap nonaktif; gunakan Get Media Base64 sesudah
otorisasi backend. Pilih endpoint webhook final setelah workflow pemiliknya
diperiksa. Jangan menganggap URL production lama sudah sesuai.

`N8N_ENABLED=false` mematikan integrasi chatbot n8n bawaan Evolution; webhook
event biasa masih dapat dikonfigurasi per instance. AI tetap di backend Cashly.

Pesan baru disimpan di database Evolution agar pencarian message ID/media
community node dapat bekerja. History, kontak dan chat tidak sengaja diimpor
oleh konfigurasi ini. Belum ada job retensi pesan otomatis; sebelum dipakai
berkelanjutan, tetapkan retensi/cleanup berdasarkan kemampuan versi ini dan uji
agar media pending masih dapat diambil. Volume/database bisa terus tumbuh meski
log container dibatasi. Batasi juga execution history n8n sebelum OTP/media nyata.

Untuk berhenti tanpa menghapus volume:

```bash
docker compose stop
```

Jangan gunakan `docker compose down -v` untuk restart atau update karena volume
berisi sesi dan database. Cadangkan database dan sesi secara privat sebelum
upgrade; sesi WhatsApp termasuk data sensitif.

## Sumber konfigurasi

- [Rilis Evolution 2.3.7](https://github.com/evolution-foundation/evolution-api/releases/tag/2.3.7)
- [Environment rilis 2.3.7](https://github.com/evolution-foundation/evolution-api/blob/2.3.7/.env.example)
- [Routing Manager dan API](https://github.com/evolution-foundation/evolution-api/blob/2.3.7/src/api/routes/index.router.ts)
- [Compose upstream](https://github.com/evolution-foundation/evolution-api/blob/main/docker-compose.yaml)
- [Credential community node](https://github.com/oriondesign2015/n8n-nodes-evolution-api/blob/main/credentials/EvolutionApi.credentials.ts)
