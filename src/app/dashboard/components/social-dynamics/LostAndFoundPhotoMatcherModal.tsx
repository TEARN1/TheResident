'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Search, X, CheckCircle2, ShieldCheck, Key, HelpCircle
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface LostAndFoundPhotoMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LostAndFoundPhotoMatcherModal({ isOpen, onClose }: LostAndFoundPhotoMatcherModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchedOwner, setMatchedOwner] = useState<{
    itemName: string;
    ownerName: string;
    ownerRoom: string;
    confidence: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSimulatePhotoMatch = () => {
    playTactileSound('pop');
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setMatchedOwner({
        itemName: 'Silver Toyota Keyfob with Red Lanyard',
        ownerName: 'Tshepo Dlamini (Verified Resident)',
        ownerRoom: 'Room 304',
        confidence: '98% Visual Match'
      });
      playTactileSound('chime');
    }, 1500);
  };

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
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-glow">
                <Search size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">AI Lost & Found Photo Matcher</h3>
                <p className="text-xs text-gray-400">Courtyard & Laundry Room Item Recognition</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Camera Stage */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/15 bg-black flex items-center justify-center">
            <div className="text-center space-y-3">
              <Key size={48} className="text-gold-primary mx-auto animate-pulse" />
              <p className="text-xs text-gray-300 font-mono">Found item: Car keyfob on courtyard bench</p>
            </div>

            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs text-cyan-300 font-mono">Matching item against building registry...</p>
                </div>
              </div>
            )}
          </div>

          {/* Matched Owner Sheet */}
          {matchedOwner ? (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Item Owner Identified
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  {matchedOwner.confidence}
                </span>
              </div>
              <p className="text-white font-bold">{matchedOwner.ownerName} • {matchedOwner.ownerRoom}</p>
              <button
                type="button"
                onClick={() => { playTactileSound('chime'); alert(`Direct ping sent to ${matchedOwner.ownerName} to collect keys!`); onClose(); }}
                className="w-full py-2.5 rounded-xl bg-gold-primary text-black font-black uppercase text-xs hover:bg-gold-secondary transition mt-1"
              >
                Send Direct Notification to {matchedOwner.ownerName}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleSimulatePhotoMatch}
              className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Camera size={16} />
              <span>Snap Photo & Identify Owner</span>
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default LostAndFoundPhotoMatcherModal;
