'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, X, ShieldCheck, CheckCircle2, Key, Clock, Building
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface ArrivedParcel {
  id: string;
  trackingNumber: string;
  courierName: string;
  recipientRoom: string;
  receivedAt: string;
  collectionOtp: string;
  isCollected: boolean;
}

const PARCEL_LIST: ArrivedParcel[] = [
  { id: 'p1', trackingNumber: 'TAL-8492019-ZAF', courierName: 'Takealot Logistics', recipientRoom: 'Room 304', receivedAt: '13:42 Today', collectionOtp: '7492', isCollected: false },
  { id: 'p2', trackingNumber: 'RAM-91823-JHB', courierName: 'RAM Couriers', recipientRoom: 'Room 304', receivedAt: 'Yesterday', collectionOtp: '1184', isCollected: true }
];

interface GatekeeperParcelSafeModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentRoom?: string;
}

export function GatekeeperParcelSafeModal({
  isOpen,
  onClose,
  residentRoom = 'Room 304'
}: GatekeeperParcelSafeModalProps) {
  const [parcels] = useState<ArrivedParcel[]>(PARCEL_LIST);

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
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-glow">
                <Package size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Gatekeeper Parcel Safe</h3>
                <p className="text-xs text-gray-400">Security Guard Lockbox & OTP Collection Portal</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Arrived Parcels List */}
          <div className="space-y-3">
            {parcels.map(p => (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  !p.isCollected
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-neutral-900 border-white/10 opacity-70'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{p.courierName}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{p.trackingNumber}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono">Logged at Guardhouse: {p.receivedAt}</p>
                </div>

                {!p.isCollected ? (
                  <div className="text-right">
                    <span className="text-[9px] text-gray-400 uppercase font-black block">Collection OTP</span>
                    <span className="text-lg font-black font-mono text-gold-primary tracking-widest bg-black/60 px-3 py-1 rounded-xl border border-gold-primary/40">
                      {p.collectionOtp}
                    </span>
                  </div>
                ) : (
                  <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 font-mono">
                    <CheckCircle2 size={13} /> Collected
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 bg-black/60 rounded-2xl border border-white/10 text-center text-xs text-gray-400 font-mono">
            Show your 4-digit collection OTP to security officer at gate to claim parcel.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default GatekeeperParcelSafeModal;
