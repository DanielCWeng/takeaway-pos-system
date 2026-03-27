import type { Address } from '../../types';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { X, MapPin } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface AddressSelectionModalProps {
  addresses: Address[];
  onSelect: (address: Address) => void;
  onClose: () => void;
}

export function AddressSelectionModal({ addresses, onSelect, onClose }: AddressSelectionModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
        className="pos-panel flex max-h-[80vh] w-full max-w-lg flex-col shadow-2xl overflow-hidden border-primary/20"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-primary/5">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold tracking-tight">Select Address</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-2">
            {addresses.map((addr, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(addr)}
                className="flex flex-col items-start gap-1 rounded-xl border border-border/40 bg-background p-4 text-left transition-all hover:bg-primary/5 hover:border-primary/30 group active:scale-[0.98]"
              >
                <span className="text-sm font-bold group-hover:text-primary transition-colors">
                  {addr.line1}
                </span>
                {(addr.line2 || addr.town) && (
                  <span className="text-xs text-muted-foreground italic">
                    {[addr.line2, addr.town].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="mt-1 font-mono text-[10px] uppercase tracking-widest opacity-60">
                  {addr.postcode}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 p-4 bg-muted/20">
          <Button variant="outline" className="w-full h-12 text-base" onClick={onClose}>
            None of these
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
