import { MenuItem, Modifier } from "./types";

export const SET_MEALS = [
  { id: "A", name: "Happy Meal", size: "", price: 11.0 },
  { id: "B", name: "Set Meal B", size: "2 人餐", price: 24.0 },
  { id: "C", name: "Set Meal C", size: "3 人餐", price: 33.0 },
  { id: "D", name: "Set Meal D", size: "4 人餐", price: 47.0 },
  { id: "1a", name: "1/4 Aromatic Duck", size: "1/4 甲", price: 9.6 },
  { id: "1b", name: "1/2 Aromatic Duck", size: "1/2 甲", price: 18.0 },
  { id: "1c", name: "Whole Aromatic Duck", size: "全甲", price: 36.0 },
];

export const SET_MEAL_COMPONENTS: { [key: string]: string[] } = {
  SET2: ["3", "42", "100", "232", "239"], // Spare Ribs, S&S Chicken HK, Beef Green Pepper, Egg Fried Rice, Prawn Crackers
  // Add other sets here as needed
};

export const DISH_GRID_ITEMS = [
  // Row 1
  ["Show All", "Starter", "Spare Rib", "Chicken Wing", "Soup", "Salt & Pepper"],
  // Row 2
  ["Satay", "Black Bean", "Curry", "Thai-Curry", "Thai", "Sambal"],
  // Row 3
  ["Chef's", "Ginger & S Onion", "Sweet & Sour", "Chilli Garlic", "Peking", "Cashew Nuts"],
  // Row 4
  ["Black Pepper", "Lemon/Plum", "Pineapple", "Kung Po", "Chop Suey", "Mixed Veg"],
  // Row 5 (with placeholders for the new buttons)
  ["Szechuan", "Oyster", "Mushroom", "Rice", "Chow Mein", "Veg"],

  ["Snack Box", "English", "Foo Yung", "PREV_BUTTON", "NEXT_BUTTON"],
];

export const CATEGORY_ICONS = ["🐄", "🐑", "🐖", "🐔", "🐟", "🍤", "🥦", "🌶️"];

