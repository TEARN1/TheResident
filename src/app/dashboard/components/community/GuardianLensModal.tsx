'use client';

import React, { useState } from 'react';
import { 
  Eye, 
  X, 
  ShieldCheck, 
  PhoneCall, 
  CreditCard, 
  Building, 
  EyeOff
} from 'lucide-react';

interface GuardianLensModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
  residenceName?: string;
  roomNumber?: string;
}

export function GuardianLensModal({
  isOpen,
  onClose,
  studentName = 'Sipho Ndlovu',
  residenceName = 'South Point Central, Braamfontein',
  roomNumber = 'Room 408B'
}: GuardianLensModalProps) {
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  if (!isOpen) return null;

  const handleSimulatePayment = () => {
    setPaySuccess(true);
    setTimeout(() => {
      setPaySuccess(false);
      setShowPayModal(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-teal-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Eye className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  GuardianLens: Peace-of-Mind Relay
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  Guardian Portal
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Transparent safety & financial monitoring for parents while strictly safeguarding student privacy.
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

        {/* Student & Building Card */}
        <div className="mt-6 p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-neutral-400">Enrolled Resident</div>
            <div className="text-base font-bold text-neutral-100">{studentName}</div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Building className="w-3.5 h-3.5 text-teal-400" />
              <span>{residenceName} • {roomNumber}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="tel:0115550199"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 hover:text-white hover:bg-neutral-700 transition"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
              <span>Call Building Warden Desk</span>
            </a>
          </div>
        </div>

        {/* Relay Metrics */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Safety & Transit Card */}
          <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-teal-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-400" /> Biometric Building Access
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">SAFE ON SITE</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-300">
                <span>Last Entrance Tap:</span>
                <span className="font-semibold text-neutral-100">Main Boom Gate Turnstile</span>
              </div>
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Timestamp:</span>
                <span>Today at 20:42 SAST</span>
              </div>
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Campus Shuttle Arrival:</span>
                <span className="text-emerald-400">Confirmed at Station Gate 2</span>
              </div>
            </div>
          </div>

          {/* Financial & Rent Ledger */}
          <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-400" /> Co-Signer Rent Status
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                PAID UP TO DATE
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-300">
                <span>Current Month:</span>
                <span className="font-semibold text-neutral-100">October 2026 (R4,200)</span>
              </div>
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>NSFAS Remittance:</span>
                <span className="text-emerald-400">Disbursed (Direct to Escrow)</span>
              </div>
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>SARS Proof of Rent:</span>
                <span className="text-amber-400 underline cursor-pointer">Download Tax PDF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Fortress Notice */}
        <div className="mt-6 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-3">
          <EyeOff className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-bold text-neutral-300">Student Privacy Fortress (POPIA Act Compliant)</div>
            <p className="text-neutral-400 leading-relaxed">
              To foster independence and dignity, GuardianLens strictly restricts access to student personal chats,
              gossip board postings, social connections, and event attendance. Only life-safety and financial compliance data are relayed.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-neutral-400">Next Rent Cycle due 01 November 2026</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 rounded-xl bg-teal-500 text-neutral-950 font-bold text-xs uppercase tracking-wider hover:bg-teal-400 transition"
            >
              Top-Up Student Account
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Top-up modal simulated */}
        {showPayModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-neutral-100">Direct PayShap Student Co-Pay</h3>
              <p className="text-xs text-neutral-400">
                Instantly deposit food allowance or room utility credits for {studentName}.
              </p>
              <div className="space-y-2">
                <label className="text-xs text-neutral-300">Amount (ZAR)</label>
                <input
                  type="number"
                  defaultValue={500}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-neutral-100"
                />
              </div>
              {paySuccess ? (
                <div className="p-2 rounded-lg bg-emerald-950 text-emerald-300 text-xs text-center">
                  Funds transferred instantly!
                </div>
              ) : (
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPayModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulatePayment}
                    className="px-4 py-1.5 rounded-lg bg-teal-500 text-neutral-950 font-bold text-xs"
                  >
                    Send PayShap
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GuardianLensModal;

