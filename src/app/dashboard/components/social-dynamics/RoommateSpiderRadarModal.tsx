'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, X, Sparkles, CheckCircle2, Moon, Volume2, Shield, Users, Utensils
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface RadarAxis {
  label: string;
  myScore: number; // 0-100
  theirScore: number;
  icon: React.ReactNode;
}

const AXES_DATA: RadarAxis[] = [
  { label: 'Sleep Chronotype (Early vs Night)', myScore: 85, theirScore: 80, icon: <Moon size={12} /> },
  { label: 'Cleanliness & Chores', myScore: 90, theirScore: 85, icon: <Sparkles size={12} /> },
  { label: 'Noise & Quiet Study', myScore: 75, theirScore: 70, icon: <Volume2 size={12} /> },
  { label: 'Social & Guests', myScore: 60, theirScore: 65, icon: <Users size={12} /> },
  { label: 'Kitchen & Dietary Habits', myScore: 95, theirScore: 90, icon: <Utensils size={12} /> }
];

interface RoommateSpiderRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName?: string;
  candidateAvatar?: string;
}

export function RoommateSpiderRadarModal({
  isOpen,
  onClose,
  candidateName = 'Kagiso M.',
  candidateAvatar = 'K'
}: RoommateSpiderRadarModalProps) {
  const [axes] = useState<RadarAxis[]>(AXES_DATA);

  if (!isOpen) return null;

  const totalScore = Math.round(
    axes.reduce((acc, curr) => acc + (100 - Math.abs(curr.myScore - curr.theirScore)), 0) / axes.length
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-glow">
                <Compass size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Roommate Compatibility Spider Web</h3>
                <p className="text-xs text-gray-400">Comparing your lifestyle profile with {candidateName}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Top Synergy Score */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase font-mono text-gray-400">Harmonic Match Index</span>
              <p className="text-2xl font-black font-mono text-emerald-400">{totalScore}% Compatible</p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
              High Household Harmony
            </span>
          </div>

          {/* 5-Axis Spider Radar Breakdown */}
          <div className="space-y-3">
            {axes.map(axis => {
              const diff = Math.abs(axis.myScore - axis.theirScore);
              const harmonyPercent = 100 - diff;
              return (
                <div key={axis.label} className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {axis.icon} {axis.label}
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{harmonyPercent}% Align</span>
                  </div>

                  {/* Dual comparison bar */}
                  <div className="flex gap-2 items-center">
                    <span className="text-[9px] text-gray-500 w-8">You:</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gold-primary rounded-full" style={{ width: `${axis.myScore}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-[9px] text-gray-500 w-8">{candidateAvatar}:</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${axis.theirScore}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { playTactileSound('chime'); alert(`Roommate match request sent to ${candidateName}!`); onClose(); }}
            className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition"
          >
            Connect with {candidateName}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default RoommateSpiderRadarModal;
