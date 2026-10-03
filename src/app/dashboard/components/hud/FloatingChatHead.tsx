'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, X, Send, User, ChevronDown
} from 'lucide-react';
import { playTactileSound } from '../../../../utils/tactileSounds';

interface FloatingChatHeadProps {
  recipientName?: string;
  recipientRole?: string;
  avatarLetter?: string;
}

export function FloatingChatHead({
  recipientName = 'Tshepo (Bakkie Driver)',
  recipientRole = 'En route • 4.2 km away',
  avatarLetter = 'T'
}: FloatingChatHeadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'driver'; text: string; time: string }>>([
    { sender: 'driver', text: 'Sharp sharp! I am at the main gate. Is it Floor 3?', time: '14:20' },
    { sender: 'user', text: 'Yes, Unit 304, taking the lift down now.', time: '14:21' }
  ]);
  const [inputValue, setInputValue] = useState('');

  const toggleOpen = () => {
    playTactileSound('pop');
    setIsOpen(!isOpen);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    playTactileSound('click');
    setMessages(prev => [
      ...prev,
      {
        sender: 'user',
        text: inputValue.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setInputValue('');
  };

  return (
    <div className="fixed bottom-20 right-5 z-[150]">
      {/* Floating Minimized Avatar Orb */}
      {!isOpen ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={toggleOpen}
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-gold-primary to-amber-500 p-0.5 border-2 border-white/20 flex items-center justify-center transition-all cursor-pointer group"
          title={`Chat with ${recipientName}`}
        >
          <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center text-gold-primary font-black text-lg">
            {avatarLetter}
          </div>
          {/* Online Radar Pulse */}
          <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-black" />
          <span className="absolute -bottom-1 px-1.5 py-0.2 rounded-full bg-black/90 border border-gold-primary/40 text-[9px] text-white font-mono font-bold">
            Live
          </span>
        </motion.button>
      ) : (
        /* Expanded Floating Chat Drawer */
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-80 sm:w-96 bg-neutral-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-3.5 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gold-primary text-black font-black flex items-center justify-center text-xs">
                {avatarLetter}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white line-clamp-1">{recipientName}</h4>
                <p className="text-[10px] text-emerald-400 font-medium">{recipientRole}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleOpen}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
                title="Minimize chat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="p-3.5 h-64 overflow-y-auto space-y-2.5 text-xs">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-2.5 rounded-2xl max-w-[85%] ${
                    msg.sender === 'user'
                      ? 'bg-gold-primary text-black font-medium rounded-tr-none'
                      : 'bg-neutral-800 text-gray-200 rounded-tl-none border border-white/10'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-gray-500 mt-0.5 px-1">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-2 bg-neutral-900 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Message driver..."
              className="flex-1 bg-neutral-800/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-primary/50"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-gold-primary text-black hover:bg-gold-secondary transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}

export default FloatingChatHead;
