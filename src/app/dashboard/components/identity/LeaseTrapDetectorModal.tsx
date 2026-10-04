'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, FileText, X, Sparkles, Scale, Download
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface TrapItem {
  id: string;
  clauseNumber: string;
  originalText: string;
  violation: string;
  legalActCitation: string;
  severity: 'Illegal' | 'Unfair' | 'Caution';
}

const DETECTED_TRAPS: TrapItem[] = [
  {
    id: 'trap-1',
    clauseNumber: 'Clause 14.2',
    originalText: '"The Landlord reserves the right to lock the tenant out immediately if rent is overdue by 7 days without court order."',
    violation: 'Unlawful Dispossession & Spoliation',
    legalActCitation: 'Section 16, Rental Housing Act 50 of 1999 (Lockouts require High/Magistrate Court Eviction Order)',
    severity: 'Illegal'
  },
  {
    id: 'trap-2',
    clauseNumber: 'Clause 8.1',
    originalText: '"The deposit shall be non-refundable and forfeited in full if the tenant vacates before 12 months."',
    violation: 'Unlawful Deposit Forfeiture & Interest Withholding',
    legalActCitation: 'Section 5(3)(g), Rental Housing Act (Deposit must be held in interest-bearing account and refunded minus actual repair receipts)',
    severity: 'Illegal'
  },
  {
    id: 'trap-3',
    clauseNumber: 'Clause 19.4',
    originalText: '"Tenant is liable for all electrical geyser element failures and structural plumbing maintenance."',
    violation: 'Unfair Maintenance Burden',
    legalActCitation: 'Fair wear-and-tear principles under Section 5(4)',
    severity: 'Unfair'
  }
];

interface LeaseTrapDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaseTrapDetectorModal({ isOpen, onClose }: LeaseTrapDetectorModalProps) {
  const [traps] = useState<TrapItem[]>(DETECTED_TRAPS);
  const [selectedTrap, setSelectedTrap] = useState<TrapItem>(DETECTED_TRAPS[0]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shadow-glow">
                <Scale size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">AI Lease Loophole & Trap Detector</h3>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold">
                    3 Flags Detected
                  </span>
                </div>
                <p className="text-xs text-gray-400">Audited against the SA Rental Housing Act 50 of 1999</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Traps List & Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* List */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Flagged Clauses:</span>
              {traps.map(trap => {
                const isSelected = trap.id === selectedTrap.id;
                return (
                  <div
                    key={trap.id}
                    onClick={() => { playTactileSound('tab'); setSelectedTrap(trap); }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500 text-white'
                        : 'bg-neutral-900 border-white/10 text-gray-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span>{trap.clauseNumber}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] uppercase font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {trap.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-1">{trap.violation}</p>
                  </div>
                );
              })}
            </div>

            {/* Selected Trap Legal Breakdown */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 text-xs">
              <div>
                <span className="text-gray-500 uppercase text-[9px] font-bold block">Original Lease Text</span>
                <p className="text-gray-200 italic bg-white/5 p-2 rounded-xl mt-1 border border-white/5">
                  {selectedTrap.originalText}
                </p>
              </div>

              <div>
                <span className="text-rose-400 uppercase text-[9px] font-bold block">Why It Is Illegal</span>
                <p className="text-white font-bold">{selectedTrap.violation}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">{selectedTrap.legalActCitation}</p>
              </div>

              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => { playTactileSound('chime'); alert(`Formal legal objection letter generated for ${selectedTrap.clauseNumber}.`); }}
                  className="w-full py-2 rounded-xl bg-gold-primary text-black font-black uppercase text-[11px] hover:bg-gold-secondary transition"
                >
                  Generate Legal Amendment Counter-Letter
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default LeaseTrapDetectorModal;
