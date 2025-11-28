import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const JSON_PATH = path.join(process.cwd(), 'data', 'postcodes_detailed.json');
const DB_PATH = path.join(process.cwd(), 'data', 'postcodes.db');

async function migrate() {
  console.log('Starting migration...');
  console.log(`Reading JSON from ${JSON_PATH}...`);
  
  try {
    const rawData = fs.readFileSync(JSON_PATH, 'utf8');
    const postcodes = JSON.parse(rawData);
    const entries = Object.entries(postcodes);
    
    console.log(`Loaded ${entries.length} postcodes. Creating database...`);

    // Delete existing DB if it exists to start fresh
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }

    const db = new Database(DB_PATH);
    
    // Create table
    db.exec(`
      CREATE TABLE postcodes (
        postcode TEXT PRIMARY KEY,
        street TEXT,
        easting INTEGER,
        northing INTEGER,
        ward TEXT
      )
    `);

    // Prepare insert statement
    const insert = db.prepare(`
      INSERT INTO postcodes (postcode, street, easting, northing, ward)
      VALUES (@postcode, @street, @easting, @northing, @ward)
    `);

    const insertMany = db.transaction((data) => {
      for (const [code, details] of data) {
        insert.run({
          postcode: code,
          street: details.street || null,
          easting: details.easting || null,
          northing: details.northing || null,
          ward: details.ward || null
        });
      }
    });

    console.log('Inserting data...');
    insertMany(entries);
    
    console.log('Creating index...');
    // Primary key automatically creates an index, but we can verify or add others if needed.
    // Since we only look up by postcode, the PK index is sufficient.

    console.log('Migration complete!');
    db.close();
    
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
