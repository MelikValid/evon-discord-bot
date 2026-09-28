import { query } from './database.js';

const LIMIT = 12;

export async function getHistory(key) { 
  const { rows } = await query(
    `SELECT role, content FROM conversations WHERE conversation_key=$1 ORDER BY created_at DESC LIMIT $2`, 
    [key, LIMIT]
  ); 
  return rows.reverse(); 
}

export async function addMessage(key, userId, role, content) { 
  await query(
    'INSERT INTO conversations (conversation_key,user_id,role,content) VALUES ($1,$2,$3,$4)', 
    [key, userId, role, content]
  ); 
  await query(
    `DELETE FROM conversations WHERE conversation_key=$1 AND created_at < 
     (SELECT COALESCE(min(created_at), now()) FROM 
      (SELECT created_at FROM conversations WHERE conversation_key=$1 ORDER BY created_at DESC LIMIT $2) recent)`, 
    [key, LIMIT]
  ); 
}
