'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, ShieldCheck, Sun, FileText, CheckCircle2
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface UVBlacklightInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  receiptNumber?: string;
}

export function UVBlacklightInspectorModal({
  isOpen,
  onClose,
  documentTitle = 'SARS Official Rental Payment Certificate',
  receiptNumber = 'RES-TAX-2026-09-8492'
}: UVBlacklightInspectorModalProps) {
  const [torchPos, setTorchPos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  if (!isOpen) return null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTorchPos({ x, y });
    setIsHovering(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-neutral-950 border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-glow">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Digital 395nm UV Blacklight Inspector</h3>
                <p className="text-xs text-gray-400">Drag cursor/finger to reveal fluorescent anti-forgery watermarks</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Interactive UV Document Stage */}
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setIsHovering(false)}
            className="relative aspect-[4/3] rounded-3xl bg-neutral-900 border border-white/20 p-6 flex flex-col justify-between overflow-hidden cursor-crosshair select-none"
          >
            {/* Standard Visible Document Layer */}
            <div className="space-y-3 font-mono text-xs text-gray-300 relative z-10">
              <div className="border-b border-white/10 pb-2 flex justify-between">
                <div>
                  <span className="text-[10px] text-gold-primary font-bold block uppercase">REPUBLIC OF SOUTH AFRICA</span>
                  <p className="font-bold text-white text-sm">{documentTitle}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500">CERTIFICATE NO:</span>
                  <p className="font-bold text-gold-primary">{receiptNumber}</p>
                </div>
              </div>

              <div className="space-y-1 text-[11px]">
                <p>Status: <strong>SETTLED VIA PAYSHAP ESCROW</strong></p>
                <p>Tax Act Compliance: <strong>Income Tax Act 58 of 1962</strong></p>
                <p>Certified Residuary: <strong>145 Jorissen Street, Braamfontein</strong></p>
              </div>
            </div>

            {/* Hidden UV Reactive Guilloche & Watermark Layer revealed by torch light */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
              style={{
                background: `radial-gradient(circle 120px at ${torchPos.x}% ${torchPos.y}%, rgba(168, 85, 247, 0.45) 0%, rgba(99, 102, 241, 0.25) 50%, transparent 100%)`,
                opacity: isHovering ? 1 : 0
              }}
            >
              {/* Glowing Fluorescent Security Crest */}
              <div
                className="absolute inset-0 flex items-center justify-center font-mono font-black text-2xl text-purple-300 opacity-60 tracking-widest uppercase pointer-events-none"
                style={{ textShadow: '0 0 12px #c084fc, 0 0 25px #a855f7' }}
              >
                ★ THE RESIDENT AUTHENTIC SECURE LEDGER ★
              </div>
            </div>

            {/* Footer stamp inside document */}
            <div className="relative z-10 flex items-center justify-between text-[10px] text-gray-500 border-t border-white/10 pt-2 font-mono">
              <span>SHA-256: e8c5970•bakkie•verified</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck size={12} /> Tamper Seal Intact
              </span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-400">
            Hover over the certificate to simulate 395nm UV excitation revealing cryptographic ink.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default UVBlacklightInspectorModal;
