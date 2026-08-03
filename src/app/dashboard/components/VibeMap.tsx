'use client'

import React from 'react'
import { Navigation, Map as MapIcon, Layers, Maximize, User } from 'lucide-react'

export default function VibeMap() {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-8">
           <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                 <Navigation size={24} className="text-gold-primary" /> VibeMap™ Real-time Local Intelligence
              </h3>
              <p className="text-gray-500 text-sm mt-1">Heatmaps of community activity, safety events, and local vibes.</p>
           </div>
           <div className="flex gap-2">
              <button className="bg-white/5 p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all"><Layers size={20}/></button>
              <button className="bg-white/5 p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all"><Maximize size={20}/></button>
           </div>
        </div>

        <div className="aspect-video bg-gray-900 rounded-2xl relative overflow-hidden border border-white/5 flex items-center justify-center group">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center opacity-30 grayscale contrast-125" />
           <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

           {/* Mock Markers */}
           <div className="absolute top-1/4 left-1/3 w-4 h-4 bg-gold-primary rounded-full shadow-[0_0_15px_#D4AF37] animate-pulse" />
           <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_#ef4444]" />
           <div className="absolute top-1/2 right-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_15px_#3b82f6] animate-bounce" />

           <div className="z-10 text-center space-y-4">
              <div className="p-4 bg-black/80 backdrop-blur-md border border-gold-primary/20 rounded-2xl shadow-2xl">
                 <Navigation size={32} className="text-gold-primary mx-auto mb-2" />
                 <h4 className="font-bold text-white">VibeMap Interactive Engine</h4>
                 <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Live Data Stream Active</p>
              </div>
           </div>

           {/* Legend */}
           <div className="absolute bottom-4 left-4 p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                 <div className="w-2 h-2 bg-gold-primary rounded-full" /> Verified Rooms
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                 <div className="w-2 h-2 bg-red-500 rounded-full" /> Safety Incidents
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                 <div className="w-2 h-2 bg-blue-500 rounded-full" /> Community Events
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
           <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Local Vibe Index</p>
              <p className="text-lg font-bold text-white">CHILL (4.2/5)</p>
           </div>
           <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Active Residents</p>
              <p className="text-lg font-bold text-white">1,240 ONLINE</p>
           </div>
           <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Nearby Hazards</p>
              <p className="text-lg font-bold text-red-500">NONE DETECTED</p>
           </div>
        </div>
      </div>
    </div>
  )
}
