// --- START OF FILE src/components/ItemModificationModal.tsx ---

import React, { useState } from 'react';
import { OrderItem } from '../types';

type ModifierCommand = 'REMOVE' | 'LESS' | 'MORE' | 'WANT' | 'ONLY';
interface Ingredient {
    name: string;
    zh: string;
    price?: number;
    category: string;
}
interface Modifier {
    command: ModifierCommand;
    ingredient: Ingredient;
}

const createIngredient = (name: string, zh: string, category: string, price?: number): Ingredient => ({ name, zh, price, category });

const allIngredients: Ingredient[] = [
    // Sauces
    createIngredient('BBQ Sauce', '排骨汁', 'Sauces'), createIngredient('B/Bean Sauce', '豉汁', 'Sauces'),
    createIngredient('B/Pepper Sauce', '黑召汁', 'Sauces'), createIngredient('Curry', '加汁', 'Sauces'),
    createIngredient('Gravy sauce', '烧汁', 'Sauces'), createIngredient('Honey & Spicy Sauce', '蜜辣汁', 'Sauces'),
    createIngredient('Kung Po Sauce', '公保汁', 'Sauces'), createIngredient('Lemon Sauce', '柠檬汁', 'Sauces'),
    createIngredient('Orange', '橙汁', 'Sauces'), createIngredient('Peking Sauce', '京汁', 'Sauces'),
    createIngredient('Satay Sauce', '沙爹汁', 'Sauces'), createIngredient('Sauce', '汁', 'Sauces'),
    createIngredient('Sauce Separate', '汁分开', 'Sauces'), createIngredient('Sweet Sour Sauce', '古汁', 'Sauces'),
    createIngredient('Szechuan Sauce', '四川汁', 'Sauces'), createIngredient('Thai Sweet Chili', '泰甜辣汁', 'Sauces'),
    // Spice Level
    createIngredient('Sauce Extra Hot', '汁加辣', 'Spice Level'), createIngredient('Sauce Less Spicy', '汁少辣', 'Spice Level'),
    createIngredient('Sauce Medium Spicy', '汁中辣', 'Spice Level'),
    // Vegetables & Other Ingredients
    createIngredient('Baby Corn', '粟米仔', 'Vegetables'), createIngredient('Bamboo Shoots', '竹笋', 'Vegetables'),
    createIngredient('Bamboo Sh & W', '竹马', 'Vegetables'), createIngredient('Beansprout', '牙才', 'Vegetables'),
    createIngredient('Black Beans', '豆士', 'Vegetables'), createIngredient('Brocolli', '西兰花', 'Vegetables'),
    createIngredient('Carrot', '红萝卜白', 'Vegetables'), createIngredient('Cashew nuts', '腰果', 'Vegetables'),
    createIngredient('Chinese Leaf', '绍才', 'Vegetables'), createIngredient('Cucumber', '青瓜', 'Vegetables'),
    createIngredient('Egg', '蛋', 'Vegetables'), createIngredient('Fresh Chillies', '辣椒仔', 'Vegetables'),
    createIngredient('Garlic', '蒜蓉', 'Vegetables'), createIngredient('Ginger', '姜', 'Vegetables'),
    createIngredient('Lemon', '柠檬', 'Vegetables'), createIngredient('Mushroom', '毛菇', 'Vegetables'),
    createIngredient('Onion', '洋冲', 'Vegetables'), createIngredient('Orange', '橙', 'Vegetables'),
    createIngredient('Peas', '青豆', 'Vegetables'), createIngredient('Pepper', '青椒', 'Vegetables'),
    createIngredient('Pineapple', '波罗', 'Vegetables'), createIngredient('Spring Onions', '青葱', 'Vegetables'),
    createIngredient('Spr Onions', '葱仔', 'Vegetables'), createIngredient('Tomato', '蕃茄', 'Vegetables'),
    createIngredient('Veg', '菜', 'Vegetables'), createIngredient('Waterchestnut', '马蹄', 'Vegetables'),
    // Seasonings
    createIngredient('MSG', '味精', 'Seasonings'), createIngredient('Oil', '油', 'Seasonings'),
    createIngredient('Oyster Sauce', '蚝油', 'Seasonings'), createIngredient('Peppers', '胡椒粉', 'Seasonings'),
    createIngredient('Salt', '盐', 'Seasonings'), createIngredient('Soy', '豉油', 'Seasonings'),
    createIngredient('Spicy', '辣', 'Seasonings'), createIngredient('Sugar', '糖', 'Seasonings'),
    createIngredient('Vinegar', '醋', 'Seasonings'), createIngredient('Wine', '酒', 'Seasonings'),
    // Preparation & Size
    createIngredient('Batter', '粉', 'Preparation'), createIngredient('Crispy', '炸脆', 'Preparation'),
    createIngredient('Extra Pancake', '皮鸭皮', 'Preparation'), createIngredient('Large', '餐加大', 'Preparation', 1.00),
    createIngredient('Open', '打开', 'Preparation'), createIngredient('Sauce Sep', '分汁', 'Preparation'),
    createIngredient('Shredded', '切碎', 'Preparation'), createIngredient('Small', '小', 'Preparation'),
    // Meats & Seafood
    createIngredient('Beef', '牛', 'Meats', 1.00), createIngredient('Chicken', '介', 'Meats', 1.00),
    createIngredient('Duck', '甲', 'Meats', 2.00), createIngredient('Fish', '鱼', 'Meats'),
    createIngredient('Ham', '火腿', 'Meats'), createIngredient('King Prawn', '大虾', 'Meats', 1.00),
    createIngredient('Meat', '肉', 'Meats'), createIngredient('Mussels', '青口', 'Meats'),
    createIngredient('Pork', '猪肉', 'Meats'), createIngredient('Roast Pork', '叉烧', 'Meats', 1.00),
    createIngredient('Seafood', '海鲜', 'Meats'), createIngredient('Shrimp', '虾仔', 'Meats', 1.00),
    createIngredient('Squid', '尤', 'Meats'),
    // Allergens
    createIngredient('Celery', '西芹', 'Allergens'), createIngredient('Egg', '蛋', 'Allergens'),
    createIngredient('Gluten', '面粉', 'Allergens'), createIngredient('Milk', '牛奶', 'Allergens'),
    createIngredient('Mustard', '芥辣', 'Allergens'), createIngredient('Nuts', '果仁', 'Allergens'),
    createIngredient('Peanuts', '花生', 'Allergens'), createIngredient('Sesame', '芝麻', 'Allergens'),
    createIngredient('Sesame Oil', '麻油', 'Allergens'), createIngredient('Shell Fish', '鱼虾蟹贝壳', 'Allergens'),
    createIngredient('Soya', '黄豆', 'Allergens'), createIngredient('Soya Sauce', '豉油', 'Allergens'),
].sort((a, b) => a.name.localeCompare(b.name));

