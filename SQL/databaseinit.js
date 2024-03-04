const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbFile = 'NinjaSnipeITBridge.db';

// Check if the database file exists, and delete it if it does
if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
    console.log(`Deleted the old database file '${dbFile}'.`);
}

// Create a new SQLite database
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log(`SQLite database file '${dbFile}' has been created.`);
    }
});

db.run(`
CREATE TABLE IF NOT EXISTS organizations (
    orgid INTEGER PRIMARY KEY UNIQUE,
    name TEXT NOT NULL UNIQUE
    )
`);

db.run(`
CREATE TABLE IF NOT EXISTS manufacturers (
    manufacturerId INTEGER PRIMARY KEY UNIQUE,
    name TEXT NOT NULL UNIQUE
    )
`);

db.run(`
CREATE TABLE IF NOT EXISTS models (
    modelId INTEGER PRIMARY KEY UNIQUE,
    category INTEGER NOT NULL UNIQUE,
    modelNumber INTEGER NOT NULL UNIQUE,
    manufacturerId INTEGER UNIQUE NOT NULL,
    FOREIGN KEY (manufacturerId) references manufacturers(manufacturerId)
    )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS devices (
    assetTag INTEGER PRIMARY KEY UNIQUE,
    ninjaId INTEGER NOT NULL UNIQUE,
    snipeitId INTEGER NOT NULL UNIQUE,
    serialNumber TEXT NOT NULL UNIQUE
    )
`);

// Close the database connection
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
});