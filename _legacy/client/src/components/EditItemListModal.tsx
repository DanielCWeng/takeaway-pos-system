import React, { useState } from 'react';
import { MenuItem, Modifier } from '../types';
import { IconX } from './Icons';

interface EditItemListModalProps {
  menuItems: MenuItem[];
  modifiers: Modifier[];
  onUpdateItems: (items: MenuItem[]) => void;
  onUpdateModifiers: (modifiers: Modifier[]) => void;
  onClose: () => void;
}

const EditItemListModal: React.FC<EditItemListModalProps> = ({
  menuItems,
  modifiers,
  onUpdateItems,
  onUpdateModifiers,
  onClose,
}) => {
  const [localItems, setLocalItems] = useState([...menuItems]);
  const [localModifiers, setLocalModifiers] = useState([...modifiers]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const handleAddItem = () => {
    // CORRECTED: Creates a new item with the updated structure
    const newItem: MenuItem = {
      id: Date.now().toString(), // Use string for ID
      name: { en: 'New Item', zh: '新项目' },
      price: 0,
      primaryCategory: 'Special',      // Use primaryCategory
      secondaryCategory: 'Uncategorized', // Use secondaryCategory
    };
    setLocalItems([...localItems, newItem]);
  };

  const handleRemoveItem = () => {
    if (selectedItemId !== null) {
      setLocalItems(localItems.filter((item) => item.id !== selectedItemId));
      setSelectedItemId(null);
    }
  };

  // CORRECTED: `id` is now a string
  const handleItemChange = (id: string, field: keyof MenuItem | 'name.en' | 'name.zh', value: any) => {
    setLocalItems(
      localItems.map((item) => {
        if (item.id === id) {
          if (field === 'name.en') return { ...item, name: { ...item.name, en: value } };
          if (field === 'name.zh') return { ...item, name: { ...item.name, zh: value } };
          if (field === 'price') return { ...item, price: parseFloat(value) || 0 };
          // This will now correctly handle 'primaryCategory' and 'secondaryCategory'
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };
  
  const handleSaveChanges = () => {
    onUpdateItems(localItems);
    onUpdateModifiers(localModifiers);
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col p-6"> {/* Increased max-width */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Edit Item List</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <IconX className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow grid grid-cols-2 gap-6 overflow-hidden">
            {/* Item Table */}
            <div className="flex flex-col overflow-hidden bg-gray-900 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Menu Items</h3>
                <div className="flex gap-2 mb-2">
                    <button onClick={handleAddItem} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Add Item</button>
                    <button onClick={handleRemoveItem} disabled={!selectedItemId} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:bg-gray-600">Remove Item</button>
                </div>
                <div className="flex-grow overflow-y-auto text-white">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-gray-900">
                            <tr>
                                <th className="p-2">ID</th>
                                <th className="p-2">English Name</th>
                                <th className="p-2">Chinese Name</th>
                                <th className="p-2">Price</th>
                                {/* CORRECTED: Updated table headers */}
                                <th className="p-2">Primary Cat</th>
                                <th className="p-2">Secondary Cat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localItems.map(item => (
                                <tr key={item.id} onClick={() => setSelectedItemId(item.id)} className={`cursor-pointer ${selectedItemId === item.id ? 'bg-blue-900' : 'hover:bg-gray-700'}`}>
                                    <td className="p-1 whitespace-nowrap">{item.id}</td>
                                    <td className="p-1"><input type="text" value={item.name.en} onChange={e => handleItemChange(item.id, 'name.en', e.target.value)} className="bg-transparent w-full" /></td>
                                    <td className="p-1"><input type="text" value={item.name.zh} onChange={e => handleItemChange(item.id, 'name.zh', e.target.value)} className="bg-transparent w-full" /></td>
                                    <td className="p-1"><input type="number" step="0.01" value={item.price ?? 0} onChange={e => handleItemChange(item.id, 'price', e.target.value)} className="bg-transparent w-20" /></td>
                                    {/* CORRECTED: Replaced single category select with two text inputs */}
                                    <td className="p-1"><input type="text" value={item.primaryCategory} onChange={e => handleItemChange(item.id, 'primaryCategory', e.target.value)} className="bg-transparent w-full" /></td>
                                    <td className="p-1"><input type="text" value={item.secondaryCategory} onChange={e => handleItemChange(item.id, 'secondaryCategory', e.target.value)} className="bg-transparent w-full" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modifier Table */}
            <div className="flex flex-col overflow-hidden bg-gray-900 p-4 rounded-lg text-white">
                <h3 className="text-lg font-semibold mb-2">Modifiers</h3>
                {/* Modifier controls can be added here */}
                <div className="flex-grow overflow-y-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-gray-900">
                            <tr>
                                <th className="p-2">Name</th>
                                <th className="p-2">Section</th>
                                <th className="p-2">Price Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localModifiers.map(mod => (
                                <tr key={mod.id} className="hover:bg-gray-700">
                                    <td className="p-2">{mod.name}</td>
                                    <td className="p-2">{mod.section}</td>
                                    <td className="p-2">£{mod.priceChange.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div className="mt-6 text-right">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2">
            Cancel
          </button>
          <button onClick={handleSaveChanges} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditItemListModal;