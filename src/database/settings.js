import { query } from './database.js';

export async function getSettings() { 
  const { rows } = await query('SELECT typing_delay AS "typingDelay", paused FROM bot_settings WHERE id=true'); 
  return rows[0] || { typingDelay: 2.5, paused: false }; 
}

export async function setTypingDelay(value) { 
  await query('UPDATE bot_settings SET typing_delay=$1, updated_at=now() WHERE id=true', [value]); 
}

export async function setPaused(paused) { 
  await query('UPDATE bot_settings SET paused=$1, updated_at=now() WHERE id=true', [paused]); 
}

export async function getPersonality(userId) { 
  const { rows } = await query('SELECT personality FROM user_settings WHERE user_id=$1', [userId]); 
  return rows[0]?.personality || 'bot'; 
}

export async function setPersonality(userId, personality) { 
  await query(
    `INSERT INTO user_settings (user_id, personality) VALUES ($1,$2) 
     ON CONFLICT (user_id) DO UPDATE SET personality=$2, updated_at=now()`, 
    [userId, personality]
  ); 
}
