'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartHandshake, MessageSquare, X, Sparkles, CheckCircle2, ShieldCheck, Scale
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface DisputeScenario {
  id: string;
  topic: string;
  complaintExcerpt: string;
  peacekeeperAdvice: string;
  proposedResolution: string;
}

const SAMPLE_SCENARIOS: DisputeScenario[] = [
  {
    id: 'd1',
    topic: 'Sink Dishes & Pots Backlog',
    complaintExcerpt: '"Someone left oily pots in the sink again for 3 days and now we cannot even wash a coffee mug."',
    peacekeeperAdvice: 'Tension is high around kitchen hygiene. High probability of passive-aggressive escalations.',
    proposedResolution: '24-Hour Clean-as-You-Go Rule: unwashed pots after 24 hrs result in buying the floor a R20 Eskom electricity token.'
  },
  {
    id: 'd2',
    topic: 'Late-Night Corridor Call Noise',
    complaintExcerpt: '"Why are you pacing up and down the hallway shouting on speakerphone at 01:30 AM when people have test tomorrow?"',
    peacekeeperAdvice: 'Sleep deprivation during exam weeks triggers resentment.',
    proposedResolution: 'Sanctuary Hours (22:30 - 06:30): speakerphone pacing relocated to ground floor courtyard or common room.'
  }
];

interface PeacekeeperMediatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdName?: string;
}

export function PeacekeeperMediatorModal({
  isOpen,
  onClose,
  householdName = 'Unit 304 Flatshare Group'
}: PeacekeeperMediatorModalProps) {
  const [selectedDispute, setSelectedDispute] = useState<DisputeScenario>(SAMPLE_SCENARIOS[0]);
  const [resolutionAccepted, setResolutionAccepted] = useState(false);

  if (!isOpen) return null;

  const handleAdoptResolution = () => {
    playTactileSound('chime');
    setResolutionAccepted(true);
    alert('Resolution drafted! Peacekeeper treaty posted to household chat.');
  };

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
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-glow">
                <HeartHandshake size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">The Peacekeeper • AI Mediator</h3>
                <p className="text-xs text-gray-400">{householdName} • De-escalation Counsel</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Active Complaint Box */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-2 text-xs">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
              Flagged Household Friction: {selectedDispute.topic}
            </span>
            <p className="text-gray-300 italic bg-black/40 p-3 rounded-xl border border-white/5">
              {selectedDispute.complaintExcerpt}
            </p>
          </div>

          {/* Peacekeeper Solution */}
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Sparkles size={14} />
              <span>Recommended Fair Compromise:</span>
            </div>
            <p className="text-white leading-relaxed font-medium">
              {selectedDispute.proposedResolution}
            </p>
          </div>

          <button
            type="button"
            disabled={resolutionAccepted}
            onClick={handleAdoptResolution}
            className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition disabled:opacity-50"
          >
            {resolutionAccepted ? 'Treaty Adopted by Roommates' : 'Post Compromise Treaty to Group Chat'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PeacekeeperMediatorModal;
