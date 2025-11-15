// server/services/callerIdService.js (Correct ES Modules Version)

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { HID } from "node-hid";
import fetch from "node-fetch";
import { LRUCache } from "lru-cache";

// ====================== AUTO-DETECT JD-2000S ======================
function findJD2000S() {
  try {
    const devices = HID.devices();
    const match = devices.find(
      (d) =>
        (d.product && d.product.includes("JD-2000S")) ||
        (d.manufacturer && d.manufacturer.includes("KOSEN")) ||
        (d.vendorId === 0x0483 && d.productId === 0x5750)
    );
    if (!match) {
      console.warn("JD-2000S not found in HID devices");
      return null;
    }
    if (fs.existsSync("/sys/class/hidraw")) {
      const sysPath = "/sys/class/hidraw";
      for (const name of fs.readdirSync(sysPath)) {
        try {
          const ueventPath = `${sysPath}/${name}/device/uevent`;
          if (fs.existsSync(ueventPath)) {
            const uevent = fs.readFileSync(ueventPath, "utf8");
            if (uevent.includes("0483") && uevent.includes("5750")) {
              return `/dev/${name}`;
            }
          }
        } catch (err) {
          continue;
        }
      }
    }
    return match.path;
  } catch (err) {
    console.error("Error detecting JD-2000S:", err.message);
    return null;
  }
}

// ====================== CONFIG ======================
const DEVICE_PATH = findJD2000S() || "/dev/hidraw0";
const CUSTOMERS_DB = path.join(process.cwd(), "data", "customers.json");
const POSTCODES_VALIDATOR_PATH = path.join(
  process.cwd(),
  "data",
  "postcodes_detailed.json"
);
const GETADDRESS_API_KEY = ""; //change
const STORE_POSTCODE = "NG9 8GF";
const DEBUG = process.env.DEBUG === "true";

// ====================== STATE ======================
let device;
let lastPhone = null;
let timeout = null;
let saveInProgress = false;
let pendingSave = false;
const postcodeCache = new LRUCache({ max: 5000 });
const localPostcodeDB = new Map();

// ====================== UTILITIES ======================
function logDebug(msg) {
  if (DEBUG) console.log("DEBUG:", msg);
}
function normalizePostcode(postcode) {
  if (!postcode) return null;
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})$/);
  if (match) return `${match[1]} ${match[2]}`;
  return cleaned;
}

// ====================== LOAD POSTCODE VALIDATOR ======================
let postcodeValidator = {};
async function loadPostcodeValidator() {
  try {
    const data = await fsp.readFile(POSTCODES_VALIDATOR_PATH, "utf8");
    postcodeValidator = JSON.parse(data);
    console.log(
      `✅ VALIDATOR: Loaded ${
        Object.keys(postcodeValidator).length
      } postcodes for validation.`
    );
  } catch (err) {
    console.warn(
      "⚠️ VALIDATOR: Could not load postcodes_detailed.json. Proceeding without fast validation."
    );
  }
}

// ====================== CUSTOMERS ======================
async function loadCustomers() {
  try {
    let data = await fsp.readFile(CUSTOMERS_DB, "utf8").catch(() => "[]");
    const customers = JSON.parse(data);
    for (const cust of customers) {
      if (cust.postcode && cust.postcodeData) {
        postcodeCache.set(
          normalizePostcode(cust.postcode),
          JSON.parse(JSON.stringify(cust.postcodeData))
        );
      }
    }
    return customers;
  } catch (err) {
    console.error("Failed to load customers.json:", err.message);
    return [];
  }
}
async function saveCustomers(customers) {
  if (saveInProgress) {
    pendingSave = true;
    return;
  }
  saveInProgress = true;
  try {
    const tmpFile = CUSTOMERS_DB + ".tmp";
    await fsp.writeFile(tmpFile, JSON.stringify(customers, null, 2));
    await fsp.rename(tmpFile, CUSTOMERS_DB);
    logDebug("Saved customers.json");
  } catch (err) {
    console.error("Failed to save customers.json:", err.message);
  } finally {
    saveInProgress = false;
    if (pendingSave) {
      pendingSave = false;
      await saveCustomers(customers);
    }
  }
}

// ====================== EXTRACT PHONE ======================
function extractPhone(data) {
  if (DEBUG)
    logDebug(
      `Raw data length: ${data.length} Hex: ${data
        .toString("hex")
        .slice(0, 50)}`
    );
  let digits = "";
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    if (byte >= 48 && byte <= 57) digits += String.fromCharCode(byte);
  }
  if (DEBUG) logDebug("Digits: " + digits);
  const match = digits.match(/0\d{10}/);
  const phone = match ? match[0] : null;
  if (DEBUG) logDebug("Phone: " + (phone || "None"));
  return phone;
}

