import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationRecord {
  id: number;
  name: string;
  appliedAt: string;
}

export function runMigrations(): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get list of applied migrations
  const appliedMigrations = db
    .prepare('SELECT name FROM _migrations ORDER BY id')
    .all() as MigrationRecord[];
  const appliedSet = new Set(appliedMigrations.map((m) => m.name));

  // Read migration files from the migrations directory
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`🚨 Migrations directory not found at ${migrationsDir}. Build step likely failed to copy .sql files.`);
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('📂 No migration files found.');
    return;
  }

  let appliedCount = 0;

  for (const file of migrationFiles) {
    if (appliedSet.has(file)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`🔄 Applying migration: ${file}`);

    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    });

    applyMigration();
    appliedCount++;
    console.log(`✅ Applied migration: ${file}`);
  }

  if (appliedCount === 0) {
    console.log('✅ All migrations are up to date.');
  } else {
    console.log(`✅ Applied ${appliedCount} migration(s).`);
  }
}
