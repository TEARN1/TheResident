'use client';

import React, { useState, useEffect } from 'react';
import { 
  BellRing, 
  X, 
  Volume2, 
  CheckCircle2, 
  Smartphone, 
  Play 
} from 'lucide-react';

interface PushCallNotificationManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PushCallNotificationManager({ isOpen, onClose }: PushCallNotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [highPriorityRingtone, setHighPriorityRingtone] = useState(true);
  const [isPlayingChime, setIsPlayingChime] = useState(false);
  const [testDispatched, setTestDispatched] = useState(false);

  useEffect(() => {
    const handleFocus = () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (!isOpen) return null;

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
      } catch (err) {
        console.error('Failed to request notification permission:', err);
      }
    }
  };

  const handleTestChime = () => {
    setIsPlayingChime(true);
    // Simulate luxury audio synthesizer chime using Web Audio API if available
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.7);
    } catch {
      // AudioContext unavailable or blocked
    }

    setTimeout(() => {
      setIsPlayingChime(false);
    }, 1000);
  };

  const handleDispatchPushSimulation = () => {
    setTestDispatched(true);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Incoming Call: Warden Sipho Ndlovu', {
        body: 'Resident VoIP Call • Tap to answer',
        icon: '/icons/icon-192x192.png',
        tag: 'resident-incoming-call'
      });
    }
    setTimeout(() => setTestDispatched(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-violet-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <BellRing className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  VoIP Call Push Notifications
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                  Background Ringing
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Ensure phone and desktop ring even when TheResident tab is backgrounded or closed.
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

        {/* Permission Status Box */}
        <div className="mt-6 p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-neutral-300">Push Notification Permission</div>
            <div className="text-xs">
              Status:{' '}
              <span
                className={`font-bold ${
                  permission === 'granted'
                    ? 'text-emerald-400'
                    : permission === 'denied'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {permission.toUpperCase()}
              </span>
            </div>
          </div>

          {permission !== 'granted' ? (
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="px-4 py-2 rounded-xl bg-violet-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:bg-violet-400 transition"
            >
              Enable Ringing
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Active</span>
            </div>
          )}
        </div>

        {/* Ringtone Tester */}
        <div className="mt-6 space-y-4">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
            Acoustics & Sensory Tuning
          </span>

          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-200">TheResident Signature Chime</div>
                <div className="text-[11px] text-neutral-400">Calm, non-jarring pentatonic luxury tone</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestChime}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 hover:text-white flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isPlayingChime ? 'Playing...' : 'Test Sound'}</span>
            </button>
          </div>

          {/* Toggle Options */}
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 border border-neutral-800 cursor-pointer">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-neutral-200">Haptic Pulse Vibration</div>
                <div className="text-[11px] text-neutral-400">Triple gentle pulses on mobile handsets</div>
              </div>
              <input
                type="checkbox"
                checked={vibrateEnabled}
                onChange={e => setVibrateEnabled(e.target.checked)}
                className="accent-violet-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 border border-neutral-800 cursor-pointer">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-neutral-200">High-Priority Bypass</div>
                <div className="text-[11px] text-neutral-400">Ring through even during browser battery saver</div>
              </div>
              <input
                type="checkbox"
                checked={highPriorityRingtone}
                onChange={e => setHighPriorityRingtone(e.target.checked)}
                className="accent-violet-500 w-4 h-4"
              />
            </label>
          </div>
        </div>

        {/* Test Call Push Notification */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDispatchPushSimulation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-violet-400" />
            <span>Simulate Incoming Push Call</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-violet-500 text-neutral-950 font-bold text-xs hover:bg-violet-400 transition"
          >
            Save Preferences
          </button>
        </div>

        {testDispatched && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 text-center">
            Test call payload dispatched! Check your desktop/phone system notification tray.
          </div>
        )}
      </div>
    </div>
  );
}

export default PushCallNotificationManager;

