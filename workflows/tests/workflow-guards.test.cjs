const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const scripts = path.join(__dirname, '../code');
const run = (file, input, context = {}) => new Function('$json', '$', fs.readFileSync(path.join(scripts, file + '.js'), 'utf8'))(
  input, name => ({item: {json: context[name]}})
).json;
const copy = value => JSON.parse(JSON.stringify(value));
const config = {expected_instance: 'cashly-staging', backend_base_url: 'http://backend:8000', linking_backend_ready: false, expense_processing_enabled: true};
const incoming = () => ({config, body: {
  event: 'messages.upsert', instance: 'cashly-staging', apikey: 'SYNTHETIC-DO-NOT-RETAIN',
  sender: '000000000002@s.whatsapp.net',
  data: {key: {remoteJid: '000000000001@s.whatsapp.net', fromMe: false, id: 'SYNTHETIC-001'},
    message: {conversation: 'kopi 18rb', messageContextInfo: {messageSecret: {fake: true}}},
    messageTimestamp: 1795176000}
}});
let count = 0;
const test = (name, fn) => {fn(); count++; console.log('PASS ' + name);};
const normalized = run('normalize-event', incoming());
const eventId = '00000000-0000-4000-8000-000000000001';
const jobId = '00000000-0000-4000-8000-000000000002';
const replyId = '00000000-0000-4000-8000-000000000003';
const admission = () => ({data: {event_id: eventId, job_id: jobId, verified_link: true,
  action: 'process', kind: 'text', message_id: normalized.event.message_id,
  sender_id: normalized.event.sender_id, bot_id: 'cashly-staging'}});
