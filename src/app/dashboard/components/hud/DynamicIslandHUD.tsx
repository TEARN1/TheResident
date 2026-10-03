'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Truck, Zap, Radio, ChevronDown, ChevronUp,
  MapPin, PhoneCall, Volume2, Navigation
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

export type DynamicIslandState = 'idle' | 'bakkie' | 'escort' | 'loadshedding' | 'townhall';

interface DynamicIslandHUDProps {
  onOpenPanic?: () => void;
  onOpenBakkie?: () => void;
  onOpenTownHall?: () => void;
  onOpenWaterRadar?: () => void;
}

export function DynamicIslandHUD({
  onOpenPanic,
  onOpenBakkie,
  onOpenTownHall,
  onOpenWaterRadar
}: DynamicIslandHUDProps) {
  const [activeMode, setActiveMode] = useState<DynamicIslandState>('loadshedding');
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    playTactileSound('pop');
    setIsExpanded(!isExpanded);
  };

  const switchMode = (mode: DynamicIslandState) => {
    playTactileSound('tab');
    setActiveMode(mode);
  };

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-[95vw] sm:max-w-xl">
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`bg-black/90 backdrop-blur-2xl border border-white/15 hover:border-gold-primary/50 text-white rounded-full transition-all duration-300 ${
          isExpanded ? 'rounded-3xl p-4 sm:p-5 w-[360px] sm:w-[460px]' : 'px-4 py-2 flex items-center gap-3 cursor-pointer'
        }`}
        onClick={!isExpanded ? toggleExpand : undefined}
      >
        {!isExpanded ? (
          /* Collapsed Pill State */
          <div className="flex items-center justify-between w-full gap-3 text-xs select-none">
            {activeMode === 'loadshedding' && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <Zap size={14} className="text-amber-400" />
                <span className="font-bold text-gray-200">Stage 2 Active</span>
                <span className="text-gray-400 text-[10px]">Braamfontein • Slot ends 20:30</span>
              </div>
            )}

            {activeMode === 'bakkie' && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Truck size={14} className="text-gold-primary" />
                <span className="font-bold text-gray-200">Tshepo En Route</span>
                <span className="text-emerald-400 text-[10px] font-mono">4.2 km (12 mins)</span>
              </div>
            )}

            {activeMode === 'escort' && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Shield size={14} className="text-emerald-400" />
                <span className="font-bold text-emerald-300">Escort Live</span>
                <span className="text-gray-400 text-[10px]">Breadcrumbs 14/14</span>
              </div>
            )}

            {activeMode === 'townhall' && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <Radio size={14} className="text-indigo-400" />
                <span className="font-bold text-indigo-300">Town Hall Space</span>
                <span className="text-gray-400 text-[10px]">42 Listening</span>
              </div>
            )}

            {activeMode === 'idle' && (
              <div className="flex items-center gap-2 text-gray-400">
                <Shield size={14} className="text-gold-primary" />
                <span className="font-medium text-[11px]">The Resident Grid • Protected</span>
              </div>
            )}

            <ChevronDown size={14} className="text-gray-400 hover:text-white shrink-0 ml-1" />
          </div>
        ) : (
          /* Expanded Island Control Center */
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gold-primary/20 border border-gold-primary/30 flex items-center justify-center text-gold-primary">
                  <Navigation size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Civic Dynamic Island</h4>
                  <p className="text-[10px] text-gray-400">Live Telemetry & Rapid Dispatch</p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleExpand}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Collapse Island"
              >
                <ChevronUp size={16} />
              </button>
            </div>

            {/* Mode Selectors */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => switchMode('loadshedding')}
                className={`py-1.5 rounded-lg flex flex-col items-center gap-1 transition ${
                  activeMode === 'loadshedding' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Zap size={12} />
                <span>Eskom</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('bakkie')}
                className={`py-1.5 rounded-lg flex flex-col items-center gap-1 transition ${
                  activeMode === 'bakkie' ? 'bg-gold-primary/20 text-gold-primary border border-gold-primary/40' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Truck size={12} />
                <span>Bakkie</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('escort')}
                className={`py-1.5 rounded-lg flex flex-col items-center gap-1 transition ${
                  activeMode === 'escort' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Shield size={12} />
                <span>Escort</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('townhall')}
                className={`py-1.5 rounded-lg flex flex-col items-center gap-1 transition ${
                  activeMode === 'townhall' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Radio size={12} />
                <span>Spaces</span>
              </button>
            </div>

            {/* Active Mode Card Display */}
            <div className="p-3 bg-neutral-950/70 border border-white/10 rounded-2xl text-xs space-y-2">
              {activeMode === 'loadshedding' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Zap size={14} /> Stage 2 Loadshedding
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">2h 14m left</span>
                  </div>
                  <p className="text-[11px] text-gray-300">Junction & South Point Study Hub generator on standby. Wi-Fi verified active.</p>
                </div>
              )}

              {activeMode === 'bakkie' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gold-primary flex items-center gap-1.5">
                      <Truck size={14} /> Toyota Hilux 2.4 GD-6
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">ETA 14:42</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-300">
                    <MapPin size={12} className="text-gray-400" />
                    <span>Driver Tshepo Dlamini • GP 88 YZ</span>
                  </div>
                  {onOpenBakkie && (
                    <button
                      type="button"
                      onClick={() => { toggleExpand(); onOpenBakkie(); }}
                      className="w-full py-1.5 rounded-xl bg-gold-primary/20 text-gold-primary font-bold text-[11px] hover:bg-gold-primary/30 transition border border-gold-primary/30"
                    >
                      Open Live GPS Radar
                    </button>
                  )}
                </div>
              )}

              {activeMode === 'escort' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-emerald-300 font-bold">
                    <span className="flex items-center gap-1.5"><Shield size={14} /> Walk-With-Me Active</span>
                    <span className="text-[10px] font-mono">07:28 Timer</span>
                  </div>
                  <p className="text-[11px] text-gray-300">Companion auto-pings CPF patrol if dead-man switch not touched.</p>
                  {onOpenPanic && (
                    <button
                      type="button"
                      onClick={() => { toggleExpand(); onOpenPanic(); }}
                      className="w-full py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[11px] hover:bg-rose-500/30 transition border border-rose-500/30 flex items-center justify-center gap-1.5"
                    >
                      <PhoneCall size={12} />
                      <span>Trigger Instant CPF Panic</span>
                    </button>
                  )}
                </div>
              )}

              {activeMode === 'townhall' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-indigo-300 font-bold">
                    <span className="flex items-center gap-1.5"><Radio size={14} /> Braamfontein Res Forum</span>
                    <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded">Live</span>
                  </div>
                  <p className="text-[11px] text-gray-300">Currently speaking: House Warden Nthabiseng on water tank maintenance.</p>
                  {onOpenTownHall && (
                    <button
                      type="button"
                      onClick={() => { toggleExpand(); onOpenTownHall(); }}
                      className="w-full py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold text-[11px] hover:bg-indigo-500/30 transition border border-indigo-500/30 flex items-center justify-center gap-1.5"
                    >
                      <Volume2 size={12} />
                      <span>Join Audio Space</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-1 text-[11px]">
              {onOpenWaterRadar && (
                <button
                  type="button"
                  onClick={() => { toggleExpand(); onOpenWaterRadar(); }}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                >
                  <span>Water Outages</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleExpand}
                className="text-gray-400 hover:text-white ml-auto"
              >
                Close HUD
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default DynamicIslandHUD;
