# Contoh payload

`evolution-text.json` memetakan struktur event teks Evolution 2.3.7 yang diamati
user; semua nomor, message ID dan isi pesan adalah fiktif. Root `sender` adalah
identitas bot, pengirim chat berasal dari `data.key.remoteJid`.

Untuk tes MCP, gunakan objek file ini sebagai `webhookData.body`, bukan sebagai
seluruh item Webhook n8n. Untuk tes lokal, bungkus dengan `{body: payload, config}`
sesuai node Konfigurasi Staging. Timestamp fixture tetap, bukan jam server hidup.

Sampel foto/VN provider nyata belum tersedia. Tes lokal memakai bentuk fiktif;
siapkan sampel tersanitasi setelah menguji foto dengan caption, VN, pesan kutipan,
pesan bot sendiri, grup, history dan status pengiriman.

Gunakan sender/message/instance fiktif dan jangan menyertakan API key, token,
nomor nyata, isi finansial pribadi, OTP, QR atau base64 media pengguna. Catat
versi Evolution serta bentuk event asli sebelum memetakan ke envelope Cashly.

`remoteJid` atau sender berformat `@lid` tidak boleh dianggap langsung sebagai
nomor telepon. Pemetaan identitas harus diverifikasi sesuai event provider nyata.
