'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, X, ChevronUp, ChevronDown, MapPin, Zap, Home, Calendar, Phone
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';
import { formatCurrency } from '../../../../utils/logic';

interface RoomStory {
  id: string;
  title: string;
  suburb: string;
  priceZAR: number;
  videoPoster: string;
  solarBackup: boolean;
  landlordPhone: string;
}

const STORIES: RoomStory[] = [
  {
    id: 's1',
    title: 'Sunny Ensuite Room with North Balcony',
    suburb: 'Braamfontein',
    priceZAR: 4200,
    videoPoster: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1080&q=80',
    solarBackup: true,
    landlordPhone: '+27 82 555 0192'
  },
  {
    id: 's2',
    title: 'Spacious 2-Sleeper Studio with Private Kitchen',
    suburb: 'Hatfield, Pretoria',
    priceZAR: 4800,
    videoPoster: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1080&q=80',
    solarBackup: true,
    landlordPhone: '+27 71 888 4120'
  }
];

interface RoomStoriesReelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoomStoriesReelModal({ isOpen, onClose }: RoomStoriesReelModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  if (!isOpen) return null;

  const activeStory = STORIES[currentIndex];

  const handleNextStory = () => {
    playTactileSound('tab');
    setCurrentIndex(prev => (prev + 1) % STORIES.length);
  };

  const handlePrevStory = () => {
    playTactileSound('tab');
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : STORIES.length - 1));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-0 sm:p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full h-full sm:max-w-md sm:h-[85vh] sm:rounded-3xl overflow-hidden bg-black flex flex-col justify-between border border-white/20 shadow-2xl"
        >
          {/* Top Segmented Progress Bar */}
          <div className="absolute top-3 inset-x-3 z-30 flex gap-1.5">
            {STORIES.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gold-primary transition-all duration-300 ${
                    i === currentIndex ? 'w-full' : i < currentIndex ? 'w-full' : 'w-0'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Top Header Bar */}
          <div className="relative z-30 pt-7 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-black/60 border border-white/20 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
                Room Stories
              </span>
              {activeStory.solarBackup && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/80 text-black text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Zap size={10} /> Solar Backup
                </span>
              )}
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 rounded-full bg-black/60 text-white hover:bg-black transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Fullscreen Video/Photo Background */}
          <div
            className="absolute inset-0 bg-cover bg-center cursor-pointer"
            style={{ backgroundImage: `url(${activeStory.videoPoster})` }}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
          </div>

          {/* Story Navigation Tap Zones */}
          <div className="absolute inset-y-24 inset-x-0 flex justify-between z-10 pointer-events-auto">
            <div className="w-1/3 h-full" onClick={handlePrevStory} />
            <div className="w-1/3 h-full" onClick={handleNextStory} />
          </div>

          {/* Bottom Action Drawer */}
          <div className="relative z-30 p-5 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gold-primary font-bold">
                <MapPin size={13} />
                <span>{activeStory.suburb}</span>
              </div>
              <h3 className="text-base font-black text-white line-clamp-1">{activeStory.title}</h3>
              <p className="text-xl font-black font-mono text-gold-primary mt-1">
                {formatCurrency(activeStory.priceZAR, 'ZAR')} <span className="text-xs text-gray-300 font-sans">/ month</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { playTactileSound('chime'); alert(`Inspection requested for ${activeStory.title}! Landlord notified.`); }}
                className="flex-1 py-3 rounded-2xl bg-gold-primary text-black font-black uppercase text-xs tracking-wider transition hover:bg-gold-secondary"
              >
                1-Tap Book Inspection
              </button>
              <button
                type="button"
                onClick={handleNextStory}
                className="p-3 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition"
                title="Next Room"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default RoomStoriesReelModal;
