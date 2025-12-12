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
  
  // V2 Tables: Content Blocks & Templates
  await sql`
    CREATE TABLE IF NOT EXISTS content_blocks (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
  `;

  // Prompt History (request logging; excludes API keys)
  await sql`
    CREATE TABLE IF NOT EXISTS prompt_history (
      id TEXT PRIMARY KEY,
      created_at INTEGER,
      provider TEXT,
      type TEXT,
      model TEXT,
      topic_id TEXT,
      topic_title TEXT,
      template_id TEXT,
      template_name TEXT,
      payload TEXT
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_prompt_history_created_at ON prompt_history(created_at DESC);
  `;
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_blocks_topic_id ON content_blocks(topic_id);
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      type TEXT NOT NULL, -- 'content' or 'subtopics'
      is_default BOOLEAN DEFAULT 0
    );
  `;

  // Migrations for existing databases
  try {
    await sql`ALTER TABLE content_blocks ADD COLUMN audio BLOB`;
    await sql`ALTER TABLE content_blocks ADD COLUMN has_audio BOOLEAN DEFAULT 0`;
  } catch (e) {
    // Ignore if columns already exist
  }

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