// ====================== GET OR CREATE CUSTOMER ======================
function getOrCreateCustomer(phone, customers) {
  let cust = customers.find((c) => c.phone === phone);
  if (!cust) {
    console.log("NEW CUSTOMER:", phone);
    cust = {
      phone,
      postcode: null,
      address: null,
      distance: null,
      postcodeData: null,
      firstCall: new Date().toISOString(),
      lastCall: new Date().toISOString(),
      callCount: 1,
    };
    customers.push(cust);
  } else {
    console.log("EXISTING CUSTOMER:", phone);
    cust.lastCall = new Date().toISOString();
    cust.callCount++;
  }
  return cust;
}

// ====================== API LOOKUP FUNCTIONS ======================
async function lookupAddressesAPI(postcode) {
  const normalized = normalizePostcode(postcode);
  if (!normalized) return null;
  const url = `https://api.getaddress.io/find/${encodeURIComponent(
    normalized
  )}?api-key=${GETADDRESS_API_KEY}&expand=true&format=true`;
  logDebug(
    "Fetching addresses from API: " +
      url.replace(GETADDRESS_API_KEY, "KEY_HIDDEN")
  );
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.log("POSTCODE NOT FOUND: Trying autocomplete fallback...");
        return await lookupAddressesAutocomplete(postcode);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data.addresses || data.addresses.length === 0)
      throw new Error("No addresses returned");
    const addresses = data.addresses.map((addr, idx) => {
      const parts = addr.split(",").map((p) => p.trim());
      return {
        id: idx,
        line1: parts[0] || "",
        line2: parts[1] || "",
        line3: parts[2] || "",
        town: parts[3] || "",
        county: parts[4] || "",
        postcode: data.postcode,
        full: addr + ", " + data.postcode,
      };
    });
    const result = { postcode: data.postcode, addresses, source: "api_find" };
    console.log(
      `API: Found ${addresses.length} addresses for ${data.postcode}`
    );
    return result;
  } catch (err) {
    console.error("ERROR: Address lookup failed:", err.message);
    return null;
  }
}
async function lookupAddressesAutocomplete(postcode) {
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  const url = `https://api.getaddress.io/autocomplete/${cleaned}?api-key=${GETADDRESS_API_KEY}&all=true`;
  logDebug(
    "Trying autocomplete API: " + url.replace(GETADDRESS_API_KEY, "KEY_HIDDEN")
  );
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.suggestions || data.suggestions.length === 0) {
      console.log("POSTCODE INVALID: No suggestions found");
      return null;
    }
    const addresses = data.suggestions.map((s, idx) => {
      const parts = s.address.split(",").map((p) => p.trim());
      const pc = parts[parts.length - 1];
      return {
        id: idx,
        line1: parts[0] || "",
        line2: parts[1] || "",
        line3: parts[2] || "",
        town: parts[3] || "",
        county: parts[4] || "",
        postcode: pc,
        full: s.address,
      };
    });
    const result = { postcode: cleaned, addresses, source: "api_autocomplete" };
    console.log(
      `AUTOCOMPLETE: Found ${addresses.length} suggestions for ${cleaned}`
    );
    return result;
  } catch (err) {
    console.error("ERROR: Autocomplete failed:", err.message);
    return null;
  }
}
async function calculateDistance(fromPostcode, toPostcode) {
  const from = normalizePostcode(fromPostcode);
  const to = normalizePostcode(toPostcode);
  if (!from || !to) return null;
  const url = `https://api.getaddress.io/distance/${encodeURIComponent(
    from
  )}/${encodeURIComponent(to)}?api-key=${GETADDRESS_API_KEY}`;
  logDebug(`Calculating distance: ${from} -> ${to}`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const miles = (data.metres / 1609.34).toFixed(2);
    const km = (data.metres / 1000).toFixed(2);
    console.log(`DISTANCE: ${miles} miles (${km} km)`);
    return {
      metres: data.metres,
      miles: parseFloat(miles),
      km: parseFloat(km),
    };
  } catch (err) {
    console.error("ERROR: Distance failed:", err.message);
    return null;
  }
}
function isAddressDataComplete(addressData) {
  if (
    !addressData ||
    !addressData.addresses ||
    addressData.addresses.length === 0
  )
    return false;
  const firstAddr = addressData.addresses[0];
  return firstAddr.line1 || firstAddr.full;
}

