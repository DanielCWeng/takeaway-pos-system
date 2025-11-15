import React, { useState, useMemo, useEffect } from "react";
import { MenuItem } from "../types";

// Data now includes Chinese translations for buttons
const PRIMARY_CATEGORIES_ICONS = [
  { name: "Chicken", icon: "🐔" },
  { name: "Beef", icon: "🐄" },
  { name: "Pork", icon: "🐖" },
  { name: "Duck", icon: "🦆" },
  { name: "Lamb", icon: "🐑" },
  { name: "King Prawn", icon: "🦐" },
  { name: "Shrimp", icon: "🍤" },
  { name: "Fish", icon: "🐟" },
  { name: "Mushroom", icon: "🍄" },
  { name: "Veg", icon: "🥦" },
  { name: "Special", icon: "⭐" },
  { name: "Rice", icon: "🍚" },
  { name: "Chips", icon: "🍟" },
  { name: "Btn 1", icon: "1️⃣" },
  { name: "Btn 2", icon: "2️⃣" },
  { name: "Btn 3", icon: "3️⃣" },
];

const SECONDARY_CATEGORIES_PAGES = [
  // --- PAGE 1 (Existing Categories) ---
  [
    { zh: "全部", en: "Show All" },
    { zh: "头盘", en: "Starter" },
    { zh: "排骨", en: "Spare Rib" },
    { zh: "鸡翅", en: "Chicken Wing" },
    { zh: "汤", en: "Soup" },
    { zh: "召盐", en: "Salt & Pepper" },
    { zh: "沙爹", en: "Satay" },
    { zh: "士召", en: "Black Bean" },
    { zh: "加哩", en: "Curry" },
    { zh: "泰加哩", en: "Thai-Curry" },
    { zh: "泰式", en: "Thai" },
    { zh: "三保", en: "Sambal" },
    { zh: "特色", en: "Chef's" },
    { zh: "姜葱", en: "Ginger & S Onion" },
    { zh: "古老", en: "Sweet & Sour" },
    { zh: "辣蒜", en: "Chilli Garlic" },
    { zh: "京式", en: "Peking" },
    { zh: "腰果", en: "Cashew Nuts" },
    { zh: "黑召", en: "Black Pepper" },
    { zh: "柠檬/梅", en: "Lemon/Plum" },
    { zh: "菠萝", en: "Pineapple" },
    { zh: "宫保", en: "Kung Po" },
    { zh: "什水", en: "Chop Suey" },
    { zh: "什菜", en: "Mixed Veg" },
    { zh: "四川", en: "Szechuan" },
    { zh: "蚝油", en: "Oyster" },
    { zh: "毛菇", en: "Mushroom" },
    { zh: "饭", en: "Rice" },
    { zh: "面", en: "Chow Mein" },
    { zh: "斋", en: "Vegetarian" },
    { zh: "餐盒", en: "Snack Box" },
    { zh: "西餐", en: "English" },
    { zh: "芙蓉", en: "Foo Yung" },
    { zh: "<<", en: "<<" },
    { zh: ">>", en: ">>" },
  ],
  // --- [NEW] PAGE 2 (New Categories) ---
  [
    { zh: "全部", en: "Show All" }, // Show All is on every page
    { zh: "乌冬", en: "Udon" },
    { zh: "脆面", en: "Crispy Noodle" },
    { zh: "中式", en: "Chinese Style" },
    { zh: "蒜蓉", en: "Garlic Sauce" },
    { zh: "上海", en: "Shanghai Style" },
    { zh: "洋葱", en: "Onion" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "", en: "" },
    { zh: "<<", en: "<<" },
    { zh: ">>", en: ">>" },
  ],
];

interface RightPanelProps {
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
  onOpenMenuRef: () => void;
}

