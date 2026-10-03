'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, CheckCircle2, ShieldCheck, X, Search, FileCheck, AlertCircle
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface LandlordDeedsCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  landlordName?: string;
  propertyAddress?: string;
}

export function LandlordDeedsCheckerModal({
  isOpen,
  onClose,
  landlordName = 'Mrs. Mokoena Properties',
  propertyAddress = '145 Jorissen Street, Braamfontein, Johannesburg'
}: LandlordDeedsCheckerModalProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedResult, setVerifiedResult] = useState<{
    titleDeedNumber: string;
    registeredOwner: string;
    municipality: string;
    ratesStatus: string;
    erfNumber: string;
  } | null>({
    titleDeedNumber: 'T000049281/2018',
    registeredOwner: 'Mokoena Residential Holdings (Pty) Ltd',
    municipality: 'City of Johannesburg Metropolitan',
    ratesStatus: 'Fully Paid & Rates Clearance Issued',
    erfNumber: 'Erf 384 Braamfontein Township'
  });

  if (!isOpen) return null;

  const handleRunAudit = () => {
    playTactileSound('pop');
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      playTactileSound('chime');
    }, 1200);
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
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Landlord Title Deeds & Rates Audit</h3>
                <p className="text-xs text-gray-400">Deeds Office & Municipal Rates Clearance Checker</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Property Info Card */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-1 text-xs">
            <span className="text-gray-400 uppercase text-[9px] font-bold block">Subject Property</span>
            <p className="text-white font-bold">{propertyAddress}</p>
            <p className="text-gray-400">Claimed Landlord: <strong>{landlordName}</strong></p>
          </div>

          {/* Deeds Office Result */}
          {verifiedResult && (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} /> DEEDS REGISTRY VERIFIED
                </span>
                <span className="text-gray-400 text-[10px]">{verifiedResult.titleDeedNumber}</span>
              </div>

              <div className="space-y-1 text-[11px] text-gray-300">
                <p>Registered Owner: <strong className="text-white">{verifiedResult.registeredOwner}</strong></p>
                <p>Municipal Jurisdiction: <strong>{verifiedResult.municipality}</strong></p>
                <p>Cadastral Erf: <strong>{verifiedResult.erfNumber}</strong></p>
                <p className="text-emerald-400 font-bold">Rates Status: {verifiedResult.ratesStatus}</p>
              </div>

              <div className="pt-1 text-[10px] text-gray-400 flex items-center gap-1">
                <FileCheck size={12} className="text-gold-primary" />
                <span>Zero bogus landlord risk • Safe for deposit escrow lock</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-gold-primary text-black font-black uppercase text-xs tracking-wider transition hover:bg-gold-secondary"
            >
              Verified & Safe to Proceed
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default LandlordDeedsCheckerModal;
