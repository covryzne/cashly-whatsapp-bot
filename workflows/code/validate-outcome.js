const original = $('Validasi Izin Backend').item.json;
const result = $json.data;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!result || result.event_id !== original.admission.event_id || result.job_id !== original.admission.job_id
  || !['saved','needs_review','failed','queued','ignored'].includes(result.status)) throw new Error('CASHLY_OUTCOME_INVALID');
if (result.status === 'saved' && result.committed !== true) throw new Error('CASHLY_COMMIT_NOT_CONFIRMED');
const reply = result.reply;
if (reply != null && (!uuid.test(reply.id ?? '') || typeof reply.text !== 'string' || !reply.text.trim() || reply.text.length > 4000)) throw new Error('CASHLY_REPLY_INVALID');
if (['saved','needs_review','failed'].includes(result.status) && !reply) throw new Error('CASHLY_TERMINAL_REPLY_MISSING');
return {json: {config: original.config, event: original.event, admission: original.admission,
  status: result.status, reply: reply ? {id: reply.id, text: reply.text} : null}};
