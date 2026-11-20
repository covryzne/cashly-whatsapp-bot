const cfg = $json.config;
const body = $json.body ?? {};
const data = body.data ?? {};
const key = data.key ?? {};
const jid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
let message = data.message ?? {};
let unsupportedWrapper = false;
for (let depth = 0; depth < 4; depth++) {
  if (message.viewOnceMessage || message.viewOnceMessageV2 || message.viewOnceMessageV2Extension) {
    unsupportedWrapper = true;
    break;
  }
  if (message.ephemeralMessage?.message) message = message.ephemeralMessage.message;
  else if (message.documentWithCaptionMessage?.message) message = message.documentWithCaptionMessage.message;
  else break;
}
const image = message.imageMessage;
const audio = message.audioMessage;
const textValue = message.conversation ?? message.extendedTextMessage?.text;
const kind = image ? 'receipt' : audio ? 'voice' : typeof textValue === 'string' ? 'text' : 'unsupported';
const text = typeof textValue === 'string' ? textValue.trim() : '';
const media = image ?? audio;
const rawTime = data.messageTimestamp;
const timestamp = typeof rawTime === 'number' ? rawTime
  : typeof rawTime === 'string' && /^\d+$/.test(rawTime) ? Number(rawTime) : NaN;
const validTime = Number.isSafeInteger(timestamp) && timestamp > 0 && timestamp < 253402300800;
const context = image?.contextInfo ?? audio?.contextInfo ?? message.extendedTextMessage?.contextInfo;
const command = kind !== 'text' ? 'expense'
  : /^\/(help|info|start)(?:\s|$)/i.test(text) ? 'help'
  : /^\/laporan(?:\s|$)/i.test(text) ? 'report'
  : /^Halo Cashly, hubungkan WhatsApp saya\. Kode koneksi:\s*\S+/i.test(text) ? 'link'
  : 'expense_or_correction';
let reason = null;
if (body.event !== 'messages.upsert') reason = 'event_not_supported';
else if (body.instance !== cfg.expected_instance) reason = 'wrong_instance';
else if (key.fromMe !== false) reason = 'not_inbound';
else if (!/^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(jid)) reason = 'not_direct_chat';
else if (typeof key.id !== 'string' || !key.id || key.id.length > 255) reason = 'invalid_message_id';
else if (!validTime) reason = 'invalid_timestamp';
else if (body.type === 'history' || data.type === 'append' || data.isHistory === true) reason = 'history';
else if (unsupportedWrapper) reason = 'view_once_not_supported';
else if (kind === 'unsupported' || (kind === 'text' && !text)) reason = 'unsupported_or_empty';
else if (text.length > 4000 || (typeof media?.caption === 'string' && media.caption.length > 1000)) reason = 'input_too_long';
const phoneJid = [jid, key.remoteJidAlt].find(v => typeof v === 'string' && /^\d+@s\.whatsapp\.net$/.test(v)) ?? null;
return {json: {
  config: cfg,
  eligible: reason === null,
  ignore_reason: reason,
  event: {
    contract_version: 'cashly-wa-v1', environment: 'staging', provider: 'evolution',
    bot_id: cfg.expected_instance, event_type: 'messages.upsert',
    message_id: typeof key.id === 'string' ? key.id : '', sender_id: jid,
    sender_phone_jid: phoneJid, addressing_mode: typeof key.addressingMode === 'string' ? key.addressingMode : null,
    sent_at: validTime ? new Date(timestamp * 1000).toISOString() : null,
    received_at: new Date().toISOString(), kind, command_hint: command,
    text: kind === 'text' ? text : null,
    caption: typeof image?.caption === 'string' ? image.caption : null,
    quoted_message_id: typeof context?.stanzaId === 'string' ? context.stanzaId : null,
    media: media ? {mime_type: typeof media.mimetype === 'string' ? media.mimetype : null} : null
  }
}};
