'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_VOICE_SECONDS, pickRecorderMime } from '../../../../utils/dmMedia'

export interface Recording {
  blob: Blob
  mime: string
  seconds: number
}

/**
 * Records a real voice note with the browser's MediaRecorder (webm on
 * Chrome/Android, mp4 on Safari/iPhone). Stops itself at MAX_VOICE_SECONDS
 * and hands the recording to onLimit so it can be sent.
 */
export function useVoiceRecorder(onError: (message: string) => void, onLimit: (r: Recording) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef = useRef('')
  const onLimitRef = useRef(onLimit)
  useEffect(() => { onLimitRef.current = onLimit }, [onLimit])

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    recRef.current = null
    setRecording(false)
  }, [])

  const stop = useCallback((): Promise<Recording | null> => {
    const rec = recRef.current
    if (!rec || rec.state === 'inactive') return Promise.resolve(null)
    const secs = (Date.now() - startedAt.current) / 1000
    return new Promise(resolve => {
      rec.onstop = () => {
        const mime = rec.mimeType || mimeRef.current || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        cleanup()
        resolve({ blob, mime, seconds: secs })
      }
      rec.stop()
    })
  }, [cleanup])

  const start = useCallback(async () => {
    if (recRef.current) return
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('This browser cannot record voice notes.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mime = pickRecorderMime(t => MediaRecorder.isTypeSupported(t))
      mimeRef.current = mime
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      streamRef.current = stream
      recRef.current = rec
      startedAt.current = Date.now()
      setSeconds(0)
      setRecording(true)
      rec.start(250)
      timer.current = setInterval(() => {
        const secs = (Date.now() - startedAt.current) / 1000
        setSeconds(secs)
        if (secs >= MAX_VOICE_SECONDS) {
          void stop().then(r => { if (r) onLimitRef.current(r) })
        }
      }, 250)
    } catch (err) {
      cleanup()
      const name = err instanceof DOMException ? err.name : ''
      onError(name === 'NotAllowedError'
        ? 'Allow microphone access to record voice notes.'
        : name === 'NotFoundError' ? 'No microphone found on this device.' : 'Could not start recording.')
    }
  }, [cleanup, onError, stop])

  const cancel = useCallback(() => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      rec.stop()
    }
    chunksRef.current = []
    cleanup()
  }, [cleanup])

  useEffect(() => () => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop() }
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (timer.current) clearInterval(timer.current)
  }, [])

  return { recording, seconds, start, stop, cancel }
}