const categories = ['Sauces', 'Spice Level', 'Vegetables', 'Seasonings', 'Preparation', 'Meats', 'Allergens'];

const categoryColors: { [key: string]: string } = {
    'Sauces': 'bg-red-200 hover:bg-red-300',
    'Spice Level': 'bg-orange-200 hover:bg-orange-300',
    'Vegetables': 'bg-green-200 hover:bg-green-300',
    'Seasonings': 'bg-blue-200 hover:bg-blue-300',
    'Preparation': 'bg-indigo-200 hover:bg-indigo-300',
    'Meats': 'bg-pink-200 hover:bg-pink-300',
    'Allergens': 'bg-gray-400 hover:bg-gray-500 text-white',
};

const CommandButton: React.FC<{ command: ModifierCommand, activeCommand: ModifierCommand | null, onClick: () => void }> = ({ command, activeCommand, onClick }) => (
    <button
        onClick={onClick}
        className={`flex-1 p-3 text-lg font-bold border-2 rounded-md ${activeCommand === command ? 'bg-yellow-400 border-yellow-600' : 'bg-gray-300 border-gray-400'}`}
    >
        {command}
    </button>
);

const IngredientButton: React.FC<{ ingredient: Ingredient, onClick: () => void }> = ({ ingredient, onClick }) => (
    <button onClick={onClick} className={`p-2 text-sm border rounded-md text-black w-full ${categoryColors[ingredient.category] || 'bg-gray-200'}`}>
        <div>{ingredient.name}</div>
        <div className="text-xs">{ingredient.zh}</div>
    </button>
);

interface ItemModificationModalProps {
    item: OrderItem;
    onClose: () => void;
    onSave: (updatedItem: OrderItem) => void;
}

