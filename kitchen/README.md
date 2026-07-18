# Kitchen Display Screen

A real-time Kanban board for the kitchen. Shows active orders in three columns — **New**, **Cooking**, and **Ready** — and lets staff advance each order through the status pipeline by tapping one button.

---

## Running locally

```bash
# 1. Start the server first (required for API + WebSocket)
cd ../server && npm run dev

# 2. Start the kitchen screen
cd kitchen
npm install
npm run dev        # http://localhost:5174
```

The Vite dev server proxies `/api` and `/ws` to `http://localhost:4000`, so no extra config is needed.

---

## Production build

```bash
npm run build      # outputs to kitchen/dist/
npm run preview    # serve the built output locally
```

Point a static file server (nginx, Caddy, etc.) at `kitchen/dist/`. The kitchen screen only needs network access to the Express server.

---

## Architecture

```
kitchen/src/
├── config.ts                  API_URL + WS_URL (empty = Vite proxy)
├── types/kitchen.ts           All shared types: KitchenOrder, StationType, etc.
├── hooks/
│   ├── useKitchenSocket.ts    WebSocket connection with exponential backoff
│   ├── useActiveOrders.ts     Fetch + live WS updates, race-condition safe buffering
│   ├── useBusyMode.ts         Busy mode detection + priority card + miss-window ids
│   ├── useCookTimer.ts        Estimated ready time, deadline, countdown formatting
│   └── useStationLoad.ts      Per-station load derived from active orders + menu
└── components/
    ├── KitchenBoard.tsx        Root board: header, banners, station panel, columns
    ├── KanbanColumn.tsx        One column (New / Cooking / Ready)
    ├── OrderCard.tsx           Individual order card with all status/action logic
    ├── CountdownTimer.tsx      Ticking deadline countdown (green → amber → red)
    ├── WaitingTime.tsx         "Waiting Xs" badge on new orders
    ├── DeliveryBadge.tsx       Delivery / Collection pill
    ├── StationLoadPanel.tsx    Row of station load pips
    ├── StationPip.tsx          Single station pip (idle / active / full / backlog)
    └── BusyModeBanner.tsx      Amber banner shown in busy mode
```

---

## Order status flow

```
new → accepted → cooking → ready → complete
                                 ↘ cancelled
```

- **new**: order just came in; kitchen hasn't touched it yet
- **accepted**: kitchen acknowledged — deadline clock started
- **cooking**: active on the line
- **ready**: food plated and waiting
- **complete / cancelled**: terminal states, removed from active view

Smart initialisation: if it's a collection order and the queue is empty, it skips straight to **cooking** automatically.

---

## Busy mode

Busy mode activates when:
- **Sustained load**: ≥ 4 active orders for 2 continuous minutes, OR
- **Rush detection**: ≥ 3 new orders arrive within any 10-minute rolling window

While busy:
- Delivery deadlines extend from 37 min → 60 min
- The highest-urgency order gets a golden "DO THIS NOW" priority badge
- Orders that can't make their window get a pulsing red "Won't make window" warning
- An amber busy-mode banner is shown across the top of the board

---

## Station load panel

Tracks load across 9 station types:

| Station | Description |
|---------|-------------|
| `dark_fryer` | For darker-battered items |
| `light_fryer` | For lighter-battered items |
| `oil_wok` | Dry-fried and high-heat dishes |
| `wet_wok` | Sauced dishes (2 woks) |
| `noodle_machine` | Auto noodle machines (3 total; 1 spicy-only) |
| `microwave` | Defrosting only |
| `sauce` | Sauce station (not a bottleneck — excluded from panel) |
| `boiler` | Always-on for rice; shown as static "BOILER: ON" |

Load states per station:
- **Idle** (grey): nothing queued
- **Active** (amber): 1–(slots) orders
- **Full** (orange): at capacity
- **Backlog** (red): more orders than slots

---

## Bilingual display

All item names show English + Chinese (Noto Sans SC, amber tint) where translations exist in the menu. Modifiers also show their Chinese translation when available.

---

## WebSocket events consumed

| Event | Action |
|-------|--------|
| `order_created` | Prepend new order card to New column |
| `order_status_changed` | Move card to correct column |
| `order_cancelled` | Remove card from board |
| `order_eta_updated` | Update countdown timer on affected card |

See the root [`README.md`](../README.md) for the full WS event payload schemas.
