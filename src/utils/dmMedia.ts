// Helpers for voice notes, shared locations and calls in DMs.
//
// DMs live in the `messages` table shared with The Gruvs, so every special
// message keeps a readable `body` (that is what The Gruvs shows) and puts the
// structured data in the table's own columns: message_type, media_url,
// media_type, latitude, longitude.

export const VOICE_BUCKET = 'res-voice-notes'
export const MAX_VOICE_SECONDS = 120

/** 7 -> "0:07", 75 -> "1:15" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function voiceNoteBody(seconds: number): string {
  return `🎙️ Voice note (${formatDuration(seconds)})`
}

/** Duration back out of a voice-note body, for the player label. */
export function voiceNoteDuration(body: string): string | null {
  return body.match(/\((\d+:\d{2})\)/)?.[1] ?? body.match(/Duration:\s*(\d+:\d{2})/)?.[1] ?? null
}

/** Private-bucket path: sender first, recipient second, so the storage
 *  policy can let exactly those two people read it. */
export function voiceNotePath(senderId: string, recipientId: string, ext: string, now: number = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${senderId}/${recipientId}/${now}-${rand}.${ext}`
}

const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

/** The first recording format this browser supports (Chrome/Android: webm,
 *  Safari/iPhone: mp4), or '' when MediaRecorder can't record audio. */
export function pickRecorderMime(isSupported: (type: string) => boolean): string {
  return RECORDER_TYPES.find(t => {
    try { return isSupported(t) } catch { return false }
  }) ?? ''
}

/** "audio/webm;codecs=opus" -> { contentType: "audio/webm", ext: "webm" } */
export function uploadTypeFor(recorderMime: string): { contentType: string; ext: string } {
  const base = (recorderMime.split(';')[0] || 'audio/webm').trim()
  const ext = base === 'audio/mp4' ? 'm4a' : base === 'audio/ogg' ? 'ogg' : base === 'audio/mpeg' ? 'mp3' : 'webm'
  return { contentType: base, ext }
}

export function mapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`
}

export function locationBody(lat: number, lon: number): string {
  return `📍 Shared location: ${mapsUrl(lat, lon)}`
}

export interface ParsedLocation {
  lat: number
  lon: number
  /** Old "Find Me Beacon" messages sent made-up Braamfontein coordinates
   *  whenever GPS failed. Those are not anyone's real position. */
  placeholder: boolean
}

/** Read a location out of the old "📍 [Find Me Beacon] Lat: x, Lon: y" text. */
export function parseLegacyBeacon(body: string): ParsedLocation | null {
  if (!body.startsWith('📍 [Find Me Beacon]')) return null
  const lat = Number(body.match(/Lat:\s*(-?[\d.]+)/)?.[1])
  const lon = Number(body.match(/Lon:\s*(-?[\d.]+)/)?.[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon, placeholder: body.includes('Co-Living Zone') }
}

export function isLegacyVoiceNote(body: string): boolean {
  return body.startsWith('🎙️ [Voice Note]')
}

/** Web-Mercator tile containing a point, plus the point's pixel position
 *  inside that 256px tile, for drawing a small map preview from tiles. */
export function tileFor(lat: number, lon: number, zoom: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** zoom
  const latRad = (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180
  const fx = ((lon + 180) / 360) * n
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const x = Math.floor(fx)
  const y = Math.floor(fy)
  return { x, y, px: (fx - x) * 256, py: (fy - y) * 256 }
}

export function callSummaryBody(type: 'audio' | 'video', missed: boolean): string {
  const what = type === 'video' ? 'video call' : 'voice call'
  return missed ? `📞 Missed ${what}` : `📞 ${what[0].toUpperCase()}${what.slice(1)}`
}
