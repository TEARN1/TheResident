'use client';

import React, { useState } from 'react';
import { Zap, CloudRain, Flame, ShieldAlert } from 'lucide-react';

interface WeatherLoadsheddingOverlayProps {
  isLoadshedding?: boolean;
  isRaining?: boolean;
}

export function WeatherLoadsheddingOverlay({
  isLoadshedding = true,
  isRaining = false
}: WeatherLoadsheddingOverlayProps) {
  const [minimized, setMinimized] = useState(false);

  return (
    <>
      {/* Loadshedding Warm Amber Border Glow */}
      {isLoadshedding && (
        <div
          className="fixed inset-x-0 top-0 h-1.5 z-40 bg-gradient-to-r from-amber-500/0 via-amber-500/80 to-amber-500/0 pointer-events-none animate-pulse"
        />
      )}

      {/* Raining Header Droplet Shimmer Effect */}
      {isRaining && (
        <div
          className="fixed inset-x-0 top-0 h-1 z-40 bg-gradient-to-r from-cyan-400/0 via-cyan-400/70 to-cyan-400/0 pointer-events-none"
        />
      )}

      {/* Micro Status Chip in Bottom Bar */}
      {!minimized && isLoadshedding && (
        <div className="fixed bottom-5 right-24 z-30 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-500/30 backdrop-blur-md text-[11px] text-amber-300 font-mono">
          <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Stage 2 Grid Active • Backup Solar Enabled</span>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="text-amber-400 hover:text-white ml-1 text-xs"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export default WeatherLoadsheddingOverlay;
