'use client';

import React, { useState } from 'react';
import { 
  BookOpen, 
  X, 
  Barcode, 
  Search, 
  Camera, 
  MessageCircle 
} from 'lucide-react';

interface Textbook {
  id: string;
  isbn: string;
  title: string;
  authors: string;
  faculty: string;
  edition: string;
  campusStorePriceZAR: number;
  peerPriceZAR: number;
  condition: 'Like New' | 'Good (Mild Highlights)' | 'Acceptable';
  sellerName: string;
  sellerRes: string;
}

const CATALOG_TEXTBOOKS: Textbook[] = [
  {
    id: 'tb1',
    isbn: '9780190746821',
    title: 'The Law of Property in South Africa',
    authors: 'Mostert & Pope',
    faculty: 'Law & Jurisprudence',
    edition: '3rd Edition (2024)',
    campusStorePriceZAR: 790,
    peerPriceZAR: 320,
    condition: 'Like New',
    sellerName: 'Karabo M.',
    sellerRes: 'South Point Braamfontein'
  },
  {
    id: 'tb2',
    isbn: '9781485130826',
    title: 'Commercial Law: Fresh Perspectives',
    authors: 'Govindjee, Van der Walt et al.',
    faculty: 'Commerce & Accounting',
    edition: '4th Edition',
    campusStorePriceZAR: 680,
    peerPriceZAR: 250,
    condition: 'Good (Mild Highlights)',
    sellerName: 'Dineo S.',
    sellerRes: 'Auckland Park Kingsway'
  },
  {
    id: 'tb3',
    isbn: '9780190748986',
    title: 'Economics for South African Students',
    authors: 'Philip Mohr & Fourie',
    faculty: 'Economics & Management',
    edition: '6th Edition',
    campusStorePriceZAR: 840,
    peerPriceZAR: 360,
    condition: 'Like New',
    sellerName: 'Jacques P.',
    sellerRes: 'Hatfield Studios Pretoria'
  }
];

interface TextbookScannerExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSeller?: (textbook: Textbook) => void;
}

export function TextbookScannerExchangeModal({
  isOpen,
  onClose,
  onContactSeller
}: TextbookScannerExchangeModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('All');
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);
  const [scannedResult, setScannedResult] = useState<Textbook | null>(null);
  const books = CATALOG_TEXTBOOKS;

  if (!isOpen) return null;

  const handleSimulateScan = () => {
    setIsSimulatingScan(true);
    setTimeout(() => {
      setIsSimulatingScan(false);
      setScannedResult(CATALOG_TEXTBOOKS[0]);
    }, 1200);
  };

  const faculties = ['All', 'Law & Jurisprudence', 'Commerce & Accounting', 'Economics & Management'];

  const filtered = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.isbn.includes(searchQuery);
    const matchesFaculty = selectedFaculty === 'All' || b.faculty === selectedFaculty;
    return matchesSearch && matchesFaculty;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-sky-500/30 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <BookOpen className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  Campus Textbook Scanner & Swap
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  Save ~65%
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Scan ISBN barcodes to trade, buy, or resell prescribed textbooks directly with students in your res.
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

        {/* Scan Barcode Simulator */}
        <div className="mt-6 p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-neutral-200">ISBN Barcode Optical Scanner</div>
              <div className="text-neutral-400">Point phone camera at the back cover barcode</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSimulateScan}
            disabled={isSimulatingScan}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-neutral-950 font-bold text-xs hover:bg-sky-400 disabled:opacity-50 transition"
          >
            <Camera className="w-4 h-4" />
            <span>{isSimulatingScan ? 'Decoding Barcode...' : 'Scan Book Cover'}</span>
          </button>
        </div>

        {scannedResult && (
          <div className="mt-4 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-xs text-sky-300">
            <span>Scanned: <strong>{scannedResult.title}</strong> (ISBN {scannedResult.isbn})</span>
            <button type="button" onClick={() => setScannedResult(null)} className="text-sky-400 hover:text-white font-bold ml-2">Clear</button>
          </div>
        )}

        {/* Search & Faculty Filters */}
        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search title, author or 13-digit ISBN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {faculties.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFaculty(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  selectedFaculty === f
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                    : 'bg-neutral-800/60 text-neutral-400 border border-neutral-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Textbooks List */}
        <div className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {filtered.map(book => {
            const savingsPercent = Math.round(
              ((book.campusStorePriceZAR - book.peerPriceZAR) / book.campusStorePriceZAR) * 100
            );

            return (
              <div
                key={book.id}
                className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-100">{book.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                      {book.edition}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">By {book.authors} • ISBN: {book.isbn}</p>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-400 pt-1">
                    <span className="text-emerald-400 font-medium">Condition: {book.condition}</span>
                    <span>•</span>
                    <span>Seller: {book.sellerName} ({book.sellerRes})</span>
                  </div>
                </div>

                <div className="flex items-center sm:flex-col items-end justify-between w-full sm:w-auto gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <span className="text-base font-bold text-sky-400">R{book.peerPriceZAR}</span>
                      <span className="text-xs text-neutral-500 line-through">R{book.campusStorePriceZAR}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-400">Save {savingsPercent}%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onContactSeller) onContactSeller(book);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 font-semibold text-xs hover:bg-sky-500/30 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat & Swap</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-400">
          <span>Peer-to-peer textbook handovers are safe in res common study rooms.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TextbookScannerExchangeModal;

