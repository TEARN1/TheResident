'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Camera
} from 'lucide-react';

interface Milestone {
  id: string;
  name: string;
  percentage: number;
  amountZAR: number;
  condition: string;
  status: 'locked' | 'awaiting_approval' | 'released';
  proofUrl?: string;
}

interface HandymanMilestoneEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle?: string;
  artisanName?: string;
  totalQuoteZAR?: number;
}

export function HandymanMilestoneEscrowModal({
  isOpen,
  onClose,
  jobTitle = 'Bathroom Tile Replacement & Geyser Valve Overhaul',
  artisanName = 'Bongani Sithole (PIRB Certified)',
  totalQuoteZAR = 3200
}: HandymanMilestoneEscrowModalProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([
    {
      id: 'm1',
      name: 'Phase 1: Materials & Consumables Down Payment',
      percentage: 30,
      amountZAR: Math.round(totalQuoteZAR * 0.3),
      condition: 'Released when artisan uploads hardware store receipts and arrives on site.',
      status: 'released',
      proofUrl: 'Receipt: Builders Warehouse (R960.00)'
    },
    {
      id: 'm2',
      name: 'Phase 2: Rough-in Installation & Halfway Check',
      percentage: 40,
      amountZAR: Math.round(totalQuoteZAR * 0.4),
      condition: 'Released after tile laying or valve plumbing is mounted and leak-tested.',
      status: 'awaiting_approval',
      proofUrl: 'Photo proof submitted: High-pressure valve secured'
    },
    {
      id: 'm3',
      name: 'Phase 3: Final Sign-off & 48-Hour Snag Guarantee',
      percentage: 30,
      amountZAR: Math.round(totalQuoteZAR * 0.3),
      condition: 'Released 48 hours after full cleanup if no leaks or defects are reported.',
      status: 'locked'
    }
  ]);

  const [disputeActive, setDisputeActive] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApproveMilestone = (id: string) => {
    setMilestones(prev =>
      prev.map(m => {
        if (m.id === id) {
          return { ...m, status: 'released' };
        }
        return m;
      })
    );
    setSuccessMsg('Milestone released directly to artisan PayShap wallet.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleDispute = () => {
    setDisputeActive(true);
    setSuccessMsg('Escrow frozen. An independent TheResident Trade Arbitrator has been assigned.');
  };

  const totalLocked = milestones
    .filter(m => m.status !== 'released')
    .reduce((sum, m) => sum + m.amountZAR, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Trade Milestone Escrow Vault
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Protected Escrow
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Funds are held securely by TheResident and only released as tangible job milestones are reached.
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

        {/* Job & Artisan summary */}
        <div className="mt-6 p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-neutral-400">Assigned Artisan</div>
            <div className="text-sm font-bold text-neutral-200">{artisanName}</div>
            <div className="text-xs text-neutral-400 mt-0.5">{jobTitle}</div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs text-neutral-400">Total Contract Value</div>
            <div className="text-lg font-bold text-amber-400">R{totalQuoteZAR}</div>
            <div className="text-[11px] text-emerald-400">R{totalLocked} currently safeguarded</div>
          </div>
        </div>

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {disputeActive && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Job Dispute Opened. Case #TRD-8891. Funds are locked pending mediator review.</span>
          </div>
        )}

        {/* Milestone Steps */}
        <div className="mt-6 space-y-4">
          <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Job Release Milestones (3-Stage Verification)
          </div>

          <div className="space-y-3">
            {milestones.map((m) => {
              const isDone = m.status === 'released';
              const isWaiting = m.status === 'awaiting_approval';
              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border transition ${
                    isDone
                      ? 'bg-emerald-950/10 border-emerald-500/30'
                      : isWaiting
                      ? 'bg-amber-950/20 border-amber-500/50'
                      : 'bg-neutral-800/30 border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-200">{m.name}</span>
                        {isDone && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            RELEASED
                          </span>
                        )}
                        {isWaiting && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            READY FOR SIGN-OFF
                          </span>
                        )}
                        {m.status === 'locked' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                            PENDING NEXT STAGE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">{m.condition}</p>

                      {m.proofUrl && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 pt-1">
                          <Camera className="w-3.5 h-3.5" />
                          <span>{m.proofUrl}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-neutral-100">R{m.amountZAR}</div>
                      <div className="text-[10px] text-neutral-400">{m.percentage}% of total</div>

                      {isWaiting && !disputeActive && (
                        <button
                          type="button"
                          onClick={() => handleApproveMilestone(m.id)}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-500 text-neutral-950 font-bold text-xs hover:bg-emerald-400 transition"
                        >
                          Approve Release
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Protection Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>48-Hour Snag Warranty holds Phase 3 until you test all repairs.</span>
          </div>

          {!disputeActive ? (
            <button
              type="button"
              onClick={handleDispute}
              className="text-xs text-rose-400 hover:text-rose-300 underline transition"
            >
              Report Workmanship Snag / Freeze Escrow
            </button>
          ) : (
            <span className="text-xs text-rose-400 font-semibold">Arbitration Pending</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default HandymanMilestoneEscrowModal;
