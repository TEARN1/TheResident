'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, CheckCircle2, Circle, ArrowRight, X, Sparkles, Key, Camera, Zap, Users
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface QuestStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  rewardPoints: number;
  icon: React.ReactNode;
}

const QUEST_STEPS: QuestStep[] = [
  { id: 1, title: 'Complete Day-1 Room Snag Photos', description: 'Protect your deposit before unpacking boxes', completed: true, rewardPoints: 200, icon: <Camera size={14} /> },
  { id: 2, title: 'Claim Digital NFC Room Keycard', description: 'Test tap-to-unlock and save security PIN', completed: true, rewardPoints: 150, icon: <Key size={14} /> },
  { id: 3, title: 'Purchase First Prepaid Electricity Token', description: 'Split utility voucher with your roommates', completed: false, rewardPoints: 100, icon: <Zap size={14} /> },
  { id: 4, title: 'Say Hi in Building Town Hall Space', description: 'Introduce yourself to floor neighbors', completed: false, rewardPoints: 100, icon: <Users size={14} /> }
];

interface MoveInSurvivalQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentName?: string;
}

export function MoveInSurvivalQuestModal({
  isOpen,
  onClose,
  residentName = 'Sipho'
}: MoveInSurvivalQuestModalProps) {
  const [steps, setSteps] = useState<QuestStep[]>(QUEST_STEPS);

  if (!isOpen) return null;

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

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
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-glow">
                <Trophy size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Move-In Survival Quest</h3>
                <p className="text-xs text-gray-400">Welcome, {residentName}! Level up your civic reputation</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress Bar Header */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white uppercase tracking-wider">Quest Progression</span>
              <span className="font-mono font-bold text-gold-primary">{progressPercent}% Completed</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-primary to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">Complete all 4 steps to claim R100 Bakkie moving discount voucher.</p>
          </div>

          {/* Steps Road Map */}
          <div className="space-y-3">
            {steps.map(step => (
              <div
                key={step.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  step.completed
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-neutral-900 border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${step.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                    {step.icon}
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${step.completed ? 'text-white' : 'text-gray-300'}`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-gray-400">{step.description}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {step.completed ? (
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 font-mono">
                      <CheckCircle2 size={14} /> Done
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-1 rounded-xl bg-gold-primary/20 text-gold-primary border border-gold-primary/30 font-bold">
                      +{step.rewardPoints} pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default MoveInSurvivalQuestModal;
