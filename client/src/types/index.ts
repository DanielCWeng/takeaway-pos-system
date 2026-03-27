/**
 * client/src/types/index.ts
 *
 * Single source of truth for all shared TypeScript interfaces.
 */

export interface OrderItem {
  uniqueId: string;
  id: string;
  name: string;
  zhName?: string;
  price: number;
  quantity: number;
  parentId?: string;
  isFoc?: boolean;
  isIncluded?: boolean;
}

export interface ItemOption {
  name: string;
  price?: number;
}

export interface MenuContent {
  type?: "choice" | "item";
  item?: string;
  description?: string;
  options?: string[];
}

export interface MenuItem {
  id: string;
  name: {
    en: string;
    zh: string;
  };
  price?: number;
  primaryCategory?: string;
  primaryCategories?: string[];
  secondaryCategory?: string;
  options?: ItemOption[];
  contents?: MenuContent[];
}

export type OrderType = "collection" | "delivery";

export interface CustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
  houseNumber?: string;
  street?: string;
  town?: string;
  postcode?: string;
  distance?: number;
  deliveryInstructions?: string;
  deliveryTime?: string;
}

export interface PaymentDetails {
  method: "cash" | "card";
  amount: number;
}

/**
 * The "data" blob stored in the database and sent in /api/orders/print
 */
export interface FullOrder {
  items: OrderItem[];
  orderType: OrderType;
  customerInfo?: CustomerInfo;
  payment: PaymentDetails;
  total: number;
  notes?: string;
}

/**
 * The structure of an order as returned from the archive
 */
export interface ArchivedOrder {
  id: number;
  data: FullOrder;
  archivedAt: string;
}

export interface Customer {
  phone: string;
  name: string | null;
  postcode: string | null;
  houseNumber: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  firstCall: string;
  lastCall: string;
  callCount: number;
}

export interface Address {
  line1: string;
  line2?: string;
  town?: string;
  postcode: string;
  latitude: number;
  longitude: number;
}

export interface CallDetectedPayload {
  phone: string;
  customer: Customer | null;
  addresses: Address[];
  distance: number | null;
}

export type WebSocketMessage = {
  type: "incoming_call";
  payload: CallDetectedPayload;
};

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
