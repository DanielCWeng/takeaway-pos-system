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
      
      for (const customer of customers) {
        // Serialize complex objects to JSON strings
        const distanceStr = customer.distance ? JSON.stringify(customer.distance) : null;
        const postcodeDataStr = customer.postcodeData ? JSON.stringify(customer.postcodeData) : null;
        const addressesStr = customer.addresses ? JSON.stringify(customer.addresses) : null;
        
        await stmt.run(
          customer.phone,
          customer.name || null,
          customer.postcode || null,
          customer.address || null,
          customer.houseNumber || null,
          customer.street || null,
          customer.town || null,
          distanceStr,
          postcodeDataStr,
          customer.firstCall || null,
          customer.lastCall || null,
          customer.callCount || 1,
          addressesStr
        );
      }
      
      await stmt.finalize();
      console.log(`✅ Migrated ${customers.length} customers to SQLite.`);
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
