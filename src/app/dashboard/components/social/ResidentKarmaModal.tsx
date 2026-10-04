'use client';

import React from 'react';
import { 
  Award, 
  X, 
  Sparkles, 
  Gift 
} from 'lucide-react';

interface KarmaFactor {
  title: string;
  points: number;
  maxPoints: number;
  category: string;
  description: string;
}

const KARMA_FACTORS: KarmaFactor[] = [
  {
    title: 'On-Time Rent Payout Streak',
    points: 280,
    maxPoints: 300,
    category: 'Financial Reliability',
    description: '14 consecutive months paid before the 1st via TheResident Vault or PayShap.'
  },
  {
    title: 'Noise Courtesy & Quiet Hours',
    points: 180,
    maxPoints: 200,
    category: 'Community Respect',
    description: '98% neighbor satisfaction; 0 noise citations or warden complaints.'
  },
  {
    title: 'Solo Mover & Assembly Helper Gigs',
    points: 160,
    maxPoints: 200,
    category: 'Mutual Aid',
    description: 'Helped 8 fellow residents carry sofas & assemble flatpacks with 5.0 ratings.'
  },
  {
    title: 'Clean Kitchen Pledge & Recycler Sorting',
    points: 160,
    maxPoints: 200,
    category: 'Shared Spaces',
    description: 'Zero kitchen mess disputes; active contributor to waste segregation.'
  }
];

const BADGES = [
  { name: 'Model Resident', icon: '🏆', color: 'from-amber-500 to-yellow-600', perk: 'Deposit Waivers on Select Buildings' },
  { name: 'Midnight Hero', icon: '🛡️', color: 'from-indigo-500 to-purple-600', perk: 'Verified Night Escort Authority' },
  { name: 'Master Assembler', icon: '⚡', color: 'from-emerald-500 to-teal-600', perk: 'Zero Platform Fee on Trade Gigs' },
  { name: 'Community Pillar', icon: '🌟', color: 'from-rose-500 to-pink-600', perk: 'Town Hall Voting Weight x2' }
];

interface ResidentKarmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKarma?: number;
}

export function ResidentKarmaModal({
  isOpen,
  onClose,
  currentKarma = 780
}: ResidentKarmaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Award className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Street Credit & Resident Karma
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Tier 4: Legend
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Decentralized reputation calculated from verified rent reliability, neighbor reviews, and community deeds.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Score Header */}
        <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 via-neutral-900 to-neutral-950 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Total Resident Credit
            </span>
            <div className="flex items-baseline gap-2 justify-center sm:justify-start">
              <span className="text-4xl font-extrabold text-neutral-100">{currentKarma}</span>
              <span className="text-sm text-neutral-500">/ 1,000 PTS</span>
            </div>
            <p className="text-xs text-neutral-300">
              Top 2% of verified residents across Johannesburg & Western Cape.
            </p>
          </div>

          <div className="flex flex-col items-center sm:items-end">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>VIP Landlord Priority Unlocked</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1.5">No background check deposit required</span>
          </div>
        </div>

        {/* Karma Pillars */}
        <div className="mt-6 space-y-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
            Reputation Breakdown Pillars
          </span>
          <div className="space-y-2.5">
            {KARMA_FACTORS.map((f, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-neutral-200">{f.title}</span>
                    <span className="text-[10px] text-neutral-500 ml-2">({f.category})</span>
                  </div>
                  <span className="font-bold text-amber-400">
                    +{f.points} <span className="text-neutral-500 font-normal">/ {f.maxPoints}</span>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${(f.points / f.maxPoints) * 100}%` }}
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                  />
                </div>

                <p className="text-[11px] text-neutral-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Unlocked Badges & Perks */}
        <div className="mt-6 space-y-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
            Unlocked Resident Badges & Perks
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {BADGES.map((b, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-neutral-800/30 border border-neutral-800 flex items-center gap-3"
              >
                <div className="text-2xl p-2 rounded-xl bg-neutral-800 border border-neutral-700/60">
                  {b.icon}
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-200">{b.name}</div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <Gift className="w-3 h-3" /> {b.perk}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
          >
            Close Passport
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResidentKarmaModal;

