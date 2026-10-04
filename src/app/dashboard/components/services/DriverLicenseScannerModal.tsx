'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, CheckCircle2, ScanLine, X
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface DriverLicenseScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified?: (data: { driverName: string; discExpiry: string; vehicleVin: string }) => void
}

export default function DriverLicenseScannerModal({
  isOpen,
  onClose,
  onVerified
}: DriverLicenseScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedData, setScannedData] = useState<{
    driverName: string
    vehicleVin: string
    licensePlate: string
    pdpValid: boolean
    discExpiry: string
  } | null>(null)

  if (!isOpen) return null

  const handleStartScan = () => {
    playTactileSound('pop')
    setIsScanning(true)
    setTimeout(() => {
      setIsScanning(false)
      playTactileSound('success')
      const mockResult = {
        driverName: 'Siphamandla Radebe',
        vehicleVin: 'AHTBB3CD609••••14',
        licensePlate: 'CA 729-411',
        pdpValid: true,
        discExpiry: '30 November 2027'
      }
      setScannedData(mockResult)
      if (onVerified) onVerified(mockResult)
    }, 2500)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-[var(--card-bg,rgba(11,43,38,0.98))] border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <ScanLine size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">NATIS Vehicle & Driver Verification</h3>
                <p className="text-xs text-gray-400">Scan South African License Disc & PDP Permit</p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scanner Viewport */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-gold-primary/40 bg-black flex flex-col items-center justify-center p-6 text-center shadow-inner">
            {isScanning ? (
              <div className="space-y-3 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full border-4 border-gold-primary border-t-transparent animate-spin flex items-center justify-center" />
                <p className="text-xs font-black text-gold-primary uppercase tracking-widest animate-pulse">
                  Decoding NATIS 2D Barcode & PDP Disc...
                </p>
                <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-[0_0_15px_red] animate-bounce" />
              </div>
            ) : scannedData ? (
              <div className="space-y-3 w-full bg-black/60 p-4 rounded-2xl border border-emerald-500/30 text-left font-mono text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold pb-2 border-b border-white/10">
                  <CheckCircle2 size={16} />
                  <span>NATIS VERIFIED DRIVER & VEHICLE</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                  <div>
                    <span className="text-gray-500 uppercase text-[9px] block">Driver:</span>
                    <strong className="text-white">{scannedData.driverName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase text-[9px] block">License Plate:</span>
                    <strong className="text-gold-primary">{scannedData.licensePlate}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase text-[9px] block">PDP Permit Status:</span>
                    <strong className="text-emerald-400">Valid Goods & Passenger</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase text-[9px] block">Disc Expiry:</span>
                    <strong className="text-white">{scannedData.discExpiry}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex flex-col items-center">
                <Camera size={36} className="text-gold-primary animate-pulse" />
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-wider">Point Camera at Vehicle Disc</p>
                  <p className="text-xs text-gray-400 max-w-xs mt-1">
                    Align the circular disc on the lower-left windscreen within the frame.
                  </p>
                </div>
                <button
                  onClick={handleStartScan}
                  className="px-6 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all"
                >
                  Start Barcode Scan
                </button>
              </div>
            )}
          </div>

          {/* Action button */}
          {scannedData && (
            <button
              onClick={() => {
                playTactileSound('chime')
                alert('Vehicle registered to driver profile with verified passenger insurance.')
                onClose()
              }}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all"
            >
              Confirm & Attach Verified Driver Badge
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
