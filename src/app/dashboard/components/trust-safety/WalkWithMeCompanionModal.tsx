'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  MapPin, 
  PhoneCall, 
  AlertTriangle, 
  CheckCircle2, 
  Compass, 
  UserCheck, 
  Radio 
} from 'lucide-react';

interface WalkWithMeCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationDefault?: string;
  estMinutesDefault?: number;
}

export function WalkWithMeCompanionModal({
  isOpen,
  onClose,
  destinationDefault = 'Wits Library to South Point Central (12 mins)',
  estMinutesDefault = 12
}: WalkWithMeCompanionModalProps) {
  const [isActiveWalk, setIsActiveWalk] = useState(false);
  const [destination, setDestination] = useState(destinationDefault);
  const [remainingSeconds, setRemainingSeconds] = useState(estMinutesDefault * 60);
  const [checkInCountdown, setCheckInCountdown] = useState(240); // 4 min check-in
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [fakeCallActive, setFakeCallActive] = useState(false);
  const [arrivedSafe, setArrivedSafe] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActiveWalk && !arrivedSafe) {
      interval = setInterval(() => {
        setRemainingSeconds(s => (s > 0 ? s - 1 : 0));
        setCheckInCountdown(c => {
          if (c <= 1) {
            setShowCheckInPrompt(true);
            return 60; // 60s emergency window
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActiveWalk, arrivedSafe]);

  if (!isOpen) return null;

  const handleStartWalk = () => {
    setIsActiveWalk(true);
    setArrivedSafe(false);
    setShowCheckInPrompt(false);
  };

  const handleConfirmSafe = () => {
    setShowCheckInPrompt(false);
    setCheckInCountdown(240); // reset 4 min timer
  };

  const handleSafeArrival = () => {
    setArrivedSafe(true);
    setIsActiveWalk(false);
  };

  const minutesRemaining = Math.floor(remainingSeconds / 60);
  const secondsRemaining = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Walk With Me: Night Escort
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Digital Guardian
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Automated dead-man check-ins, live roomie ping, and fake call deflection for solo night journeys.
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

        {/* Check-In Emergency Modal / Banner */}
        {showCheckInPrompt && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/80 border-2 border-rose-500 text-rose-100 animate-pulse space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Safety Check-In: Are You Safe?</span>
            </div>
            <p className="text-xs text-rose-200">
              Tap below within <span className="font-bold underline">{checkInCountdown}s</span>, or your live coordinates will automatically dispatch to your roomies & campus security.
            </p>
            <button
              type="button"
              onClick={handleConfirmSafe}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition"
            >
              I Am Safe • Continue Walk
            </button>
          </div>
        )}

        {!isActiveWalk && !arrivedSafe ? (
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Planned Walking Route / Destination
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Roomie & Security Broadcast list */}
            <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-2">
              <span className="text-xs font-medium text-neutral-300">Live Escort Relays Assigned:</span>
              <div className="flex flex-col gap-1.5 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Room 408 Roommate (Naledi M.)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>South Point Central Control Room Desk</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartWalk}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 transition"
              >
                Start Accompanied Walk
              </button>
            </div>
          </div>
        ) : isActiveWalk && !arrivedSafe ? (
          <div className="mt-6 space-y-6">
            {/* Active timer */}
            <div className="p-6 rounded-2xl bg-neutral-950/70 border border-emerald-500/40 text-center space-y-2">
              <span className="text-xs text-emerald-400 font-semibold uppercase tracking-widest flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Guardian Escort Active
              </span>
              <div className="text-4xl font-mono font-bold text-neutral-100">
                {minutesRemaining < 10 ? `0${minutesRemaining}` : minutesRemaining}:
                {secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}
              </div>
              <p className="text-xs text-neutral-400">{destination}</p>
            </div>

            {/* Fake Call Deflection Tool */}
            <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-neutral-200">Fake Deflection Call</div>
                <div className="text-[11px] text-neutral-400">Triggers realistic phone call UI with conversational audio</div>
              </div>

              <button
                type="button"
                onClick={() => setFakeCallActive(!fakeCallActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  fakeCallActive
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>{fakeCallActive ? 'Hang Up Fake Call' : 'Simulate Call'}</span>
              </button>
            </div>

            {fakeCallActive && (
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Simulated call active: &quot;Hey, I&apos;m right outside with the door open for you...&quot;</span>
              </div>
            )}

            {/* Arrived Safe Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Minimize Window
              </button>
              <button
                type="button"
                onClick={handleSafeArrival}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition"
              >
                I Have Safely Arrived!
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-100">Safely Arrived!</h3>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              Your roommates and building security have been notified that you are safely inside your residence. Escrow session closed.
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

export default WalkWithMeCompanionModal;

