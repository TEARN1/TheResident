'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertOctagon, 
  X, 
  ShieldAlert, 
  MapPin, 
  Radio, 
  PhoneCall, 
  VolumeX, 
  Car 
} from 'lucide-react';

interface CPFPanicButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CPFPanicButtonModal({ isOpen, onClose }: CPFPanicButtonModalProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDispatched, setIsDispatched] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const [audioRecordingSec, setAudioRecordingSec] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(c => {
          if (c === 1) {
            setIsDispatched(true);
            return null;
          }
          return c !== null ? c - 1 : null;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown]);

  useEffect(() => {
    let audioTimer: NodeJS.Timeout | null = null;
    if (isDispatched && audioRecordingSec < 15) {
      audioTimer = setInterval(() => {
        setAudioRecordingSec(s => s + 1);
      }, 1000);
    }
    return () => {
      if (audioTimer) clearInterval(audioTimer);
    };
  }, [isDispatched, audioRecordingSec]);

  if (!isOpen) return null;

  const handleTriggerPanic = () => {
    setCountdown(3);
  };

  const handleCancelCountdown = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCountdown(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div
        className={`relative w-full max-w-lg rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8 transition-colors ${
          silentMode ? 'bg-neutral-950 border border-neutral-800' : 'bg-neutral-900 border border-rose-500/50'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  CPF & Armed Response Panic
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Direct Dispatch
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Local Sector Community Policing Forum & rapid armed response link.
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

        {/* Main Body */}
        {!isDispatched ? (
          <div className="mt-6 flex flex-col items-center space-y-6 text-center">
            {countdown === null ? (
              <>
                <p className="text-xs text-neutral-300 max-w-sm">
                  Pressing this button broadcasts your exact GPS coordinates and activates emergency dispatch to nearest sector vehicles.
                </p>

                {/* Big Tactical Panic Button */}
                <button
                  type="button"
                  onClick={handleTriggerPanic}
                  className="w-36 h-36 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 text-white font-extrabold text-xl tracking-wider uppercase border-4 border-rose-400/40 hover:scale-105 active:scale-95 transition flex flex-col items-center justify-center gap-1 shadow-2xl"
                >
                  <AlertOctagon className="w-10 h-10" />
                  <span>PANIC</span>
                </button>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSilentMode(!silentMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition ${
                      silentMode
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    <span>{silentMode ? 'Silent Screen Mode: ON' : 'Enable Silent Mode'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4 py-4">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest animate-pulse">
                  Dispatching Emergency Signal in:
                </span>
                <div className="text-6xl font-mono font-extrabold text-rose-500 animate-ping-slow">
                  0{countdown}
                </div>
                <p className="text-xs text-neutral-400">Accidental tap? Cancel before timer ends.</p>
                <button
                  type="button"
                  onClick={handleCancelCountdown}
                  className="px-6 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
                >
                  Abort Dispatch
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Dispatched Live Status */}
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  DISPATCH CONFIRMED: SECTOR 3 CPF
                </span>
                <span className="text-[11px] font-mono text-neutral-400">Incident #CPF-9182</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-neutral-300">
                  <Car className="w-4 h-4 text-rose-400" />
                  <span>Patrol Unit #12 (Braamfontein Central)</span>
                  <span className="ml-auto font-bold text-emerald-400">0.8 km • ~2 mins ETA</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Broadcasted Coordinates: -26.1929° S, 28.0305° E</span>
                </div>
              </div>
            </div>

            {/* Audio Recording Snippet */}
            <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-neutral-300">
                <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>Ambient Audio Stream to Dispatcher:</span>
              </div>
              <span className="font-mono text-rose-400 font-bold">{audioRecordingSec}s / 15s</span>
            </div>

            {/* Direct Station Phone Link */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <a
                href="tel:10111"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 hover:text-white"
              >
                <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
                <span>Dial SAPS 10111 Directly</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setIsDispatched(false);
                  setCountdown(null);
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Stand Down / False Alarm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CPFPanicButtonModal;

