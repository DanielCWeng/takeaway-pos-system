# Takeaway POS Client

Frontend application for the takeaway point-of-sale workflow.

[![React 19](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tested with Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)

## Tech Stack
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Radix UI primitives
- Vitest + Testing Library

## What This App Does

- Builds and edits orders in a touch-friendly POS interface
- Handles incoming caller events over WebSocket
- Supports customer capture and delivery-address workflows
- Submits printable orders to backend and manages offline print queue retries
- Provides admin history view with date filtering and reprint actions

## Directory Overview

- `src/components/layout` - main POS screens and panel layout
- `src/components/modals` - order/customer/admin modal workflows
- `src/components/ui` - reusable UI primitives
- `src/context` - global app state providers (`Order`, `Caller`, `Theme`, `UI`)
- `src/hooks` - socket and call orchestration hooks
- `src/api` - typed backend API client
- `src/lib` - utility and runtime monitoring helpers
- `src/constants` - menu and delivery constants
- `src/types` - shared app types

## Environment Setup

1. Copy template:

```bash
cp .env.example .env
```

2. Set values as needed:

- `VITE_API_URL` default: `http://localhost:4000/api`
- `VITE_WS_URL` default: `ws://localhost:4000`
- `VITE_ADMIN_PASSWORD` for Admin screen unlock

## Run Locally

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:5173`

## Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - type-check and production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint
- `npm test` - run Vitest

## Backend Integration

The client expects the server API and WebSocket endpoints to be reachable.

Minimum backend routes consumed by this client:

- Orders: create/print, list, delete, reprint
- Customers: fetch customer by phone
- Addresses: postcode lookup and verification
- Telemetry: runtime client-error reporting

## Testing

```bash
npm test -- --run
```

Current tests focus on hooks and core order-context behavior. UI-heavy modal/layout workflows are partially covered and can be expanded over time.

## Build Notes

- Runtime monitor reports global errors to the server telemetry endpoint
- Chunk-load failures trigger a one-time reload attempt per browser session
- Order draft and print queue state are persisted in `localStorage`

