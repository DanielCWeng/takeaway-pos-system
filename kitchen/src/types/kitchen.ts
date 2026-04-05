/**
 * kitchen/src/types/kitchen.ts
 *
 * All types used by the kitchen screen.
 * Intentionally self-contained — does not import from the POS client.
 */

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

export type StationType =
  | "dark_fryer"
  | "light_fryer"
  | "oil_wok"
  | "wet_wok"
  | "noodle_machine"
  | "noodle_machine_spicy"
  | "microwave"
  | "boiler"
  | "sauce";

export interface StationRequirement {
  station: StationType;
  durationSeconds: number;
}

export interface StationConfig {
  slots: number;
  portionCapacity: number;
}

export const STATION_CONFIG: Record<StationType, StationConfig> = {
  dark_fryer:           { slots: 1, portionCapacity: 5 },
  light_fryer:          { slots: 1, portionCapacity: 5 },
  oil_wok:              { slots: 2, portionCapacity: 2 },
  wet_wok:              { slots: 2, portionCapacity: 1 },
  noodle_machine:       { slots: 2, portionCapacity: 1 },
  noodle_machine_spicy: { slots: 1, portionCapacity: 1 },
  microwave:            { slots: 1, portionCapacity: 3 },
  boiler:               { slots: 1, portionCapacity: 4 },
  sauce:                { slots: 1, portionCapacity: 99 },
};

// Stations shown on the load panel — sauce and boiler excluded
// (sauce is never a bottleneck; boiler is shown as a static always-on indicator)
export const TRACKED_STATIONS: StationType[] = [
  "dark_fryer",
  "light_fryer",
  "oil_wok",
  "wet_wok",
  "noodle_machine",
  "noodle_machine_spicy",
  "microwave",
];

export const STATION_LABELS: Record<StationType, string> = {
  dark_fryer:           "DARK FRY",
  light_fryer:          "LIGHT FRY",
  oil_wok:              "OIL WOKS",
  wet_wok:              "WET WOKS",
  noodle_machine:       "NOODLE",
  noodle_machine_spicy: "SPICY NDL",
  microwave:            "MICROWAVE",
  boiler:               "BOILER",
  sauce:                "SAUCE",
};

// ---------------------------------------------------------------------------
// Order types (subset of FullOrder from the POS client)
// ---------------------------------------------------------------------------

export interface OrderModifier {
  command?: string;
  ingredient?: { name?: string; zh?: string };
  name?: string;
  zh?: string;
}

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
  modifiers?: Array<string | OrderModifier>;
  parentId?: string;
  isFoc?: boolean;
  isIncluded?: boolean;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
  houseNumber?: string;
  street?: string;
  town?: string;
  postcode?: string;
  deliveryInstructions?: string;
  deliveryTime?: string;
  latitude?: number | null;
  longitude?: number | null;
  distance?: number | null;  // miles from store
}

export interface FullOrder {
  items: OrderItem[];
  orderType: "collection" | "delivery";
  customerInfo?: CustomerInfo;
  payment: { method: string; amount: number };
  total: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export interface MenuItem {
  id: string;
  name: { en: string; zh: string };
  price?: number;
  primaryCategory?: string;
  /** Seconds at the primary station. */
  primaryCookTime?: number;
  primaryStation?: StationType;
  /** Seconds at the secondary station (sequential after primary). */
  secondaryCookTime?: number;
  secondaryStation?: StationType;
  portionCapacity?: number;
}

// ---------------------------------------------------------------------------
// Kitchen domain
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "new"
  | "accepted"
  | "cooking"
  | "ready"
  | "complete"
  | "cancelled";

export interface KitchenOrder {
  orderId: number;
  order: FullOrder;
  status: OrderStatus;
  archivedAt: string;
  estimatedReadyAt: string; // calculated client-side from cookTimeSeconds
  actualReadyAt?: string;   // set when status → 'ready'
  deadline: string;         // customer expectation window — drives priority
}

export interface QueueSummary {
  total: number;
  byStatus: Partial<Record<OrderStatus, number>>;
  busyMode: boolean;
  urgentCount: number;
  willMissWindow: number;
}

export interface StationLoad {
  used: number;     // slot-uses currently occupied
  capacity: number; // total slots
  queued: number;   // items waiting because station is full
}

export type StationLoadMap = Partial<Record<StationType, StationLoad>>;

// ---------------------------------------------------------------------------
// WebSocket events
// ---------------------------------------------------------------------------

export type KitchenSocketEvent =
  | { type: "order_created";       payload: { orderId: number; order: FullOrder; archivedAt: string; status: OrderStatus } }
  | { type: "order_status_changed"; payload: { orderId: number; previousStatus: OrderStatus; status: OrderStatus; updatedAt: string } }
  | { type: "order_cancelled";      payload: { orderId: number } }
  | { type: "order_eta_updated";    payload: { orderId: number; estimatedReadyAt: string } }
  | { type: "incoming_call";        payload: unknown }; // passthrough — kitchen ignores this
