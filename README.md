# Takeaway POS System Rebuild

Monorepo for a custom takeaway point-of-sale platform with a React client and a Node.js server.

[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Client](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-149ECA?style=flat-square&logo=react&logoColor=white)](./client/README.md)
[![Server](https://img.shields.io/badge/Backend-Express%20%2B%20SQLite-000000?style=flat-square&logo=express&logoColor=white)](./server/README.md)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](./server/README.md#testing)

## Repository Layout

- `client/` - React + TypeScript + Vite frontend for the POS UI
- `server/` - Express + SQLite backend, WebSocket transport, and hardware adapters
- `docs/` - project documentation and planning materials
- `_legacy/` - legacy reference code retained for migration context

## Prerequisites

- Node.js 22+
- npm 10+

For production hardware support (USB printer and caller ID device), see `server/README.md` for native dependency setup.

## Quick Start

1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
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
```

Default URLs:

- Client: `http://localhost:5173`
- Server API: `http://localhost:4000/api`
- Server WebSocket: `ws://localhost:4000`

## Testing

```bash
cd server && npm test
cd client && npm test -- --run
```

## Formatting

Root formatting scripts:

```bash
npm run format
npm run format:client
npm run format:server
```

## Where To Go Next

- Backend details: [server/README.md](server/README.md)
- Frontend details: [client/README.md](client/README.md)
