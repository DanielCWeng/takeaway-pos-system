import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import Database from "better-sqlite3";

const sourcePath = process.argv[2];
const dbPath = path.resolve(process.env.DB_PATH || "./data/orders.db");

if (!sourcePath || !existsSync(sourcePath)) {
  console.error("Usage: npm run contacts:import-bt -- <path-to-bt.csv>");
  process.exit(1);
}

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  fields.push(value.trim());
  return fields;
}

function normalisePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length === 12) digits = `0${digits.slice(2)}`;
  return digits;
}

function splitAddress(rawAddress) {
  const compactTail = rawAddress
    .toUpperCase()
    .match(/([A-Z]{1,2}\s*\d[A-Z\d]?\s*\d\s*[A-Z]\s*[A-Z])\s*$/);
  let postcode = null;
  let address = rawAddress.trim();
  if (compactTail) {
    const compact = compactTail[1].replace(/\s/g, "");
    postcode = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
    address = address
      .slice(0, compactTail.index)
      .trim()
      .replace(/[,\s]+$/, "");
  }

  const houseMatch = address.match(/^(\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?)\s+(.+)$/);
  return {
    postcode,
    houseNumber: houseMatch?.[1] ?? null,
    street: houseMatch?.[2]?.trim() || address || null,
  };
}

const csv = await readFile(sourcePath, "utf8");
const lines = csv.split(/\r?\n/).filter((line) => line.trim());
const contacts = lines.slice(1).map((line, index) => {
  const [address = "", rawPhone = ""] = parseCsvLine(line);
  const phone = normalisePhone(rawPhone);
  if (phone.length < 10 || phone.length > 13) {
    throw new Error(`Invalid phone number on CSV row ${index + 2}: ${rawPhone}`);
  }
  return { phone, ...splitAddress(address) };
});

const unique = new Map(contacts.map((contact) => [contact.phone, contact]));
const db = new Database(dbPath);
const timestamp = new Date().toISOString();
const backupPath = path.join(
  path.dirname(dbPath),
  `orders.before-bt-import-${timestamp.replace(/[:.]/g, "-")}.db`,
);

await db.backup(backupPath);

const existingPhones = new Set(
  db
    .prepare("SELECT phone FROM customers")
    .all()
    .map((row) => row.phone),
);
const upsert = db.prepare(`
  INSERT INTO customers (
    phone, name, postcode, house_number, street, town,
    latitude, longitude, distance, first_call, last_call, call_count
  ) VALUES (
    @phone, NULL, @postcode, @houseNumber, @street, NULL,
    NULL, NULL, NULL, @timestamp, @timestamp, 0
  )
  ON CONFLICT(phone) DO UPDATE SET
    postcode = CASE WHEN customers.postcode IS NULL OR customers.postcode = '' THEN excluded.postcode ELSE customers.postcode END,
    house_number = CASE WHEN customers.house_number IS NULL OR customers.house_number = '' THEN excluded.house_number ELSE customers.house_number END,
    street = CASE WHEN customers.street IS NULL OR customers.street = '' THEN excluded.street ELSE customers.street END
`);

const importContacts = db.transaction(() => {
  for (const contact of unique.values()) upsert.run({ ...contact, timestamp });
});

importContacts();
const inserted = [...unique.keys()].filter((phone) => !existingPhones.has(phone)).length;
const merged = unique.size - inserted;
const total = db.prepare("SELECT COUNT(*) AS count FROM customers").get().count;
db.close();

console.log(`Imported ${unique.size} unique BT contacts (${inserted} new, ${merged} merged).`);
console.log(`Customer database now contains ${total} records.`);
console.log(`Backup created: ${backupPath}`);
