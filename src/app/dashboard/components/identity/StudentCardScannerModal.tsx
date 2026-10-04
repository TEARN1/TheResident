'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Camera, CheckCircle2, X, ShieldCheck, Scan, RefreshCw
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface StudentCardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified?: (data: { studentNumber: string; institution: string; status: string }) => void;
}

export function StudentCardScannerModal({
  isOpen,
  onClose,
  onVerified
}: StudentCardScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<{
    studentNumber: string;
    studentName: string;
    institution: string;
    faculty: string;
    status: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSimulateScan = () => {
    playTactileSound('pop');
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const data = {
        studentNumber: '219084721',
        studentName: 'Lerato Khumalo',
        institution: 'University of the Witwatersrand (Wits)',
        faculty: 'Faculty of Commerce, Law & Management',
        status: 'Active Registered Student 2026'
      };
      setScannedData(data);
      playTactileSound('chime');
      if (onVerified) onVerified(data);
    }, 1500);
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
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300 shadow-glow">
                <GraduationCap size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Student Card Hologram OCR</h3>
                <p className="text-xs text-gray-400">Scan student card to unlock student-only pricing</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scanner Optical Viewfinder */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/15 bg-black flex items-center justify-center">
            {/* Background card mockup */}
            <div className="relative w-64 h-40 rounded-2xl bg-gradient-to-tr from-sky-900 to-indigo-950 border-2 border-white/20 p-4 flex flex-col justify-between shadow-2xl">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-300">Wits University</span>
                <span className="text-[9px] font-mono text-gray-300">2026</span>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">Lerato Khumalo</p>
                <p className="text-[10px] font-mono text-sky-200">NO: 219084721</p>
              </div>
              <div className="h-2 w-full bg-sky-400/30 rounded" />
            </div>

            {/* Scanning Laser Line */}
            {isScanning && (
              <motion.div
                className="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee]"
                initial={{ top: '15%' }}
                animate={{ top: '85%' }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>

          {/* Scanned Result Card */}
          {scannedData ? (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> {scannedData.institution}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">Verified</span>
              </div>
              <p className="text-white font-bold">{scannedData.studentName} • {scannedData.studentNumber}</p>
              <p className="text-gray-400 text-[11px]">{scannedData.faculty}</p>
            </div>
          ) : (
            <button
              type="button"
              disabled={isScanning}
              onClick={handleSimulateScan}
              className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black uppercase text-xs tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Camera size={16} />
              <span>{isScanning ? 'Verifying Optical Hologram...' : 'Scan Front of Student Card'}</span>
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default StudentCardScannerModal;
