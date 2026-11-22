# Handoff adapter backend cashly-wa-v1

> Pembaruan fase linking: API challenge/verify/status/disconnect, events,
> outbox/claim dan deliveries sudah diimplementasikan pada Cashly API migration
> 0007, belum di-deploy staging. Kontrak aktual ada di repo backend,
> `docs/whatsapp-linking.openapi.json` dan `docs/whatsapp-linking.md`.
> Bagian action process/job expense di bawah tetap usulan tahap berikutnya.
> Readiness sekarang `linking_backend_ready`; flag expense tetap false.

**Usulan kontrak untuk draft workflow, belum endpoint yang tersedia.** Dokumen
ini tidak mengimplementasikan atau men-deploy backend/migration. Backend harus
menyelaraskan kontrak ini dengan OpenAPI dan specs sebelum backend_ready=true.

## Batas layanan

Base URL n8n adalah `http://backend:8000`. Semua endpoint integrasi menerima
credential server khusus dengan scope WhatsApp staging, bukan JWT login user.
Draft memakai Templated Custom Auth; usulan header `X-Cashly-Integration-Key`.
Secret dikelola pada server dan credential n8n. `X-Cashly-Contract: cashly-wa-v1`
adalah metadata versi, bukan bukti autentikasi.

Backend wajib resolve akun dari verified link sender; tidak menerima account ID
dari n8n/LLM. Semua field sender/media/phone hint berasal dari webhook yang
diautentikasi. Root sender Evolution adalah bot. Jangan mengubah LID menjadi
nomor atau mempercayai phone hint tanpa validasi sesuai provider.

## POST /api/v1/integrations/whatsapp/events

Body: envelope `event` hasil normalize-event.js. Memuat environment, provider,
bot_id, message_id, sender_id, sender_phone_jid (nullable, hint), sent_at,
received_at, kind (`text|receipt|voice`), text/caption, quoted_message_id,
media.mime_type dan command_hint. Tidak memuat base64 atau account ID.

`Idempotency-Key` berbentuk `wa-event:<encoded-bot>:<encoded-message>`;
backend tetap memakai unique key provider + bot + message, bukan key header saja.
Beri batas key yang memadai (hingga 2048 karakter untuk hasil encoding input
terbatas), fingerprint immutable input dan abaikan received_at dari fingerprint
retry. Tolak identitas/environment bot yang tidak sesuai credential integrasi.

Balasan HTTP JSON:

```json
{
  "data": {
    "event_id": "00000000-0000-4000-8000-000000000001",
    "bot_id": "cashly-staging",
    "message_id": "SYNTHETIC-MESSAGE-001",
    "sender_id": "000000000001@s.whatsapp.net",
    "action": "process",
    "verified_link": true,
    "kind": "text",
    "job_id": "00000000-0000-4000-8000-000000000002"
  }
}
```

Action yang diterima:

- `reply`: OTP/help/info, panduan unlinked, atau hasil report yang sudah aman.
  Wajib reply `{id: <UUID>, text: <1..4000 chars>}` dan outbox durable.
- `process`: wajib verified_link boolean true, job_id UUID, kind yang sesuai
  event. Buat job durable sebelum mengembalikan respons; tidak cukup mengembalikan
  status link tanpa record pekerjaan.
- `ignore`: replay/event yang tidak perlu diproses. Jangan menghilangkan job
  pending dari event yang diulang; backend recovery harus tetap menjangkaunya.

Semua action wajib mengembalikan event_id UUID dan scope bot/message/sender yang
sama. Akun unlinked hanya mendapat linking/help, tidak memanggil AI/media.
Backend adalah otoritas intent; command_hint bukan hasil klasifikasi tepercaya.
OTP harus diverifikasi di aplikasi sebelum nomor berstatus linked.

ACK 200 n8n baru dikirim sesudah respons ini tervalidasi. Respons admission harus
cepat (timeout HTTP draft 15 detik); jangan melakukan AI lama di endpoint ini.

## POST /api/v1/integrations/whatsapp/jobs/{job_id}/process

`Idempotency-Key: wa-process:<job-uuid>`. Body teks:

