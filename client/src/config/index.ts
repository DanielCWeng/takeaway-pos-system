/**
 * client/src/config/index.ts
 *
 * Reads import.meta.env values and exports a typed config object.
 */

interface Config {
  apiUrl: string;
  wsUrl: string;
  adminApiToken?: string;
  adminTokenMismatch: boolean;
}

const adminApiToken = import.meta.env.VITE_ADMIN_API_TOKEN;
const legacyAdminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

export const config: Config = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:4000",
  // Canonical key: VITE_ADMIN_API_TOKEN. Keep legacy fallback temporarily.
  adminApiToken: adminApiToken || legacyAdminPassword || undefined,
  adminTokenMismatch:
    Boolean(adminApiToken) &&
    Boolean(legacyAdminPassword) &&
    adminApiToken !== legacyAdminPassword,
};