// --- MODAL COMPONENT FOR ITEM OPTIONS ---
const ItemOptionsModal = ({
  item,
  onConfirm,
  onClose,
}: {
  item: MenuItem;
  onConfirm: (finalizedItem: MenuItem) => void;
  onClose: () => void;
}) => {
  const [selections, setSelections] = useState<{
    [key: string]: string | string[];
  }>({});

  // Pre-select the first option for each choice
  useEffect(() => {
    const initialSelections: { [key: string]: string | string[] } = {};
    if (item.options) {
      initialSelections["main"] = item.options[0]?.name || "";
    }
    if (item.contents) {
      item.contents.forEach((content) => {
        if (content.type === "choice") {
          initialSelections[content.description] = content.options[0];
        }
      });
    }
    setSelections(initialSelections);
  }, [item]);

  const handleConfirm = () => {
    const finalizedItem = JSON.parse(JSON.stringify(item)); // Deep copy

    let selectionsText = Object.values(selections).flat().join(", ");
    if (selectionsText) {
      finalizedItem.name.en = `${item.name.en} (${selectionsText})`;
    }

    finalizedItem.selections = selections;

    if (item.options) {
      const selectedOption = item.options.find(
        (opt) => opt.name === selections["main"]
      );
      if (selectedOption && selectedOption.price) {
        finalizedItem.price = selectedOption.price;
      }
    }

    onConfirm(finalizedItem);
  };

  const handleSelectionChange = (group: string, value: string) => {
    setSelections((prev) => ({ ...prev, [group]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">{item.name.en}</h2>
        <div className="space-y-4">
          {item.options && (
            <div>
              <h3 className="font-semibold text-lg">Options:</h3>
              {item.options.map((opt) => (
                <label key={opt.name} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="main-option"
                    value={opt.name}
                    checked={selections["main"] === opt.name}
                    onChange={() => handleSelectionChange("main", opt.name)}
                  />
                  <span>
                    {opt.name} {opt.price ? `(£${opt.price.toFixed(2)})` : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
          {item.contents && (
            <div>
              <h3 className="font-semibold text-lg">Includes:</h3>
              <ul className="list-disc pl-5">
                {item.contents.map((content, index) => {
                  if (content.type === "choice") {
                    return (
                      <li key={index} className="mt-2">
                        <p className="font-semibold">{content.description}:</p>
                        {content.options.map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center space-x-2 pl-2"
                          >
                            <input
                              type="radio"
                              name={content.description}
                              value={opt}
                              checked={selections[content.description] === opt}
                              onChange={() =>
                                handleSelectionChange(content.description, opt)
                              }
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </li>
                    );
                  }
                  return <li key={index}>{content.item}</li>;
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Confirm & Add
          </button>
        </div>
      </div>
    </div>
  );
};

const PrimaryHorizontalButton = ({
  icon,
  isActive,
  onClick,
}: {
  icon: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`h-12 w-12 border-2 flex items-center justify-center p-1 rounded-md
      ${
        isActive
          ? "bg-blue-600 text-white border-l-gray-700 border-t-gray-700 border-r-blue-400 border-b-blue-400"
          : "bg-gray-300 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100"
      }`}
  >
    <span className="text-2xl">{icon}</span>
  </button>
);

const DishStyleButton = ({
  label,
  onClick,
  isSelected,
}: {
  label: { zh: string; en: string };
  onClick: () => void;
  isSelected: boolean;
}) => {
  const isEmpty = !label.en;

  return (
    <button
      disabled={isEmpty}
      className={`h-full w-full border-2 flex flex-col items-center justify-center text-black p-0.5
            ${
              isEmpty
                ? "bg-gray-200 border-gray-400 cursor-not-allowed"
                : isSelected
                ? "bg-blue-600 text-white border-l-gray-700 border-t-gray-700 border-r-blue-400 border-b-blue-400"
                : label.en === "Show All"
                ? "bg-red-400 border-r-gray-600 border-b-gray-600 border-l-gray-100 border-t-gray-100"
                : "bg-green-400 border-r-gray-600 border-b-gray-600 border-l-gray-100 border-t-gray-100"
            }`}
      onClick={onClick}
    >
      <span className="font-bold">{label.zh}</span>
      <span className="text-xs">{label.en}</span>
    </button>
  );
};

const RightPanel: React.FC<RightPanelProps> = ({
  menuItems,
  onAddItem,
  onOpenMenuRef,
}) => {
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(
    null
  );
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [secondaryPage, setSecondaryPage] = useState(0);
  const [itemForModal, setItemForModal] = useState<MenuItem | null>(null);

  const filteredResults = useMemo(() => {
    if (!selectedPrimary && !selectedSecondary) {
      return [...menuItems];
    }
    return menuItems.filter((item) => {
      // ----- THIS IS THE FIX -----
      // It safely checks if item.primaryCategories exists before calling .includes()
      const primaryMatch = selectedPrimary
        ? item.primaryCategories &&
          item.primaryCategories.includes(selectedPrimary)
        : true;

      const secondaryMatch =
        selectedSecondary && selectedSecondary !== "Show All"
          ? item.secondaryCategory === selectedSecondary
          : true;

      return primaryMatch && secondaryMatch;
    });
  }, [menuItems, selectedPrimary, selectedSecondary]);

  useEffect(() => {
    if (
      filteredResults.length > 0 &&
      !filteredResults.find((i) => i.id === selectedResultId)
    ) {
      setSelectedResultId(filteredResults[0].id);
    } else if (filteredResults.length === 0) {
      setSelectedResultId(null);
    }
  }, [filteredResults, selectedResultId]);

  const handlePrimarySelect = (category: string) => {
    setSelectedPrimary((prev) => (prev === category ? null : category));
  };

  const handleSecondarySelect = (category: string) => {
    if (category === "Show All") {
      setSelectedPrimary(null);
      setSelectedSecondary(null);
    } else {
      setSelectedSecondary((prev) => (prev === category ? null : category));
    }
  };

  const handleAttemptAddItem = (item: MenuItem) => {
    if (item.options || item.contents) {
      setItemForModal(item);
    } else {
      onAddItem(item);
      setSelectedPrimary(null);
      setSelectedSecondary(null);
    }
  };

  const handleConfirmItemWithOptions = (finalizedItem: MenuItem) => {
    onAddItem(finalizedItem);
    setItemForModal(null);
    setSelectedPrimary(null);
    setSelectedSecondary(null);
  };

  const handleNavigate = (direction: "up" | "down") => {
    if (!selectedResultId || filteredResults.length === 0) return;
    const currentIndex = filteredResults.findIndex(
      (item) => item.id === selectedResultId
    );
    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    if (direction === "up") {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(filteredResults.length - 1, currentIndex + 1);
    }

    if (newIndex !== currentIndex) {
      setSelectedResultId(filteredResults[newIndex].id);
    }
  };

  const currentSecondaryGrid = SECONDARY_CATEGORIES_PAGES[secondaryPage] || [];
  const selectedItem = useMemo(
    () => filteredResults.find((i) => i.id === selectedResultId),
    [filteredResults, selectedResultId]
  );

  return (
    <div className="w-[62%] bg-gray-300 flex flex-col gap-2">
      {itemForModal && (
        <ItemOptionsModal
          item={itemForModal}
          onConfirm={handleConfirmItemWithOptions}
          onClose={() => setItemForModal(null)}
        />
      )}
      <div className="h-[40%] bg-yellow-100 border-2 border-t-gray-600 border-l-gray-600 border-b-gray-100 border-r-gray-100 p-1 flex flex-col overflow-hidden">
        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-yellow-200">
              <tr>
                <th className="p-1 w-16">ID</th>
                <th className="p-1">Name</th>
                <th className="p-1">H/M</th>
                <th className="p-1 w-24 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedResultId(item.id)}
                  onDoubleClick={() => handleAttemptAddItem(item)}
                  className={`cursor-pointer ${
                    selectedResultId === item.id
                      ? "bg-blue-600 text-white"
                      : "hover:bg-yellow-200"
                  }`}
                >
                  <td className="p-1 font-mono">{item.id}</td>
                  <td className="p-1">{item.name.en}</td>
                  <td className="p-1">{item.name.zh}</td>
                  <td className="p-1 font-mono text-right">
                    {item.price != null
                      ? `£${item.price.toFixed(2)}`
                      : item.options || item.contents
                      ? "See options"
                      : "£0.00"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 mt-1 flex gap-1">
          <button
            onClick={() => selectedItem && handleAttemptAddItem(selectedItem)}
            disabled={!selectedItem}
            className="flex-grow h-10 bg-green-500 text-white font-bold border border-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add to Order 入单
          </button>
          <button
            onClick={() => handleNavigate("up")}
            className="w-10 h-10 bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500"
          >
            ▲
          </button>
          <button
            onClick={() => handleNavigate("down")}
            className="w-10 h-10 bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col">
        <div className="flex-shrink-0 flex gap-2 h-8 mb-2">
          <button className="bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 px-2">
            F8 - Dish Type 餐款入单
          </button>
          <button
            onClick={onOpenMenuRef}
            className="bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 px-2"
          >
            Menu Ref 餐号入单
          </button>
        </div>
        <div className="flex flex-wrap gap-1 h-14 mb-2 items-center justify-start">
          {PRIMARY_CATEGORIES_ICONS.map((cat) => (
            <PrimaryHorizontalButton
              key={cat.name}
              icon={cat.icon}
              isActive={selectedPrimary === cat.name}
              onClick={() => handlePrimarySelect(cat.name)}
            />
          ))}
        </div>
        <div className="flex-grow grid grid-cols-7 grid-rows-5 gap-1">
          {currentSecondaryGrid.map((cat, index) => {
            const uniqueKey = `${secondaryPage}-${index}`;
            if (cat.en === "<<" || cat.en === ">>") {
              const newPage =
                cat.en === ">>"
                  ? Math.min(
                      SECONDARY_CATEGORIES_PAGES.length - 1,
                      secondaryPage + 1
                    )
                  : Math.max(0, secondaryPage - 1);
              return (
                <DishStyleButton
                  key={uniqueKey}
                  label={cat}
                  onClick={() => setSecondaryPage(newPage)}
                  isSelected={false}
                />
              );
            }
            return (
              <DishStyleButton
                key={uniqueKey}
                label={cat}
                isSelected={selectedSecondary === cat.en}
                onClick={() => handleSecondarySelect(cat.en)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
