'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Fuel, X, CheckCircle2, DollarSign, Clock, Users, ShieldCheck
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface GeneratorDieselPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingName?: string;
}

export function GeneratorDieselPoolModal({
  isOpen,
  onClose,
  buildingName = 'Junction Lofts • 500kVA Cummins Generator'
}: GeneratorDieselPoolModalProps) {
  const [dieselLitersRemaining] = useState(185);
  const [totalTankCapacity] = useState(350);
  const [hourlyRunCostZAR] = useState(420);
  const [myRoomContributionZAR, setMyRoomContributionZAR] = useState(60);
  const [hasContributed, setHasContributed] = useState(false);

  if (!isOpen) return null;

  const fuelPercent = Math.round((dieselLitersRemaining / totalTankCapacity) * 100);

  const handlePayDieselShare = () => {
    playTactileSound('chime');
    setHasContributed(true);
    alert(`R60 diesel contribution sent via PayShap. Your room power pass is locked for this evening's loadshedding slot.`);
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
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-glow">
                <Fuel size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Communal Generator Diesel Pool</h3>
                <p className="text-xs text-gray-400">{buildingName}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tank Level Gauge */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-300 uppercase">Diesel Fuel In Tank</span>
              <span className="font-mono font-bold text-amber-400">{dieselLitersRemaining}L / {totalTankCapacity}L ({fuelPercent}%)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                style={{ width: `${fuelPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Estimated runtime: ~7.5 hours continuous power during Stage 4/6 outages.
            </p>
          </div>

          {/* Transparent Pool Contribution List */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-black/60 rounded-2xl border border-white/10">
              <span className="text-[9px] text-gray-500 uppercase font-bold block">Run Cost Per Hour</span>
              <span className="text-white font-bold font-mono text-sm">{formatCurrency(hourlyRunCostZAR, 'ZAR')} / hr</span>
            </div>
            <div className="p-3 bg-black/60 rounded-2xl border border-white/10">
              <span className="text-[9px] text-gray-500 uppercase font-bold block">Share Per Apartment (24 Units)</span>
              <span className="text-gold-primary font-bold font-mono text-sm">{formatCurrency(myRoomContributionZAR, 'ZAR')} / slot</span>
            </div>
          </div>

          {/* Pay Share Action */}
          <button
            type="button"
            disabled={hasContributed}
            onClick={handlePayDieselShare}
            className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            <span>{hasContributed ? 'Contributed • Power Pass Active' : `Pay Diesel Share (${formatCurrency(myRoomContributionZAR, 'ZAR')})`}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default GeneratorDieselPoolModal;
