/**
 * client/src/api/client.ts
 *
 * Typed fetch wrappers for all backend REST endpoints.
 * This is the single source of truth for all API interactions.
 */

import { config } from "../config";
import type { FullOrder, ArchivedOrder, Customer, Address, ApiError } from "../types";

const API_BASE_URL = config.apiUrl;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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
    return request(`/orders${query}`);
  },

  async deleteOrder(id: number): Promise<void> {
    return request(`/orders/${id}`, { method: "DELETE" });
  },

  async deleteOrdersByDate(date: string): Promise<void> {
    return request(`/orders?date=${date}`, { method: "DELETE" });
  },

  async reprintOrder(id: number): Promise<{ printed: boolean }> {
    return request(`/orders/${id}/reprint`, { method: "POST" });
  },

  // Customers
  async fetchCustomer(phone: string): Promise<{ customer: Customer }> {
    return request(`/customers/${phone}`);
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
