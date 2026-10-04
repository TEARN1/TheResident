'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Sunset, Sunrise, Sparkles } from 'lucide-react';

export type SolarPhase = 'dawn' | 'noon' | 'golden_hour' | 'twilight' | 'midnight';

interface SolarConfig {
  phase: SolarPhase;
  label: string;
  gradient: string;
  accentColor: string;
  icon: React.ReactNode;
}

const SOLAR_PRESETS: Record<SolarPhase, SolarConfig> = {
  dawn: {
    phase: 'dawn',
    label: 'Dawn Horizon (06:00)',
    gradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(244, 114, 182, 0.15), rgba(251, 146, 60, 0.12), transparent 70%)',
    accentColor: '#f472b6',
    icon: <Sunrise className="w-3.5 h-3.5 text-pink-400" />
  },
  noon: {
    phase: 'noon',
    label: 'High Sun (12:00)',
    gradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.08), transparent 70%)',
    accentColor: '#f59e0b',
    icon: <Sun className="w-3.5 h-3.5 text-amber-400" />
  },
  golden_hour: {
    phase: 'golden_hour',
    label: 'Golden Hour (17:30)',
    gradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(234, 88, 12, 0.18), rgba(245, 158, 11, 0.12), transparent 70%)',
    accentColor: '#ea580c',
    icon: <Sunset className="w-3.5 h-3.5 text-orange-400" />
  },
  twilight: {
    phase: 'twilight',
    label: 'Twilight (19:30)',
    gradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.16), rgba(168, 85, 247, 0.12), transparent 70%)',
    accentColor: '#818cf8',
    icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />
  },
  midnight: {
    phase: 'midnight',
    label: 'Midnight Velvet (23:00)',
    gradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.08), rgba(6, 78, 59, 0.15), transparent 70%)',
    accentColor: '#10b981',
    icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
  }
};

function getAutoPhase(): SolarPhase {
  if (typeof window === 'undefined') return 'midnight';
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 16) return 'noon';
  if (hour >= 16 && hour < 19) return 'golden_hour';
  if (hour >= 19 && hour < 22) return 'twilight';
  return 'midnight';
}

interface DynamicSolarLightingProps {
  showControls?: boolean;
}

export function DynamicSolarLighting({ showControls = false }: DynamicSolarLightingProps) {
  const [currentPhase, setCurrentPhase] = useState<SolarPhase>(getAutoPhase);
  const [isAuto, setIsAuto] = useState(true);

  useEffect(() => {
    if (!isAuto) return;
    const interval = setInterval(() => {
      setCurrentPhase(getAutoPhase());
    }, 60000);
    return () => clearInterval(interval);
  }, [isAuto]);

  const active = SOLAR_PRESETS[currentPhase];

  return (
    <>
      {/* Background Ambient Aura - fixed behind all UI */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-all duration-1000 ease-in-out"
        style={{
          background: active.gradient
        }}
      />

      {/* Optional Interactive Ambient Controls Widget */}
      {showControls && (
        <div className="fixed bottom-4 right-4 z-40 bg-neutral-900/90 border border-neutral-800 p-2.5 rounded-2xl backdrop-blur-md shadow-xl flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-800 text-xs">
            {active.icon}
            <span className="text-neutral-300 font-medium text-[11px]">{active.label}</span>
          </div>

          <div className="flex items-center gap-1">
            {(Object.keys(SOLAR_PRESETS) as SolarPhase[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setIsAuto(false);
                  setCurrentPhase(p);
                }}
                className={`p-1.5 rounded-lg text-xs transition ${
                  currentPhase === p
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={SOLAR_PRESETS[p].label}
              >
                {SOLAR_PRESETS[p].icon}
              </button>
            ))}
          </div>

          {!isAuto && (
            <button
              type="button"
              onClick={() => setIsAuto(true)}
              className="text-[10px] text-amber-400 underline px-1"
            >
              Reset Auto
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default DynamicSolarLighting;

