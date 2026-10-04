'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, BatteryCharging, Zap, X, ShieldCheck, CheckCircle2, Wifi, Clock
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface SolarBatteryBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemName?: string;
}

export function SolarBatteryBridgeModal({
  isOpen,
  onClose,
  systemName = 'SunSynk 8kW Hybrid Inverter + 10kWh Lithium Battery'
}: SolarBatteryBridgeModalProps) {
  const [batteryPercent] = useState(88);
  const [solarGenerationKw] = useState(4.2);
  const [backupHoursRemaining] = useState(6.5);

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
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Solar Inverter & Battery Bridge</h3>
                <p className="text-xs text-gray-400">{systemName}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Battery Status Dial Card */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-white/10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Battery State of Charge (SoC)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black font-mono text-emerald-400">{batteryPercent}%</span>
                <span className="text-xs text-gray-300 font-bold">(Lithium LiFePO4)</span>
              </div>
              <p className="text-xs text-emerald-300 font-medium flex items-center gap-1">
                <BatteryCharging size={14} className="text-emerald-400 animate-pulse" />
                <span>Charging from rooftop solar panels (+{solarGenerationKw} kW)</span>
              </p>
            </div>

            <div className="p-3 bg-black/60 rounded-2xl border border-white/10 text-center font-mono">
              <span className="text-[9px] text-gray-400 block uppercase">Outage Bridge</span>
              <span className="text-xl font-bold text-amber-300">{backupHoursRemaining} hrs</span>
            </div>
          </div>

          {/* Protected Circuits Checklist */}
          <div className="space-y-2 text-xs">
            <span className="text-gray-400 uppercase text-[10px] font-bold block">Protected Essential Loads:</span>
            {[
              { label: 'Uncapped Fibre Wi-Fi Router (Building Core)', status: 'Online 100%' },
              { label: 'Hallway & Stairwell Emergency LED Lights', status: 'Online 100%' },
              { label: 'Ground Floor Study Hall Red Sockets (Laptops)', status: 'Active (Max 65W/socket)' }
            ].map(c => (
              <div key={c.label} className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <span className="text-white font-medium">{c.label}</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono text-[11px]">
                  <CheckCircle2 size={13} /> {c.status}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center text-[11px] text-gray-400 font-mono">
            Rooftop solar telemetry synced live with Braamfontein weather station.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default SolarBatteryBridgeModal;
