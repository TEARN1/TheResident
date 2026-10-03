'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car, MapPin, X, CheckCircle2, Navigation, DollarSign, Info
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface TaxiRouteSign {
  id: string;
  destination: string;
  handGesture: string;
  gestureDescription: string;
  cashFareZAR: number;
  safeRankLocation: string;
}

const TAXI_ROUTES: TaxiRouteSign[] = [
  {
    id: 'tr1',
    destination: 'Johannesburg CBD / Noord Street Rank',
    handGesture: '☝️ Index Finger Up',
    gestureDescription: 'Point index finger straight up into the air towards the sky.',
    cashFareZAR: 16,
    safeRankLocation: 'Bree Street Taxi Rank (Main Deck)'
  },
  {
    id: 'tr2',
    destination: 'Braamfontein Local / Wits Main Campus',
    handGesture: '🫱 Flat Hand Pointing Down',
    gestureDescription: 'Hold flat palm horizontally facing the road (signals "Local / Short Distance").',
    cashFareZAR: 13,
    safeRankLocation: 'Jorissen & Station Street Rank'
  },
  {
    id: 'tr3',
    destination: 'Hatfield to Pretoria CBD',
    handGesture: '✌️ Two Fingers Peace Sign (Up)',
    gestureDescription: 'Hold peace sign pointing up towards Church Square.',
    cashFareZAR: 18,
    safeRankLocation: 'Hatfield Plaza Gautrain Taxi Bay'
  }
];

interface TaxiHandSignGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaxiHandSignGuideModal({ isOpen, onClose }: TaxiHandSignGuideModalProps) {
  const [routes] = useState<TaxiRouteSign[]>(TAXI_ROUTES);

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
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-glow">
                <Car size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">SA Minibus Taxi Hand-Signs & Fares</h3>
                <p className="text-xs text-gray-400">Survival Guide for Commuting Students & Residents</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Routes & Signs List */}
          <div className="space-y-3">
            {routes.map(r => (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-2 hover:border-gold-primary/40 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-white">{r.destination}</h4>
                    <p className="text-sm font-black text-gold-primary mt-1">{r.handGesture}</p>
                  </div>
                  <span className="text-base font-black font-mono text-emerald-400">
                    {formatCurrency(r.cashFareZAR, 'ZAR')}
                  </span>
                </div>

                <p className="text-xs text-gray-300 italic">{r.gestureDescription}</p>

                <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
                  <MapPin size={11} className="text-gold-primary shrink-0" />
                  <span>Safe Rank: {r.safeRankLocation}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] text-gray-400 font-mono text-center">
            Always have exact change ready for the front seat passenger who counts the money!
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default TaxiHandSignGuideModal;
