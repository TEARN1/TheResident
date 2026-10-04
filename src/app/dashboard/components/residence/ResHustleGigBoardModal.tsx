'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, X, Plus, Clock, MapPin, CheckCircle2, DollarSign, Sparkles
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface MicroGig {
  id: string;
  title: string;
  posterRoom: string;
  bountyZAR: number;
  estMinutes: number;
  category: 'Errands' | 'Study' | 'Moving' | 'Social';
}

const GIG_LIST: MicroGig[] = [
  { id: 'g1', title: 'Print 40 pages notes at campus library', posterRoom: 'Room 304 (Floor 3)', bountyZAR: 30, estMinutes: 20, category: 'Study' },
  { id: 'g2', title: 'Iron 2 shirts & trousers for job interview', posterRoom: 'Room 112 (Floor 1)', bountyZAR: 50, estMinutes: 15, category: 'Errands' },
  { id: 'g3', title: 'Help lug 3 heavy storage boxes to courtyard', posterRoom: 'Room 408 (Floor 4)', bountyZAR: 40, estMinutes: 10, category: 'Moving' },
  { id: 'g4', title: 'Braai Master for floor Friday evening social', posterRoom: 'Floor 2 Common Room', bountyZAR: 150, estMinutes: 90, category: 'Social' }
];

interface ResHustleGigBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResHustleGigBoardModal({ isOpen, onClose }: ResHustleGigBoardModalProps) {
  const [gigs, setGigs] = useState<MicroGig[]>(GIG_LIST);

  if (!isOpen) return null;

  const handleClaimGig = (gig: MicroGig) => {
    playTactileSound('chime');
    alert(`Gig claimed: "${gig.title}"! Head to ${gig.posterRoom} to coordinate.`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <Briefcase size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">The Res Hustle • Micro-Gig Board</h3>
                <p className="text-xs text-gray-400">Earn extra cash doing quick campus errands for neighbors</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Gigs List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {gigs.map(g => (
              <div
                key={g.id}
                className="p-4 rounded-2xl bg-neutral-900 border border-white/10 hover:border-gold-primary/40 flex items-center justify-between gap-3 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{g.title}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 font-mono">
                      ~{g.estMinutes} mins
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                    <MapPin size={11} className="text-gold-primary" /> {g.posterRoom}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base font-black font-mono text-gold-primary">
                    {formatCurrency(g.bountyZAR, 'ZAR')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleClaimGig(g)}
                    className="px-3 py-1.5 rounded-xl bg-gold-primary text-black font-black uppercase text-xs hover:bg-gold-secondary transition"
                  >
                    Claim Gig
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center text-[11px] text-gray-400 font-mono">
            Zero platform fees on micro-gigs. Payouts clear directly to in-app wallet via PayShap.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ResHustleGigBoardModal;