export const MODIFIERS: Modifier[] = [
  // Page 1
  { id: 1, name: "Sauce", section: "Sauce", priceChange: 0.0 },
  { id: 2, name: "Curry", section: "Sauce", priceChange: 0.0 },
  { id: 3, name: "Sweet Sour", section: "Sauce", priceChange: 0.0 },
  { id: 4, name: "BBQ Sauce", section: "Sauce", priceChange: 0.0 },
  { id: 5, name: "B.Pepper Sauce", section: "Sauce", priceChange: 0.0 },
  { id: 6, name: "B.Bean", section: "Sauce", priceChange: 0.0 },
  { id: 7, name: "Honey & Spicy", section: "Sauce", priceChange: 0.0 },
  { id: 8, name: "Kung Po", section: "Sauce", priceChange: 0.0 },
  { id: 9, name: "Peking Sauce", section: "Sauce", priceChange: 0.0 },
  { id: 10, name: "Lemon Sauce", section: "Sauce", priceChange: 0.0 },
  { id: 11, name: "Orange", section: "Sauce", priceChange: 0.0 },
  { id: 12, name: "Satay Sauce", section: "Sauce", priceChange: 0.0 },
  { id: 13, name: "Gravy Sauce", section: "Sauce", priceChange: 0.0 },
  { id: 14, name: "Sauce Separate", section: "Sauce", priceChange: 0.0 },
  { id: 15, name: "Sauce Less Spicy", section: "Sauce", priceChange: 0.0 },
  { id: 16, name: "Sauce Medium", section: "Sauce", priceChange: 0.0 },
  { id: 17, name: "Sauce Extra Hot", section: "Sauce", priceChange: 0.0 },
  { id: 18, name: "Thai Sweet Chilli", section: "Sauce", priceChange: 0.0 },
  { id: 20, name: "Veg", section: "Veg", priceChange: 0.0 },
  { id: 21, name: "Onion", section: "Veg", priceChange: 0.0 },
  { id: 22, name: "Beansprout", section: "Veg", priceChange: 0.0 },
  { id: 23, name: "Mushroom", section: "Veg", priceChange: 0.5 },
  { id: 24, name: "Pineapple", section: "Veg", priceChange: 0.0 },
  { id: 25, name: "Cashew nuts", section: "Veg", priceChange: 1.0 },
  { id: 26, name: "Tomato", section: "Veg", priceChange: 0.0 },
  { id: 27, name: "Cucumber", section: "Veg", priceChange: 0.0 },
  { id: 28, name: "Waterchestnut", section: "Veg", priceChange: 0.0 },
  { id: 29, name: "Fresh Chillies", section: "Veg", priceChange: 0.0 },
  { id: 30, name: "Bamboo Shoots", section: "Veg", priceChange: 0.0 },
  { id: 31, name: "Baby Corn", section: "Veg", priceChange: 0.0 },
  { id: 35, name: "Garlic", section: "Veg", priceChange: 0.0 },
  { id: 36, name: "Egg", section: "Veg", priceChange: 0.0 },
  { id: 37, name: "Chinese Leaf", section: "Veg", priceChange: 0.0 },
  { id: 38, name: "Black Beans", section: "Veg", priceChange: 0.0 },
  { id: 39, name: "Orange", section: "Veg", priceChange: 0.0 },
  { id: 40, name: "Carrott", section: "Veg", priceChange: 0.0 },
  { id: 41, name: "Broccoli", section: "Veg", priceChange: 0.0 },
  { id: 42, name: "Spring Onions", section: "Veg", priceChange: 0.0 },
  { id: 43, name: "Lemon", section: "Veg", priceChange: 0.0 },
  { id: 45, name: "Jinger", section: "Veg", priceChange: 0.0 },
  // Page 2
  { id: 46, name: "Spicy", section: "Misc", priceChange: 0.0 },
  { id: 47, name: "Salt", section: "Misc", priceChange: 0.0 },
  { id: 48, name: "Sugar", section: "Misc", priceChange: 0.0 },
  { id: 49, name: "MSG", section: "Misc", priceChange: 0.0 },
  { id: 50, name: "Soy Sauce", section: "Misc", priceChange: 0.0 },
  { id: 51, name: "Vinegar", section: "Misc", priceChange: 0.0 },
  { id: 52, name: "Wine", section: "Misc", priceChange: 0.0 },
  { id: 53, name: "Peppers", section: "Misc", priceChange: 0.0 },
  { id: 54, name: "Oyster Sauce", section: "Misc", priceChange: 0.0 },
  { id: 55, name: "Oil", section: "Misc", priceChange: 0.0 },
  { id: 56, name: "Large", section: "Misc", priceChange: 1.0 },
  { id: 57, name: "Small", section: "Misc", priceChange: 0.0 },
  { id: 58, name: "Batter", section: "Misc", priceChange: 0.0 },
  { id: 59, name: "Shredded", section: "Misc", priceChange: 0.0 },
  { id: 60, name: "Sauce Separate", section: "Misc", priceChange: 0.8 },
  { id: 61, name: "Open", section: "Misc", priceChange: 0.0 },
  { id: 62, name: "Crispy", section: "Misc", priceChange: 0.0 },
  { id: 63, name: "Extra Pancake", section: "Misc", priceChange: 0.0 },
  { id: 64, name: "Pork", section: "Meat", priceChange: 0.0 },
  { id: 65, name: "Shrimp", section: "Meat", priceChange: 1.0 },
  { id: 66, name: "King Prawn", section: "Meat", priceChange: 1.0 },
  { id: 67, name: "Roast Pork", section: "Meat", priceChange: 1.0 },
  { id: 68, name: "Duck", section: "Meat", priceChange: 2.0 },
  { id: 69, name: "Chicken", section: "Meat", priceChange: 1.0 },
  { id: 70, name: "Beef", section: "Meat", priceChange: 1.0 },
  { id: 71, name: "Ham", section: "Meat", priceChange: 0.0 },
  { id: 72, name: "Fish", section: "Meat", priceChange: 0.0 },
  { id: 73, name: "Mussels", section: "Meat", priceChange: 0.0 },
  { id: 74, name: "Squid", section: "Meat", priceChange: 0.0 },
  { id: 75, name: "Seafood", section: "Meat", priceChange: 0.0 },
  { id: 76, name: "Shell Fish", section: "Meat", priceChange: 0.0 },
  { id: 77, name: "Nuts", section: "Misc", priceChange: 0.0 },
  { id: 78, name: "Egg", section: "Misc", priceChange: 0.0 },
  { id: 79, name: "Celery", section: "Misc", priceChange: 0.0 },
  { id: 80, name: "Gluten", section: "Misc", priceChange: 0.0 },
  { id: 81, name: "Soya", section: "Misc", priceChange: 0.0 },
  { id: 82, name: "Milk", section: "Misc", priceChange: 0.0 },
  { id: 83, name: "Mustard", section: "Misc", priceChange: 0.0 },
  { id: 84, name: "Peanuts", section: "Misc", priceChange: 0.0 },
  { id: 85, name: "Sesame", section: "Misc", priceChange: 0.0 },
  { id: 86, name: "Soya Sauce", section: "Misc", priceChange: 0.0 },
  { id: 87, name: "Sesame Oil", section: "Misc", priceChange: 0.0 },
];

export const CATEGORIES: MenuItem["category"][] = [
  "Chicken",
  "Beef",
  "Vegetable",
  "Special",
  "Seafood",
  "Drink",
];

export const DELIVERY_CHARGE = 2.0;

/**
 * Calculate delivery charge based on distance
 * - Base charge (0-2 miles): £2.00
 * - Over 2 miles: £2.50
 * - Over 3 miles: £3.00
 * - And continues at £0.50 increments per mile
 */
export function calculateDeliveryCharge(distanceInMiles?: number): number {
  if (!distanceInMiles || distanceInMiles <= 2) {
    return 2.0;
  }

  // For distances over 2 miles, calculate charge
  // £2.00 + £0.50 for each mile over 2
  const milesOver2 = Math.floor(distanceInMiles - 2);
  return 2.0 + milesOver2 * 0.5;
}

export const API_BASE_URL = "http://" + window.location.hostname + ":4000";
