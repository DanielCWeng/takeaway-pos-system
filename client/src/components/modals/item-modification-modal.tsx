import { useState } from 'react';
import { motion } from 'framer-motion';
import type { OrderItem } from '../../types';
import { Button } from '../ui/button';
import { X, Trash2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/format';

type ModifierCommand = 'REMOVE' | 'LESS' | 'MORE' | 'WANT' | 'ONLY';

const COMMAND_TRANSLATIONS: Record<ModifierCommand, { en: string; zh: string }> = {
  REMOVE: { en: 'No', zh: '走' },
  LESS: { en: 'Less', zh: '少' },
  MORE: { en: 'Extra', zh: '加' },
  WANT: { en: 'Want', zh: '要' },
  ONLY: { en: 'Only', zh: '只要' },
};

const CATEGORIES = ['Sauces', 'Spice Level', 'Vegetables', 'Seasonings', 'Preparation', 'Meats', 'Allergens'];

const INGREDIENTS = [
  { name: 'Onion', zh: '洋葱', category: 'Vegetables' },
  { name: 'Mushroom', zh: '毛菇', category: 'Vegetables' },
  { name: 'Garlic', zh: '蒜蓉', category: 'Vegetables' },
  { name: 'Ginger', zh: '姜', category: 'Vegetables' },
  { name: 'Pepper', zh: '青椒', category: 'Vegetables' },
  { name: 'Beansprout', zh: '牙才', category: 'Vegetables' },
  { name: 'Chili', zh: '辣椒', category: 'Spice Level' },
  { name: 'BBQ Sauce', zh: '排骨汁', category: 'Sauces' },
  { name: 'Curry', zh: '加汁', category: 'Sauces' },
  { name: 'Sweet Sour', zh: '古汁', category: 'Sauces' },
  { name: 'Soy Sauce', zh: '豉油', category: 'Seasonings' },
  { name: 'MSG', zh: '味精', category: 'Seasonings' },
  { name: 'Salt', zh: '盐', category: 'Seasonings' },
  { name: 'Large', zh: '加大', category: 'Preparation', price: 1.0 },
  { name: 'Chicken', zh: '鸡', category: 'Meats', price: 1.0 },
  { name: 'Beef', zh: '牛', category: 'Meats', price: 1.0 },
];

interface ItemModificationModalProps {
  item: OrderItem;
  originalName: string;
  onClose: () => void;
  onSave: (updatedItem: OrderItem) => void;
}

export function ItemModificationModal({
  item,
  originalName,
  onClose,
  onSave,
}: ItemModificationModalProps) {
  const [activeCommand, setActiveCommand] = useState<ModifierCommand | null>(null);
  type Ingredient = { name: string; zh?: string; price?: number };
  type ModifierEntry = { command: ModifierCommand; ingredient: Ingredient };
  const [modifiers, setModifiers] = useState<ModifierEntry[]>([]);
  const [customPrice, setCustomPrice] = useState<string>(item.price.toString());
  const [customName, setCustomName] = useState<string>(item.name);

  const handleIngredientClick = (ing: Ingredient) => {
    if (!activeCommand) return;
    setModifiers((prev) => [...prev, { command: activeCommand, ingredient: ing }]);
  };

  const handleRemoveModifier = (index: number) => {
    setModifiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const modifierText = modifiers
      .map((m) => {
        const cmd = COMMAND_TRANSLATIONS[m.command as ModifierCommand];
        return `(${cmd.en} ${m.ingredient.name} / ${cmd.zh} ${m.ingredient.zh})`;
      })
      .join(' ');

    const basePrice = parseFloat(customPrice) || 0;
    const extraPrice = modifiers.reduce((sum, m) => sum + (m.ingredient.price || 0), 0);

    onSave({
      ...item,
      name: customName + (modifierText ? ' ' + modifierText : ''),
      price: basePrice + extraPrice,
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
        className="pos-panel flex h-[90vh] w-full max-w-6xl flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="pos-kicker text-primary">Modifying</span>
            <span className="font-display text-xl font-bold tracking-tight">
              {originalName}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-border/40 bg-muted/20 px-6 py-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Custom Name
            </label>
            <Input 
              value={customName} 
              onChange={(e) => setCustomName(e.target.value)}
              className="h-11 bg-card font-semibold border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Base Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">£</span>
              <Input 
                type="number"
                value={customPrice} 
                onChange={(e) => setCustomPrice(e.target.value)}
                className="h-11 bg-card pl-7 font-mono font-bold text-foreground border-border/60"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col border-r border-border/40 lg:flex-[2]">
            <div className="grid grid-cols-5 gap-2 border-b border-border/40 p-4 bg-muted/10">
              {(Object.keys(COMMAND_TRANSLATIONS) as ModifierCommand[]).map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => setActiveCommand(activeCommand === cmd ? null : cmd)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 rounded-lg border h-14 transition-all',
                    activeCommand === cmd
                      ? 'pos-btn-tactile-primary'
                      : 'pos-btn-tactile hover:bg-muted/50'
                  )}
                >
                  <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">
                    {cmd}
                  </span>
                  <span className="text-sm font-bold tracking-tight">
                    {COMMAND_TRANSLATIONS[cmd].zh}
                  </span>
                </button>
              ))}
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="space-y-3">
                    <h4 className="pos-kicker text-[9px] border-b border-border/20 pb-1">{cat}</h4>
                    <div className="grid gap-2">
                       {INGREDIENTS.filter(i => i.category === cat).map((ing) => (
                         <button
                           key={ing.name}
                           onClick={() => handleIngredientClick(ing)}
                           className="flex flex-col items-start gap-0 rounded-lg border border-border/40 bg-muted/20 p-2 text-left transition hover:bg-muted/50 hover:border-border/60"
                         >
                           <span className="text-[11px] font-semibold">{ing.name}</span>
                           <span className="text-[10px] text-muted-foreground">{ing.zh}</span>
                         </button>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="w-80 flex flex-col bg-muted/10">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <span className="pos-kicker">Modifiers</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {modifiers.length}
              </Badge>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col gap-2">
                {modifiers.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/40 p-8 text-center">
                    <p className="text-xs text-muted-foreground">Select a command, then an ingredient</p>
                  </div>
                )}
                {modifiers.map((mod, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                        {mod.command}
                      </span>
                      <span className="text-xs font-semibold">
                        {mod.ingredient.name}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveModifier(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="mt-auto border-t border-border/40 p-4 bg-background">
               <div className="flex items-center justify-between mb-4 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Extra</span>
                  <span className="pos-value font-mono font-bold text-accent">
                    {formatCurrency(modifiers.reduce((sum, m) => sum + (m.ingredient.price || 0), 0))}
                  </span>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-11" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button className="h-11 font-bold shadow-lg shadow-primary/20" onClick={handleSave}>
                    Confirm Changes
                  </Button>
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
