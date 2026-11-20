# Workflow n8n

Belum ada JSON WhatsApp siap impor. Template lama Telegram + Google Sheets sudah
ditinjau dalam diskusi, tetapi belum diadaptasi dan tidak disalin mentah ke Git
karena mengandung konfigurasi/credential yang perlu disanitasi.

Target pembagian workflow:

1. Receiver Evolution: verifikasi sumber, normalisasi, filter dan registrasi event.
2. Linking/bantuan: pengiriman instruksi backend untuk OTP, help dan info.
3. Pencatatan: teks, transfer foto/VN setelah otorisasi, klarifikasi dan hasil.
4. Pengiriman/pemulihan: kirim balasan dan laporkan hasil pengiriman ke backend.

Nama file dan jumlah subworkflow final ditentukan saat adaptasi. Jangan membuat
JSON placeholder yang tampak siap dipakai padahal kontrak backend belum tersedia.

Sebelum commit ekspor, hapus API key, token, header autentikasi literal, OTP,
pinData, execution data, QR, nomor nyata, webhook privat, dan ID credential
instance. Gunakan nama credential yang perlu dipilih ulang saat impor.

Perubahan JSON di Git tidak otomatis diterapkan ke n8n. Impor sebagai workflow
baru nonaktif, pilih credential, uji payload fiktif, lalu uji staging sebelum
aktivasi. Jangan menimpa workflow Telegram live saat adaptasi.
