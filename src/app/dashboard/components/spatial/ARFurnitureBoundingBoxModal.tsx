'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Camera, X, CheckCircle2, RotateCw, Ruler, ShieldCheck, Eye
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface ARFurnitureBoundingBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFurnitureName?: string;
}

export function ARFurnitureBoundingBoxModal({
  isOpen,
  onClose,
  selectedFurnitureName = 'Double Bed (137 × 188 × 60 cm)'
}: ARFurnitureBoundingBoxModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [wireframePlaced, setWireframePlaced] = useState(true);
  const [surfaceDetected, setSurfaceDetected] = useState(true);

  if (!isOpen) return null;

  const handleRetestCorner = () => {
    playTactileSound('pop');
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setWireframePlaced(true);
    }, 1200);
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
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-glow">
                <Box size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">AR 3D Furniture Bounding Box</h3>
                <p className="text-xs text-gray-400">LiDAR & Camera Optical Fit Verification</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* AR Camera Simulated Viewport */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/15 bg-black flex items-center justify-center">
            {/* Background Room Camera View */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40"
              style={{
                backgroundImage: 'url("https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80")'
              }}
            />

            {/* Simulated AR Surface Mesh & 3D Bounding Wireframe Box */}
            {wireframePlaced && (
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-52 h-36 border-2 border-emerald-400 rounded-xl bg-emerald-500/10 flex flex-col items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-pulse">
                  <Box size={32} className="text-emerald-300 mb-1" />
                  <p className="text-xs font-black text-white uppercase">{selectedFurnitureName}</p>
                  <span className="text-[10px] text-emerald-300 font-mono">100% Fit Confirmed</span>
                </div>

                {/* Ground Plane Calibration Crosshairs */}
                <div className="w-64 h-8 mt-2 border-b-2 border-dotted border-gold-primary/50 flex justify-between text-[9px] font-mono text-gold-primary px-2">
                  <span>WALL: 2.4m</span>
                  <span>FLOOR DETECTED (0.0° TILT)</span>
                  <span>DOOR: 95cm</span>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="text-center space-y-2">
                  <Camera className="w-8 h-8 text-gold-primary animate-bounce mx-auto" />
                  <p className="text-xs font-mono text-gray-200">Point phone camera at corner floor...</p>
                </div>
              </div>
            )}

            <div className="absolute top-3 left-3 bg-black/80 px-2.5 py-1 rounded-full border border-white/10 text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>AR Tracking Locked</span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleRetestCorner}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:text-white text-xs font-bold flex items-center gap-2 transition"
            >
              <RotateCw size={14} />
              <span>Re-scan Corner</span>
            </button>

            <button
              type="button"
              onClick={() => { playTactileSound('chime'); onClose(); }}
              className="px-5 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black text-xs font-black uppercase tracking-wider transition shadow-md"
            >
              Confirm Measurement
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ARFurnitureBoundingBoxModal;
