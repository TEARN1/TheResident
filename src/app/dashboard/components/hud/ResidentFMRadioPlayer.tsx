'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Play, Pause, SkipForward, Volume2, CloudRain,
  Music, X, Disc3, Sparkles
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface Track {
  id: string;
  title: string;
  speaker: string;
  residence: string;
  duration: string;
  tags: string[];
}

const BROADCAST_TRACKS: Track[] = [
  {
    id: 't1',
    title: 'Floor 3 Kitchen Cleanliness Agreement',
    speaker: 'Anonymous Resident',
    residence: 'Junction Res, Braamfontein',
    duration: '01:14',
    tags: ['House Rules', 'Kitchen']
  },
  {
    id: 't2',
    title: 'Water Outage Update & Tanker Schedule',
    speaker: 'House Warden Nthabiseng',
    residence: 'South Point Commons',
    duration: '02:05',
    tags: ['Water', 'Urgent']
  },
  {
    id: 't3',
    title: 'Campus Shuttle Pooling for Deep in the City',
    speaker: 'Groove Coordinator Sbu',
    residence: 'Constitution Hill',
    duration: '00:58',
    tags: ['Nightlife', 'Gruvs']
  }
];

export function ResidentFMRadioPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 1.5 | 2>(1);
  const [rainAmbience, setRainAmbience] = useState(false);

  const activeTrack = BROADCAST_TRACKS[currentTrackIndex];

  const togglePlay = () => {
    playTactileSound(isPlaying ? 'pop' : 'chime');
    setIsPlaying(!isPlaying);
  };

  const handleNextTrack = () => {
    playTactileSound('tab');
    setCurrentTrackIndex((prev) => (prev + 1) % BROADCAST_TRACKS.length);
  };

  const cycleSpeed = () => {
    playTactileSound('click');
    setSpeedMultiplier(prev => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  return (
    <>
      {/* Floating Dock Launcher Mini Cassette */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => { playTactileSound('pop'); setIsOpen(true); }}
          className="fixed bottom-5 right-5 z-[140] p-2.5 rounded-2xl bg-black/80 border border-purple-500/30 text-purple-300 backdrop-blur-xl flex items-center gap-2 text-xs font-bold transition hover:border-purple-500"
          title="Resident FM Campus Audio Stream"
        >
          <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="hidden sm:inline text-[10px] uppercase font-mono tracking-wider">Resident FM</span>
          {isPlaying && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>
      )}

      {/* Expanded Player Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-5 right-5 z-[160] w-80 sm:w-96 bg-neutral-950/95 border border-purple-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl space-y-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-white tracking-wider">Resident FM (Radio)</h4>
                  <p className="text-[10px] text-gray-400">Campus Gossip & Community Stream</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cassette Tape Visualizer */}
            <div className="relative p-4 rounded-2xl bg-neutral-900 border border-purple-500/20 flex flex-col items-center justify-center space-y-3">
              <div className="flex items-center justify-between w-full px-6">
                {/* Rotating Reel 1 */}
                <Disc3
                  className={`w-10 h-10 text-purple-400 transition-transform ${
                    isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: speedMultiplier === 2 ? '1s' : '3s' }}
                />
                <div className="h-0.5 flex-1 mx-4 bg-white/20 rounded relative overflow-hidden">
                  {isPlaying && (
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-400 to-emerald-400"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 74, repeat: Infinity }}
                    />
                  )}
                </div>
                {/* Rotating Reel 2 */}
                <Disc3
                  className={`w-10 h-10 text-purple-400 transition-transform ${
                    isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: speedMultiplier === 2 ? '1s' : '3s' }}
                />
              </div>

              <div className="text-center">
                <h5 className="text-xs font-bold text-white line-clamp-1">{activeTrack.title}</h5>
                <p className="text-[10px] text-gray-400">{activeTrack.speaker} • {activeTrack.residence}</p>
              </div>

              {/* Tags */}
              <div className="flex gap-1.5">
                {activeTrack.tags.map(t => (
                  <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Playback Controls Bar */}
            <div className="flex items-center justify-between pt-1">
              {/* Rain Ambience Toggle */}
              <button
                type="button"
                onClick={() => { playTactileSound('click'); setRainAmbience(!rainAmbience); }}
                className={`p-2 rounded-xl border text-xs flex items-center gap-1 transition ${
                  rainAmbience
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                    : 'bg-neutral-900 border-neutral-800 text-gray-400 hover:text-white'
                }`}
                title="Toggle Lo-fi Rain Ambience"
              >
                <CloudRain className="w-3.5 h-3.5" />
                <span className="text-[10px]">Rain</span>
              </button>

              {/* Central Transport Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-purple-500 hover:bg-purple-400 text-neutral-950 flex items-center justify-center transition"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-gray-300 hover:text-white transition"
                  title="Next Broadcast"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Speed Multiplier */}
              <button
                type="button"
                onClick={cycleSpeed}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-purple-300 hover:text-white text-[10px] font-mono font-bold transition"
              >
                {speedMultiplier}x
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ResidentFMRadioPlayer;
