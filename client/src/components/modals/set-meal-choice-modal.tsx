import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { MenuContent } from '../../types';

interface SetMealChoiceModalProps {
  choice: MenuContent;
  onConfirm: (selections: string[]) => void;
  onClose: () => void;
}

export function SetMealChoiceModal({ choice, onConfirm, onClose }: SetMealChoiceModalProps) {
  const [selections, setSelections] = useState<string[]>([]);
  
  // Extract required count from description (e.g., "Choose 2 Soups" -> 2)
  const requiredCount = parseInt(choice.description?.match(/\d+/)?.[0] || '1', 10);

  const addSelection = (option: string) => {
    if (selections.length < requiredCount) {
      setSelections(prev => [...prev, option]);
    }
  };

  const removeSelection = (index: number) => {
    setSelections(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (selections.length === requiredCount) {
      onConfirm(selections);
    }
  };

  const isComplete = selections.length === requiredCount;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-white/[0.02]">
          <div>
            <h2 className="text-lg font-bold text-white/90">{choice.description || 'Make a Selection'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select {requiredCount} item{requiredCount > 1 ? 's' : ''} to continue
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Active Selections Summary */}
          {requiredCount > 1 && (
            <div className="mb-6 rounded-2xl bg-white/[0.02] border border-white/5 p-4">
              <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Your Selections</h3>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {Array.from({ length: requiredCount }).map((_, i) => (
                  <div 
                    key={i}
                    onClick={() => removeSelection(i)}
                    className={cn(
                      "h-10 px-4 rounded-xl border flex items-center justify-between gap-2 transition-all group cursor-pointer",
                      selections[i] 
                        ? "bg-primary/20 border-primary/30 text-primary-foreground" 
                        : "bg-white/[0.05] border-white/5 border-dashed text-white/20"
                    )}
                  >
                    <span className="text-xs font-medium">
                      {selections[i] || 'Empty Slot'}
                    </span>
                    {selections[i] && <X className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5">
            {choice.options?.map((option) => {
              const count = selections.filter(s => s === option).length;
              return (
                <button
                  key={option}
                  onClick={() => addSelection(option)}
                  disabled={selections.length >= requiredCount}
                  className={cn(
                    "relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group",
                    count > 0 
                      ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]" 
                      : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    count > 0 ? "text-primary-foreground" : "text-white/70 group-hover:text-white/90"
                  )}>
                    {option}
                  </span>
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border transition-all font-mono text-sm font-bold",
                    count > 0 
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "border-white/20 bg-transparent text-white/20"
                  )}>
                    {count > 0 ? count : '+'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <div className="text-xs font-mono text-muted-foreground bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
              {selections.length} / {requiredCount} SELECTED
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={onClose}
                className="h-11 px-6 border-white/5 bg-white/[0.05]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!isComplete}
                className={cn(
                  "h-11 px-8 bg-primary text-primary-foreground font-bold transition-all",
                  isComplete ? "shadow-lg shadow-primary/25 hover:scale-105" : "opacity-50 grayscale cursor-not-allowed"
                )}
              >
                Confirm Selection
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
