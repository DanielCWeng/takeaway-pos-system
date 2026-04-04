import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { MenuItem } from "../../types";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";

interface ItemOptionsModalProps {
  item: MenuItem;
  onConfirm: (finalizedItem: {
    name: string | { en: string; zh: string };
    price: number;
  }) => void;
  onClose: () => void;
}

const OPTION_TRANSLATIONS: Record<string, string> = {
  // Sizes / Portions
  Small: "小",
  Large: "大",
  Quarter: "1/4",
  Half: "半",
  Whole: "全",
  Chips: "条",
  "Egg Fried Rice": "炒饭",
  "Boiled Rice": "白饭",
};

function translateOption(opt: string): string {
  // If the option has a known translation, use it. Otherwise fallback to the English string.
  return OPTION_TRANSLATIONS[opt] || opt;
}

export function ItemOptionsModal({
  item,
  onConfirm,
  onClose,
}: ItemOptionsModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    const initialSelections: Record<string, string> = {};
    if (item.options?.length) {
      initialSelections["main"] = item.options[0].name;
    }
    item.contents?.forEach((content) => {
      if (
        content.type === "choice" &&
        content.options?.length &&
        content.description
      ) {
        initialSelections[content.description] = content.options[0];
      }
    });
    // Intentional reset when item changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelections(initialSelections);
  }, [item]);

  const handleSelectionChange = (group: string, value: string) => {
    setSelections((prev) => ({ ...prev, [group]: value }));
  };

  const handleConfirm = () => {
    const selectionValues = Object.values(selections);
    const suffixEn =
      selectionValues.length > 0 ? ` (${selectionValues.join(", ")})` : "";
    const suffixZh =
      selectionValues.length > 0
        ? ` (${selectionValues.map(translateOption).join(", ")})`
        : "";

    let price = item.price ?? 0;
    if (item.options) {
      const selectedOption = item.options.find(
        (opt) => opt.name === selections["main"],
      );
      if (selectedOption?.price !== undefined) {
        price = selectedOption.price;
      }
    }

    onConfirm({
      name: {
        en: `${item.name.en}${suffixEn}`,
        zh: `${item.name.zh}${suffixZh}`,
      },
      price,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-keyboard-aware fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
        className="pos-panel flex max-h-[90vh] w-full max-w-2xl flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="pos-kicker">Options for</span>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              {item.name.en}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="flex flex-col gap-8">
            {item.options && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Size / Style
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {item.options.map((opt) => (
                    <button
                      key={opt.name}
                      onClick={() => handleSelectionChange("main", opt.name)}
                      className={cn(
                        "flex h-20 flex-col items-center justify-center gap-1 rounded-xl border transition-all",
                        selections["main"] === opt.name
                          ? "pos-btn-tactile-primary"
                          : "pos-btn-tactile hover:bg-muted/50",
                      )}
                    >
                      <span className="text-sm font-semibold">{opt.name}</span>
                      {opt.price !== undefined && (
                        <span className="pos-value font-mono text-xs font-bold opacity-80">
                          {formatCurrency(opt.price)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.contents?.map((content, index) => {
              if (content.type === "item") {
                return (
                  <div
                    key={index}
                    className="rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground border border-border/40"
                  >
                    Includes:{" "}
                    <span className="text-foreground font-medium">
                      {content.item}
                    </span>
                  </div>
                );
              }
              if (
                content.type === "choice" &&
                content.description &&
                content.options
              ) {
                return (
                  <div key={index} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {content.description}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {content.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() =>
                            handleSelectionChange(content.description!, opt)
                          }
                          className={cn(
                            "flex h-16 items-center justify-center px-3 rounded-xl border transition-all text-sm font-medium",
                            selections[content.description!] === opt
                              ? "pos-btn-tactile-primary"
                              : "pos-btn-tactile hover:bg-muted/50",
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </ScrollArea>

        <div className="flex gap-3 border-t border-border/60 bg-muted/20 p-6">
          <Button
            variant="outline"
            className="flex-1 h-12 text-base"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-12 text-base font-bold shadow-lg shadow-primary/20"
            variant="default"
            onClick={handleConfirm}
          >
            Confirm & Add
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
