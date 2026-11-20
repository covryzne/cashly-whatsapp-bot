const original = $('Balasan yang Diklaim').item.json;
const response = $json;
const id = response.data?.key?.id;
const accepted = response.success === true && typeof id === 'string' && id.length > 0 && response.data?.key?.fromMe === true;
return {json: {config: original.config,
  delivery: {
    contract_version: 'cashly-wa-v1', environment: 'staging', provider: 'evolution',
    bot_id: original.event.bot_id, event_id: original.admission.event_id,
    reply_id: original.reply.id, recipient_id: original.event.sender_id,
    lease_id: original.reply.lease_id,
    status: accepted ? 'accepted' : 'unknown', outbound_message_id: accepted ? id : null,
    error_code: accepted ? null : 'OUTBOUND_UNCONFIRMED'
  }
}};
