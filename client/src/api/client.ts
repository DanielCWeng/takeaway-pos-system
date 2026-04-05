/**
 * client/src/api/client.ts
 *
 * Typed fetch wrappers for all backend REST endpoints.
 * This is the single source of truth for all API interactions.
 */

import { config } from "../config";
import { reportClientError } from "../lib/runtime-monitor";
import type { FullOrder, ArchivedOrder, Customer, Address, ApiError } from "../types";

const API_BASE_URL = config.apiUrl;

function adminAuthHeaders(): Record<string, string> {
  if (!config.adminPassword) return {};
  return { Authorization: `Bearer ${config.adminPassword}` };
}

function redactApiPath(path: string) {
  return path
    .replace(/\/customers\/[^/?]+/gi, "/customers/[redacted]")
    .replace(/\/orders\/\d+/g, "/orders/[id]")
    .replace(/\b07\d{9,11}\b/g, "[redacted-phone]");
}

function isSensitiveTelemetryPath(path: string) {
  return (
    /^\/customers\/[^/?]+(?:\/export)?(?:\?|$)/i.test(path) ||
    /^\/orders\/cleanup(?:\?|$)/i.test(path)
  );
}

function getTelemetrySource(path: string) {
  if (/^\/customers\/[^/?]+\/export(?:\?|$)/i.test(path)) return "/customers/[redacted]/export";
  if (/^\/customers\/[^/?]+(?:\?|$)/i.test(path)) return "/customers/[redacted]";
  if (/^\/orders\/cleanup(?:\?|$)/i.test(path)) return "/orders/cleanup";
  return redactApiPath(path);
}

function summarizeErrorDetails(details: unknown) {
  if (!details || typeof details !== "object") return undefined;
  const keys = Object.keys(details as Record<string, unknown>).slice(0, 8);
  if (keys.length === 0) return undefined;
  return `detailKeys=${keys.join(",")}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const sensitivePath = isSensitiveTelemetryPath(path);
  const telemetrySource = getTelemetrySource(path);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch (error) {
    reportClientError({
      type: "api.error",
      message: `API request failed (${sensitivePath ? "sensitive" : "standard"} endpoint) (NETWORK_ERROR)`,
      source: telemetrySource,
    });

    const networkError = new Error(
      error instanceof Error ? error.message : "Network request failed",
    ) as Error & { code?: string; status?: number };
    networkError.code = "NETWORK_ERROR";
    throw networkError;
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiError | undefined;
    const error = new Error(errorData?.error?.message || response.statusText) as Error & {
      code?: string;
      details?: unknown;
      status?: number;
    };
    error.code = errorData?.error?.code || "UNKNOWN_ERROR";
    error.details = errorData?.error?.details;
    error.status = response.status;

    // Report API failures to telemetry. For sensitive endpoints we only send
    // redacted endpoint labels and omit details entirely.
    const detailSummary = sensitivePath ? undefined : summarizeErrorDetails(error.details);
    reportClientError({
      type: "api.error",
      message: `API ${response.status} on ${telemetrySource} (${error.code})`,
      source: telemetrySource,
      stack: detailSummary,
    });

    throw error;
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

export const apiClient = {
  // Orders
  async submitOrder(order: FullOrder): Promise<{ orderId: number; printed: boolean }> {
    return request("/orders/print", {
      method: "POST",
      body: JSON.stringify({ order, payment: order.payment }),
    });
  },

  async fetchOrders(date?: string): Promise<{ orders: ArchivedOrder[] }> {
    const query = date ? `?date=${date}` : "";
    return request(`/orders${query}`, {
      headers: adminAuthHeaders(),
    });
  },

  async deleteOrder(id: number): Promise<void> {
    return request(`/orders/${id}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
  },

  async deleteOrdersByDate(date: string): Promise<void> {
    return request(`/orders?date=${date}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
  },

  async reprintOrder(id: number): Promise<{ printed: boolean }> {
    return request(`/orders/${id}/reprint`, {
      method: "POST",
      headers: adminAuthHeaders(),
    });
  },

  async cleanupOrders(): Promise<{ success: boolean; deletedCount: number }> {
    return request("/orders/cleanup", {
      method: "POST",
      headers: adminAuthHeaders(),
    });
  },

  // Customers
  async fetchCustomer(phone: string): Promise<{ customer: Customer }> {
    return request(`/customers/${phone}`);
  },

  async deleteCustomer(phone: string): Promise<{ ordersAnonymized: number }> {
    return request(`/customers/${phone}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
  },

  async exportCustomer(phone: string): Promise<unknown> {
    return request(`/customers/${phone}/export`, {
      headers: adminAuthHeaders(),
    });
  },

  // Addresses
  async lookupPostcode(postcode: string): Promise<{ addresses: Address[]; source: string }> {
    return request("/addresses/lookup", {
      method: "POST",
      body: JSON.stringify({ postcode }),
    });
  },

  async verifyAddress(
    phone: string,
    addressData: Partial<Address>,
  ): Promise<{ customer: Customer }> {
    return request("/addresses/verify", {
      method: "POST",
      body: JSON.stringify({ phone, addressData }),
    });
  },
};
