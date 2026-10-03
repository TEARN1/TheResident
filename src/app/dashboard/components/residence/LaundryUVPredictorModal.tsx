'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, CloudRain, Wind, Droplets, X, CheckCircle2, AlertTriangle, Sparkles
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface LaundryUVPredictorModalProps {
  isOpen: boolean;
  onClose: () => void;
  suburbName?: string;
}

export function LaundryUVPredictorModal({
  isOpen,
  onClose,
  suburbName = 'Braamfontein, Johannesburg'
}: LaundryUVPredictorModalProps) {
  const [uvIndex] = useState(10); // Extreme UV
  const [humidityPercent] = useState(28); // Dry Highveld air
  const [windSpeedKmh] = useState(14); // Gentle breeze
  const [estDryingMinutes] = useState(38);

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
                <Sun size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Courtyard Laundry Drying & UV Radar</h3>
                <p className="text-xs text-gray-400">{suburbName} • Communal Clotheslines</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Core Prediction Card */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-white/10 text-center space-y-2">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Estimated Drying Duration</span>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-black font-mono text-emerald-400">{estDryingMinutes}</span>
              <span className="text-base text-gray-300 font-bold">Minutes (100% Dry)</span>
            </div>
            <p className="text-xs text-gray-300">
              Optimal sunny Highveld weather. Heavy towels and bedding will dry rapidly today.
            </p>
          </div>

          {/* Meteorological Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
            <div className="p-3 bg-black/60 rounded-2xl border border-white/10">
              <Sun size={18} className="text-amber-400 mx-auto mb-1" />
              <span className="text-gray-400 text-[10px] block">UV Index</span>
              <span className="text-white font-bold">{uvIndex} (Very High)</span>
            </div>
            <div className="p-3 bg-black/60 rounded-2xl border border-white/10">
              <Wind size={18} className="text-cyan-400 mx-auto mb-1" />
              <span className="text-gray-400 text-[10px] block">Wind Velocity</span>
              <span className="text-white font-bold">{windSpeedKmh} km/h</span>
            </div>
            <div className="p-3 bg-black/60 rounded-2xl border border-white/10">
              <Droplets size={18} className="text-emerald-400 mx-auto mb-1" />
              <span className="text-gray-400 text-[10px] block">Air Humidity</span>
              <span className="text-white font-bold">{humidityPercent}% (Dry)</span>
            </div>
          </div>

          {/* Rain / Thunderstorm Sentinel Warning */}
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center gap-3 text-xs">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-300">Highveld Thunderstorm Watch</p>
              <p className="text-gray-400 text-[11px]">No rain expected before 17:00. Safe to hang laundry outside now.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default LaundryUVPredictorModal;
