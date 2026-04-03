import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, ArrowUp, CornerDownLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export function VirtualKeyboard() {
  const [isVisible, setIsVisible] = useState(false);
  const [isShift, setIsShift] = useState(false);

  useEffect(() => {
    let hideTimeout: number;

    const handleFocus = (e: FocusEvent) => {
      clearTimeout(hideTimeout);
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        // Ignore disabled or readonly fields
        if (input.readOnly || input.disabled) return;
        
        setIsVisible(true);
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    const handleBlur = () => {
      hideTimeout = window.setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
          setIsVisible(false);
          setIsShift(false);
        }
      }, 150);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      clearTimeout(hideTimeout);
    };
  }, []);

  const handleKey = (key: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevents input from losing focus
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return;

    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    const current = active.value;

    let newVal = current;
    let newCursorOrig = start;
    let keepShift = isShift;

    if (key === 'BACKSPACE') {
      if (start === end && start > 0) {
        newVal = current.slice(0, start - 1) + current.slice(start);
        newCursorOrig = start - 1;
      } else if (start !== end) {
        newVal = current.slice(0, start) + current.slice(end);
        newCursorOrig = start;
      }
    } else if (key === 'SPACE') {
      newVal = current.slice(0, start) + ' ' + current.slice(end);
      newCursorOrig = start + 1;
    } else if (key === 'ENTER') {
      if (active.tagName === 'TEXTAREA') {
        newVal = current.slice(0, start) + '\n' + current.slice(end);
        newCursorOrig = start + 1;
      } else {
        active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        active.blur();
        setIsVisible(false);
        return;
      }
    } else if (key === 'SHIFT') {
      setIsShift(!isShift);
      return;
    } else {
      const char = isShift ? key.toUpperCase() : key;
      newVal = current.slice(0, start) + char + current.slice(end);
      newCursorOrig = start + 1;
      keepShift = false; // Turn off shift after one key press
    }

    const setter = Object.getOwnPropertyDescriptor(
      active.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    
    if (setter) {
        setter.call(active, newVal);
    }

    active.dispatchEvent(new Event('input', { bubbles: true }));

    setTimeout(() => {
      active.setSelectionRange(newCursorOrig, newCursorOrig);
    }, 0);
    
    setIsShift(keepShift);
  };

  const rows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm']
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-xl border-t border-border/60 p-3 pb-6 shadow-2xl z-[100]"
        >
          <div className="mx-auto max-w-4xl flex flex-col gap-2">
            <div className="flex gap-2 justify-center">
              {rows[0].map((k) => (
                <Key key={k} label={k} onClick={(e) => handleKey(k, e)} />
              ))}
            </div>
            <div className="flex gap-2 justify-center pl-6">
              {rows[1].map((k) => (
                <Key key={k} label={isShift ? k.toUpperCase() : k} onClick={(e) => handleKey(k, e)} />
              ))}
            </div>
            <div className="flex gap-2 justify-center pr-6">
              {rows[2].map((k) => (
                <Key key={k} label={isShift ? k.toUpperCase() : k} onClick={(e) => handleKey(k, e)} />
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <Key label="SHIFT" icon={<ArrowUp className={cn("h-6 w-6", isShift && "fill-current")} />} onClick={(e) => handleKey('SHIFT', e)} className="w-[84px] bg-muted/60" />
              {rows[3].map((k) => (
                <Key key={k} label={isShift ? k.toUpperCase() : k} onClick={(e) => handleKey(k, e)} />
              ))}
              <Key label="BACKSPACE" icon={<Delete className="h-6 w-6" />} onClick={(e) => handleKey('BACKSPACE', e)} className="w-[84px] bg-muted/60" />
            </div>
            <div className="flex gap-2 justify-center">
              <Key label="SPACE" className="w-[60%] max-w-lg bg-muted/20" onClick={(e) => handleKey('SPACE', e)} />
              <Key label="ENTER" icon={<CornerDownLeft className="h-6 w-6" />} onClick={(e) => handleKey('ENTER', e)} className="w-[120px] bg-primary/10 hover:bg-primary/20 text-primary border-primary/20" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Key({ 
  label, 
  icon, 
  onClick, 
  className 
}: { 
  label: string; 
  icon?: React.ReactNode; 
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      onMouseDown={onClick}
      className={cn(
        "h-14 min-w-[56px] px-2 rounded-xl border border-border/80 bg-background shadow-sm hover:bg-muted/50 active:scale-95 active:bg-muted transition-all flex items-center justify-center font-bold text-xl uppercase font-mono",
        className
      )}
    >
      {icon || label}
    </button>
  );
}
