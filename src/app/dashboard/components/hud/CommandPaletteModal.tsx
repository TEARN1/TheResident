'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShieldAlert, Truck, Droplets, Calculator,
  Home, Radio, FileText, ArrowRight, X, Command
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionKey: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  shortcut: string;
  category: 'Safety' | 'Logistics' | 'Housing' | 'Community';
  icon: React.ReactNode;
}

const COMMAND_LIST: CommandItem[] = [
  {
    id: 'panic',
    label: 'Trigger CPF Emergency Alarm',
    description: 'Dispatch silent alert and audio log to neighborhood watch',
    shortcut: '/panic',
    category: 'Safety',
    icon: <ShieldAlert className="w-4 h-4 text-rose-400" />
  },
  {
    id: 'bakkie',
    label: 'Estimate Bakkie Volume & Price',
    description: 'Calculate cubic metres (CBM) and vehicle requirements',
    shortcut: '/bakkie',
    category: 'Logistics',
    icon: <Truck className="w-4 h-4 text-gold-primary" />
  },
  {
    id: 'water',
    label: 'Check Water Tankers & Taps',
    description: 'Live municipal water trucks and JoJo reserve levels',
    shortcut: '/water',
    category: 'Safety',
    icon: <Droplets className="w-4 h-4 text-cyan-400" />
  },
  {
    id: 'split',
    label: 'Split Household Utility Bills',
    description: 'Divide Eskom electricity and Wi-Fi between roommates',
    shortcut: '/split',
    category: 'Housing',
    icon: <Calculator className="w-4 h-4 text-emerald-400" />
  },
  {
    id: 'lease',
    label: 'Generate Official SA Lease',
    description: 'Create Act 50 compliant residential contract with escrow',
    shortcut: '/lease',
    category: 'Housing',
    icon: <FileText className="w-4 h-4 text-amber-400" />
  },
  {
    id: 'spaces',
    label: 'Join Town Hall Audio Space',
    description: 'Tune into active student residence discussion forum',
    shortcut: '/spaces',
    category: 'Community',
    icon: <Radio className="w-4 h-4 text-indigo-400" />
  },
  {
    id: 'floorplan',
    label: 'Open 2.5D Room Floorplan Canvas',
    description: 'Drag and arrange beds, desks, and fridges in your room',
    shortcut: '/floorplan',
    category: 'Housing',
    icon: <Home className="w-4 h-4 text-purple-400" />
  }
];

export function CommandPaletteModal({
  isOpen,
  onClose,
  onSelectAction
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        playTactileSound('pop');
        if (isOpen) {
          onClose();
        } else {
          // Parent handles open
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filtered = COMMAND_LIST.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase()) ||
    item.shortcut.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (id: string) => {
    playTactileSound('click');
    onSelectAction(id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="w-full max-w-xl bg-neutral-950 border border-white/15 rounded-3xl p-4 shadow-2xl space-y-3 overflow-hidden"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-3 py-2 bg-neutral-900/80 rounded-2xl border border-white/10">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              placeholder="Type a command or search (/panic, /bakkie, /water, /split)..."
              className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-gray-500"
            />
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 bg-black/40 px-2 py-0.5 rounded border border-white/10 font-mono">
              <Command className="w-2.5 h-2.5" /> K
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Command Results */}
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">
                No matching commands. Try &quot;/panic&quot;, &quot;/bakkie&quot;, or &quot;/water&quot;.
              </div>
            ) : (
              filtered.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    idx === selectedIndex
                      ? 'bg-gold-primary/10 border border-gold-primary/30 text-white'
                      : 'hover:bg-white/5 border border-transparent text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-black/60 border border-white/10 shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-2">
                        <span>{item.label}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{item.shortcut}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">{item.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold px-2 py-0.5 rounded bg-white/5">
                      {item.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CommandPaletteModal;
