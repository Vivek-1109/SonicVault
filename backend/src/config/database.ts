import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './env.js';

let dbPath = env.DATABASE_PATH;

// Railway-aware: use volume mount path if available
const railwayVolume = process.env['RAILWAY_VOLUME_MOUNT_PATH'];
if (railwayVolume) {
  dbPath = path.join(railwayVolume, 'music.db');
}

// Resolve to absolute path
dbPath = path.resolve(dbPath);

// Create parent directories if they don't exist
const parentDir = path.dirname(dbPath);
if (!fs.existsSync(parentDir)) {
  fs.mkdirSync(parentDir, { recursive: true });
}

const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Set busy timeout to 5 seconds
db.pragma('busy_timeout = 5000');

// Optimize synchronous mode for WAL
db.pragma('synchronous = NORMAL');

// Enable memory-mapped I/O (64MB)
db.pragma('mmap_size = 67108864');

export default db;
export { dbPath };

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});