```json
{"event_id":"00000000-0000-4000-8000-000000000001","kind":"text"}
```

Teks/caption/konteks diambil dari event durable server. Body media menambahkan
`media: {mime_type, data: <base64>}` dan `input_error: null`. Jika transfer gagal,
media=null dan input_error salah satu MEDIA_FETCH_FAILED, MEDIA_TYPE_UNSUPPORTED,
MEDIA_BASE64_INVALID atau MEDIA_TOO_LARGE. Jangan memanggil AI ketika input_error
terisi; hasilkan failed dengan reply coba ulang/manual yang tetap idempotent.

Validasi ulang file/ukuran/durasi di backend; pemeriksaan n8n bukan pengganti
decoding. OCR satu foto per expense, VN dapat beberapa expense mengikuti service
bersama. Jangan menyalin prompt atau menyimpan raw media jangka panjang.

Response:

```json
{
  "data": {
    "event_id": "00000000-0000-4000-8000-000000000001",
    "job_id": "00000000-0000-4000-8000-000000000002",
    "status": "saved",
    "committed": true,
    "reply": {
      "id": "00000000-0000-4000-8000-000000000003",
      "text": "Contoh fiktif: pengeluaran kopi Rp18.000 tersimpan."
    }
  }
}
```

Status saved/needs_review/failed wajib reply UUID dan teks 1..4000 karakter.
Saved wajib committed=true, sesudah transaksi DB benar-benar commit. queued atau
ignored boleh tanpa reply dan wajib ditangani recovery server bila masih pending.
Tidak ada callback n8n untuk queued pada draft ini; jangan mengembalikan queued
tanpa worker/outbox recovery atau mekanisme lanjutan yang benar-benar tersedia.

Sebelum commit, cek ulang link dan account scope. Writer memakai platform
whatsapp dengan source_type text/receipt/voice. Transaksi expense/items/streak
atomik, dedup message dan indeks expense, retry tidak membuat transaksi/reward
kedua. Klarifikasi/koreksi mengacu draft/expense akun yang sama; follow-up adalah
event baru, bukan menulis ulang job lama dengan payload berbeda.

## POST /api/v1/integrations/whatsapp/deliveries

Body `delivery` hasil prepare-delivery.js: contract_version, environment,
provider, bot_id, event_id, reply_id, recipient_id, status (`accepted|unknown`),
outbound_message_id (nullable), error_code (nullable).
`Idempotency-Key: wa-delivery:<reply-uuid>:<status>`.

Response cukup `{data:{status:"recorded"}}`. Scope reply/event/recipient harus
divalidasi server dan laporan yang sama aman dipanggil ulang. Draft mencoba HTTP
ini maksimal dua kali. Laporan tidak membuktikan delivered/read atau linked.

Unknown berarti pengiriman belum dapat dipastikan; jangan mengulang otomatis
tanpa rekonsiliasi provider. Delivery report tidak mengulang AI/commit expense.
Callback delivery provider belum dipasang pada draft ini.

## Recovery yang harus tersedia

Sesudah ACK, n8n bisa mati saat download, AI atau kirim balasan. Job dan balasan
tersimpan di backend. Jadwal **Pulihkan Outbox Setiap Menit** mengambil balasan
yang siap, termasuk balasan untuk job kedaluwarsa. Pengguna diminta mengirim ulang
jika job kedaluwarsa sebelum tersimpan. Status kirim `unknown` ditinjau di Evolution.

Menyimpan job/outbox saja belum menjamin exactly-once send. Crash sesudah provider
menerima pesan tetapi sebelum laporan bisa memberi status unknown. Tidak ada
jaminan exactly-once delivery dari graph ini. OTP resend harus mempertahankan
semantik kode aktif/expiry dan tidak menghasilkan OTP yang saling bersaing.

Uji wajib: cross-account, sender LID, replay, respons commit hilang, link dicabut
ketika proses berjalan, job crash, media gagal, provider timeout serta rollback
expense/items/streak. Jangan membuka flag readiness sebelum seluruh dependency
tersebut diimplementasikan dan diuji pada staging.
