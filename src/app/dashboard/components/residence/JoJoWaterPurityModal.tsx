'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, ShieldCheck, AlertTriangle, X, CheckCircle2, Info, Activity
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface JoJoWaterPurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  residenceTankId?: string;
}

export function JoJoWaterPurityModal({
  isOpen,
  onClose,
  residenceTankId = 'Courtyard JoJo Tank B (5000L Rain & Backup Mains)'
}: JoJoWaterPurityModalProps) {
  const [purityTier] = useState<'Safe to Drink' | 'Boil Before Drinking' | 'Greywater Only'>('Safe to Drink');
  const [phLevel] = useState(7.2);
  const [tdsPpm] = useState(140); // Total Dissolved Solids
  const [lastTested] = useState('Today at 08:00 AM');

  if (!isOpen) return null;

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
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-glow">
                <Droplets size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">JoJo Tank Water Purity Sensor</h3>
                <p className="text-xs text-gray-400">{residenceTankId}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Core Purity Status Banner */}
          <div className="p-5 rounded-3xl bg-emerald-950/20 border border-emerald-500/40 text-center space-y-2">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Official Potability Rating</span>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck size={28} className="text-emerald-400" />
              <span className="text-2xl font-black text-white">{purityTier}</span>
            </div>
            <p className="text-xs text-emerald-300">
              UV sterilization & sediment carbon filters verified active. Safe for drinking, cooking, and brushing teeth.
            </p>
          </div>

          {/* Sensor Readings */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
            <div className="p-3 bg-neutral-900 rounded-2xl border border-white/10">
              <span className="text-gray-400 text-[10px] block">pH Acidity</span>
              <span className="text-white font-bold">{phLevel} (Neutral)</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-2xl border border-white/10">
              <span className="text-gray-400 text-[10px] block">TDS Purity</span>
              <span className="text-cyan-400 font-bold">{tdsPpm} PPM</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-2xl border border-white/10">
              <span className="text-gray-400 text-[10px] block">Chlorine Level</span>
              <span className="text-emerald-400 font-bold">0.4 mg/L (Safe)</span>
            </div>
          </div>

          <div className="p-3 bg-black/60 rounded-2xl border border-white/10 text-center text-[11px] text-gray-400 font-mono">
            Last optical water telemetry sample: {lastTested}.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default JoJoWaterPurityModal;
