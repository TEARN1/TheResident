'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint, ShieldCheck, CheckCircle2, X, Lock, Key, Sparkles
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface BiometricLaserScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionTitle?: string;
  onVerified?: () => void;
}

export function BiometricLaserScanModal({
  isOpen,
  onClose,
  actionTitle = 'Authorize Deposit Escrow Release (R4,500)',
  onVerified
}: BiometricLaserScanModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  if (!isOpen) return null;

  const handleStartScan = () => {
    playTactileSound('pop');
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setIsVerified(true);
      playTactileSound('chime');
      if (onVerified) onVerified();
    }, 1800);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-neutral-950 border border-gold-primary/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-center relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-[10px] uppercase tracking-widest text-gold-primary font-black">Biometric Security Gate</span>
            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-white">{actionTitle}</h3>
            <p className="text-xs text-gray-400">Touch and hold to scan biometric credential</p>
          </div>

          {/* Biometric Laser Scanner Target */}
          <div className="relative w-36 h-36 mx-auto rounded-3xl bg-neutral-900 border-2 border-white/20 flex items-center justify-center overflow-hidden">
            <Fingerprint
              size={72}
              className={`transition-colors duration-500 ${
                isVerified
                  ? 'text-emerald-400'
                  : isScanning
                  ? 'text-gold-primary'
                  : 'text-gray-500'
              }`}
            />

            {/* Vertical Moving Laser Beam */}
            {isScanning && (
              <motion.div
                className="absolute inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-gold-primary to-emerald-400 shadow-[0_0_15px_#d4af37]"
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {isVerified && (
              <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center">
                <CheckCircle2 size={48} className="text-emerald-400 animate-scale" />
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className="text-xs font-mono">
            {isVerified ? (
              <span className="text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} /> Biometric Signature Verified (256-bit)
              </span>
            ) : isScanning ? (
              <span className="text-gold-primary font-bold animate-pulse">
                Decrypting Secure Enclave...
              </span>
            ) : (
              <span className="text-gray-400">Ready for scan</span>
            )}
          </div>

          {/* Action Button */}
          {!isVerified ? (
            <button
              type="button"
              disabled={isScanning}
              onClick={handleStartScan}
              className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition disabled:opacity-50"
            >
              {isScanning ? 'Scanning...' : 'Scan Fingerprint / Face ID'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs tracking-wider transition"
            >
              Done & Return
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default BiometricLaserScanModal;
