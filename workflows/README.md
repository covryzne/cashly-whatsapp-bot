# Workflow n8n

Draft adaptasi Telegram + Google Sheets tersedia pada `cashly-wa.json` dan sudah
disimpan lewat MCP di canvas **Cashly WA**. Workflow Telegram lama tetap aktif
dan tidak diedit. Semua pencatatan baru melalui layanan backend Cashly.

File:

- `cashly-wa.json`: template portable 41 node, nonaktif, tanpa credential/pinData.
- `cashly-wa.sdk.ts`: source builder n8n SDK dengan contoh output fiktif.
- `code/`: script runtime Code node yang sama dengan draft canvas.
- `tests/workflow-guards.test.cjs`: pemeriksaan guard dan pemetaan tanpa network.

Path Webhook pada template portable adalah `cashly-wa-staging`; canvas existing
mempertahankan path UUID yang sudah diuji user. Mengimpor file ini membuat
konfigurasi portable, bukan memperbarui canvas existing otomatis.

Draft menyatukan empat tahap dalam satu canvas dengan empat node group:

1. Terima pesan terverifikasi: Webhook Header Auth, filter, readiness gate,
   registrasi durable dan ACK. Credential Header Auth masih harus diisi manual.
2. Catat melalui Cashly: instruksi OTP/help/report atau gate verified-link sebelum
   chat/OCR/VN, lalu validasi hasil commit/klarifikasi.
3. Balas ke pengirim: claim outbox sebelum kirim Evolution, laporkan accepted/unknown dengan lease.
4. Recovery: ambil satu outbox ready per menit; claimed/unknown tidak dikirim ulang.

`linking_backend_ready=false` pada Konfigurasi Staging dan Konfigurasi Recovery
menahan HTTP/outbound sampai deploy. Backend linking sekarang diimplementasikan
pada perubahan Cashly API migration 0007. `expense_processing_enabled=false`
tetap memblokir chat/OCR/VN finansial; endpoint job expense belum tersedia.
Panduan deploy/credential di `cashly-buddy-backend/docs/whatsapp-linking.md`
pada workspace aplikasi. Handoff sebelumnya menjelaskan tahap finansial lanjutan.

Validasi SDK/per-node lolos tanpa warning. Uji n8n manual dengan data fiktif
mencapai guard Setup Backend Diperlukan dan Recovery Belum Siap. Ini bukan uji HTTP Header Auth, provider media,
outbound WhatsApp, OTP, AI atau database staging end-to-end.

Jalankan `node workflows/tests/workflow-guards.test.cjs` dari root repo. Perubahan
script harus diterapkan pula pada JSON/SDK dan canvas; edit file JS saja tidak
mengubah Code node yang sudah disimpan di n8n.

Sebelum commit ekspor, hapus API key, token, header autentikasi literal, OTP,
pinData, execution data, QR, nomor nyata, webhook privat, dan ID credential
instance. Gunakan nama credential yang perlu dipilih ulang saat impor.

Perubahan JSON di Git tidak otomatis diterapkan ke n8n. Impor sebagai workflow
baru nonaktif, pilih credential, uji payload fiktif, lalu uji staging sebelum
aktivasi. Jangan menimpa workflow Telegram live saat adaptasi.
