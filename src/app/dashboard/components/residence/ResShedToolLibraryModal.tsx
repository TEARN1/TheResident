'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, X, ShieldCheck, CheckCircle2, Clock, MapPin, Drill, Lock
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface ToolItem {
  id: string;
  name: string;
  ownerRoom: string;
  collateralDepositZAR: number;
  available: boolean;
  category: string;
  icon: string;
}

const TOOL_LIST: ToolItem[] = [
  { id: 'tool-1', name: 'Bosch Cordless Power Drill', ownerRoom: 'Room 205', collateralDepositZAR: 150, available: true, category: 'Hardware', icon: '🪛' },
  { id: 'tool-2', name: 'Steam Iron & Compact Board', ownerRoom: 'Room 310', collateralDepositZAR: 80, available: true, category: 'Appliance', icon: '👔' },
  { id: 'tool-3', name: 'Heavy-Duty Vacuum Cleaner', ownerRoom: 'Floor 4 Rep', collateralDepositZAR: 120, available: false, category: 'Cleaning', icon: '🧹' },
  { id: 'tool-4', name: 'Wahl Hair Clipper Set', ownerRoom: 'Room 102', collateralDepositZAR: 90, available: true, category: 'Grooming', icon: '✂️' }
];

interface ResShedToolLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResShedToolLibraryModal({ isOpen, onClose }: ResShedToolLibraryModalProps) {
  const [tools, setTools] = useState<ToolItem[]>(TOOL_LIST);

  if (!isOpen) return null;

  const handleBorrow = (t: ToolItem) => {
    playTactileSound('chime');
    alert(`Collateral deposit (${formatCurrency(t.collateralDepositZAR, 'ZAR')}) reserved in escrow vault. Collect ${t.name} from ${t.ownerRoom}.`);
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
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-glow">
                <Wrench size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">The Res Shed • P2P Tool Library</h3>
                <p className="text-xs text-gray-400">Borrow communal tools with zero-risk escrow collateral return</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tools Grid */}
          <div className="space-y-3">
            {tools.map(t => (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-xl bg-black/60 border border-white/10">{t.icon}</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{t.name}</h4>
                    <p className="text-[10px] text-gray-400 font-mono">Owner: {t.ownerRoom} • Collateral: {formatCurrency(t.collateralDepositZAR, 'ZAR')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {t.available ? (
                    <button
                      type="button"
                      onClick={() => handleBorrow(t)}
                      className="px-3.5 py-1.5 rounded-xl bg-gold-primary text-black font-black uppercase text-xs hover:bg-gold-secondary transition"
                    >
                      Borrow Now
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-500 font-bold text-xs">
                      Currently Loaned
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-black/60 rounded-2xl border border-white/10 text-center text-xs text-gray-400">
            Collateral is refunded 100% immediately when the tool is checked back in undamaged.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ResShedToolLibraryModal;
