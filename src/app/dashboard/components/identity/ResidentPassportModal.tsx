'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, ShieldCheck, CheckCircle2, X, Star, FileText, Stamp, Sparkles
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface PassportStamp {
  id: string;
  residence: string;
  suburb: string;
  year: string;
  verdict: string;
  color: string;
}

const PASSPORT_STAMPS: PassportStamp[] = [
  {
    id: 's1',
    residence: 'Junction Residence',
    suburb: 'Braamfontein',
    year: '2024 / 2025',
    verdict: '100% On-Time PayShap Rent • Zero Disputes',
    color: 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
  },
  {
    id: 's2',
    residence: 'The Exchange Commons',
    suburb: 'Hatfield, Pretoria',
    year: '2025 / 2026',
    verdict: 'Zero Snag Deductions • Full Deposit Refunded',
    color: 'border-gold-primary text-gold-primary bg-amber-950/20'
  },
  {
    id: 's3',
    residence: 'South Point Lofts',
    suburb: 'Johannesburg CBD',
    year: '2026 Active',
    verdict: 'Resident Karma 4.95 • Civic Ambassador',
    color: 'border-purple-500 text-purple-300 bg-purple-950/20'
  }
];

interface ResidentPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentName?: string;
}

export function ResidentPassportModal({
  isOpen,
  onClose,
  residentName = 'Sipho Ndlovu'
}: ResidentPassportModalProps) {
  if (!isOpen) return null;

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
                <Award size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">The Resident Official Passport</h3>
                <p className="text-xs text-gray-400">Cryptographically Verified Tenant Credential</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Passport Identification Bio Page */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <span className="text-[9px] text-gray-500 uppercase font-black">PASSPORT HOLDER</span>
              <p className="text-base font-black text-white">{residentName}</p>
              <p className="text-gray-400 font-mono">RES-ID: RSA-980412-RES-01</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-gray-500 uppercase font-black">OVERALL STATUS</span>
              <p className="text-emerald-400 font-black text-sm flex items-center justify-end gap-1">
                <ShieldCheck size={14} /> AAA+ Vetted
              </p>
              <p className="text-gold-primary text-[10px] font-bold">100% Lease Approval Rate</p>
            </div>
          </div>

          {/* Embossed Visa Stamps Section */}
          <div className="space-y-2.5">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
              Official Rental Visa Stamps:
            </span>

            <div className="grid grid-cols-1 gap-2.5">
              {PASSPORT_STAMPS.map(stamp => (
                <div
                  key={stamp.id}
                  className={`p-3.5 rounded-2xl border-2 border-dashed ${stamp.color} space-y-1 relative overflow-hidden`}
                >
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                    <span>{stamp.residence} ({stamp.suburb})</span>
                    <span className="font-mono text-[10px]">{stamp.year}</span>
                  </div>
                  <p className="text-[11px] font-bold">{stamp.verdict}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[11px] text-gray-400 font-mono">1-Click Shareable with Landlords</span>
            <button
              type="button"
              onClick={() => { playTactileSound('chime'); alert('Encrypted 1-Page Resident Passport copied to clipboard for instant landlord submission!'); }}
              className="px-5 py-2.5 rounded-xl bg-gold-primary text-black font-black uppercase text-xs tracking-wider transition hover:bg-gold-secondary"
            >
              Share Verified Passport
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ResidentPassportModal;
