import pg from 'pg';
import { config } from '../config.js';
const { Pool } = pg;

export const pool = new Pool({ 
  connectionString: config.databaseUrl, 
  max: 10, 
  idleTimeoutMillis: 30000, 
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined 
});

export async function query(text, params) { 
  return pool.query(text, params); 
}

export async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      id boolean PRIMARY KEY DEFAULT true, 
      typing_delay real NOT NULL DEFAULT 2.5, 
      paused boolean NOT NULL DEFAULT false, 
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO bot_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
    
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id text PRIMARY KEY, 
      personality text NOT NULL DEFAULT 'bot' CHECK (personality IN ('bot','human')), 
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_key text NOT NULL, 
      user_id text NOT NULL, 
      role text NOT NULL CHECK (role IN ('user','assistant')), 
      content text NOT NULL, 
      created_at timestamptz NOT NULL DEFAULT now()
    );
    
    CREATE INDEX IF NOT EXISTS conversations_recent_idx ON conversations (conversation_key, created_at DESC);
  `);
}

export async function closeDatabase() { 
  await pool.end(); 
}
