'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { callSummaryBody, formatDuration } from '../../../../utils/dmMedia'
import IncomingCallBanner from './IncomingCallBanner'

/**
 * Real one-to-one voice and video calls (WebRTC).
 *
 * Audio and video go directly between the two phones. Only the small setup
 * messages (offer, answer, network candidates, hang-up) travel through the
 * res_call_signals table: RLS fixes who sent each one, Realtime delivers it
 * only to the person it is addressed to, and you can only ring someone you
 * have already messaged. This replaced a screen that faked "Ringing…" and
 * "Connected" on a timer without ever reaching the other person.
 *
 * Calls need both people to have the app open (there is no push yet). If the
 * other person doesn't answer within 45 seconds, they get a "Missed call"
 * message in the chat instead.
 *
 * Networks: public STUN servers are enough for most home and Wi-Fi
 * connections. Some mobile networks need a TURN relay; set
 * NEXT_PUBLIC_TURN_URLS / _USERNAME / _CREDENTIAL to add one.
 */

export type CallType = 'audio' | 'video'

export interface CallPeer {
  id: string
  name: string
  avatarUrl?: string | null
}

type CallStatus = 'ringing' | 'connecting' | 'connected' | 'ended'

interface CallState {
  id: string
  peer: CallPeer
  type: CallType
  direction: 'outgoing' | 'incoming'
  status: CallStatus
  note?: string
  connectedAt?: number
}

interface SignalRow {
  call_id: string
  from_id: string
  to_id: string
  kind: 'invite' | 'answer' | 'ice' | 'decline' | 'cancel' | 'hangup' | 'busy'
  payload: Record<string, unknown>
  created_at: string
}

interface CallApi {
  available: boolean
  inCall: boolean
  startCall: (peer: CallPeer, type: CallType) => void
}

const CallContext = createContext<CallApi>({ available: false, inCall: false, startCall: () => {} })
export const useCall = () => useContext(CallContext)

const RING_TIMEOUT_MS = 45_000
const STALE_SIGNAL_MS = 60_000

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const turn = process.env.NEXT_PUBLIC_TURN_URLS
  if (turn) {
    servers.push({
      urls: turn.split(',').map(s => s.trim()).filter(Boolean),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    })
  }
  return servers
}

function mediaError(err: unknown, type: CallType): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return type === 'video' ? 'Allow camera and microphone access to make video calls.' : 'Allow microphone access to make calls.'
  if (name === 'NotFoundError') return type === 'video' ? 'No camera or microphone found on this device.' : 'No microphone found on this device.'
  return 'Could not start your microphone. Please try again.'
}

interface Props {
  myId?: string | null
  myName?: string | null
  myAvatar?: string | null
  children: React.ReactNode
}

