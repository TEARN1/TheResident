'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Download, X, Calendar, Clock, CheckCircle2, Search, FileText
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface PastPaper {
  id: string;
  courseCode: string;
  courseTitle: string;
  year: string;
  faculty: string;
  downloads: number;
}

const PAPERS: PastPaper[] = [
  { id: 'p1', courseCode: 'LAWS1002', courseTitle: 'Law of Persons & Family', year: '2025 Mid-Year Exam', faculty: 'Law', downloads: 84 },
  { id: 'p2', courseCode: 'ACCN2001', courseTitle: 'Financial Accounting II', year: '2025 Final Exam', faculty: 'Commerce', downloads: 142 },
  { id: 'p3', courseCode: 'ECON1001', courseTitle: 'Microeconomics I', year: '2024 Final Exam', faculty: 'Commerce', downloads: 98 }
];

interface PastPapersVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PastPapersVaultModal({ isOpen, onClose }: PastPapersVaultModalProps) {
  const [papers] = useState<PastPaper[]>(PAPERS);
  const [activeTab, setActiveTab] = useState<'Papers' | 'StudyRooms'>('Papers');
  const [studyRoomBooked, setStudyRoomBooked] = useState(false);

  if (!isOpen) return null;

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
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Faculty Exam Vault & Study Rooms</h3>
                <p className="text-xs text-gray-400">Peer past paper archives & quiet room bookings</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 text-xs">
            {(['Papers', 'StudyRooms'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { playTactileSound('tab'); setActiveTab(tab); }}
                className={`px-4 py-2 rounded-xl font-bold transition ${
                  activeTab === tab
                    ? 'bg-gold-primary text-black'
                    : 'bg-neutral-900 border border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'Papers' ? 'Exam Papers Archive' : 'Book Study Rooms'}
              </button>
            ))}
          </div>

          {activeTab === 'Papers' ? (
            <div className="space-y-3">
              {papers.map(p => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between gap-3 hover:border-indigo-500/40 transition"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{p.courseCode}</span>
                      <span className="text-gray-400 font-normal">({p.courseTitle})</span>
                    </span>
                    <p className="text-[10px] text-indigo-400 font-mono">{p.year} • {p.downloads} peer downloads</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => { playTactileSound('chime'); alert(`Downloading ${p.courseCode} official memo & paper PDF.`); }}
                    className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition"
                    title="Download Exam PDF"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-neutral-900 border border-white/10 space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-white">Quiet Study Room 2B (With Inverter Backup)</h4>
                  <p className="text-gray-400 text-[11px]">Capacity: 6 Students • Backup Wi-Fi Operational</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Open Slot
                </span>
              </div>

              <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] text-gray-400 block font-mono">RESERVATION WINDOW:</span>
                <p className="text-white font-bold">Today: 18:00 - 22:00 (Exam Quiet Hours)</p>
              </div>

              <button
                type="button"
                onClick={() => { playTactileSound('chime'); setStudyRoomBooked(true); }}
                className="w-full py-2.5 rounded-xl bg-gold-primary text-black font-black uppercase text-xs hover:bg-gold-secondary transition"
              >
                {studyRoomBooked ? 'Room Reserved! (PIN: 8492)' : 'Reserve Study Pod for Group'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PastPapersVaultModal;
