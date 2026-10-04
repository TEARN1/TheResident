'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Mic, X, CheckCircle2, AlertTriangle, Send, Bell
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface NoiseSentinelDecibelModalProps {
  isOpen: boolean;
  onClose: () => void;
  floorZone?: string;
}

export function NoiseSentinelDecibelModal({
  isOpen,
  onClose,
  floorZone = 'Floor 3 Study Corridor'
}: NoiseSentinelDecibelModalProps) {
  const [currentDecibels] = useState(42);
  const [reminderSent, setReminderSent] = useState(false);

  if (!isOpen) return null;

  const handleSendGentleReminder = () => {
    playTactileSound('chime');
    setReminderSent(true);
    alert('Anonymous gentle quiet reminder broadcast to Floor 3 chat group.');
  };

  const isSilent = currentDecibels < 45;
  const isModerate = currentDecibels >= 45 && currentDecibels < 70;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden text-center"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-glow">
                <Volume2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Corridor Decibel Sentinel</h3>
                <p className="text-xs text-gray-400">{floorZone} • Exam Quiet Hours</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sound Meter Visual Gauge */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-white/10 space-y-3">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Live Ambient Acoustic Level</span>
            <div className="flex items-baseline justify-center gap-2">
              <span className={`text-5xl font-black font-mono ${isSilent ? 'text-emerald-400' : isModerate ? 'text-amber-400' : 'text-rose-400'}`}>
                {currentDecibels}
              </span>
              <span className="text-gray-400 text-sm font-bold">dB (A)</span>
            </div>

            {/* Visual Equalizer Bars */}
            <div className="flex items-center justify-center gap-1 h-12 w-48 mx-auto">
              {[20, 45, 60, 35, 80, 50, 30, 65, 40, 55, 25].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${(h * (currentDecibels / 80))}%` }}
                  className={`w-2 rounded-full transition-all duration-300 ${
                    isSilent ? 'bg-emerald-400' : isModerate ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                />
              ))}
            </div>

            <p className="text-xs text-gray-300 font-medium">
              {isSilent ? '🟢 Quiet Sanctuary — Ideal for exam revision' : '🟡 Moderate murmur detected in corridor'}
            </p>
          </div>

          {/* Anonymous Friendly Reminder Action */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSendGentleReminder}
              disabled={reminderSent}
              className="w-full py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-neutral-950 font-black uppercase text-xs tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Bell size={16} />
              <span>{reminderSent ? 'Friendly Reminder Sent to Floor Chat' : 'Send Anonymous Friendly Quiet Beacon'}</span>
            </button>
            <p className="text-[10px] text-gray-500 font-mono">
              Zero conflict, zero names attached. A gentle nudge sent to everyone on Floor 3.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default NoiseSentinelDecibelModal;
