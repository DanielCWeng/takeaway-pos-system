import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import type { OrderItem } from "../../types";
import { Button } from "../ui/button";
import { X, Trash2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/format";

type ModifierCommand = "REMOVE" | "LESS" | "MORE" | "WANT" | "ONLY";

const COMMAND_TRANSLATIONS: Record<ModifierCommand, { en: string; zh: string }> = {
  REMOVE: { en: "No", zh: "走" },
  LESS: { en: "Less", zh: "少" },
  MORE: { en: "Extra", zh: "加" },
  WANT: { en: "Want", zh: "要" },
  ONLY: { en: "Only", zh: "只要" },
};

const CATEGORIES = [
  "Sauces",
  "Spice Level",
  "Vegetables",
  "Seasonings",
  "Preparation",
  "Meats",
  "Allergens",
];

const CATEGORY_STYLES: Record<string, string> = {
  Sauces: "bg-[#8f7b70] hover:bg-[#806b60]",
  "Spice Level": "bg-[#a98058] hover:bg-[#976f48]",
  Vegetables: "bg-[#489a9b] hover:bg-[#3c898a]",
  Seasonings: "bg-[#3f7f8e] hover:bg-[#356f7d]",
  Preparation: "bg-[#78a777] hover:bg-[#689767]",
  Meats: "bg-[#719a35] hover:bg-[#62872d]",
  Allergens: "bg-[#8c5396] hover:bg-[#7b4785]",
};

const INGREDIENTS = [
  { name: "Sauce", zh: "汁", category: "Sauces" }, { name: "Curry", zh: "加汁", category: "Sauces" }, { name: "Sweet Sour Sau", zh: "古汁", category: "Sauces" }, { name: "BBQ Sauce", zh: "排骨汁", category: "Sauces" }, { name: "B/Pepper Sauce", zh: "黑召汁", category: "Sauces" },
  { name: "B/Bean", zh: "士召汁", category: "Sauces" }, { name: "Honey & Spicy S", zh: "蜜辣汁", category: "Sauces" }, { name: "Kung Po", zh: "公保汁", category: "Sauces" }, { name: "Peking Sauce", zh: "京汁", category: "Sauces" }, { name: "Lemon Sauce", zh: "柠檬汁", category: "Sauces" },
  { name: "Orange", zh: "橙汁", category: "Sauces" }, { name: "Satay Sauce", zh: "沙爹汁", category: "Sauces" }, { name: "Gravy sauce", zh: "烧汁", category: "Sauces" }, { name: "Szechuan", zh: "四川汁", category: "Sauces" }, { name: "Sauce Separate", zh: "汁分开", category: "Sauces" },
  { name: "Sauce Less Spic", zh: "汁少辣", category: "Spice Level" }, { name: "Sauce Medium S", zh: "汁中辣", category: "Spice Level" }, { name: "Sauce Extra Hot", zh: "汁加辣", category: "Spice Level" }, { name: "Thai Sweet Chil", zh: "泰甜辣汁", category: "Spice Level" },
  { name: "Veg", zh: "菜", category: "Vegetables" }, { name: "Onion", zh: "洋冲", category: "Vegetables" }, { name: "Beansprout", zh: "牙才", category: "Vegetables" }, { name: "Mushroom", zh: "毛菇", category: "Vegetables", price: 0.5 }, { name: "Peas", zh: "青豆", category: "Vegetables" },
  { name: "Pepper", zh: "青椒", category: "Vegetables" }, { name: "Cashew nuts", zh: "腰果", category: "Vegetables", price: 0.5 }, { name: "Tomato", zh: "番茄", category: "Vegetables" }, { name: "Cucumber", zh: "青瓜", category: "Vegetables" }, { name: "Pineapple", zh: "波罗", category: "Vegetables" },
  { name: "Spr Onions", zh: "葱仔", category: "Vegetables" }, { name: "Bamboo Sh & W", zh: "竹马", category: "Vegetables" }, { name: "Bamboo Shoots", zh: "竹笋", category: "Vegetables" }, { name: "Waterchestnut", zh: "马蹄", category: "Vegetables" }, { name: "Fresh Chillies", zh: "辣椒仔", category: "Vegetables" },
  { name: "Garlic", zh: "蒜蓉", category: "Vegetables" }, { name: "Egg", zh: "蛋", category: "Vegetables" }, { name: "Chinese Leaf", zh: "绍才", category: "Vegetables" }, { name: "Black Beans", zh: "豆士", category: "Vegetables" }, { name: "Baby Corn", zh: "粟米仔", category: "Vegetables" },
  { name: "Carrort", zh: "红萝卜", category: "Vegetables" }, { name: "Brocolli", zh: "西兰花", category: "Vegetables" }, { name: "Spring Onions", zh: "青葱", category: "Vegetables" }, { name: "Lemon", zh: "柠檬", category: "Vegetables" }, { name: "Orange", zh: "橙", category: "Vegetables" }, { name: "Ginger", zh: "姜", category: "Vegetables" },
  { name: "Spicy", zh: "辣", category: "Seasonings" }, { name: "Salt", zh: "盐", category: "Seasonings" }, { name: "Sugar", zh: "糖", category: "Seasonings" }, { name: "MSG", zh: "味精", category: "Seasonings" }, { name: "Soy", zh: "豉油", category: "Seasonings" },
  { name: "Vinegar", zh: "醋", category: "Seasonings" }, { name: "Wine", zh: "酒", category: "Seasonings" }, { name: "Peppers", zh: "胡椒粉", category: "Seasonings" }, { name: "Oyster Sauce", zh: "蚝油", category: "Seasonings" }, { name: "Oil", zh: "油", category: "Seasonings" },
  { name: "Large", zh: "餐加大", category: "Preparation", price: 1 }, { name: "Small", zh: "小", category: "Preparation" }, { name: "Batter", zh: "粉", category: "Preparation" }, { name: "Shredded", zh: "切碎", category: "Preparation" }, { name: "Sauce Separat", zh: "分汁", category: "Preparation" },
  { name: "Open", zh: "打开", category: "Preparation" }, { name: "Crispy", zh: "炸脆", category: "Preparation" }, { name: "Extra Pancake (", zh: "皮鸭皮", category: "Preparation" },
  { name: "Meat", zh: "肉", category: "Meats" }, { name: "Pork", zh: "朱肉", category: "Meats" }, { name: "Shrimp", zh: "虾仔", category: "Meats", price: 1 }, { name: "King Prawn", zh: "大虾", category: "Meats", price: 1 }, { name: "Roast Pork", zh: "叉烧", category: "Meats", price: 1 },
  { name: "Duck", zh: "甲", category: "Meats", price: 2 }, { name: "Chicken", zh: "介", category: "Meats", price: 1 }, { name: "Beef", zh: "牛", category: "Meats", price: 1 }, { name: "Ham", zh: "火腿", category: "Meats" }, { name: "Fish", zh: "鱼", category: "Meats" },
  { name: "Mussels", zh: "青口", category: "Meats" }, { name: "Squid", zh: "尤", category: "Meats" }, { name: "Seafood", zh: "海鲜", category: "Meats" },
  { name: "Egg", zh: "蛋", category: "Allergens" }, { name: "Celery", zh: "西芹", category: "Allergens" }, { name: "Gluten", zh: "面粉", category: "Allergens" }, { name: "Shell Fish", zh: "鱼虾蟹贝壳", category: "Allergens" }, { name: "Nuts", zh: "果仁", category: "Allergens" },
  { name: "Milk", zh: "牛奶", category: "Allergens" }, { name: "Mustard", zh: "芥辣", category: "Allergens" }, { name: "Peanuts", zh: "花生", category: "Allergens" }, { name: "Sesame", zh: "芝麻", category: "Allergens" }, { name: "Soya", zh: "黄豆", category: "Allergens" },
  { name: "Soya Sauce", zh: "豉油", category: "Allergens" }, { name: "Sesame Oil", zh: "麻油", category: "Allergens" },
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
  const [quantity, setQuantity] = useState(item.quantity);
  const [ingredientScroll, setIngredientScroll] = useState(0);
  const ingredientScrollRef = useRef<HTMLDivElement>(null);
  const ingredientTrackRef = useRef<HTMLDivElement>(null);

  const updateIngredientScroll = () => {
    const element = ingredientScrollRef.current;
    if (!element) return;
    const maximum = element.scrollHeight - element.clientHeight;
    setIngredientScroll(maximum > 0 ? (element.scrollTop / maximum) * 100 : 0);
  };

  const setIngredientScrollPosition = (percentage: number) => {
    const element = ingredientScrollRef.current;
    if (!element) return;
    const maximum = element.scrollHeight - element.clientHeight;
    element.scrollTop = (percentage / 100) * maximum;
    setIngredientScroll(percentage);
  };

  const dragIngredientScrollbar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = ingredientTrackRef.current;
    if (!track) return;
    const bounds = track.getBoundingClientRect();
    const thumbHeight = 112;
    const travel = Math.max(1, bounds.height - thumbHeight);
    const position = Math.min(travel, Math.max(0, event.clientY - bounds.top - thumbHeight / 2));
    setIngredientScrollPosition((position / travel) * 100);
  };

  const adjustBasePrice = (amount: number) => {
    setCustomPrice((current) => {
      const parsed = Number.parseFloat(current);
      const next = (Number.isFinite(parsed) ? parsed : 0) + amount;
      return next.toFixed(2);
    });
  };

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
      .join(" ");

    const basePrice = parseFloat(customPrice) || 0;
    const extraPrice = modifiers.reduce((sum, m) => sum + (m.ingredient.price || 0), 0);

    onSave({
      ...item,
      name: customName + (modifierText ? " " + modifierText : ""),
      price: basePrice + extraPrice,
      quantity,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-keyboard-aware fixed inset-0 z-50 bg-[#c9c7bd] p-2"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
        className="pos-panel flex h-full w-full flex-col overflow-hidden shadow-2xl"
      >
        <div className="relative flex min-h-16 items-center justify-center border-b-2 border-gray-500 bg-[#d3d0c5] px-16 py-2">
          <div className="text-center">
            <div className="font-display text-2xl font-black tracking-tight">{originalName}</div>
            <div className="font-mono text-lg font-bold">{formatCurrency(Number.parseFloat(customPrice) || 0)}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(28rem,0.8fr)] gap-4 border-b-2 border-gray-500 bg-[#d3d0c5] px-4 py-2">
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
              Price Adjustment
            </label>
            <div className="flex h-11 items-stretch gap-1">
              <div className="flex min-w-24 items-center justify-center border-2 border-l-gray-500 border-t-gray-500 border-r-gray-100 border-b-gray-100 bg-white px-3 font-mono text-lg font-black">
                {formatCurrency(Number.parseFloat(customPrice) || 0)}
              </div>
              <Button type="button" variant="positive" className="h-11 flex-1 px-2" onClick={() => adjustBasePrice(1)}>+ £1</Button>
              <Button type="button" variant="positive" className="h-11 flex-1 px-2" onClick={() => adjustBasePrice(0.5)}>+ 50p</Button>
              <Button type="button" variant="destructive" className="h-11 flex-1 px-2" onClick={() => adjustBasePrice(-1)}>− £1</Button>
              <Button type="button" variant="destructive" className="h-11 flex-1 px-2" onClick={() => adjustBasePrice(-0.5)}>− 50p</Button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(16rem,0.72fr)_10rem] overflow-hidden">
          <div className="flex min-w-0 flex-col border-r-2 border-gray-500 bg-[#4d62be]">
            <div className="border-b-2 border-gray-500 bg-[#3f6bd0] px-3 py-1 text-center text-xl font-black text-white">Exception 加加減減</div>
            <div className="grid grid-cols-5 gap-1 border-b-2 border-gray-500 bg-[#bdbbb3] p-2">
              {(Object.keys(COMMAND_TRANSLATIONS) as ModifierCommand[]).map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => setActiveCommand(activeCommand === cmd ? null : cmd)}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-0.5 border-2 border-b-gray-600 border-r-gray-600 border-l-white border-t-white transition-none",
                    activeCommand === cmd
                      ? "pos-btn-tactile-primary"
                      : "pos-btn-tactile hover:bg-muted/50",
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

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <div
                ref={ingredientScrollRef}
                onScroll={updateIngredientScroll}
                className="scrollbar-hide absolute inset-y-0 left-0 right-10 overflow-y-scroll overscroll-contain pl-2 py-2"
              >
                <div className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <div key={cat}>
                    <div className="mb-1 text-xs font-black uppercase tracking-wider text-white/80">{cat}</div>
                    <div className="grid grid-cols-5 gap-1">
                      {INGREDIENTS.filter((i) => i.category === cat).map((ing) => (
                        <button
                          key={ing.name}
                          onClick={() => handleIngredientClick(ing)}
                          className={cn("flex min-h-14 flex-col items-start justify-center border-2 border-b-gray-700 border-r-gray-700 border-l-white/70 border-t-white/70 px-2 text-left text-white transition-none", CATEGORY_STYLES[cat])}
                        >
                          <span className="text-[11px] font-semibold">
                            {ing.name}{ing.price ? ` (${ing.price.toFixed(2)})` : ""}
                          </span>
                          <span className="text-[10px] text-white/90">
                            {ing.zh} ({INGREDIENTS.indexOf(ing) + 1})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                </div>
              </div>
              <div className="absolute inset-y-0 right-0 flex w-10 justify-center border-l-2 border-gray-500 bg-[#c9c7bd] p-1.5">
                <div
                  ref={ingredientTrackRef}
                  role="scrollbar"
                  aria-label="Scroll ingredients"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(ingredientScroll)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragIngredientScrollbar(event);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) dragIngredientScrollbar(event);
                  }}
                  className="relative h-full w-7 touch-none border-2 border-gray-600 bg-[#aeb8d8]"
                >
                  <div
                    className="absolute left-0 h-28 w-full border-2 border-b-[#172d61] border-r-[#172d61] border-l-[#89a7ec] border-t-[#89a7ec] bg-[#315dbd] shadow-sm active:bg-[#244b9f]"
                    style={{ top: `calc((100% - 7rem) * ${ingredientScroll / 100})` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col border-r-2 border-gray-500 bg-[#5369c5]">
            <div className="flex items-center justify-between border-b-2 border-gray-500 bg-[#3f6bd0] px-4 py-2 text-white">
              <span className="text-xl font-black">Choice 选择</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {modifiers.length}
              </Badge>
            </div>

            <ScrollArea className="min-h-0 flex-1 p-3">
              <div className="flex flex-col gap-2">
                {modifiers.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/40 p-8 text-center">
                    <p className="text-xs text-muted-foreground">
                      Select a command, then an ingredient
                    </p>
                  </div>
                )}
                {modifiers.map((mod, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-2 border-blue-200 bg-[#d9e2ff] p-2 text-gray-950"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                        {mod.command}
                      </span>
                      <span className="text-xs font-semibold">{mod.ingredient.name}</span>
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

            <div className="mt-auto border-t-2 border-gray-500 bg-[#d3d0c5] p-3">
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Extra
                </span>
                <span className="pos-value font-mono font-bold text-accent">
                  {formatCurrency(modifiers.reduce((sum, m) => sum + (m.ingredient.price || 0), 0))}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#d3d0c5]">
            <div className="border-b-2 border-gray-500 bg-[#3f6bd0] px-2 py-2 text-center text-lg font-black text-white">Quantity 数量</div>
            <div className="flex min-h-28 items-center justify-center border-b-2 border-gray-500 bg-white font-mono text-6xl font-black text-[#4165b5]">{quantity}</div>
            <div className="grid grid-cols-2 border-b-2 border-gray-500">
              <button type="button" className="h-16 border-r-2 border-gray-500 text-4xl font-black" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
              <button type="button" className="h-16 text-4xl font-black" onClick={() => setQuantity((value) => value + 1)}>+</button>
            </div>
            <button type="button" onClick={handleSave} className="min-h-28 border-b-2 border-gray-500 bg-[#9dcc99] px-2 text-xl font-black active:bg-[#78a875]">✓ OK<br />确认</button>
            <button type="button" onClick={onClose} className="min-h-28 border-b-2 border-gray-500 bg-[#d8a3aa] px-2 text-xl font-black active:bg-[#bd7e87]">✕ Cancel<br />取消</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
