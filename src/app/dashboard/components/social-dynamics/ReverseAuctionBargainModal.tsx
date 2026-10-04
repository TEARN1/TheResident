'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Clock, ArrowDown, X, CheckCircle2, Sparkles, ShoppingBag
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface AuctionItem {
  id: string;
  title: string;
  originalPriceZAR: number;
  currentPriceZAR: number;
  dropRateZAR: number;
  nextDropHours: number;
  sellerRoom: string;
  image: string;
}

const AUCTION_ITEMS: AuctionItem[] = [
  {
    id: 'a1',
    title: 'Hisense 90L Metallic Bar Fridge',
    originalPriceZAR: 1600,
    currentPriceZAR: 1140,
    dropRateZAR: 20,
    nextDropHours: 4,
    sellerRoom: 'Room 412 (Graduating)',
    image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'a2',
    title: 'Defy 20L Solo Microwave Oven',
    originalPriceZAR: 750,
    currentPriceZAR: 490,
    dropRateZAR: 20,
    nextDropHours: 8,
    sellerRoom: 'Room 105',
    image: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=400&q=80'
  }
];

interface ReverseAuctionBargainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReverseAuctionBargainModal({ isOpen, onClose }: ReverseAuctionBargainModalProps) {
  const [items, setItems] = useState<AuctionItem[]>(AUCTION_ITEMS);

  if (!isOpen) return null;

  const handleClaim = (item: AuctionItem) => {
    playTactileSound('chime');
    alert(`Deal claimed at ${formatCurrency(item.currentPriceZAR, 'ZAR')}! Head to ${item.sellerRoom} to collect.`);
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
                <Tag size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">The Bargain Bin • Reverse Auction</h3>
                <p className="text-xs text-gray-400">Prices drop by R20 every 24 hours until someone buys!</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Auction Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-3xl bg-neutral-900 border border-white/10 space-y-3 flex flex-col justify-between hover:border-gold-primary/40 transition"
              >
                <div className="space-y-2">
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-bold text-[10px] flex items-center gap-0.5">
                      <ArrowDown size={11} /> -R{item.dropRateZAR}/24h
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{item.title}</h4>
                    <p className="text-[10px] text-gray-400 font-mono">{item.sellerRoom}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] line-through text-gray-500 font-mono">
                      {formatCurrency(item.originalPriceZAR, 'ZAR')}
                    </span>
                    <span className="text-lg font-black font-mono text-gold-primary">
                      {formatCurrency(item.currentPriceZAR, 'ZAR')}
                    </span>
                  </div>

                  <div className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                    <Clock size={11} /> Next drop in {item.nextDropHours} hours
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClaim(item)}
                    className="w-full py-2.5 rounded-xl bg-gold-primary text-black font-black uppercase text-xs hover:bg-gold-secondary transition shadow-md"
                  >
                    Claim Deal Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ReverseAuctionBargainModal;