// ====================== LOOKUP ADDRESSES (HYBRID) ======================
export async function lookupAddresses(postcode) {
  const normalized = normalizePostcode(postcode);
  if (!normalized) return null;
  const validatorKey = normalized.replace(/\s/g, "").toUpperCase();
  if (
    Object.keys(postcodeValidator).length > 0 &&
    !postcodeValidator[validatorKey]
  ) {
    console.log(`🔴 INVALID: ${normalized} not found in local validator.`);
    return { postcode: normalized, addresses: [], source: "invalid_postcode" };
  }
  const key = normalized.replace(/\s/g, "");
  if (postcodeCache.has(normalized)) {
    console.log(`CACHE HIT: Using cached addresses for ${normalized}`);
    return postcodeCache.get(normalized);
  }
  if (GETADDRESS_API_KEY && !GETADDRESS_API_KEY.startsWith("YOUR")) {
    console.log(`API LOOKUP: Fetching ${normalized} from getaddress.io`);
    const apiResult = await lookupAddressesAPI(normalized);
    if (apiResult) {
      postcodeCache.set(normalized, apiResult);
      return apiResult;
    }
  } else {
    console.warn("API KEY NOT CONFIGURED: Cannot fetch from API");
  }
  console.log(`NOT FOUND: ${normalized} not in local DB or API`);
  return null;
}

// ====================== HANDLE CALL ======================
// It now takes the callback as an argument
async function handleCall(phone, onCallHandled) {
  console.log("\n=== INCOMING CALL ===");
  console.log("PHONE:", phone);
  const customers = await loadCustomers();
  const customer = getOrCreateCustomer(phone, customers);
  let addressData = null,
    distance = null;
  if (customer.postcode) {
    if (customer.postcodeData && isAddressDataComplete(customer.postcodeData)) {
      console.log(
        `CUSTOMER DATA: Using saved addresses for ${customer.postcode}`
      );
      addressData = customer.postcodeData;
    } else {
      addressData = await lookupAddresses(customer.postcode);
      if (addressData)
        customer.postcodeData = JSON.parse(JSON.stringify(addressData));
    }
    if (addressData && STORE_POSTCODE) {
      if (!customer.distance) {
        distance = await calculateDistance(STORE_POSTCODE, customer.postcode);
        if (distance) customer.distance = distance;
      } else {
        distance = customer.distance;
        console.log(`DISTANCE: ${distance.miles} miles (cached)`);
      }
    }
  }
  await saveCustomers(customers);
  await onCallHandled(customer, addressData, distance);
  console.log("=== CALL HANDLED ===\n");
}

// ====================== STARTUP ======================
// [CHANGE] It now accepts the callback function as a parameter
export async function startCallerIdService(onCallHandledCallback) {
  try {
    if (!DEVICE_PATH) {
      throw new Error("JD-2000S device not found! Please check connection.");
    }
    console.log("╔════════════════════════════════════════════════╗");
    console.log("║  JD-2000S Caller ID + API Address Lookup      ║");
    console.log("╚════════════════════════════════════════════════╝\n");
    console.log("Configuration:");
    console.log("  Device:", DEVICE_PATH);
    console.log("  Customer DB:", CUSTOMERS_DB);
    console.log("  Validator DB:", POSTCODES_VALIDATOR_PATH);
    console.log(
      "  API Key:",
      GETADDRESS_API_KEY.startsWith("YOUR") ? "NOT SET" : "Configured"
    );
    console.log("  Store PC:", STORE_POSTCODE);
    console.log("  Debug:", DEBUG ? "ON" : "OFF");
    console.log("");
    device = new HID(DEVICE_PATH);
    console.log("✓ Connected to JD-2000S\n");
    await loadPostcodeValidator();
    // await loadLocalAddressDB();
    if (GETADDRESS_API_KEY.startsWith("YOUR")) {
      console.log("WARNING: API key not set - API fallback disabled\n");
    }
    console.log("Ready. Waiting for calls...\n");
    device.on("data", async (data) => {
      const phone = extractPhone(data);
      if (phone?.length === 11) {
        if (lastPhone === phone && timeout) return;
        lastPhone = phone;
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          if (lastPhone) {
            // [CHANGE] Pass the callback through to handleCall
            await handleCall(lastPhone, onCallHandledCallback);
            lastPhone = null;
          }
        }, 2000);
      }
    });
    device.on("error", (err) => console.error("HID ERROR:", err.message));
  } catch (err) {
    console.error(
      "🔴 FATAL ERROR during Caller ID Service startup:",
      err.message
    );
    throw err;
  }
}
