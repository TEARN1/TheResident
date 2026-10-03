'use client';

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  X, 
  Mic, 
  MicOff, 
  Hand, 
  Users, 
  Volume2, 
  ShieldCheck, 
  Sparkles,
  PhoneOff
} from 'lucide-react';

interface Speaker {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

interface Listener {
  id: string;
  name: string;
  avatar: string;
  hasHandRaised: boolean;
}

const INITIAL_SPEAKERS: Speaker[] = [
  { id: 's1', name: 'Noluthando Z.', role: 'House Committee Chairperson', avatar: 'NZ', isSpeaking: true, isMuted: false },
  { id: 's2', name: 'Mr. Van Der Merwe', role: 'Building Facility Manager', avatar: 'VM', isSpeaking: false, isMuted: true },
  { id: 's3', name: 'Kamohelo P.', role: 'Floor 3 Rep', avatar: 'KP', isSpeaking: false, isMuted: false }
];

const INITIAL_LISTENERS: Listener[] = [
  { id: 'l1', name: 'Bontle M.', avatar: 'BM', hasHandRaised: true },
  { id: 'l2', name: 'Tariq A.', avatar: 'TA', hasHandRaised: false },
  { id: 'l3', name: 'Zandile S.', avatar: 'ZS', hasHandRaised: false },
  { id: 'l4', name: 'Liam C.', avatar: 'LC', hasHandRaised: false },
  { id: 'l5', name: 'Thando G.', avatar: 'TG', hasHandRaised: false },
];

interface AudioSpacesTownHallModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceTitle?: string;
  spaceCategory?: string;
}

export function AudioSpacesTownHallModal({
  isOpen,
  onClose,
  spaceTitle = 'Emergency Water Interruption & Jojo Tank Contingency',
  spaceCategory = 'Braamfontein South Point Res Committee'
}: AudioSpacesTownHallModalProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>(INITIAL_SPEAKERS);
  const listeners = INITIAL_LISTENERS;
  const [isSelfMuted, setIsSelfMuted] = useState(true);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const activeSpeechSnippet =
    '"Joburg Water has confirmed maintenance on the Parktown reservoir until 18:00 today. The backup 5000L tanks in courtyard B are currently operational..."';

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      // Toggle speaking state randomly among speakers to simulate active discussion
      setSpeakers(prev =>
        prev.map((s, idx) => ({
          ...s,
          isSpeaking: idx === Math.floor(Math.random() * prev.length)
        }))
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-bold text-rose-400 tracking-wider uppercase">LIVE TOWN HALL</span>
                <span className="text-xs text-neutral-500">•</span>
                <span className="text-xs text-neutral-400">{spaceCategory}</span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-neutral-100 mt-0.5">
                {spaceTitle}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Speech AI Transcription Bar */}
        <div className="mt-4 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-2.5 text-xs">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-neutral-300 italic font-mono leading-relaxed">
            {activeSpeechSnippet}
          </div>
        </div>

        {/* The Stage: Speakers */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              On Stage ({speakers.length})
            </span>
            <span className="text-[11px] text-indigo-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Res Committee Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {speakers.map(spk => (
              <div
                key={spk.id}
                className={`p-3.5 rounded-xl border flex flex-col items-center text-center transition ${
                  spk.isSpeaking
                    ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50'
                    : 'bg-neutral-800/40 border-neutral-800'
                }`}
              >
                <div className="relative mb-2">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-bold text-sm text-white shadow-inner">
                    {spk.avatar}
                  </div>
                  {spk.isSpeaking && (
                    <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-neutral-900 text-neutral-950">
                      <Volume2 className="w-3 h-3 animate-pulse" />
                    </span>
                  )}
                  {spk.isMuted && (
                    <span className="absolute -bottom-1 -right-1 p-1 bg-neutral-800 rounded-full border-2 border-neutral-900 text-neutral-400">
                      <MicOff className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div className="text-xs font-bold text-neutral-200">{spk.name}</div>
                <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{spk.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* The Audience: Listeners */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Audience ({listeners.length + 1})
            </span>
            <span className="text-[11px] text-neutral-400">Tap hand to request microphone</span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {listeners.map(lis => (
              <div
                key={lis.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-800/50 border border-neutral-800 text-xs"
              >
                <div className="w-6 h-6 rounded-full bg-neutral-700 text-neutral-300 font-bold text-[10px] flex items-center justify-center">
                  {lis.avatar}
                </div>
                <span className="text-neutral-300 text-xs">{lis.name}</span>
                {lis.hasHandRaised && (
                  <span className="text-amber-400" title="Hand Raised">
                    ✋
                  </span>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-950/30 border border-indigo-500/40 text-xs">
              <div className="w-6 h-6 rounded-full bg-indigo-500 text-neutral-950 font-bold text-[10px] flex items-center justify-center">
                YOU
              </div>
              <span className="text-indigo-300 font-semibold">You</span>
              {myHandRaised && <span>✋</span>}
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="mt-8 pt-4 border-t border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSelfMuted(!isSelfMuted)}
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition ${
                isSelfMuted
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                  : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              }`}
            >
              {isSelfMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isSelfMuted ? 'Muted' : 'Speaking'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMyHandRaised(!myHandRaised)}
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition ${
                myHandRaised
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
              }`}
            >
              <Hand className="w-4 h-4" />
              <span>{myHandRaised ? 'Hand Raised' : 'Raise Hand'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 font-semibold text-xs transition"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave Space</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AudioSpacesTownHallModal;
