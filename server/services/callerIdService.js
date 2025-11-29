// server/services/callerIdService.js (Correct ES Modules Version)

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { HID } from "node-hid";
import fetch from "node-fetch";
import { LRUCache } from "lru-cache";
import Database from "better-sqlite3";
import { getDb } from "../database.js";

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
const POSTCODES_DB_PATH = path.join(process.cwd(), "data", "postcodes.db");
const GETADDRESS_API_KEY = ""; //change
const STORE_POSTCODE = "NG9 8GF";
const DEBUG = process.env.DEBUG === "true";

// ====================== STATE ======================
let device;
const activeCallTimers = new Map();
const postcodeCache = new LRUCache({ max: 5000 });
let postcodeDb;

// Init SQLite DB
try {
  postcodeDb = new Database(POSTCODES_DB_PATH, { 
    readonly: true,
    verbose: (msg) => console.log(`[PostcodeDB DEBUG] ${msg}`)
  });
  console.log("VALIDATOR: Connected to postcodes.db SQLite database.");
} catch (err) {
  console.warn("VALIDATOR: Could not connect to postcodes.db. Proceeding without fast validation.", err.message);
}

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
async function getOrCreateCustomer(phone) {
  const db = getDb();
  
  // Try to find existing customer
  let customer = await db.get('SELECT * FROM customers WHERE phone = ?', phone);
  
  if (!customer) {
    console.log("NEW CUSTOMER:", phone);
    const now = new Date().toISOString();
    
    // Insert new customer
    await db.run(
      `INSERT INTO customers 
        (phone, postcode, address, houseNumber, street, town, distance, postcodeData, firstCall, lastCall, callCount) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      phone, null, null, null, null, null, null, null, now, now, 1
    );
    
    // Fetch the newly created customer
    customer = await db.get('SELECT * FROM customers WHERE phone = ?', phone);
  } else {
    console.log("EXISTING CUSTOMER:", phone);
    const now = new Date().toISOString();
    
    // Increment call count and update lastCall
    await db.run(
      'UPDATE customers SET callCount = callCount + 1, lastCall = ? WHERE phone = ?',
      now, phone
    );
    
    // Fetch updated customer
    customer = await db.get('SELECT * FROM customers WHERE phone = ?', phone);
  }
  
  // Deserialize JSON fields
  if (customer.distance) {
    try {
      customer.distance = JSON.parse(customer.distance);
    } catch (e) {
      customer.distance = null;
    }
  }
  
  if (customer.postcodeData) {
    try {
      customer.postcodeData = JSON.parse(customer.postcodeData);
      // Restore to cache
      if (customer.postcode) {
        postcodeCache.set(normalizePostcode(customer.postcode), customer.postcodeData);
      }
    } catch (e) {
      customer.postcodeData = null;
    }
  }
  
  if (customer.addresses) {
    try {
      customer.addresses = JSON.parse(customer.addresses);
    } catch (e) {
      customer.addresses = null;
    }
  }
  
  return customer;
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
  
  // SQLite Validation
  const validatorKey = normalized.replace(/\s/g, "").toUpperCase();
  if (postcodeDb) {
    try {
      const stmt = postcodeDb.prepare("SELECT 1 FROM postcodes WHERE postcode = ?");
      const exists = stmt.get(validatorKey);
      if (!exists) {
        console.log(`INVALID: ${normalized} not found in local validator.`);
        return { postcode: normalized, addresses: [], source: "invalid_postcode" };
      }
    } catch (err) {
      console.error("Database lookup failed:", err.message);
    }
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
  
  const db = getDb();
  const customer = await getOrCreateCustomer(phone);
  
  let addressData = null;
  let distance = null;
  
  if (customer.postcode) {
    if (customer.postcodeData && isAddressDataComplete(customer.postcodeData)) {
      console.log(
        `CUSTOMER DATA: Using saved addresses for ${customer.postcode}`
      );
      addressData = customer.postcodeData;
    } else {
      addressData = await lookupAddresses(customer.postcode);
      if (addressData) {
        // Update postcodeData in database
        await db.run(
          'UPDATE customers SET postcodeData = ? WHERE phone = ?',
          JSON.stringify(addressData),
          phone
        );
        customer.postcodeData = addressData;
      }
    }
    
    if (addressData && STORE_POSTCODE) {
      if (!customer.distance) {
        distance = await calculateDistance(STORE_POSTCODE, customer.postcode);
        if (distance) {
          // Update distance in database
          await db.run(
            'UPDATE customers SET distance = ? WHERE phone = ?',
            JSON.stringify(distance),
            phone
          );
          customer.distance = distance;
        }
      } else {
        distance = customer.distance;
        console.log(`DISTANCE: ${distance.miles} miles (cached)`);
      }
    }
  }
  
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
    console.log("  Validator DB:", POSTCODES_DB_PATH);
    console.log(
      "  API Key:",
      GETADDRESS_API_KEY.startsWith("YOUR") ? "NOT SET" : "Configured"
    );
    console.log("  Store PC:", STORE_POSTCODE);
    console.log("  Debug:", DEBUG ? "ON" : "OFF");
    console.log("");
    device = new HID(DEVICE_PATH);
    console.log("✓ Connected to JD-2000S\n");
    
    // loadPostcodeValidator() call removed -> Now using SQLite DB
    
    if (GETADDRESS_API_KEY.startsWith("YOUR")) {
      console.log("WARNING: API key not set - API fallback disabled\n");
    }
    console.log("Ready. Waiting for calls...\n");
    device.on("data", async (data) => {
      console.log("HID DATA RAW:", data.toString("hex"));
      const phone = extractPhone(data);
      console.log("EXTRACTED PHONE:", phone);
      
      if (phone?.length === 11) {
        // If we are already waiting for this phone (debounce window active), ignore subsequent signals
        if (activeCallTimers.has(phone)) {
           console.log(`IGNORING ${phone} - Debounce active`);
           return;
        }

        console.log(`STARTING TIMER FOR ${phone}`);

        // Start a timer for this specific phone
        const timer = setTimeout(async () => {
          console.log(`TIMER FIRED FOR ${phone} - Processing call`);
          activeCallTimers.delete(phone); // Remove from map when processing starts
          await handleCall(phone, onCallHandledCallback);
        }, 2000);

        activeCallTimers.set(phone, timer);
      } else {
         console.log("NO VALID PHONE EXTRACTED");
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
