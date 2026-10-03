'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Refrigerator, X, Plus, Clock, Gift, CheckCircle2, AlertTriangle, Trash2
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface FridgeItem {
  id: string;
  name: string;
  ownerRoom: string;
  expiryDate: string;
  isFreeToTake: boolean;
  shelf: string;
}

const FRIDGE_ITEMS: FridgeItem[] = [
  { id: 'f1', name: 'Clover Full Cream Milk (2L)', ownerRoom: 'Room 204', expiryDate: 'Tomorrow (Oct 5)', isFreeToTake: true, shelf: 'Middle Door Shelf' },
  { id: 'f2', name: 'Cheddar Cheese Block (400g)', ownerRoom: 'Room 312', expiryDate: 'In 5 days (Oct 9)', isFreeToTake: false, shelf: 'Top Crisper' },
  { id: 'f3', name: 'Fresh Apples (Bag of 6)', ownerRoom: 'Room 108', expiryDate: 'Departing for Recess!', isFreeToTake: true, shelf: 'Veggie Drawer' }
];

interface CommunalFridgeGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  fridgeName?: string;
}

export function CommunalFridgeGuardModal({
  isOpen,
  onClose,
  fridgeName = 'Communal Kitchen Fridge • Floor 3'
}: CommunalFridgeGuardModalProps) {
  const [items, setItems] = useState<FridgeItem[]>(FRIDGE_ITEMS);

  if (!isOpen) return null;

  const handleClaim = (item: FridgeItem) => {
    playTactileSound('chime');
    alert(`You claimed ${item.name}! Thanks to ${item.ownerRoom} for sharing before recess.`);
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
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-glow">
                <Refrigerator size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Communal Fridge & Expiry Guard</h3>
                <p className="text-xs text-gray-400">{fridgeName}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {items.map(i => (
              <div
                key={i.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  i.isFreeToTake
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-neutral-900 border-white/10'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{i.name}</span>
                    {i.isFreeToTake && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Gift size={11} /> Free To Take
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono">
                    Owner: {i.ownerRoom} • {i.shelf} • Exp: {i.expiryDate}
                  </p>
                </div>

                {i.isFreeToTake ? (
                  <button
                    type="button"
                    onClick={() => handleClaim(i)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-black uppercase text-xs hover:bg-emerald-400 transition"
                  >
                    Claim Food
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-500 font-mono px-2 py-1 rounded bg-black/40 border border-white/5">
                    Private
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="text-center text-[11px] text-gray-400 font-mono">
            Heading home for the holidays? Mark perishables as &quot;Free to Take&quot; to prevent fridge mould and waste.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CommunalFridgeGuardModal;
