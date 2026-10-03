'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, X, Zap, Sun, Droplets, ChevronLeft, ChevronRight
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface Hotspot {
  id: string;
  xPercent: number; // horizontal angle 0-100%
  yPercent: number; // vertical angle 0-100%
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ROOM_HOTSPOTS: Hotspot[] = [
  {
    id: 'solar-plug',
    xPercent: 35,
    yPercent: 65,
    title: 'Backup Solar Inverter Plug',
    description: 'Dedicated red clean-power socket. Wi-Fi and study desk lamps stay powered during Stage 6 loadshedding.',
    icon: <Zap className="w-3.5 h-3.5 text-amber-400" />
  },
  {
    id: 'sunlight-window',
    xPercent: 70,
    yPercent: 35,
    title: 'North-Facing Courtyard Window',
    description: 'Double-glazed soundproof glass. Ample natural morning sunlight with direct view of inner garden.',
    icon: <Sun className="w-3.5 h-3.5 text-gold-primary" />
  },
  {
    id: 'gas-geyser',
    xPercent: 15,
    yPercent: 50,
    title: 'Instant Gas Geyser Ensuite',
    description: 'Endless high-pressure hot water regardless of municipal electric grid cuts.',
    icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" />
  }
];

interface Panoramic360TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
}

export function Panoramic360TourModal({
  isOpen,
  onClose,
  roomName = 'Standard Ensuite Room 4B • Braamfontein'
}: Panoramic360TourModalProps) {
  const [panX, setPanX] = useState(50);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(ROOM_HOTSPOTS[0]);

  if (!isOpen) return null;

  const handlePan = (direction: 'left' | 'right') => {
    playTactileSound('tab');
    setPanX(prev => (direction === 'left' ? (prev > 10 ? prev - 15 : 90) : (prev < 90 ? prev + 15 : 10)));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-glow">
                <Compass size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">360° Panoramic Virtual Room Tour</h3>
                <p className="text-xs text-gray-400">{roomName} • Interactive Spatial Inspection</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Panoramic Viewport Canvas */}
          <div className="relative aspect-[16/9] rounded-3xl overflow-hidden border border-white/15 bg-black select-none">
            {/* Simulated 360 panoramic room background with pan translation */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500"
              style={{
                backgroundImage: 'url("https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1600&q=80")',
                transform: `scale(1.2) translateX(${(panX - 50) * 0.4}%)`
              }}
            />

            {/* Radial Vignette & Glass Shimmer */}
            <div className="absolute inset-0 bg-radial-vignette opacity-70 pointer-events-none" />

            {/* Spatial Interactive Hotspots */}
            {ROOM_HOTSPOTS.map(spot => {
              const adjustedX = spot.xPercent + (50 - panX) * 0.3;
              const isSelected = selectedHotspot?.id === spot.id;

              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => { playTactileSound('chime'); setSelectedHotspot(spot); }}
                  style={{ left: `${adjustedX}%`, top: `${spot.yPercent}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-full border-2 transition-transform duration-300 ${
                    isSelected
                      ? 'bg-gold-primary text-black border-white scale-125 shadow-glow'
                      : 'bg-black/80 text-white border-gold-primary/60 hover:scale-110'
                  }`}
                  title={spot.title}
                >
                  {spot.icon}
                </button>
              );
            })}

            {/* Pan Left / Right Navigation Buttons */}
            <button
              type="button"
              onClick={() => handlePan('left')}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/70 border border-white/20 text-white hover:bg-black transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => handlePan('right')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/70 border border-white/20 text-white hover:bg-black transition"
            >
              <ChevronRight size={20} />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded-full border border-white/10 text-[10px] text-gray-300 font-mono">
              Use arrows or drag to pan 360° • Click glowing pins to inspect features
            </div>
          </div>

          {/* Active Hotspot Feature Sheet */}
          {selectedHotspot && (
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 flex items-start gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-gold-primary/20 text-gold-primary border border-gold-primary/30 shrink-0">
                {selectedHotspot.icon}
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-white uppercase">{selectedHotspot.title}</h4>
                <p className="text-gray-300 leading-relaxed">{selectedHotspot.description}</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default Panoramic360TourModal;
