'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, ShieldCheck, CheckCircle2, X, Award, BarChart3, Building
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface RentCreditBureauModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName?: string;
  currentCreditScore?: number;
  onTimePaymentsCount?: number;
}

export function RentCreditBureauModal({
  isOpen,
  onClose,
  tenantName = 'Sipho Ndlovu',
  currentCreditScore = 718,
  onTimePaymentsCount = 11
}: RentCreditBureauModalProps) {
  const [syncedBureaus, setSyncedBureaus] = useState({
    transunion: true,
    experian: true,
    xds: true
  });

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
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-glow">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Rent-to-Credit Bureau Builder</h3>
                <p className="text-xs text-gray-400">TransUnion & Experian South Africa Integration</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Credit Score Gauge Card */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Estimated Credit Rating</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black font-mono text-emerald-400">{currentCreditScore}</span>
                <span className="text-xs text-gray-400 font-bold">/ 850 (Prime Tier)</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">+{onTimePaymentsCount * 8} points gained from verified rent clearing</p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-center text-xs font-bold">
              <Award className="w-6 h-6 mx-auto mb-1 text-gold-primary" />
              <span>100% On-Time</span>
            </div>
          </div>

          {/* Synced Bureaus Toggles */}
          <div className="space-y-2 text-xs">
            <span className="text-gray-400 uppercase text-[10px] font-bold block">Connected Credit Bureaus:</span>
            {[
              { name: 'TransUnion South Africa', desc: 'Syncs monthly rent receipts directly to credit score record' },
              { name: 'Experian SA Credit Bureau', desc: 'Pre-qualifies student for graduate vehicle finance & store cards' },
              { name: 'XDS Credit Profile', desc: 'Instant rental reference for future private property leases' }
            ].map(b => (
              <div key={b.name} className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{b.name}</p>
                  <p className="text-[10px] text-gray-400">{b.desc}</p>
                </div>
                <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active
                </span>
              </div>
            ))}
          </div>

          <div className="text-center text-[11px] text-gray-400">
            Every on-time PayShap payment automatically boosts your official credit record.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default RentCreditBureauModal;