const admit = data => run('validate-admission', data, {'Normalisasi Pesan': normalized});
const accepted = admit(admission());
const context = {'Validasi Izin Backend': accepted};
test('incoming JID is sender, not bot root sender', () => {
  assert.equal(normalized.eligible, true);
  assert.equal(normalized.event.sender_id, incoming().body.data.key.remoteJid);
  assert.notEqual(normalized.event.sender_id, incoming().body.sender);
});
test('raw keys/device secrets are excluded', () => {
  const value = JSON.stringify(normalized);
  assert(!value.includes('SYNTHETIC-DO-NOT-RETAIN'));
  assert(!value.includes('messageSecret'));
  assert(!value.includes('headers'));
});
for (const [name, mutate] of [
  ['own message', x => x.body.data.key.fromMe = true],
  ['missing fromMe', x => delete x.body.data.key.fromMe],
  ['wrong instance', x => x.body.instance = 'another-bot'],
  ['delivery event', x => x.body.event = 'messages.update'],
  ['group', x => x.body.data.key.remoteJid = '123@g.us'],
  ['broadcast', x => x.body.data.key.remoteJid = 'status@broadcast'],
  ['missing ID', x => delete x.body.data.key.id],
  ['invalid timestamp', x => x.body.data.messageTimestamp = -1],
  ['history', x => x.body.data.type = 'append'],
  ['protocol event', x => x.body.data.message = {protocolMessage: {}}],
  ['blank text', x => x.body.data.message = {conversation: '   '}],
  ['overlong text', x => x.body.data.message = {conversation: 'x'.repeat(4001)}],
  ['view-once image', x => x.body.data.message = {viewOnceMessage: {message: {imageMessage: {}}}}]
]) test('ignores ' + name, () => {const x = incoming(); mutate(x); assert.equal(run('normalize-event', x).eligible, false);});
test('text DELIVERY_ACK is not dropped', () => {const x = incoming(); x.body.data.status = 'DELIVERY_ACK'; assert(run('normalize-event', x).eligible);});
test('LID remains intact and alternate phone is only a hint', () => {
  const x = incoming(); x.body.data.key.remoteJid = '123456@lid';
  x.body.data.key.remoteJidAlt = '000000000001@s.whatsapp.net';
  const result = run('normalize-event', x);
  assert(result.eligible); assert.equal(result.event.sender_id, '123456@lid');
  assert.equal(result.event.sender_phone_jid, x.body.data.key.remoteJidAlt);
});
test('extended text preserves correction reference', () => {
  const x = incoming(); x.body.data.message = {extendedTextMessage: {text: 'ubah jadi 20rb', contextInfo: {stanzaId: 'ORIGINAL-001'}}};
  assert.equal(run('normalize-event', x).event.quoted_message_id, 'ORIGINAL-001');
});
test('photo caption preserved, media URL excluded', () => {
  const x = incoming(); x.body.data.message = {imageMessage: {caption: 'kemarin', mimetype: 'image/jpeg', url: 'https://do-not-fetch.invalid'}};
  const result = run('normalize-event', x);
  assert.equal(result.event.kind, 'receipt'); assert.equal(result.event.caption, 'kemarin');
  assert(!JSON.stringify(result).includes('do-not-fetch'));
});
test('voice classified without transcription in n8n', () => {
  const x = incoming(); x.body.data.message = {audioMessage: {ptt: true, mimetype: 'audio/ogg; codecs=opus'}};
  assert.equal(run('normalize-event', x).event.kind, 'voice');
});
test('ephemeral wrapper unwrapped', () => {
  const x = incoming(); x.body.data.message = {ephemeralMessage: {message: {conversation: '/help'}}};
  assert.equal(run('normalize-event', x).event.command_hint, 'help');
});
test('report hint never grants link', () => {
  const x = incoming(); x.body.data.message.conversation = '/laporan bulan ini';
  const result = run('normalize-event', x); assert.equal(result.event.command_hint, 'report');
  assert.equal(result.event.verified_link, undefined);
});
test('valid process admission accepted', () => assert.equal(accepted.admission.job_id, jobId));
for (const [name, mutate] of [
  ['unlinked process', x => x.data.verified_link = false],
  ['string true link', x => x.data.verified_link = 'true'],
  ['wrong sender', x => x.data.sender_id = 'other@lid'],
  ['wrong message', x => x.data.message_id = 'OTHER'],
  ['wrong bot', x => x.data.bot_id = 'other'],
  ['wrong kind', x => x.data.kind = 'receipt'],
  ['job path injection', x => x.data.job_id = '../other'],
  ['unknown action', x => x.data.action = 'save_directly']
]) test('rejects admission ' + name, () => {const x = admission(); mutate(x); assert.throws(() => admit(x));});
test('OTP/help reply allowed without linked flag', () => {
  const x = admission(); x.data.action = 'reply'; x.data.verified_link = false;
  x.data.reply = {id: replyId, text: 'Contoh OTP fiktif: masukkan kode di app.'};
  const result = admit(x); assert.equal(result.reply.id, replyId);
  assert.equal(result.admission.job_id, null);
});
test('invalid reply rejected', () => {
  const x = admission(); x.data.action = 'reply'; x.data.reply = {id: replyId, text: ''};
  assert.throws(() => admit(x));
});
const mediaContext = kind => ({'Validasi Izin Backend': {...accepted, event: {...accepted.event, kind}}});
test('image base64 converted into bounded backend payload', () => {
  const x = run('prepare-media', {success: true, data: {mimetype: 'image/png', base64: 'AA=='}}, mediaContext('receipt'));
  assert.equal(x.process_body.media.data, 'AA=='); assert.equal(x.process_body.input_error, null);
});
for (const [name, input, error] of [
  ['failed fetch', {error: {message: 'SENSITIVE'}}, 'MEDIA_FETCH_FAILED'],
  ['invalid MIME', {success: true, data: {mimetype: 'text/html', base64: 'AA=='}}, 'MEDIA_TYPE_UNSUPPORTED'],
  ['invalid base64', {success: true, data: {mimetype: 'image/png', base64: '%%%='}}, 'MEDIA_BASE64_INVALID'],
  ['oversize image', {success: true, data: {mimetype: 'image/png', base64: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64')}}, 'MEDIA_TOO_LARGE']
]) test('media ' + name + ' routes a safe failure', () => {
  const result = run('prepare-media', input, mediaContext('receipt'));
  assert.equal(result.process_body.media, null); assert.equal(result.process_body.input_error, error);
  assert(!JSON.stringify(result).includes('SENSITIVE'));
});
test('OGG MIME parameters normalized', () => {
  const result = run('prepare-media', {success: true, data: {mimetype: 'audio/ogg; codecs=opus', base64: 'AA=='}}, mediaContext('voice'));
  assert.equal(result.process_body.media.mime_type, 'audio/ogg');
});
const outcome = status => ({data: {event_id: eventId, job_id: jobId, status, committed: true, reply: {id: replyId, text: 'Contoh balasan'}}});
test('saved requires confirmed commit', () => {
  const x = outcome('saved'); x.data.committed = false;
  assert.throws(() => run('validate-outcome', x, context));
});
test('outcome for another job rejected', () => {
  const x = outcome('saved'); x.data.job_id = replyId;
  assert.throws(() => run('validate-outcome', x, context));
});
for (const status of ['saved','needs_review','failed']) test(status + ' preserves backend reply', () => {
  const result = run('validate-outcome', outcome(status), context);
  assert.equal(result.reply.id, replyId); assert.equal(result.status, status);
});
test('queued without reply waits for backend recovery', () => {
  const x = outcome('queued'); x.data.reply = null;
  assert.equal(run('validate-outcome', x, context).reply, null);
});
test('terminal outcome without reply rejected', () => {
  const x = outcome('failed'); x.data.reply = null;
  assert.throws(() => run('validate-outcome', x, context));
});
const sendContext = {'Balasan yang Diklaim': {...accepted, reply: {id: replyId, lease_id: replyId, text: 'FICTITIOUS-OTP-CONTENT'}}};
test('provider acceptance does not claim delivery or retain reply text', () => {
  const x = run('prepare-delivery', {success: true, data: {key: {id: 'OUTBOUND-001', fromMe: true}}}, sendContext);
  assert.equal(x.delivery.status, 'accepted'); assert.equal(x.delivery.outbound_message_id, 'OUTBOUND-001');
  assert(!JSON.stringify(x).includes('FICTITIOUS-OTP-CONTENT'));
});
test('outbound timeout stays unknown without invented message ID', () => {
  const x = run('prepare-delivery', {error: {message: 'SENSITIVE-TIMEOUT'}}, sendContext);
  assert.equal(x.delivery.status, 'unknown'); assert.equal(x.delivery.outbound_message_id, null);
  assert(!JSON.stringify(x).includes('SENSITIVE-TIMEOUT'));
});
test('financial processing blocked in linking-only mode', () => {
  const original = copy(normalized); original.config.expense_processing_enabled = false;
  assert.throws(() => run('validate-admission', admission(), {'Normalisasi Pesan': original}), /CASHLY_EXPENSE_PROCESSING_DISABLED/);
});
const claimRequest = {config, requested_reply_id: replyId, expected_event: normalized.event};
const claimResponse = () => ({data: {event_id: eventId, bot_id: config.expected_instance, action: 'reply',
  sender_id: normalized.event.sender_id, message_id: normalized.event.message_id, kind: 'text',
  reply: {id: replyId, lease_id: replyId, text: 'Synthetic response'}}});
test('claim validates scope and propagates lease', () => {
  const x = run('validate-claim', claimResponse(), {'Siapkan Klaim': claimRequest});
  assert.equal(x.reply.lease_id, replyId);
  assert.equal(run('prepare-delivery', {}, sendContext).delivery.lease_id, replyId);
});
test('empty outbox does not send', () => assert.equal(run('validate-claim', {data:null}, {'Siapkan Klaim':claimRequest}).has_claim,false));
for (const field of ['sender_id','message_id','bot_id']) test('claim rejects changed '+field, () => {
  const x=claimResponse();x.data[field]='wrong';assert.throws(()=>run('validate-claim',x,{'Siapkan Klaim':claimRequest}));
});
test('claim requires valid lease', () => {const x=claimResponse();delete x.data.reply.lease_id;assert.throws(()=>run('validate-claim',x,{'Siapkan Klaim':claimRequest}));});
console.log(`${count} workflow guard checks passed; no network, AI, WhatsApp send or database writes.`);
