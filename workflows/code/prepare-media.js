const original = $('Validasi Izin Backend').item.json;
const receipt = original.event.kind === 'receipt';
const result = $json;
const payload = result.data;
const mime = typeof payload?.mimetype === 'string' ? payload.mimetype.toLowerCase().split(';')[0].trim() : '';
const base64 = payload?.base64;
const maxBytes = receipt ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
const allowed = receipt ? ['image/jpeg','image/png','image/webp']
  : ['audio/ogg','audio/opus','audio/webm','audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/flac','audio/x-flac'];
let issue = null;
if (result.success !== true || !payload) issue = 'MEDIA_FETCH_FAILED';
else if (!allowed.includes(mime)) issue = 'MEDIA_TYPE_UNSUPPORTED';
else if (typeof base64 !== 'string' || !base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) issue = 'MEDIA_BASE64_INVALID';
else {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  if (base64.length / 4 * 3 - padding > maxBytes) issue = 'MEDIA_TOO_LARGE';
}
return {json: {
  config: original.config, event: original.event, admission: original.admission,
  process_body: {
    event_id: original.admission.event_id, kind: original.event.kind,
    media: issue ? null : {mime_type: mime, data: base64}, input_error: issue
  }
}};
