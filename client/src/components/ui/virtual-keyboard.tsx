import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, ArrowUp, CornerDownLeft } from "lucide-react";
import { cn } from "../../lib/utils";

const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

function dispatchKey(key: string, isShift: boolean): "blur" | "shift-off" | "none" {
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
  if (!active || (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA")) return "none";

  const start = active.selectionStart ?? 0;
  const end = active.selectionEnd ?? 0;
  const current = active.value;

  let newVal = current;
  let newCursor = start;

  if (key === "BACKSPACE") {
    if (start === end && start > 0) {
      newVal = current.slice(0, start - 1) + current.slice(start);
      newCursor = start - 1;
    } else if (start !== end) {
      newVal = current.slice(0, start) + current.slice(end);
      newCursor = start;
    }
  } else if (key === "SPACE") {
    newVal = current.slice(0, start) + " " + current.slice(end);
    newCursor = start + 1;
  } else if (key === "ENTER") {
    if (active.tagName === "TEXTAREA") {
      newVal = current.slice(0, start) + "\n" + current.slice(end);
      newCursor = start + 1;
    } else {
      active.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      return "blur";
    }
  } else {
    const char = isShift ? key.toUpperCase() : key;
    newVal = current.slice(0, start) + char + current.slice(end);
    newCursor = start + 1;
  }

  const proto =
    active.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(active, newVal);
  active.dispatchEvent(new Event("input", { bubbles: true }));
  setTimeout(() => active.setSelectionRange(newCursor, newCursor), 0);

  return key !== "BACKSPACE" && key !== "SPACE" && key !== "ENTER" ? "shift-off" : "none";
}

// ─── Exported reusable keyboard panel ───────────────────────────────────────

export function KeyboardPanel({
  compact = false,
  onEnter,
}: {
  compact?: boolean;
  onEnter?: () => void | Promise<void>;
}) {
  const [isShift, setIsShift] = useState(false);

  const handleKey = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (key === "SHIFT") { setIsShift((p) => !p); return; }
    if (key === "ENTER" && onEnter) {
      void onEnter();
      return;
    }
    const result = dispatchKey(key, isShift);
    if (result === "blur") (document.activeElement as HTMLElement)?.blur();
    if (result === "shift-off") setIsShift(false);
  };

  const keyH = compact ? "h-10" : "h-14";
  const keyMin = compact ? "min-w-[42px]" : "min-w-[56px]";
  const keyText = compact ? "text-base" : "text-xl";
  const gap = compact ? "gap-1.5" : "gap-2";
  const pad = compact ? "p-2" : "p-3";

  return (
    <div className={cn("flex items-stretch", gap, pad)}>
      <div className={cn("flex min-w-0 flex-1 flex-col", gap)}>
        <div className={cn("flex justify-center", gap)}>
          {ROWS[0].map((k) => <Key key={k} label={k} onClick={(e) => handleKey(k, e)} keyH={keyH} keyMin={keyMin} keyText={keyText} />)}
        </div>
        <div className={cn("flex justify-center pl-4", gap)}>
          {ROWS[1].map((k) => <Key key={k} label={isShift ? k.toUpperCase() : k} onClick={(e) => handleKey(k, e)} keyH={keyH} keyMin={keyMin} keyText={keyText} />)}
        </div>
        <div className={cn("flex justify-center pr-4", gap)}>
          {ROWS[2].map((k) => <Key key={k} label={isShift ? k.toUpperCase() : k} onClick={(e) => handleKey(k, e)} keyH={keyH} keyMin={keyMin} keyText={keyText} />)}
        </div>
        <div className={cn("flex justify-center", gap)}>
          <Key label="SHIFT" icon={<ArrowUp className={cn(compact ? "h-4 w-4" : "h-6 w-6", isShift && "fill-current")} />} onClick={(e) => handleKey("SHIFT", e)} keyH={keyH} keyMin={keyMin} keyText={keyText} className={cn(compact ? "w-16" : "w-[84px]", "bg-muted/60")} />
          {ROWS[3].map((k) => <Key key={k} label={isShift ? k.toUpperCase() : k} onClick={(e) => handleKey(k, e)} keyH={keyH} keyMin={keyMin} keyText={keyText} />)}
          <Key label="BACKSPACE" icon={<Delete className={compact ? "h-4 w-4" : "h-6 w-6"} />} onClick={(e) => handleKey("BACKSPACE", e)} keyH={keyH} keyMin={keyMin} keyText={keyText} className={cn(compact ? "w-16" : "w-[84px]", "bg-muted/60")} />
        </div>
        <div className={cn("flex justify-center", gap)}>
          <Key label="SPACE" onClick={(e) => handleKey("SPACE", e)} keyH={keyH} keyMin={keyMin} keyText={keyText} className="flex-1 bg-muted/20" />
        </div>
      </div>
      <Key
        label="ENTER"
        icon={<CornerDownLeft className={compact ? "h-10 w-10" : "h-12 w-12"} />}
        onClick={(e) => handleKey("ENTER", e)}
        keyH="h-auto"
        keyMin={keyMin}
        keyText={keyText}
        className={cn(compact ? "w-20" : "w-28", "self-stretch bg-primary text-primary-foreground hover:brightness-110 border-primary shadow-md shadow-primary/30")}
      />
    </div>
  );
}

// ─── Global slide-up keyboard (skips inputs with data-inline-keyboard) ───────

export function VirtualKeyboard() {
  const [isVisible, setIsVisible] = useState(false);
  const keyboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      document.body.classList.add("keyboard-open");
      requestAnimationFrame(() => {
        const h = keyboardRef.current?.offsetHeight ?? 320;
        document.body.style.setProperty("--kb-height", `${h}px`);
      });
    } else {
      document.body.classList.remove("keyboard-open");
      document.body.style.removeProperty("--kb-height");
    }
  }, [isVisible]);

  useEffect(() => {
    let hideTimeout: number;

    const handleFocus = (e: FocusEvent) => {
      clearTimeout(hideTimeout);
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        if (input.readOnly || input.disabled) return;
        if ((target as HTMLElement).dataset.inlineKeyboard) return; // handled inline
        setIsVisible(true);
        setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
      }
    };

    const handleBlur = () => {
      hideTimeout = window.setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA")) {
          setIsVisible(false);
        }
      }, 150);
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      clearTimeout(hideTimeout);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={keyboardRef}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-xl border-t border-border/60 pb-6 shadow-2xl z-[100]"
        >
          <div className="mx-auto max-w-4xl">
            <KeyboardPanel />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Key button ──────────────────────────────────────────────────────────────

function Key({
  label,
  icon,
  onClick,
  className,
  keyH,
  keyMin,
  keyText,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  keyH: string;
  keyMin: string;
  keyText: string;
}) {
  return (
    <button
      onMouseDown={onClick}
      className={cn(
        keyH, keyMin, keyText,
        "px-1 rounded-xl border border-border/80 bg-background shadow-sm hover:bg-muted/50 active:scale-95 active:bg-muted transition-all flex items-center justify-center font-bold uppercase font-mono",
        className,
      )}
    >
      {icon || label}
    </button>
  );
}
