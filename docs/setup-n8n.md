# Persiapan workflow n8n

Status: rancangan integrasi, belum ada JSON hasil adaptasi atau endpoint backend
WhatsApp yang diverifikasi. Baca [setup Evolution](setup-evolution.md) dahulu.

## Koneksi

| Dari | Tujuan |
| --- | --- |
| Community node n8n | `http://cashly-evolution:8080`, credential API key Evolution |
| HTTP Request n8n | `http://backend:8000`, credential integrasi Cashly khusus |
| Evolution | Webhook workflow receiver yang dipilih setelah diperiksa |

Paket yang ditargetkan: `n8n-nodes-evolution-api` dari OrionDesign. Verifikasi
versi yang terpasang dan bentuk respons sebelum menyiapkan JSON final. Receiver
memakai Webhook bawaan n8n; pengiriman teks dan pengambilan media memakai node
Evolution. API key Evolution dan credential integrasi Cashly adalah secret berbeda.

## Alur yang ditargetkan

1. Verifikasi sumber webhook dan instance; normalisasi event/message/sender.
2. Abaikan pesan dari bot sendiri, grup, history dan event yang bukan input baru.
   Status pengiriman dipisahkan dari pesan pengeluaran.
3. Backend mendaftarkan event dan melakukan dedup provider + instance + message ID.
4. Registrasi/OTP/help diarahkan ke layanan backend yang sesuai.
5. Nomor belum verified hanya mendapat panduan linking; jangan mengambil media
   atau memanggil AI untuk pencatatan.
6. Nomor verified: teks diproses oleh layanan Cashly; foto/VN diambil lewat Get
   Media Base64 dan dikirim bersama MIME sebenarnya. Pertahankan caption dan
   referensi pesan untuk koreksi/clarification.
7. Backend menentukan saved, needs_review atau failed. Hasil lengkap/valid boleh
   autosave menurut aturan bot; hasil ambigu diklarifikasi sebelum commit.
8. n8n mengirim balasan yang ditentukan backend dan melaporkan hasil pengiriman.

Backend memegang konteks draft/klarifikasi, kepemilikan akun, idempotency commit,
validasi dan perhitungan laporan/streak. Jangan memakai JWT login user di workflow
atau menulis langsung ke tabel finansial. Cek link lagi sebelum commit untuk
menangani disconnect saat AI masih berjalan.

Endpoint `/api/v1/integrations/whatsapp/...` masih rancangan. Jangan mengganti
dengan endpoint app yang memakai token user atau writer bersumber `dashboard`.
Implementasi endpoint dilakukan di repo backend sebelum uji finansial end-to-end.

## Pengiriman dan kegagalan

Retry balasan terpisah dari pencatatan: expense yang sudah committed tidak
diekstraksi/disimpan ulang hanya karena balasannya gagal. Status accepted/sent
provider tidak berarti delivered/read, akun linked atau transaksi tersimpan.
Timeout outbound bisa berarti status kirim tidak pasti; jangan mengklaim
exactly-once delivery tanpa rekonsiliasi dukungan provider.

## Sebelum aktivasi staging

- Pairing bot dan credential Evolution berhasil.
- Event teks/foto/VN aktual sudah dipetakan dan disanitasi.
- Webhook dilindungi mekanisme yang didukung versi provider/ingress; jangan
  menganggap URL acak saja sebagai autentikasi sumber.
- OTP/link/credential integrasi dan writer sumber WhatsApp tersedia di backend.
- Uji replay, nomor belum linked, akun berbeda, media rusak, klarifikasi,
  disconnect, respons simpan hilang dan balasan gagal.
- OTP dan media tidak tertinggal di pinData atau execution history n8n.
- Workflow diimpor nonaktif dan tidak menimpa bot Telegram lama.

Specs produk dan kontrak detail tetap dimiliki workspace Cashly, terutama
`specs/WHATSAPP_IMPLEMENTATION_PLAN.md` dan ADR-0060. Dokumen ini merangkum batas
integrasi; tidak mengubah aturan produk atau menyatakan staging sudah siap.
