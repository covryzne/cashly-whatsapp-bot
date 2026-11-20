const original = $('Normalisasi Pesan').item.json;
const result = $json.data;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!result || !uuid.test(result.event_id ?? '') || !['reply','process','ignore'].includes(result.action)) {
  throw new Error('CASHLY_ADMISSION_INVALID');
}
if (result.message_id !== original.event.message_id || result.sender_id !== original.event.sender_id || result.bot_id !== original.event.bot_id) {
  throw new Error('CASHLY_EVENT_SCOPE_MISMATCH');
}
if (result.action === 'process' && (result.verified_link !== true || !uuid.test(result.job_id ?? '') || result.kind !== original.event.kind)) {
  throw new Error('CASHLY_PROCESS_NOT_AUTHORIZED');
}
if (result.action === 'process' && original.config.expense_processing_enabled !== true) {
  throw new Error('CASHLY_EXPENSE_PROCESSING_DISABLED');
}
if (result.action === 'reply' && (!uuid.test(result.reply?.id ?? '') || typeof result.reply?.text !== 'string' || !result.reply.text.trim() || result.reply.text.length > 4000)) {
  throw new Error('CASHLY_REPLY_INVALID');
}
return {json: {
  config: original.config, event: original.event,
  admission: {event_id: result.event_id, action: result.action,
    job_id: result.action === 'process' ? result.job_id : null,
    kind: original.event.kind, verified_link: result.verified_link === true},
  reply: result.action === 'reply' ? {id: result.reply.id, text: result.reply.text} : null
}};
