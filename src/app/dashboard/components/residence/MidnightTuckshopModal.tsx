'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, X, Plus, Clock, MapPin, CheckCircle2, Moon, Sparkles
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface TuckshopItem {
  id: string;
  name: string;
  sellerRoom: string;
  priceZAR: number;
  availableQty: number;
  category: 'Snacks' | 'Drinks' | 'Meds' | 'Study';
  icon: string;
}

const SAMPLE_TUCKSHOP_ITEMS: TuckshopItem[] = [
  { id: 't1', name: '2-Minute Noodles (Chicken)', sellerRoom: 'Room 304', priceZAR: 15, availableQty: 4, category: 'Snacks', icon: '🍜' },
  { id: 't2', name: 'Monster Energy Drink (500ml)', sellerRoom: 'Room 212', priceZAR: 25, availableQty: 2, category: 'Drinks', icon: '⚡' },
  { id: 't3', name: 'Panado Pain Relief (Strip of 4)', sellerRoom: 'Room 410', priceZAR: 10, availableQty: 3, category: 'Meds', icon: '💊' },
  { id: 't4', name: 'Albany White Sliced Bread (Half)', sellerRoom: 'Room 105', priceZAR: 12, availableQty: 1, category: 'Snacks', icon: '🍞' }
];

interface MidnightTuckshopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MidnightTuckshopModal({ isOpen, onClose }: MidnightTuckshopModalProps) {
  const [items, setItems] = useState<TuckshopItem[]>(SAMPLE_TUCKSHOP_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const handleOrder = (item: TuckshopItem) => {
    playTactileSound('chime');
    alert(`Order placed for ${item.name}! Head over to ${item.sellerRoom} to collect, or knock on their door.`);
  };

  const filtered = selectedCategory === 'All'
    ? items
    : items.filter(i => i.category === selectedCategory);

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
                <Moon size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Midnight Res Tuckshop & Crave Pool</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    Floor 1 - 6 Peer Pool
                  </span>
                </div>
                <p className="text-xs text-gray-400">Late-night study snacks and essentials traded between rooms</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-2 text-xs">
            {['All', 'Snacks', 'Drinks', 'Meds'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => { playTactileSound('tab'); setSelectedCategory(cat); }}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  selectedCategory === cat
                    ? 'bg-gold-primary text-black'
                    : 'bg-neutral-900 border border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tuckshop Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {filtered.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between gap-3 hover:border-gold-primary/40 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-xl bg-black/60 border border-white/10">{item.icon}</span>
                  <div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{item.name}</h4>
                    <p className="text-[10px] text-gray-400 font-mono">Collect at {item.sellerRoom} • {item.availableQty} left</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOrder(item)}
                  className="px-3 py-1.5 rounded-xl bg-gold-primary text-black font-black text-xs hover:bg-gold-secondary transition shrink-0"
                >
                  {formatCurrency(item.priceZAR, 'ZAR')}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default MidnightTuckshopModal;
