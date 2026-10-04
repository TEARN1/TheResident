'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, KeyRound, Wifi, ShieldCheck, CheckCircle2, X, Lock, Unlock
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface NFCKeycardHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber?: string;
  residenceName?: string;
}

export function NFCKeycardHandoverModal({
  isOpen,
  onClose,
  roomNumber = 'Unit 4B',
  residenceName = 'Junction Residence'
}: NFCKeycardHandoverModalProps) {
  const [isTransferred, setIsTransferred] = useState(false);
  const [keyActive, setKeyActive] = useState(true);

  if (!isOpen) return null;

  const handleSimulateKeyTap = () => {
    playTactileSound('chime');
    setIsTransferred(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-center relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-[10px] uppercase tracking-widest text-gold-primary font-black">Digital NFC Smart Key</span>
            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-white">{roomNumber} • {residenceName}</h3>
            <p className="text-xs text-gray-400">Encrypted Digital Door Access Token</p>
          </div>

          {/* Virtual NFC Keycard Graphic */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative w-64 h-40 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-950 via-neutral-900 to-black border-2 border-emerald-500/40 p-5 flex flex-col justify-between text-left shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">RES-KEY CARD</span>
              <Wifi size={18} className="text-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-0.5">
              <span className="text-[9px] text-gray-400 font-mono">ENCRYPTED RFID SEED</span>
              <p className="text-sm font-mono font-bold text-white tracking-widest">•••• 8492 SECURE</p>
            </div>

            <div className="flex justify-between items-end text-[10px] text-gray-400 font-mono">
              <span>DOOR: {roomNumber}</span>
              <span className="text-emerald-400 font-bold">READY TO TAP</span>
            </div>
          </motion.div>

          {/* Action Tap Trigger */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleSimulateKeyTap}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs tracking-wider transition flex items-center justify-center gap-2"
            >
              <Key size={16} />
              <span>{isTransferred ? 'Access Granted • Door Unlocked' : 'Simulate Phone Tap to Unlock'}</span>
            </button>

            {isTransferred && (
              <p className="text-[11px] text-emerald-400 font-mono flex items-center justify-center gap-1">
                <CheckCircle2 size={13} />
                <span>Move-in access test passed. Escrow verified.</span>
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default NFCKeycardHandoverModal;
