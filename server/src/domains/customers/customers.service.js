import { randomUUID } from "crypto";
import * as repo from "./customers.repo.js";
import * as orders from "../orders/orders.service.js";
import { haversineInMiles } from "../../shared/haversine.js";
import { config } from "../../config/index.js";
import { logger } from "../../infrastructure/logger.js";
import { ValidationError, NotFoundError } from "../../shared/errors.js";
import { normaliseUkPhone } from "../../shared/phones.js";

function validatePhone(phone) {
  if (!phone || typeof phone !== "string") {
    throw new ValidationError("Phone must be a non-empty string", { field: "phone" });
  }
  if (phone.startsWith("UNKNOWN-")) return phone;
  const digits = normaliseUkPhone(phone);
  if (digits.length < 10 || digits.length > 13) {
    throw new ValidationError("Phone number must contain between 10 and 13 digits", {
      field: "phone",
      received: phone,
    });
  }
  return digits;
}

function isAnonymizedPhoneIdentifier(phone) {
  return typeof phone === "string" && phone.startsWith("ANON-");
}

function withDistance(address) {
  const hasCoordinates = Number.isFinite(address.latitude) && Number.isFinite(address.longitude);
  return {
    ...address,
    distance: hasCoordinates
      ? Number(
          haversineInMiles(
            config.address.storeLatitude,
            config.address.storeLongitude,
            address.latitude,
            address.longitude,
          ).toFixed(2),
        )
      : null,
  };
}

export function getOrCreateCustomer(phone) {
  const normalised = validatePhone(phone);
  return repo.upsertAndIncrementCallCount(normalised, {});
}

export function getCustomerByPhone(phone) {
  const normalised = validatePhone(phone);
  const customer = repo.findByPhone(normalised);
  if (!customer) throw new NotFoundError(`Customer with phone ${phone} not found`, { phone });
  return customer;
}

export function listCustomerAddresses(phone) {
  const normalised = validatePhone(phone);
  if (!repo.findByPhone(normalised)) {
    throw new NotFoundError(`Customer with phone ${phone} not found`, { phone });
  }
  return repo.listAddressesByCustomer(normalised).map(withDistance);
}

export function syncCustomerFromOrder(customerInfo, { includeAddress = false } = {}) {
  if (!customerInfo?.phone) return;
  const phone = validatePhone(customerInfo.phone);
  const now = new Date().toISOString();
  const existing = repo.findByPhone(phone);
  if (!existing) {
    repo.upsertCustomer({
      phone,
      name: customerInfo.name,
      firstCall: now,
      lastCall: now,
      callCount: 1,
    });
  } else if (customerInfo.name && customerInfo.name !== existing.name) {
    repo.updateName(phone, customerInfo.name);
  }

  if (includeAddress && customerInfo.line1) {
    repo.upsertCustomerAddress(phone, {
      line1: customerInfo.line1,
      line2: customerInfo.line2,
      town: customerInfo.town,
      postcode: customerInfo.postcode,
      latitude: customerInfo.latitude,
      longitude: customerInfo.longitude,
    });
  }
}

export function deleteCustomerData(phone) {
  if (isAnonymizedPhoneIdentifier(phone)) {
    throw new ValidationError(
      "Customer record has already been anonymised and cannot be deleted again",
      { field: "phone", anonymised: true },
    );
  }
  const normalised = validatePhone(phone);
  const anonId = `ANON-${randomUUID()}`;
  const ordersAnonymized = orders.scrubOrdersByPhone(normalised, anonId);
  repo.deleteByPhone(normalised);
  logger.info("Customer data erased (GDPR)", { ordersAnonymized, piiRemoved: true });
  return { ordersAnonymized };
}

export function exportCustomerData(phone) {
  if (isAnonymizedPhoneIdentifier(phone)) {
    throw new ValidationError("Customer record has been anonymised and can no longer be exported", {
      field: "phone",
      anonymised: true,
    });
  }
  const normalised = validatePhone(phone);
  const customer = repo.findByPhone(normalised);
  if (!customer) throw new NotFoundError(`Customer with phone ${phone} not found`, { phone });
  return {
    customer,
    addresses: repo.listAddressesByCustomer(normalised).map(withDistance),
    orders: orders.getOrdersByPhone(normalised),
    exportedAt: new Date().toISOString(),
  };
}
