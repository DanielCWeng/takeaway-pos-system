import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'orders.db');
const ARCHIVED_ORDERS_PATH = path.join(__dirname, 'data', 'archived_orders.json');
const CUSTOMERS_PATH = path.join(__dirname, 'data', 'customers.json');

let db;

export async function initializeDatabase() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Enable Query Logging
  const originalGet = db.get.bind(db);
  const originalAll = db.all.bind(db);
  const originalRun = db.run.bind(db);
  const originalExec = db.exec.bind(db);

  db.get = async (sql, ...params) => {
    console.log(`[SQLite DEBUG] GET: ${sql} | Params: ${JSON.stringify(params)}`);
    try {
      return await originalGet(sql, ...params);
    } catch (e) {
      console.error(`[SQLite ERROR] GET: ${sql} | Error: ${e.message}`);
      throw e;
    }
  };

  db.all = async (sql, ...params) => {
    console.log(`[SQLite DEBUG] ALL: ${sql} | Params: ${JSON.stringify(params)}`);
    try {
      return await originalAll(sql, ...params);
    } catch (e) {
      console.error(`[SQLite ERROR] ALL: ${sql} | Error: ${e.message}`);
      throw e;
    }
  };

  db.run = async (sql, ...params) => {
    console.log(`[SQLite DEBUG] RUN: ${sql} | Params: ${JSON.stringify(params)}`);
    try {
      return await originalRun(sql, ...params);
    } catch (e) {
      console.error(`[SQLite ERROR] RUN: ${sql} | Error: ${e.message}`);
      throw e;
    }
  };

  db.exec = async (sql) => {
    console.log(`[SQLite DEBUG] EXEC: ${sql.trim().substring(0, 50)}...`); // Truncate long execs
    try {
      return await originalExec(sql);
    } catch (e) {
      console.error(`[SQLite ERROR] EXEC: ${sql} | Error: ${e.message}`);
      throw e;
    }
  };

  await db.exec('PRAGMA journal_mode = WAL;');
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      archivedAt TEXT NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      phone TEXT PRIMARY KEY,
      name TEXT,
      postcode TEXT,
      address TEXT,
      houseNumber TEXT,
      street TEXT,
      town TEXT,
      distance TEXT,
      postcodeData TEXT,
      firstCall TEXT,
      lastCall TEXT,
      callCount INTEGER DEFAULT 1,
      addresses TEXT
    );
  `);

  console.log('✅ Database initialized');
  await migrateArchivedOrders();
  await migrateCustomers();
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

async function migrateArchivedOrders() {
  try {
    // Check if archived_orders.json exists
    await fs.access(ARCHIVED_ORDERS_PATH);
    
    console.log('📦 Found archived_orders.json, starting migration...');
    const data = await fs.readFile(ARCHIVED_ORDERS_PATH, 'utf8');
    const orders = JSON.parse(data);

    if (orders.length === 0) {
        console.log('ℹ️ archived_orders.json is empty, skipping migration.');
    } else {
        const stmt = await db.prepare('INSERT OR IGNORE INTO orders (id, data, archivedAt) VALUES (?, ?, ?)');
        
        for (const order of orders) {
          // Ensure we don't double-stringify if it's already a string (though it shouldn't be in the JSON file)
          const orderData = JSON.stringify(order);
          await stmt.run(order.id, orderData, order.archivedAt);
        }
        
        await stmt.finalize();
        console.log(`✅ Migrated ${orders.length} orders to SQLite.`);
    }

    // Rename the file to .bak
    const backupPath = `${ARCHIVED_ORDERS_PATH}.bak`;
    await fs.rename(ARCHIVED_ORDERS_PATH, backupPath);
    console.log(`Example: Renamed ${ARCHIVED_ORDERS_PATH} to ${backupPath}`);

  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, nothing to migrate
      console.log('ℹ️ No archived_orders.json found, skipping migration.');
    } else {
      console.error('🔴 Migration failed:', error);
      // We don't throw here to avoid crashing the server startup, 
      // but we log the error clearly.
    }
  }
}

async function migrateCustomers() {
  try {
    // Check if customers.json exists
    await fs.access(CUSTOMERS_PATH);
    
    console.log('📦 Found customers.json, starting migration...');
    const data = await fs.readFile(CUSTOMERS_PATH, 'utf8');
    const customers = JSON.parse(data);

    if (customers.length === 0) {
      console.log('ℹ️ customers.json is empty, skipping migration.');
    } else {
      const stmt = await db.prepare(`
        INSERT OR IGNORE INTO customers 
        (phone, name, postcode, address, houseNumber, street, town, distance, postcodeData, firstCall, lastCall, callCount, addresses) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let migratedCount = 0;
      
      for (const customer of customers) {
        // Handle two different data formats:
        // Format 1: Has 'addresses' array (newer format)
        // Format 2: Has individual fields like 'postcode', 'address', etc. (older format)
        
        let postcode = null;
        let address = null;
        let houseNumber = null;
        let street = null;
        let town = null;
        let addressesStr = null;
        
        if (customer.addresses && Array.isArray(customer.addresses) && customer.addresses.length > 0) {
          // Format 1: Extract from addresses array
          const firstAddr = customer.addresses[0];
          postcode = firstAddr.postcode || null;
          address = firstAddr.fullAddress || null;
          houseNumber = firstAddr.houseNumber || null;
          street = firstAddr.street || null;
          town = firstAddr.town || null;
          
          // Store the entire addresses array for future use
          addressesStr = JSON.stringify(customer.addresses);
          
          console.log(`  Migrating ${customer.phone} (Format 1: addresses array, ${customer.addresses.length} address(es))`);
        } else {
          // Format 2: Use individual fields
          postcode = customer.postcode || null;
          address = customer.address || null;
          houseNumber = customer.houseNumber || null;
          street = customer.street || null;
          town = customer.town || null;
          
          console.log(`  Migrating ${customer.phone} (Format 2: individual fields)`);
        }
        
        // Serialize complex objects to JSON strings
        const distanceStr = customer.distance ? JSON.stringify(customer.distance) : null;
        const postcodeDataStr = customer.postcodeData ? JSON.stringify(customer.postcodeData) : null;
        
        await stmt.run(
          customer.phone,
          customer.name || null,
          postcode,
          address,
          houseNumber,
          street,
          town,
          distanceStr,
          postcodeDataStr,
          customer.firstCall || null,
          customer.lastCall || null,
          customer.callCount || 1,
          addressesStr
        );
        
        migratedCount++;
      }
      
      await stmt.finalize();
      console.log(`✅ Migrated ${migratedCount} customers to SQLite.`);
    }

    // Rename the file to .bak
    const backupPath = `${CUSTOMERS_PATH}.bak`;
    await fs.rename(CUSTOMERS_PATH, backupPath);
    console.log(`✅ Renamed ${CUSTOMERS_PATH} to ${backupPath}`);

  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, nothing to migrate
      console.log('ℹ️ No customers.json found, skipping migration.');
    } else {
      console.error('🔴 Customer migration failed:', error);
      // We don't throw here to avoid crashing the server startup
    }
  }
}
