
// Modify MenuItem
// In types.ts

export interface MenuItem {
  id: string; // <--- CHANGE THIS FROM number to string
  name: {
    en: string;
    zh: string;
  };
  price?: number; // Also make price optional as I suggested before
  primaryCategory: string;
  secondaryCategory: string;
  options?: ItemOption[];
}

export interface Modifier {
  id: number;
  name: string;
  section: 'Sauce' | 'Veg' | 'Meat' | 'Misc';
  priceChange: number;
}

export interface OrderItem {
  id: string; // Unique ID for each item in the order, e.g., using Date.now()
  menuItem: MenuItem;
  displayName: string;
  modifiers: Modifier[];
  quantity: number;
  finalPrice: number;
}

export enum OrderType {
  InHouse = 'In-House',
  Delivery = 'Delivery',
  Collection = 'Collection',
}

export interface CustomerInfo {
  phone?: string;
  name?: string;
  postcode?: string;
  houseNumber?: string;
  street?: string;
  town?: string; // <-- ADD THIS
  address?: string;
  distance?: number; // <-- ADD THIS
  deliveryInstructions?: string; // <-- ADD THIS
  status?: 'COMPLETE' | 'NEEDS_ADDRESS';s
}

// Add this new interface
export interface ItemOption {
  name: string;
  price: number;
}