export default function CallProvider({ myId, myName, myAvatar, children }: Props) {
  const [call, setCall] = useState<CallState | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const callRef = useRef<CallState | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  // The caller's network candidates start flowing as soon as the offer is
  // made, which can be before the invite row lands. The other side ignores
  // signals for a call it hasn't heard of, so hold them until the invite is
  // sent.
  const outgoingIce = useRef<RTCIceCandidateInit[] | null>(null)
  const incomingOffer = useRef<RTCSessionDescriptionInit | null>(null)
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const available = !!supabase && !!myId && typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined'

  const update = useCallback((next: CallState | null) => {
    callRef.current = next
    setCall(next)
  }, [])

  const signal = useCallback(async (callId: string, to: string, kind: SignalRow['kind'], payload: Record<string, unknown> = {}) => {
    if (!supabase) return { error: new Error('offline') }
    return supabase.from('res_call_signals').insert({ call_id: callId, to_id: to, kind, payload })
  }, [])

  const postToChat = useCallback(async (to: string, body: string) => {
    if (!supabase || !myId) return
    await supabase.from('messages').insert({ sender_id: myId, recipient_id: to, body, message_type: 'call', is_request: false })
  }, [myId])

  // Tear everything down and show why the call ended for a moment.
  const finish = useCallback((note: string) => {
    const current = callRef.current
    if (ringTimer.current) clearTimeout(ringTimer.current)
    if (dropTimer.current) clearTimeout(dropTimer.current)
    ringTimer.current = null
    dropTimer.current = null
    pcRef.current?.close()
    pcRef.current = null
    localRef.current?.getTracks().forEach(t => t.stop())
    localRef.current = null
    pendingIce.current = []
    outgoingIce.current = null
    incomingOffer.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setMuted(false)
    setCameraOff(false)
    if (!current) return
    // Clean up this call's setup messages; they are only useful while ringing.
    if (supabase) void supabase.from('res_call_signals').delete().eq('call_id', current.id)
    update({ ...current, status: 'ended', note })
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => {
      if (callRef.current?.id === current.id && callRef.current.status === 'ended') update(null)
    }, 2500)
  }, [update])

  const makePeer = useCallback((callId: string, peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    pc.onicecandidate = e => {
      if (!e.candidate) return
      const candidate = e.candidate.toJSON()
      if (outgoingIce.current) outgoingIce.current.push(candidate)
      else void signal(callId, peerId, 'ice', { candidate })
    }
    pc.ontrack = e => {
      setRemoteStream(e.streams[0] ?? new MediaStream([e.track]))
    }
    pc.onconnectionstatechange = () => {
      const current = callRef.current
      if (!current || current.id !== callId) return
      if (pc.connectionState === 'connected') {
        if (dropTimer.current) clearTimeout(dropTimer.current)
        if (current.status !== 'connected') update({ ...current, status: 'connected', connectedAt: Date.now() })
      } else if (pc.connectionState === 'failed') {
        void signal(callId, peerId, 'hangup')
        finish('Could not connect. One of you may be on a network that blocks calls.')
      } else if (pc.connectionState === 'disconnected') {
        // Often a brief blip (switching Wi-Fi to data); give it a moment.
        if (dropTimer.current) clearTimeout(dropTimer.current)
        dropTimer.current = setTimeout(() => {
          if (pcRef.current === pc && pc.connectionState !== 'connected') finish('Call dropped')
        }, 8000)
      }
    }
    pcRef.current = pc
    return pc
  }, [signal, finish, update])

  const getMedia = useCallback(async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
    })
    localRef.current = stream
    setLocalStream(stream)
    return stream
  }, [])

  const flushIce = useCallback(async () => {
    const pc = pcRef.current
    if (!pc?.remoteDescription) return
    const queued = pendingIce.current
    pendingIce.current = []
    for (const c of queued) {
      try { await pc.addIceCandidate(c) } catch { /* stale candidate */ }
    }
  }, [])

  const startCall = useCallback(async (peer: CallPeer, type: CallType) => {
    if (!available || !myId || callRef.current) return
    const id = crypto.randomUUID()
    update({ id, peer, type, direction: 'outgoing', status: 'ringing' })
    outgoingIce.current = []
    try {
      const stream = await getMedia(type)
      const pc = makePeer(id, peer.id)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const { error } = await signal(id, peer.id, 'invite', {
        type, sdp: { type: offer.type, sdp: offer.sdp }, name: myName || 'Resident', avatar: myAvatar || null
      })
      if (error) {
        finish('You can call people once you have messaged each other.')
        return
      }
      const held = outgoingIce.current || []
      outgoingIce.current = null
      for (const candidate of held) void signal(id, peer.id, 'ice', { candidate })
      ringTimer.current = setTimeout(() => {
        const current = callRef.current
        if (current?.id !== id || current.status !== 'ringing') return
        void signal(id, peer.id, 'cancel')
        void postToChat(peer.id, callSummaryBody(type, true))
        finish('No answer')
      }, RING_TIMEOUT_MS)
    } catch (err) {
      finish(mediaError(err, type))
    }
  }, [available, myId, myName, myAvatar, update, getMedia, makePeer, signal, finish, postToChat])

  const accept = useCallback(async () => {
    const current = callRef.current
    const offer = incomingOffer.current
    if (!current || current.direction !== 'incoming' || !offer) return
    if (ringTimer.current) clearTimeout(ringTimer.current)
    update({ ...current, status: 'connecting' })
    try {
      const stream = await getMedia(current.type)
      const pc = makePeer(current.id, current.peer.id)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await signal(current.id, current.peer.id, 'answer', { sdp: { type: answer.type, sdp: answer.sdp } })
      await flushIce()
    } catch (err) {
      void signal(current.id, current.peer.id, 'hangup')
      finish(mediaError(err, current.type))
    }
  }, [update, getMedia, makePeer, signal, flushIce, finish])

  const decline = useCallback(() => {
    const current = callRef.current
    if (!current) return
    void signal(current.id, current.peer.id, 'decline')
    finish('Declined')
  }, [signal, finish])

  const hangUp = useCallback(() => {
    const current = callRef.current
    if (!current || current.status === 'ended') return
    if (current.direction === 'outgoing' && current.status === 'ringing') {
      void signal(current.id, current.peer.id, 'cancel')
      void postToChat(current.peer.id, callSummaryBody(current.type, true))
      finish('Cancelled')
      return
    }
    void signal(current.id, current.peer.id, 'hangup')
    if (current.direction === 'outgoing' && current.connectedAt) {
      void postToChat(current.peer.id, `${callSummaryBody(current.type, false)} (${formatDuration((Date.now() - current.connectedAt) / 1000)})`)
    }
    finish('Call ended')
  }, [signal, postToChat, finish])

  const handleSignal = useCallback(async (row: SignalRow) => {
    if (Date.now() - new Date(row.created_at).getTime() > STALE_SIGNAL_MS) return
    const current = callRef.current

    if (row.kind === 'invite') {
      if (current && current.status !== 'ended') {
        void signal(row.call_id, row.from_id, 'busy')
        return
      }
      const p = row.payload as { type?: CallType; sdp?: RTCSessionDescriptionInit; name?: string; avatar?: string | null }
      if (!p.sdp) return
      incomingOffer.current = p.sdp
      update({
        id: row.call_id,
        peer: { id: row.from_id, name: p.name || 'Resident', avatarUrl: p.avatar ?? null },
        type: p.type === 'video' ? 'video' : 'audio',
        direction: 'incoming',
        status: 'ringing'
      })
      if (ringTimer.current) clearTimeout(ringTimer.current)
      ringTimer.current = setTimeout(() => {
        if (callRef.current?.id === row.call_id && callRef.current.status === 'ringing') finish('Missed call')
      }, RING_TIMEOUT_MS)
      return
    }

    if (!current || current.id !== row.call_id || row.from_id !== current.peer.id) return
    const pc = pcRef.current

    switch (row.kind) {
      case 'answer': {
        const p = row.payload as { sdp?: RTCSessionDescriptionInit }
        if (!pc || !p.sdp) return
        if (ringTimer.current) clearTimeout(ringTimer.current)
        update({ ...current, status: 'connecting' })
        try {
          await pc.setRemoteDescription(p.sdp)
          await flushIce()
        } catch {
          finish('Could not connect the call.')
        }
        return
      }
      case 'ice': {
        const p = row.payload as { candidate?: RTCIceCandidateInit }
        if (!p.candidate) return
        if (pc?.remoteDescription) {
          try { await pc.addIceCandidate(p.candidate) } catch { /* stale candidate */ }
        } else {
          pendingIce.current.push(p.candidate)
        }
        return
      }
      case 'decline': finish(`${current.peer.name} declined`); return
      case 'busy': finish(`${current.peer.name} is on another call`); return
      case 'cancel': finish('Missed call'); return
      case 'hangup': finish('Call ended'); return
    }
  }, [signal, update, finish, flushIce])

  // Listen for calls addressed to me, on every dashboard page.
  const handleRef = useRef(handleSignal)
  useEffect(() => { handleRef.current = handleSignal }, [handleSignal])
  useEffect(() => {
    if (!available || !supabase || !myId) return
    const channel = supabase
      .channel(`res-calls-${myId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'res_call_signals', filter: `to_id=eq.${myId}` },
        payload => { void handleRef.current(payload.new as SignalRow) }
      )
      .subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [available, myId])

  // Hang up cleanly if the tab closes mid-call.
  const hangUpRef = useRef(hangUp)
  useEffect(() => { hangUpRef.current = hangUp }, [hangUp])
  useEffect(() => {
    const onUnload = () => hangUpRef.current()
    window.addEventListener('pagehide', onUnload)
    return () => {
      window.removeEventListener('pagehide', onUnload)
      hangUpRef.current()
    }
  }, [])

  // Call timer.
  useEffect(() => {
    if (call?.status !== 'connected') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [call?.status])

  const toggleMute = () => {
    const next = !muted
    localRef.current?.getAudioTracks().forEach(t => { t.enabled = !next })
    setMuted(next)
  }
  const toggleCamera = () => {
    const next = !cameraOff
    localRef.current?.getVideoTracks().forEach(t => { t.enabled = !next })
    setCameraOff(next)
  }

  const api: CallApi = { available, inCall: !!call && call.status !== 'ended', startCall: (p, t) => { void startCall(p, t) } }

  const showBanner = call?.direction === 'incoming' && call.status === 'ringing'

  return (
    <CallContext.Provider value={api}>
      {children}
      <IncomingCallBanner
        incomingCall={showBanner && call ? {
          callerId: call.peer.id,
          callerName: call.peer.name,
          callerAvatar: call.peer.avatarUrl,
          callerRole: 'On The Resident',
          callType: call.type
        } : null}
        onAccept={() => { void accept() }}
        onDecline={decline}
      />
      {call && !showBanner && (
        <CallScreen
          call={call}
          now={now}
          muted={muted}
          cameraOff={cameraOff}
          localStream={localStream}
          remoteStream={remoteStream}
          onMute={toggleMute}
          onCamera={toggleCamera}
          onHangUp={hangUp}
        />
      )}
    </CallContext.Provider>
  )
}

function StreamVideo({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />
}

function StreamAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}

interface ScreenProps {
  call: CallState
  now: number
  muted: boolean
  cameraOff: boolean
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  onMute: () => void
  onCamera: () => void
  onHangUp: () => void
}

function CallScreen({ call, now, muted, cameraOff, localStream, remoteStream, onMute, onCamera, onHangUp }: ScreenProps) {
  const isVideo = call.type === 'video'
  const status =
    call.status === 'ended' ? call.note || 'Call ended'
    : call.status === 'connected' && call.connectedAt ? formatDuration((now - call.connectedAt) / 1000)
    : call.status === 'connecting' ? 'Connecting…'
    : call.direction === 'outgoing' ? 'Calling…'
    : 'Ringing…'
  const showRemoteVideo = isVideo && !!remoteStream && call.status === 'connected'

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between text-white pt-[calc(2.5rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] px-6">
      {showRemoteVideo && <StreamVideo stream={remoteStream} className="absolute inset-0 w-full h-full object-cover" />}
      {!isVideo && <StreamAudio stream={remoteStream} />}
      {isVideo && !showRemoteVideo && <StreamAudio stream={remoteStream} />}

      <div className={`relative flex flex-col items-center gap-3 text-center ${showRemoteVideo ? 'bg-black/40 rounded-2xl px-4 py-2' : ''}`}>
        {!showRemoteVideo && (
          <div className="relative">
            <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-gold-primary to-amber-600 flex items-center justify-center text-black text-4xl font-black overflow-hidden">
              {call.peer.avatarUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={call.peer.avatarUrl} alt="" className="w-full h-full object-cover" />
                : call.peer.name.charAt(0).toUpperCase()}
            </div>
            {call.status === 'ringing' && <div className="absolute inset-0 -m-2 rounded-[2.4rem] border-2 border-gold-primary/50 animate-ping" />}
          </div>
        )}
        <p className="m-0 text-xl font-black">{call.peer.name}</p>
        <p className={`m-0 text-sm ${call.status === 'connected' ? 'font-mono text-emerald-400' : 'text-gray-300'}`}>
          {isVideo && call.status !== 'ended' ? `Video · ${status}` : status}
        </p>
      </div>

      {isVideo && localStream && call.status !== 'ended' && (
        <StreamVideo
          stream={localStream}
          muted
          className={`absolute right-4 top-[calc(5rem+env(safe-area-inset-top,0px))] w-28 h-40 rounded-2xl object-cover border border-white/20 shadow-2xl ${cameraOff ? 'opacity-0' : ''}`}
        />
      )}

      {call.status !== 'ended' && (
        <div className="relative flex items-center gap-5">
          <button
            type="button"
            onClick={onMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${muted ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'}`}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          {isVideo && (
            <button
              type="button"
              onClick={onCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${cameraOff ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'}`}
              aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
          <button
            type="button"
            onClick={onHangUp}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all active:scale-95 touch-target-48"
            aria-label="Hang up"
          >
            <PhoneOff size={26} />
          </button>
        </div>
      )}
    </div>
  )
}
