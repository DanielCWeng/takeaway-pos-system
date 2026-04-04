/**
 * client/src/config/index.ts
 *
 * Reads import.meta.env values and exports a typed config object.
 */

interface Config {
  apiUrl: string;
  wsUrl: string;
  adminPassword?: string;
}

export const config: Config = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:4000",
  adminPassword: import.meta.env.VITE_ADMIN_PASSWORD || undefined,
};
