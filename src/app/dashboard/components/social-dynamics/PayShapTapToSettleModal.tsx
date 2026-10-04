'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, CheckCircle2, QrCode, X, DollarSign, ShieldCheck, Zap
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface RoommateCard {
  id: string;
  name: string;
  room: string;
  oweAmountZAR: number;
  settled: boolean;
}

const ROOMMATES: RoommateCard[] = [
  { id: 'rm1', name: 'You (Sipho)', room: 'Room 304', oweAmountZAR: 240, settled: false },
  { id: 'rm2', name: 'Lerato K.', room: 'Room 302', oweAmountZAR: 240, settled: true },
  { id: 'rm3', name: 'Naledi M.', room: 'Room 303', oweAmountZAR: 240, settled: false }
];

interface PayShapTapToSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseTitle?: string;
  totalExpenseZAR?: number;
}

export function PayShapTapToSettleModal({
  isOpen,
  onClose,
  expenseTitle = 'Eskom 500kWh Electricity Token + Uncapped Wi-Fi',
  totalExpenseZAR = 720
}: PayShapTapToSettleModalProps) {
  const [roommates, setRoommates] = useState<RoommateCard[]>(ROOMMATES);

  if (!isOpen) return null;

  const handleSettleMyShare = () => {
    playTactileSound('chime');
    setRoommates(prev =>
      prev.map(r => (r.id === 'rm1' ? { ...r, settled: true } : r))
    );
    alert('PayShap instant bank clearing verified! R240 settled.');
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
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">PayShap Tap-to-Settle Table</h3>
                <p className="text-xs text-gray-400">{expenseTitle}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex justify-between items-center text-xs">
            <span className="text-gray-400 uppercase font-black">Total Bill Amount:</span>
            <span className="text-gold-primary font-mono font-black text-base">{formatCurrency(totalExpenseZAR, 'ZAR')}</span>
          </div>

          {/* Virtual Table with Roommate Settlement Cards */}
          <div className="space-y-3 text-left">
            {roommates.map(r => (
              <div
                key={r.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  r.settled
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-black/60 border-white/10'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-white">{r.name} ({r.room})</h4>
                  <p className="text-[10px] text-gray-400 font-mono">Share: {formatCurrency(r.oweAmountZAR, 'ZAR')}</p>
                </div>

                {r.settled ? (
                  <span className="text-emerald-400 text-xs font-bold font-mono flex items-center gap-1">
                    <CheckCircle2 size={14} /> Settled
                  </span>
                ) : r.id === 'rm1' ? (
                  <button
                    type="button"
                    onClick={handleSettleMyShare}
                    className="px-4 py-2 rounded-xl bg-gold-primary text-black font-black uppercase text-xs hover:bg-gold-secondary transition shadow-sm"
                  >
                    Tap to Settle (R240)
                  </button>
                ) : (
                  <span className="text-amber-400 text-[11px] font-mono font-bold">
                    Awaiting Clearing
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[10px] text-gray-400 font-mono">
            Direct account-to-account settlement via South African PayShap rails. Zero delayed batch clearing.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PayShapTapToSettleModal;
