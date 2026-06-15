const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite:', err.message);
        process.exit(1);
      }
      console.log('Connected to SQLite database.');
    });
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}

function initDb() {
  return new Promise((resolve, reject) => {
    const database = getDb();

    database.serialize(() => {
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          email           TEXT    NOT NULL UNIQUE,
          password_hash   TEXT    NOT NULL,
          role            TEXT    NOT NULL DEFAULT 'client' CHECK(role IN ('client', 'employee', 'admin')),
          full_name       TEXT    NOT NULL,
          employee_type   TEXT,
          email_notifications INTEGER NOT NULL DEFAULT 1
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS services (
          id       INTEGER PRIMARY KEY AUTOINCREMENT,
          name     TEXT    NOT NULL,
          price    REAL    NOT NULL,
          duration INTEGER NOT NULL
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS bookings (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          client_name  TEXT    NOT NULL,
          client_phone TEXT    NOT NULL,
          service      TEXT    NOT NULL,
          employee_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
          status       TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'done', 'cancelled')),
          created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS reviews (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_id   INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          rating       INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
          text         TEXT,
          is_published INTEGER NOT NULL DEFAULT 0,
          created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS feedback (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL,
          email      TEXT,
          message    TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS email_verifications (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT NOT NULL UNIQUE,
          code          TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          full_name     TEXT NOT NULL,
          expires_at    TEXT NOT NULL,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Migrations
      const migrations = [
        "ALTER TABLE services ADD COLUMN employee_type TEXT NOT NULL DEFAULT 'photographer'",
        'ALTER TABLE bookings ADD COLUMN client_email TEXT',
        "ALTER TABLE reviews ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ];
      let pending = migrations.length;
      for (const sql of migrations) {
        database.run(sql, (err) => {
          if (err && !err.message.includes('duplicate column name')) return reject(err);
          if (--pending === 0) {
            console.log('Database tables initialized.');
            resolve(database);
          }
        });
      }
    });
  });
}

module.exports = { getDb, initDb };
