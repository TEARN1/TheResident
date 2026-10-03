'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Waves, X, Clock, CheckCircle2, AlertCircle, Sparkles, Bell
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface WasherMachine {
  id: string;
  name: string;
  status: 'In Use' | 'Available' | 'Maintenance';
  minutesRemaining: number;
  currentUser: string;
}

const MACHINES: WasherMachine[] = [
  { id: 'w1', name: 'Washer 01 (Speed Queen)', status: 'In Use', minutesRemaining: 18, currentUser: 'Thabo (Room 201)' },
  { id: 'w2', name: 'Washer 02 (Speed Queen)', status: 'Available', minutesRemaining: 0, currentUser: 'Free' },
  { id: 'w3', name: 'Washer 03 (Heavy Load)', status: 'In Use', minutesRemaining: 34, currentUser: 'Nomsa (Room 312)' },
  { id: 'w4', name: 'Dryer 01 (Commercial Gas)', status: 'In Use', minutesRemaining: 12, currentUser: 'Kagiso (Room 108)' }
];

interface LaundryMachineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  laundryRoomName?: string;
}

export function LaundryMachineQueueModal({
  isOpen,
  onClose,
  laundryRoomName = 'Ground Floor Laundry Room • Block B'
}: LaundryMachineQueueModalProps) {
  const [machines, setMachines] = useState<WasherMachine[]>(MACHINES);
  const [remindedMachineId, setRemindedMachineId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSetReminder = (id: string) => {
    playTactileSound('chime');
    setRemindedMachineId(id);
    alert('Alarm set! We will notify you 5 minutes before this wash cycle finishes.');
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
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-glow">
                <Waves size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Laundry Machine Queue & Timers</h3>
                <p className="text-xs text-gray-400">{laundryRoomName}</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Machine Status Cards */}
          <div className="space-y-3">
            {machines.map(m => {
              const isFree = m.status === 'Available';
              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    isFree
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-neutral-900 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isFree ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-cyan-400'}`}>
                      <Waves size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{m.name}</h4>
                      <p className="text-[10px] text-gray-400">
                        {isFree ? 'Ready for laundry load' : `Used by ${m.currentUser}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isFree ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-wider">
                        Free Now
                      </span>
                    ) : (
                      <>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {m.minutesRemaining} mins left
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSetReminder(m.id)}
                          className={`p-2 rounded-xl border text-xs font-bold transition ${
                            remindedMachineId === m.id
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                          title="Notify me when free"
                        >
                          <Bell size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center text-[11px] text-gray-400">
            Never have your clean clothes dumped on the floor again. Set reminders to collect on time.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default LaundryMachineQueueModal;
