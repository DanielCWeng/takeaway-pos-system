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
  finalPrice?: number;
  quantity: number;
  hidePrice?: boolean;
  hideQuantity?: boolean;
  isSwapped?: boolean;
  modifiers?: Array<
    | string
    | {
        command?: string;
        ingredient?: { name?: string; zh?: string };
        name?: string;
        zh?: string;
      }
  >;
  parentId?: string;
  isFoc?: boolean;
  preFocPrice?: number;
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
  distance?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  mapRef?: string;
  deliveryInstructions?: string;
  deliveryTime?: string;
  isAnonymised?: boolean;
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
  subtotal?: number;
  deliveryCharge?: number;
  paymentDetails?: {
    amountPaid?: number;
    changeDue?: number;
  };
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
  town: string | null;
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
  callId?: number;
  mode?: "none" | "single_address" | "multi_address";
}

export type WebSocketMessage =
  | {
      type: "incoming_call";
      payload: CallDetectedPayload;
    }
  | {
      type: "incoming_call_multi_address";
      payload: CallDetectedPayload;
    };

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
