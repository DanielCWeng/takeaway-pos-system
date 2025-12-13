// A single option for a menu item, e.g., "Quarter" duck or "Chips" for a snack box.
// Price is optional because some options don't change the price (e.g., steak doneness).
export interface ItemOption {
  name: string;
  price?: number; // <--- CHANGED: Made price optional
}

// Represents an item within a Set Dinner, which can be a fixed item or a choice.
export interface MenuContent {
  type?: "choice" | "item";
  item?: string;
  description?: string;
  options?: string[];
}

// The main interface for any item on the menu.
export interface MenuItem {
  id: string;
  name: {
    en: string;
    zh: string;
  };
  price?: number;
  primaryCategories: string[]; // <-- CHANGED from primaryCategory: string
  secondaryCategory: string;
  options?: ItemOption[];
  contents?: MenuContent[];
  selections?: { [key: string]: string | string[] };
}
// A modifier that can be added to an order item (e.g., "Extra Sauce").
export interface Modifier {
  id: number;
  name: string;
  section: "Sauce" | "Veg" | "Meat" | "Misc";
  priceChange: number;
}

// An item once it has been added to an order.
export interface OrderItem {
  id: string; // Unique ID for each item in the order
  menuItem: MenuItem;
  displayName: string;
  modifiers: Modifier[];
  quantity: number;
  finalPrice: number;
  customPrice?: number;
  customInstructions?: string;
  customName?: string;
  selections?: { [key: string]: string | string[] };
  hideQuantity?: boolean;
  hidePrice?: boolean;
  isPartOfSet?: boolean;
  setMealId?: string;
  isSwapped?: boolean;
}

// The type of the current order.
export enum OrderType {
  InHouse = "In-House",
  Delivery = "Delivery",
  Collection = "Collection",
}

// Information for a customer, typically for delivery or collection.
export interface CustomerInfo {
  phone?: string;
  name?: string;
  postcode?: string;
  houseNumber?: string;
  street?: string;
  town?: string;
  address?: string;
  distance?: number;
  deliveryInstructions?: string;
  status?: "COMPLETE" | "NEEDS_ADDRESS";
  deliveryTime?: string;
}

// Represents an order.
export interface Order {
  postcode?: string;
  houseNumber?: string;
  street?: string;
  town?: string;
  address?: string;
  discount: number;
  autoCreated?: boolean;
  createdAt?: number;
  hasUnreadChanges?: boolean;
  deliveryInstructions?: string;
  status?: "COMPLETE" | "NEEDS_ADDRESS";
}
