'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Truck, X, CheckCircle2, Clock, MapPin, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface GasCylinderRefillModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentAddress?: string;
}

export function GasCylinderRefillModal({
  isOpen,
  onClose,
  residentAddress = 'Unit 304, Junction Res, 145 Jorissen St, Braamfontein'
}: GasCylinderRefillModalProps) {
  const [cylinderKg, setCylinderKg] = useState<9 | 19>(9);
  const [currentLevelPercent, setCurrentLevelPercent] = useState(24);
  const [isOrdered, setIsOrdered] = useState(false);

  if (!isOpen) return null;

  const refillCost = cylinderKg === 9 ? 340 : 680;

  const handleOrderRefill = () => {
    playTactileSound('chime');
    setIsOrdered(true);
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
                <Flame size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">LPG Gas Cylinder Refill & Bakkie Swap</h3>
                <p className="text-xs text-gray-400">Doorstep Empty Cylinder Exchange</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Gas Gauge Visualizer */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-white/10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Estimated Gas Reserves</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-amber-400">{currentLevelPercent}%</span>
                <span className="text-xs text-gray-400 font-bold">({cylinderKg}kg Bottle)</span>
              </div>
              <p className="text-[11px] text-rose-400 font-bold">⚠️ Low Gas — Approx 3-4 cooking days remaining</p>
            </div>

            <div className="flex gap-2">
              {([9, 19] as const).map(kg => (
                <button
                  key={kg}
                  type="button"
                  onClick={() => setCylinderKg(kg)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    cylinderKg === kg
                      ? 'bg-gold-primary text-black'
                      : 'bg-black/40 border border-white/10 text-gray-400'
                  }`}
                >
                  {kg}kg
                </button>
              ))}
            </div>
          </div>

          {/* Delivery & Price Summary */}
          <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Refill Swap Cost (Standard SA Grade):</span>
              <span className="text-gold-primary font-bold font-mono text-sm">{formatCurrency(refillCost, 'ZAR')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Delivery Address:</span>
              <span className="text-white font-medium truncate max-w-[200px]">{residentAddress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Dispatch ETA:</span>
              <span className="text-emerald-400 font-bold">Within 45 mins (Local Bakkie on stand)</span>
            </div>
          </div>

          {/* Order Action */}
          <button
            type="button"
            disabled={isOrdered}
            onClick={handleOrderRefill}
            className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Truck size={16} />
            <span>{isOrdered ? 'Bakkie Dispatched with Full Cylinder!' : `Dispatch Gas Bakkie (${formatCurrency(refillCost, 'ZAR')})`}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default GasCylinderRefillModal;
