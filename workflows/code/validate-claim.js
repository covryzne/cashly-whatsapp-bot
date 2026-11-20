const request = $('Siapkan Klaim').item.json;
const value = $json.data;
if (value === null) return {json: {has_claim: false}};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!value || !uuid.test(value.event_id ?? '') || value.bot_id !== request.config.expected_instance
  || value.action !== 'reply' || !/^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(value.sender_id ?? '')
  || !uuid.test(value.reply?.id ?? '') || !uuid.test(value.reply?.lease_id ?? '')
  || typeof value.reply.text !== 'string' || !value.reply.text.trim() || value.reply.text.length > 4000) {
  throw new Error('CASHLY_OUTBOX_CLAIM_INVALID');
}
if (request.requested_reply_id && (request.requested_reply_id !== value.reply.id
  || request.expected_event?.sender_id !== value.sender_id
  || request.expected_event?.message_id !== value.message_id)) throw new Error('CASHLY_OUTBOX_SCOPE_MISMATCH');
return {json: {
  has_claim: true, config: request.config,
  event: {bot_id: value.bot_id, sender_id: value.sender_id, message_id: value.message_id, kind: value.kind},
  admission: {event_id: value.event_id}, reply: value.reply
}};
