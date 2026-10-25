import { test } from 'node:test'
import assert from 'node:assert'
import {
  formatDuration, voiceNoteBody, voiceNoteDuration, voiceNotePath, pickRecorderMime, uploadTypeFor,
  locationBody, parseLegacyBeacon, isLegacyVoiceNote, tileFor, callSummaryBody, photoBody
} from './dmMedia'

test('durations format as m:ss', () => {
  assert.strictEqual(formatDuration(7), '0:07')
  assert.strictEqual(formatDuration(75), '1:15')
  assert.strictEqual(formatDuration(-3), '0:00')
})

test('voice-note body round-trips its duration, including old notes', () => {
  assert.strictEqual(voiceNoteBody(7), '🎙️ Voice note (0:07)')
  assert.strictEqual(voiceNoteDuration(voiceNoteBody(65)), '1:05')
  assert.strictEqual(voiceNoteDuration('🎙️ [Voice Note] Duration: 0:12 — Encrypted Resident Audio Note'), '0:12')
  assert.ok(isLegacyVoiceNote('🎙️ [Voice Note] Duration: 0:12'))
  assert.ok(!isLegacyVoiceNote(voiceNoteBody(3)))
})

test('voice-note path puts sender then recipient first, for the storage policy', () => {
  const p = voiceNotePath('sender-1', 'recipient-2', 'webm', 1000)
  assert.ok(p.startsWith('sender-1/recipient-2/1000-'))
  assert.ok(p.endsWith('.webm'))
})

test('recorder picks a supported format and maps it to an upload type', () => {
  assert.strictEqual(pickRecorderMime(t => t === 'audio/mp4'), 'audio/mp4')
  assert.strictEqual(pickRecorderMime(() => false), '')
  assert.strictEqual(pickRecorderMime(() => { throw new Error('x') }), '')
  assert.deepStrictEqual(uploadTypeFor('audio/webm;codecs=opus'), { contentType: 'audio/webm', ext: 'webm' })
  assert.deepStrictEqual(uploadTypeFor('audio/mp4'), { contentType: 'audio/mp4', ext: 'm4a' })
})

test('location body is a plain maps link others can open', () => {
  assert.strictEqual(locationBody(-26.19, 28.03), '📍 Shared location: https://www.google.com/maps?q=-26.190000,28.030000')
})

test('old beacons parse, and the made-up fallback is flagged', () => {
  const fake = parseLegacyBeacon('📍 [Find Me Beacon] Lat: -26.1926, Lon: 28.0305 — Braamfontein Co-Living Zone.')
  assert.deepStrictEqual(fake, { lat: -26.1926, lon: 28.0305, placeholder: true })
  const real = parseLegacyBeacon('📍 [Find Me Beacon] Lat: -33.9249, Lon: 18.4241 — Shared live resident location coordinates.')
  assert.strictEqual(real?.placeholder, false)
  assert.strictEqual(parseLegacyBeacon('hello'), null)
})

test('tile maths puts Johannesburg in the right zoom-15 tile', () => {
  const t = tileFor(-26.2041, 28.0473, 15)
  assert.strictEqual(t.x, 18936)
  assert.strictEqual(t.y, 18856)
  assert.ok(t.px >= 0 && t.px < 256 && t.py >= 0 && t.py < 256)
})

test('call summaries read naturally', () => {
  assert.strictEqual(callSummaryBody('audio', true), '📞 Missed voice call')
  assert.strictEqual(callSummaryBody('video', false), '📞 Video call')
})

test('photo body formats label with optional caption', () => {
  assert.strictEqual(photoBody(), '📷 Photo attachment')
  assert.strictEqual(photoBody('Lease agreement'), '📷 Photo: Lease agreement')
})
