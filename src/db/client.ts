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

  // Audio Episodes (audio library)
  await sql`
    CREATE TABLE IF NOT EXISTS audio_episodes (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      title TEXT NOT NULL,
      scope TEXT NOT NULL, -- 'topic' | 'block'
      topic_id TEXT NOT NULL,
      block_id TEXT,
      audio BLOB NOT NULL,
      FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY(block_id) REFERENCES content_blocks(id) ON DELETE CASCADE
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_audio_episodes_created_at ON audio_episodes(created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audio_episodes_topic_id ON audio_episodes(topic_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audio_episodes_block_id ON audio_episodes(block_id);`;

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
      is_default BOOLEAN DEFAULT 0,
      auto_generate_audio BOOLEAN DEFAULT 0
    );
  `;

  // Migrations for existing databases
  try {
    await sql`ALTER TABLE content_blocks ADD COLUMN audio BLOB`;
    await sql`ALTER TABLE content_blocks ADD COLUMN has_audio BOOLEAN DEFAULT 0`;
  } catch (e) {
    // Ignore if columns already exist
  }

  try {
    await sql`ALTER TABLE templates ADD COLUMN auto_generate_audio BOOLEAN DEFAULT 0`;
  } catch (e) {
    // Ignore if columns already exist
  }

  // Backfill existing topic/block audio into audio_episodes (one-time-ish).
  // Topic audio
  try {
    await sql`
      INSERT INTO audio_episodes (id, created_at, title, scope, topic_id, block_id, audio)
      SELECT
        lower(hex(randomblob(16))) as id,
        COALESCE(t.created_at, strftime('%s','now')*1000) as created_at,
        'Narration: ' || t.title as title,
        'topic' as scope,
        t.id as topic_id,
        NULL as block_id,
        t.audio as audio
      FROM topics t
      WHERE (t.has_audio = 1 OR t.has_audio = true)
        AND t.audio IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM audio_episodes ae
          WHERE ae.scope = 'topic' AND ae.topic_id = t.id
        );
    `;
  } catch (e) {
    // ignore backfill errors
  }

  // Block audio
  try {
    await sql`
      INSERT INTO audio_episodes (id, created_at, title, scope, topic_id, block_id, audio)
      SELECT
        lower(hex(randomblob(16))) as id,
        COALESCE(cb.created_at, strftime('%s','now')*1000) as created_at,
        'Narration: ' || t.title || ' — ' || cb.label as title,
        'block' as scope,
        cb.topic_id as topic_id,
        cb.id as block_id,
        cb.audio as audio
      FROM content_blocks cb
      JOIN topics t ON t.id = cb.topic_id
      WHERE (cb.has_audio = 1 OR cb.has_audio = true)
        AND cb.audio IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM audio_episodes ae
          WHERE ae.scope = 'block' AND ae.block_id = cb.id
        );
    `;
  } catch (e) {
    // ignore backfill errors
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
