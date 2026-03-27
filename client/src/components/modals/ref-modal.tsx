import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { Button } from '../ui/button';
import type { MenuItem } from '../../types';

interface RefModalProps {
  menuItems: MenuItem[];
  onSelect: (item: MenuItem) => void;
  onClose: () => void;
}

export function RefModal({ menuItems, onSelect, onClose }: RefModalProps) {
  const [ref, setRef] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ref.trim()) return;

    const matchedItem = menuItems.find(
      (item) => item.id.toLowerCase() === ref.toLowerCase()
    );

    if (matchedItem) {
      onSelect(matchedItem);
      onClose();
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0,
          x: error ? [0, -10, 10, -10, 10, 0] : 0
        }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ 
          duration: 0.2,
          x: { duration: 0.4, ease: "easeInOut" }
        }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-white/90">
            <Search className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Item Lookup (REF)</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={ref}
                onChange={(e) => {
                  setRef(e.target.value);
                  setError(false);
                }}
                placeholder="Enter ID (e.g. 12, 12A, HM1)"
                className={`w-full h-14 bg-white/[0.03] border ${
                  error ? 'border-red-500/50 ring-2 ring-red-500/10' : 'border-white/10'
                } rounded-xl px-4 text-2xl font-mono text-center text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all uppercase`}
              />
              {error && (
                <p className="absolute -bottom-6 left-0 w-full text-center text-xs font-medium text-red-500/80 animate-pulse">
                  Invalid Reference ID
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="h-12 border-white/5 bg-white/[0.05] hover:bg-white/[0.1] text-white/70"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-12 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Add Item
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
