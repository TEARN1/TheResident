'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, X, Lock, CheckCircle2, Sparkles, Coffee, Shield
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface FloorSecretCrushModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingName?: string;
}

export function FloorSecretCrushModal({
  isOpen,
  onClose,
  buildingName = 'Junction Residence • Floors 1 - 6'
}: FloorSecretCrushModalProps) {
  const [selectedRoom, setSelectedRoom] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  if (!isOpen) return null;

  const handleLockSecret = () => {
    if (!selectedRoom.trim()) return;
    playTactileSound('chime');
    setIsLocked(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden text-center"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-glow">
                <Heart size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">The Floor Secret</h3>
                <p className="text-[10px] text-gray-400">{buildingName}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-1.5 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Safe Double-Opt-In Blind Match</h4>
            <p className="text-xs text-gray-400">
              Pick a room number or resident. Nobody ever knows unless they pick you back too.
            </p>
          </div>

          {/* Room Number Input or Locked State */}
          {!isLocked ? (
            <div className="space-y-3">
              <input
                type="text"
                value={selectedRoom}
                onChange={e => setSelectedRoom(e.target.value)}
                placeholder="Enter room number (e.g. Unit 302)..."
                className="w-full p-3.5 rounded-2xl bg-neutral-900 border border-white/10 text-center font-mono text-sm text-white focus:outline-none focus:border-rose-500"
              />

              <button
                type="button"
                onClick={handleLockSecret}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-xs tracking-wider transition flex items-center justify-center gap-2"
              >
                <Lock size={14} />
                <span>Lock Secret Encrypted Token</span>
              </button>
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-rose-950/20 border border-rose-500/40 space-y-2 text-xs">
              <CheckCircle2 size={36} className="text-rose-400 mx-auto" />
              <p className="font-bold text-white">Secret Encrypted for {selectedRoom}!</p>
              <p className="text-gray-300 text-[11px]">
                If {selectedRoom} ever locks your room number too, both phones will chime and suggest a campus coffee catch-up!
              </p>
            </div>
          )}

          <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[10px] text-gray-500 font-mono">
            Zero public lists • Zero rejection • Cryptographic double-blind hash
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default FloorSecretCrushModal;
