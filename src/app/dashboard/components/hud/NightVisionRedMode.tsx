'use client';

import React, { useState } from 'react';
import { Eye, Moon, Sun, AlertTriangle } from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

export function NightVisionRedMode() {
  const [isRedMode, setIsRedMode] = useState(false);

  const toggleRedMode = () => {
    playTactileSound('pop');
    setIsRedMode(!isRedMode);
  };

  return (
    <>
      {/* Night Vision Red Light Mode Overlay */}
      {isRedMode && (
        <div
          className="fixed inset-0 pointer-events-none z-[400] transition-opacity duration-500"
          style={{
            backgroundColor: 'rgba(255, 0, 0, 0.12)',
            mixBlendMode: 'multiply'
          }}
        />
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={toggleRedMode}
        className={`fixed bottom-5 left-5 z-[150] p-2.5 rounded-2xl border transition-all flex items-center gap-2 text-xs font-bold ${
          isRedMode
            ? 'bg-rose-950/90 border-rose-500 text-rose-300'
            : 'bg-black/70 border-white/10 text-gray-400 hover:text-white backdrop-blur-xl'
        }`}
        title="Toggle Night Vision Red Light Mode (Preserves eye adaptation during blackout loadshedding)"
      >
        <Eye className={`w-4 h-4 ${isRedMode ? 'text-rose-400 animate-pulse' : 'text-gray-400'}`} />
        <span className="hidden sm:inline text-[10px] uppercase tracking-wider font-mono">
          {isRedMode ? 'Night-Vision Active' : 'Red Mode'}
        </span>
      </button>
    </>
  );
}

export default NightVisionRedMode;
