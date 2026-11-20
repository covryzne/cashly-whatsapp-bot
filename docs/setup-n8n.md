# Draft workflow Cashly WA

Draft 41 node disimpan lewat MCP di [Cashly WA](https://n8n.covryzne.dev/workflow/nU03nYM4Zs3DWXAK).
Workflow belum dipublish. Path Webhook existing dipertahankan. Ekspor portable
ada di `workflows/cashly-wa.json` dengan path berbeda `cashly-wa-staging`.

## Yang sudah dibangun

- Header Auth pada Webhook, filter instance/fromMe/direct-chat/event/history flag.
- Normalisasi conversation, extended text, caption, audio, quoted message dan JID.
  Metadata perangkat, messageSecret, API key dan URL payload tidak diteruskan.
- `/help`, `/info`, `/start`, `/laporan`, pesan linking dan koreksi mendapat
  command hint; backend tetap menentukan intent dan otorisasinya.
- Backend mendaftarkan event, menyelesaikan replay/help/linking atau memberi
  izin memproses job. ACK 200 diberikan sesudah admission tervalidasi.
- Cabang chat, OCR dan VN dipertahankan untuk fase berikutnya; pada fase linking
  `expense_processing_enabled=false` menolak action process meski verified_link=true.
- Pemeriksaan bentuk respons backend; saved wajib committed=true.
- Pengiriman via Evolution dan laporan accepted/unknown dengan idempotency key.
- Claim atomik outbox sebelum send, lease pada report, recovery satu ready per menit.
- Empat kelompok canvas dan catatan setup. Eksekusi/payload tidak disimpan pada
  konfigurasi akhir; jangan pin pesan/OTP/media nyata.

## Credential yang harus diisi manual

| Node | Credential |
| --- | --- |
| Webhook | Header Auth, nama header `X-Cashly-Webhook-Secret`, secret acak privat |
| Ambil Foto Struk, Ambil Voice Note, Kirim Balasan WhatsApp | Evolution API, URL `http://cashly-evolution:8080`, token instance |
| Daftarkan Event Cashly, Klaim Balasan Cashly, Laporkan Pengiriman Cashly | Header Auth → Cashly Backend, header X-Cashly-Integration-Key |
| Proses Chat Cashly, Proses OCR Cashly, Proses VN Cashly | Header Auth → Cashly Backend; cabang finansial tetap belum aktif |

Saat menyimpan canvas, n8n otomatis memasangkan credential **Evolution Cashly**
yang sudah dibuat user pada tiga node Evolution. Nilai key tidak dibaca/diubah.
Periksa pilihannya; tidak perlu mengetik key di parameter node. Credential
Keenam HTTP Request backend sudah memakai Header Auth **Cashly Backend** pada canvas.
Webhook masih memakai credential backend dan harus diganti manual dengan credential
terpisah untuk X-Cashly-Webhook-Secret sebelum tes HTTP/aktivasi. Ekspor repo menghapus
seluruh referensi credential supaya pemetaan dilakukan manual saat impor.

Pasang header `X-Cashly-Webhook-Secret` yang sama pada konfigurasi webhook
instance Evolution. Bila UI Manager tidak menampilkan custom headers, gunakan
endpoint konfigurasi webhook provider yang mendukung `headers`; jangan mengisi
secret pada query URL atau isi pesan. Tanpa header tersebut, request HTTP ke
Webhook akan ditolak meski URL benar.

Untuk credential backend, header berikut sudah dipakai implementasi linking.
Gunakan Generic Credential Type → Header Auth → Cashly Backend:

```text
Name: X-Cashly-Integration-Key
Value: nilai WHATSAPP_INTEGRATION_KEY dari env privat backend
```

Isi Value privat di credential store n8n. Ini bukan token login user,
Supabase service-role, password PostgreSQL, token Evolution atau key Gemini.
Nilainya harus sama dengan WHATSAPP_INTEGRATION_KEY pada env backend.

## Konfigurasi dan readiness

Node **Konfigurasi Staging** dan **Konfigurasi Recovery** berisi:

```json
{
  "config": {
    "expected_instance": "cashly-staging",
    "backend_base_url": "http://backend:8000",
    "linking_backend_ready": false,
    "expense_processing_enabled": false
  }
}
```

Pertahankan linking readiness false sampai backend migration 0007 di-deploy,
credential diisi dan diuji staging. Panduan berada di repo Cashly API,
`docs/whatsapp-linking.md`. Event valid saat ini berhenti pada **Setup Backend
Diperlukan** dengan respons 503, tanpa download/AI/save/kirim WA. Event yang
diabaikan mendapat 200. Jangan arahkan trafik pengguna berkelanjutan ke gate 503
karena Evolution dapat mengulang pengiriman.

## Uji yang sudah dilakukan

- Validasi 41 node dan SDK graph lolos tanpa warning.
- 55 pemeriksaan guard lokal lolos: JID, fromMe/grup, history flag, tipe
  pesan, bound media, scope admission, commit dan status outbound.
- Eksekusi manual n8n dengan data fiktif mencapai readiness gate, tidak mencapai
  HTTP backend atau node Evolution.
- MCP test_workflow 17 (recovery) dan 18 (webhook) success dengan readiness false.
  Retensi tetap none/false. Automatic approval review menolak permintaan retensi;
  QA diteruskan tanpa mengubah penyimpanan payload.

Tes MCP manual memasukkan data langsung ke trigger; bukan bukti Header Auth
webhook publik sudah benar. Tes tidak memanggil AI, mengirim WA, atau menulis DB.

## Uji berikutnya sebelum publish

1. Deploy backend linking + migration 0007 dan frontend Profil yang sudah dibuat.
   Isi env privat sesuai panduan Cashly API; tidak perlu backend service baru.
2. Isi credential dan uji penolakan header salah/missing pada Test URL.
3. Dengan linking_backend_ready=true pada kedua konfigurasi, uji nomor unlinked,
   permintaan challenge dari app, OTP ke sender dan verifikasi di app.
4. Uji reload, salah OTP, resend, disconnect dan konflik nomor akun kedua.
5. Uji linked/unlinked chat/foto/VN: balasan belum tersedia, tidak membuat expense.
6. Verifikasi recovery ready setelah ACK/restart dan unknown tidak resend otomatis.
7. Pengembangan expense/source WhatsApp, OCR/VN, koreksi, AI dan streak merupakan
   fase berikutnya; jangan mengaktifkan flag expense hanya karena linking berhasil.

Status outbound accepted bukan delivered/read. Tidak ada retry otomatis Send
Text; HTTP laporan delivery saja memiliki dua percobaan dan wajib idempotent.
Kegagalan backend sebelum admission valid tidak mendapat ACK sukses. Kegagalan
sesudah ACK bergantung pada recovery backend, bukan execution history n8n.

Specs produk tetap dimiliki workspace Cashly: `specs/WHATSAPP_IMPLEMENTATION_PLAN.md`
dan ADR-0060. Autosave hanya untuk bot setelah validasi; UI app mempertahankan
review dan tombol simpan.
