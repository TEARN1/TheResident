'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Compass, X, Calendar, Clock, Flame, ShieldCheck, Thermometer
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface ARSolarWindowSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  windowFacing?: 'North' | 'East' | 'South' | 'West';
}

export function ARSolarWindowSimulatorModal({
  isOpen,
  onClose,
  windowFacing = 'North'
}: ARSolarWindowSimulatorModalProps) {
  const [season, setSeason] = useState<'Winter' | 'Summer'>('Winter');
  const [selectedHour, setSelectedHour] = useState<number>(13); // 09, 13, 17

  if (!isOpen) return null;

  // Solar angle & warmth estimation
  const isNorth = windowFacing === 'North';
  const sunlightRating = isNorth
    ? (season === 'Winter' ? 'Direct Warm Sunlight (Winter Sun is low in the North)' : 'Indirect Ambient Light (Summer Sun overhead)')
    : 'Partial Morning / Afternoon light only';
  const estimatedRoomTemp = isNorth
    ? (season === 'Winter' ? '21°C (Warm & cozy without extra heater)' : '24°C (Comfortable)')
    : (season === 'Winter' ? '15°C (Chilly - may require heater)' : '27°C');

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
                <Sun size={24} className="animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">AR Solar Window & Daylight Path</h3>
                <p className="text-xs text-gray-400">Orientation: {windowFacing}-Facing Window • Southern Hemisphere</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Season & Time Scrubber */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-neutral-900 rounded-2xl border border-white/10 text-xs">
            {/* Season Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Season:</span>
              {(['Winter', 'Summer'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { playTactileSound('tab'); setSeason(s); }}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    season === s
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-black/40 text-gray-400 hover:text-white'
                  }`}
                >
                  {s} (June vs Dec)
                </button>
              ))}
            </div>

            {/* Time of Day */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Hour:</span>
              {[9, 13, 17].map(hour => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => { playTactileSound('click'); setSelectedHour(hour); }}
                  className={`px-2.5 py-1 rounded-xl font-mono font-bold transition ${
                    selectedHour === hour
                      ? 'bg-gold-primary text-black'
                      : 'bg-black/40 text-gray-300 hover:text-white'
                  }`}
                >
                  {hour < 10 ? `0${hour}` : hour}:00
                </button>
              ))}
            </div>
          </div>

          {/* Simulated Solar Trajectory Stage */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/15 bg-black flex flex-col items-center justify-center p-6 text-center">
            {/* Window Frame Graphic */}
            <div className="relative w-48 h-36 border-4 border-white/20 rounded-xl bg-gradient-to-b from-sky-950/40 to-black/80 flex items-center justify-center overflow-hidden">
              {/* Sun Light Beam Angle */}
              <div
                className="absolute w-full h-full opacity-60 transition-all duration-700 pointer-events-none"
                style={{
                  background: `linear-gradient(${
                    selectedHour === 9 ? '45deg' : selectedHour === 13 ? '90deg' : '135deg'
                  }, rgba(251, 191, 36, 0.4) 0%, transparent 70%)`
                }}
              />
              <Sun
                size={36}
                className="text-amber-400 animate-pulse transition-transform duration-700"
                style={{
                  transform: `translateX(${(selectedHour - 13) * 35}px) translateY(${
                    season === 'Winter' ? '-10px' : '-25px'
                  })`
                }}
              />
            </div>

            {/* Solar Summary Tag */}
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs font-black text-amber-300 uppercase tracking-wider">
                <Flame size={14} />
                <span>{sunlightRating}</span>
              </div>
              <p className="text-[11px] text-gray-400">
                In South Africa, North-facing windows capture maximum winter heating.
              </p>
            </div>
          </div>

          {/* Thermal Insulation Rating Card */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-black/60 rounded-2xl border border-white/10 text-xs">
            <div className="space-y-1">
              <span className="text-gray-500 uppercase text-[9px] font-bold block">Estimated Room Temperature</span>
              <p className="text-white font-bold flex items-center gap-1.5">
                <Thermometer size={14} className="text-emerald-400" />
                <span>{estimatedRoomTemp}</span>
              </p>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-gray-500 uppercase text-[9px] font-bold block">Solar Heat Gain Rating</span>
              <p className="text-gold-primary font-black uppercase tracking-wider">
                {isNorth ? 'Class A (Optimal)' : 'Class B (Moderate)'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ARSolarWindowSimulatorModal;
