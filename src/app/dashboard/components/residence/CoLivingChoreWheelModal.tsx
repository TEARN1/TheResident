'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, Sparkles, X, CheckCircle2, User, Trophy, Shield
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface ChoreDuty {
  title: string;
  assignee: string;
  room: string;
  color: string;
}

const CHORES: ChoreDuty[] = [
  { title: 'Kitchen & Sink Deep Clean', assignee: 'Sipho', room: 'Room 301', color: 'text-emerald-400 bg-emerald-950/20 border-emerald-500/40' },
  { title: 'Municipal Bin to Curb (Pikitup)', assignee: 'Lerato', room: 'Room 302', color: 'text-amber-400 bg-amber-950/20 border-amber-500/40' },
  { title: 'Prepaid Eskom Token Purchase', assignee: 'Naledi', room: 'Room 303', color: 'text-cyan-400 bg-cyan-950/20 border-cyan-500/40' },
  { title: 'Bathroom Floor & Drain Descale', assignee: 'Kagiso', room: 'Room 304', color: 'text-purple-400 bg-purple-950/20 border-purple-500/40' }
];

interface CoLivingChoreWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdName?: string;
}

export function CoLivingChoreWheelModal({
  isOpen,
  onClose,
  householdName = 'Unit 300 Flatshare Cohort'
}: CoLivingChoreWheelModalProps) {
  const [rotationDegree, setRotationDegree] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerChore, setWinnerChore] = useState<ChoreDuty | null>(CHORES[0]);

  if (!isOpen) return null;

  const handleSpinWheel = () => {
    if (isSpinning) return;
    playTactileSound('pop');
    setIsSpinning(true);
    const randomSpins = 360 * 5 + Math.floor(Math.random() * 360);
    setRotationDegree(prev => prev + randomSpins);

    setTimeout(() => {
      setIsSpinning(false);
      playTactileSound('chime');
      const randomWinner = CHORES[Math.floor(Math.random() * CHORES.length)];
      setWinnerChore(randomWinner);
    }, 2500);
  };

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
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Co-Living Chore Wheel</h3>
                <p className="text-xs text-gray-400">{householdName} • Fair Rotation Hub</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Interactive Wheel Spinner Disc */}
          <div className="relative w-52 h-52 mx-auto flex items-center justify-center">
            {/* Top Pointer Indicator */}
            <div className="absolute -top-2 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-gold-primary" />

            <motion.div
              animate={{ rotate: rotationDegree }}
              transition={{ duration: 2.5, ease: [0.15, 0.9, 0.3, 1] }}
              className="w-full h-full rounded-full border-4 border-gold-primary/50 bg-gradient-to-tr from-neutral-900 via-neutral-950 to-black p-3 relative flex items-center justify-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-gold-primary text-black font-black text-xs flex items-center justify-center shadow-glow">
                SPIN
              </div>
            </motion.div>
          </div>

          {/* Spin Button */}
          <button
            type="button"
            disabled={isSpinning}
            onClick={handleSpinWheel}
            className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition disabled:opacity-50"
          >
            {isSpinning ? 'Randomizing Fairness...' : 'Spin for This Week’s Duties'}
          </button>

          {/* Current Assignments List */}
          <div className="space-y-2 text-left">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
              Current Weekly Assignments:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHORES.map(c => (
                <div key={c.title} className={`p-3 rounded-2xl border ${c.color} text-xs`}>
                  <p className="font-bold">{c.title}</p>
                  <p className="text-[10px] opacity-80 mt-0.5 font-mono">{c.assignee} ({c.room})</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CoLivingChoreWheelModal;
