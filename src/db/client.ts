import { SQLocal } from 'sqlocal';

// Initialize SQLocal with the database filename
// This file will be stored in the Origin Private File System (OPFS)
const client = new SQLocal('dewey-db.sqlite3');

export const { sql, transaction } = client;

export const initDB = async () => {
  console.log('Initializing Database...');
  
  // Create tables
  await sql`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      code TEXT,
      title TEXT NOT NULL,
      content TEXT,
      audio BLOB,
      has_audio BOOLEAN DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY(parent_id) REFERENCES topics(id) ON DELETE CASCADE
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_topics_parent_id ON topics(parent_id);
  `;

  console.log('Database Initialized.');
};

export const getSettings = async (key: string): Promise<string | null> => {
  const result = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return result[0]?.value as string || null;
};

export const saveSetting = async (key: string, value: string) => {
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
  `;
};
