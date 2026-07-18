# Takeaway POS Server

Backend service for the takeaway POS platform.

[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-ws-1F2937?style=flat-square)](https://github.com/websockets/ws)
[![Tested with Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)

## Tech Stack

- Node.js (ES modules)
- Express 5
- SQLite (`better-sqlite3`)
- WebSocket (`ws`)
- Zod validation
- Vitest + Supertest

## What This Service Does

- Archives orders and supports reprint flow
- Manages customer records and address updates
- Looks up addresses from local postcode DB and optional getaddress.io API
- Broadcasts incoming caller events to connected clients over WebSocket
- Integrates with optional hardware adapters:
  - USB ESC/POS thermal printer
  - HID caller ID device
  - Telephony dial/state provider (`none`, `tapi`, `asterisk_ami`)

## Directory Overview

- `src/api` - router composition and WebSocket server
- `src/domains` - domain modules (`orders`, `customers`, `addresses`, `callerIdService`, `telemetry`)
- `src/infrastructure` - DB singleton, migrations, logger
- `src/hardware` - printer and caller-ID device adapters
- `src/shared` - reusable errors, utilities, middleware
- `tests/unit` - isolated unit tests
- `tests/integration` - DB/API/WebSocket integration tests
- `scripts` - migration and postcode seeding scripts

## Prerequisites

- Node.js 22+
- npm 10+

### Linux/Raspberry Pi Native Dependencies (Hardware Builds)

Install before `npm install` if using hardware-related packages (`usb`, `node-hid`, `canvas`):

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 pkg-config libudev-dev \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

## Environment Setup

1. Copy environment template:

```bash
cp .env.example .env
```

2. Fill required values in `.env`.

Notes:

- `GETADDRESS_API_KEY` can be blank for degraded address lookup mode.
- `STORE_LATITUDE` and `STORE_LONGITUDE` are required.
- Set `TELEPHONY_PROVIDER=asterisk_ami` for Linux-native call-state/click-to-dial via Asterisk AMI.
- Keep `TELEPHONY_PROVIDER=none` for HID-only inbound caller pop (no click-to-dial).
- Config is validated at startup; invalid values cause immediate process exit.

## Run Locally

```bash
npm install
npm run migrate
npm run dev
```

Default API base URL: `http://localhost:4000/api`

## Scripts

- `npm start` - start server
- `npm run dev` - start with nodemon
- `npm test` - run all tests
- `npm run test:watch` - watch mode tests
- `npm run test:coverage` - coverage report
- `npm run lint` - lint `src`, `tests`, `scripts`
- `npm run lint:fix` - lint with fixes
- `npm run format` - prettier write
- `npm run format:check` - prettier check
- `npm run migrate` - run DB migrations
- `npm run db:seed-postcodes` - seed postcode DB from source JSON

## API Summary

Orders:

- `POST /api/orders`
- `POST /api/orders/print`
- `GET /api/orders`
- `GET /api/orders/:id`
- `DELETE /api/orders/:id` or `DELETE /api/orders?date=YYYY-MM-DD`
- `POST /api/orders/:id/reprint`

Customers:

- `GET /api/customers/:phone`
- `POST /api/customers/:phone/address`

Addresses:

- `POST /api/addresses/lookup`
- `POST /api/addresses/verify`

Telemetry:

- `POST /api/telemetry/client-error`

Menu:

- `GET /api/menu` (public read for POS and kitchen screens)
- `POST /api/menu`
- `PUT /api/menu/:id`
- `DELETE /api/menu/:id`

Menu writes, order history/reprint/delete/cleanup, and customer export/erasure
require `Authorization: Bearer <ADMIN_API_TOKEN>`. Order creation and kitchen
status transitions remain available to the trusted POS/KDS clients.

## Database and Migrations

- Orders and customers are stored in SQLite (`DB_PATH`)
- Migrations are SQL files in `src/infrastructure/migrations`
- Migrations are applied on startup and are safe to rerun

## Testing

```bash
npm test
```

Unit tests cover domain logic; integration tests cover API/DB/WebSocket behavior with isolated test databases.

## Troubleshooting

- Server exits on boot: verify `.env` values and formats
- Native module install failures: install platform build dependencies
- Address lookup returns empty: check `GETADDRESS_API_KEY` and network access
- Reprint reports `printed: false`: backend archived order, but printer adapter could not confirm device transfer
