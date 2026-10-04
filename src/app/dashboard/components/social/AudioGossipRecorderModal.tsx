'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  Send,
  Radio,
  CheckCircle2
} from 'lucide-react';

interface VoiceFilter {
  id: string;
  name: string;
  pitchShift: string;
  desc: string;
}

const VOICE_FILTERS: VoiceFilter[] = [
  { id: 'deep', name: 'Baritone Shadow', pitchShift: '-5 Semitones', desc: 'Deep disguise, completely untraceable timbre' },
  { id: 'cypher', name: 'Cyber Cypher', pitchShift: 'Robotic Vocoder', desc: 'Futuristic synthetic vocal resonance' },
  { id: 'helium', name: 'Helium Sprite', pitchShift: '+6 Semitones', desc: 'High octave modulation with playful tone' },
  { id: 'warden', name: 'Res Warden Radio', pitchShift: 'Walkie-Talkie Filter', desc: 'Lo-fi radio static effect with bandpass' }
];

const RANDOM_HANDLES = [
  'Braam Ghost #84',
  'Floor 4 Whisperer',
  'Hatfield Night Owl',
  'Observatory Insider',
  'Stellenbosch Phantom',
  'Doornfontein Scout'
];

interface AudioGossipRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublishMemo?: (memo: { title: string; handle: string; duration: number; filter: string; tag: string }) => void;
}

export function AudioGossipRecorderModal({
  isOpen,
  onClose,
  onPublishMemo
}: AudioGossipRecorderModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('deep');
  const [handle, setHandle] = useState(RANDOM_HANDLES[0]);
  const [title, setTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState('Landlord Drama');
  const [hasRecorded, setHasRecorded] = useState(false);
  const [published, setPublished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s >= 59) {
            setIsRecording(false);
            setHasRecorded(true);
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (!isRecording) {
      setSeconds(0);
      setIsRecording(true);
      setHasRecorded(false);
      setIsPlaying(false);
    } else {
      setIsRecording(false);
      setHasRecorded(true);
    }
  };

  const handleReset = () => {
    setIsRecording(false);
    setIsPlaying(false);
    setSeconds(0);
    setHasRecorded(false);
  };

  const handleRandomizeHandle = () => {
    const next = RANDOM_HANDLES[Math.floor(Math.random() * RANDOM_HANDLES.length)];
    setHandle(next);
  };

  const handlePublish = () => {
    if (onPublishMemo) {
      onPublishMemo({
        title: title || 'Anonymous Audio Confession',
        handle,
        duration: seconds,
        filter: selectedFilter,
        tag: selectedTag
      });
    }
    setPublished(true);
  };

  const tags = ['Landlord Drama', 'Roomie Secrets', 'Campus Tea', 'Party Scoop', 'Exam Leaks'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-fuchsia-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Voice Scrambler Memo
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">
                  Pitch-Shifted
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Hardware-scrambled vocal disguise prevents voice identification. 100% anonymous.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!published ? (
          <div className="mt-6 space-y-6">
            {/* Visualizer & Record Button */}
            <div className="p-6 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex flex-col items-center justify-center space-y-4">
              <div className="text-3xl font-mono font-bold tracking-widest text-neutral-200">
                00:{seconds < 10 ? `0${seconds}` : seconds} <span className="text-xs text-neutral-500 font-sans">/ 01:00</span>
              </div>

              {/* Animated Waveform Bars */}
              <div className="flex items-center gap-1.5 h-16 w-full justify-center px-4">
                {[40, 75, 20, 90, 60, 30, 85, 45, 100, 35, 70, 50, 80, 25, 65, 95, 30, 85, 40, 70].map((height, i) => {
                  const waveFactor = isRecording ? (((((i * 7 + seconds * 3) % 10) + 3) / 12)) : 0.7;
                  return (
                    <div
                      key={i}
                      style={{
                        height: isRecording || isPlaying ? `${Math.max(15, height * waveFactor)}%` : '15%',
                        transition: 'height 150ms ease-in-out'
                      }}
                      className={`w-1.5 rounded-full ${
                        isRecording
                          ? 'bg-gradient-to-t from-fuchsia-600 to-rose-400'
                          : isPlaying
                          ? 'bg-gradient-to-t from-emerald-500 to-teal-300'
                          : 'bg-neutral-800'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Record / Stop / Play Controls */}
              <div className="flex items-center gap-4 pt-2">
                {!hasRecorded ? (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                      isRecording
                        ? 'bg-rose-500 text-white animate-ping-slow'
                        : 'bg-gradient-to-tr from-fuchsia-500 to-rose-500 text-neutral-950 hover:brightness-110'
                    }`}
                  >
                    {isRecording ? <Square className="w-5 h-5 fill-white" /> : <Mic className="w-6 h-6" />}
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-3 rounded-full bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-neutral-950" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="p-3 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-neutral-400">
                {isRecording ? 'Listening & pitch-shifting audio stream...' : hasRecorded ? 'Preview scrambled voice memo' : 'Tap to record up to 60 seconds'}
              </span>
            </div>

            {/* Disguise Filter Selection */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2.5">
                Vocal Disguise DSP Preset
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {VOICE_FILTERS.map(f => {
                  const isSelected = selectedFilter === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFilter(f.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-fuchsia-950/30 border-fuchsia-500 ring-1 ring-fuchsia-500/40'
                          : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-200">{f.name}</span>
                        <span className="text-[10px] text-fuchsia-400 font-mono">{f.pitchShift}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gossip Memo Details */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400">Audio Memo Subject / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Braamfontein South Point elevator sabotage truth..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 mt-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-neutral-800/30 border border-neutral-800">
                <div className="text-xs">
                  <span className="text-neutral-400">Anonymous Alias:</span>{' '}
                  <span className="font-bold text-fuchsia-400">{handle}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRandomizeHandle}
                  className="px-3 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 hover:text-white"
                >
                  Regenerate Alias
                </button>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      selectedTag === tag
                        ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/50'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!hasRecorded}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send className="w-3.5 h-3.5" />
                Publish Anonymous Memo
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center text-fuchsia-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-100">Anonymous Voice Memo Live!</h3>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              Your memo has been scrambled and broadcast to the Gossip Feed under the alias{' '}
              <span className="text-fuchsia-400 font-semibold">{handle}</span>. Your raw audio was wiped immediately after encoding.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AudioGossipRecorderModal;
