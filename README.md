# Takeaway POS System Rebuild

Monorepo for a custom takeaway point-of-sale platform with a React client and a Node.js server.

[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Client](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-149ECA?style=flat-square&logo=react&logoColor=white)](./client/README.md)
[![Server](https://img.shields.io/badge/Backend-Express%20%2B%20SQLite-000000?style=flat-square&logo=express&logoColor=white)](./server/README.md)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](./server/README.md#testing)

## Repository Layout

- `client/` - React + TypeScript + Vite frontend for the POS UI
- `server/` - Express + SQLite backend, WebSocket transport, and hardware adapters
- `kitchen/` - React kitchen display screen (KDS) — real-time Kanban board for the kitchen
- `_legacy/` - legacy reference code retained for migration context

## Prerequisites

- Node.js 22+
- npm 10+

For production hardware support (USB printer and caller ID device), see `server/README.md` for native dependency setup.

## Quick Start

On Windows, after installing dependencies and configuring `server/.env`, run
`start.bat` from the repository root. It opens the POS client and starts the
server and kitchen display in separate terminal windows. When TAPI is enabled,
the server also starts `TapiBridge.exe` automatically.

1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
cd ../kitchen && npm install
```

2. Configure environment files

```bash
cd server
cp .env.example .env

cd ../client
cp .env.example .env
```

3. Run database migrations (optional but recommended for first setup)

```bash
cd server
npm run migrate
```

4. Start backend and frontend (in separate terminals)

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev

# terminal 3 (optional — kitchen display screen)
cd kitchen
npm run dev
```

Default URLs:

- Client: `http://localhost:5173`
- Kitchen display: `http://localhost:5174`
- Server API: `http://localhost:4000/api`
- Server WebSocket: `ws://localhost:4000`

## Address lookup

The server uses getAddress.io for postcode lookup and persists successful responses in the main `orders.db` database. There is no seeded postcode database or postcode-validation dataset. Customer addresses are operator-confirmed history; lookup failures never guess an address and the POS remains usable through manual address entry.

The address-schema release requires an intentional fresh start: stop all POS processes and remove the existing `server/data/orders.db` (including WAL/SHM sidecars) and any legacy `postcodes.db` before first startup. Existing orders, customers, calls, address history, client drafts, and queued print retries are not migrated.

## Testing

```bash
cd server && npm test
cd client && npm test -- --run
```

## Administration and Network Access

Set the same `ADMIN_API_TOKEN` on the server and `VITE_ADMIN_API_TOKEN` on the
client when using order history, customer export/erasure, menu editing, or
retention cleanup. The client token is delivered to the browser, so this is an
operator-control token for a trusted POS network, not a substitute for a
separate identity provider.

The server CORS policy allows `PATCH` because the kitchen display advances
order statuses through `PATCH /api/orders/:id/status`. If the client and server
origins differ, set `CORS_ORIGIN` to the client origin. For multiple trusted
origins, use a comma-separated list such as
`http://localhost:5173,http://192.168.1.50:5173`.

## Formatting

Root formatting scripts:

```bash
npm run format
npm run format:client
npm run format:server
```

Auto-format on commit (recommended):

```bash
git config core.hooksPath .githooks
```

This enables the repo pre-commit hook that runs Prettier on staged files before each commit.

## New API endpoints (kitchen integration)

Added as part of the kitchen display screen feature branch:

| Method  | Path                     | Description                                                    |
| ------- | ------------------------ | -------------------------------------------------------------- |
| `GET`   | `/api/orders/active`     | All non-complete/non-cancelled orders with live kitchen status |
| `PATCH` | `/api/orders/:id/status` | Advance an order through the kitchen state machine             |

Valid statuses: `new → accepted → cooking → ready → complete / cancelled`

### New WebSocket events

| Event type             | Payload                                          |
| ---------------------- | ------------------------------------------------ |
| `order_created`        | `{ orderId, order, archivedAt, status }`         |
| `order_status_changed` | `{ orderId, previousStatus, status, updatedAt }` |
| `order_cancelled`      | `{ orderId }`                                    |
| `order_eta_updated`    | `{ orderId, estimatedReadyAt }`                  |

The `WebSocketMessage` type in `client/src/types/index.ts` has been updated to include all four new event types alongside the existing `incoming_call` event.

Migration `005_order_status.sql` adds the `order_status` table that backs these endpoints.

## Where To Go Next

- Backend details: [server/README.md](server/README.md)
- Frontend details: [client/README.md](client/README.md)
- Kitchen display: [kitchen/README.md](kitchen/README.md)