const ItemModificationModal: React.FC<ItemModificationModalProps> = ({ item, onClose, onSave }) => {
    const [activeCommand, setActiveCommand] = useState<ModifierCommand | null>(null);
    const [modifiers, setModifiers] = useState<Modifier[]>(item.modifiers || []);
    const [customPrice, setCustomPrice] = useState<string>(item.customPrice ? item.customPrice.toString() : '');
    const [customName, setCustomName] = useState<string>(item.customName || '');
    const [customInstructions, setCustomInstructions] = useState<string>(item.customInstructions || '');

    const handleIngredientClick = (ingredient: Ingredient) => {
        if (!activeCommand) return;
        if (!modifiers.some(m => m.command === activeCommand && m.ingredient.name === ingredient.name)) {
            setModifiers(prev => [...prev, { command: activeCommand, ingredient }]);
        }
    };
    
    const handleRemoveModifier = (indexToRemove: number) => {
        setModifiers(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSave = () => {
        let defaultPrice = item.menuItem.price || 0;
        // Check if item is effectively free (Happy Meal item, Set Component, Swapped item)
        if (item.hidePrice || item.isPartOfSet || item.isSwapped) {
            defaultPrice = 0;
        }

        const basePrice = customPrice ? parseFloat(customPrice) : defaultPrice;
        const priceFromModifiers = modifiers.reduce((sum, mod) => sum + (mod.ingredient.price || 0), 0);
        
        // --- NEW: Translations for commands ---
        const commandTranslations: { [key in ModifierCommand]: string } = {
            REMOVE: '走', LESS: '少', MORE: '加', WANT: '要', ONLY: '只要'
        };

        const englishModifierString = modifiers.map(mod => `(${mod.command} ${mod.ingredient.name})`).join(' ');
        const chineseModifierString = modifiers.map(mod => `(${commandTranslations[mod.command]} ${mod.ingredient.zh})`).join(' ');
        
        // --- NEW: Combine base names and modifier strings into a single, comprehensive display name ---
        const englishPart = [customName || item.menuItem.name.en, englishModifierString].filter(Boolean).join(' ');
        const chinesePart = [item.menuItem.name.zh, chineseModifierString].filter(Boolean).join(' ');
        const finalDisplayName = [englishPart, chinesePart].filter(Boolean).join(' | ');

        const updatedItem: OrderItem = {
            ...item,
            modifiers,
            finalPrice: basePrice + priceFromModifiers,
            displayName: finalDisplayName,
            customPrice: customPrice ? parseFloat(customPrice) : undefined,
            customName: customName || undefined,
            customInstructions: customInstructions || undefined,
        };
        onSave(updatedItem);
    };

    const commands: ModifierCommand[] = ['REMOVE', 'LESS', 'MORE', 'WANT', 'ONLY'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            {/* --- MODIFIED: Wider modal container --- */}
            <div className="bg-gray-100 w-full max-w-7xl h-[90vh] rounded-lg shadow-xl flex flex-col p-4 gap-4">
                <h2 className="text-2xl font-bold text-center flex-shrink-0">Modify: {item.menuItem.name.en}</h2>
                
                <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Custom Name</label>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder={item.menuItem.name.en}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Custom Base Price</label>
                        <input
                            type="number"
                            value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                            placeholder={item.menuItem.price?.toString()}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Instructions</label>
                        <input
                            type="text"
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                </div>
                
                <div className="flex-shrink-0 flex gap-2">
                    {commands.map(cmd => (
                        <CommandButton key={cmd} command={cmd} activeCommand={activeCommand} onClick={() => setActiveCommand(cmd === activeCommand ? null : cmd)} />
                    ))}
                </div>

                <div className="flex-shrink-0 bg-white p-2 border rounded-md min-h-[60px] flex flex-wrap gap-2 items-center">
                    {modifiers.length === 0 && <span className="text-gray-400">Select a command, then an ingredient...</span>}
                    {modifiers.map((mod, index) => (
                        <div key={index} className="bg-blue-500 text-white p-1 rounded-md flex items-center gap-2">
                            <span>{mod.command}: {mod.ingredient.name}</span>
                            <button onClick={() => handleRemoveModifier(index)} className="bg-red-500 w-5 h-5 rounded-full text-xs font-bold">X</button>
                        </div>
                    ))}
                </div>
                
                 {/* --- MODIFIED: Wider grid for ingredients --- */}
                <div className="flex-grow bg-white border rounded-md p-2 overflow-y-auto">
                    <div className="grid grid-cols-7 gap-4">
                        {categories.map(category => (
                            <div key={category} className="flex flex-col gap-2">
                                <h3 className="font-bold border-b-2 border-gray-300 pb-1">{category}</h3>
                                {allIngredients.filter(ing => ing.category === category).map(ingredient => (
                                    <IngredientButton key={ingredient.name + ingredient.category} ingredient={ingredient} onClick={() => handleIngredientClick(ingredient)} />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-shrink-0 grid grid-cols-2 gap-4">
                    <button onClick={onClose} className="p-4 bg-gray-400 text-white text-xl font-bold rounded-md">Cancel</button>
                    <button onClick={handleSave} className="p-4 bg-green-500 text-white text-xl font-bold rounded-md">OK</button>
                </div>
            </div>
        </div>
    );
};

export default ItemModificationModal;
// --- END OF FILE ---