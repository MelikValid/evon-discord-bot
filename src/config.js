import 'dotenv/config';

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'DATABASE_URL', 'OPENROUTER_API_KEY', 'AI_MODEL'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);

export const config = Object.freeze({
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  ownerId: process.env.OWNER_ID || '1360006388847218870',
  databaseUrl: process.env.DATABASE_URL,
  openrouterKey: process.env.OPENROUTER_API_KEY,
  aiModel: process.env.AI_MODEL,
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  nodeEnv: process.env.NODE_ENV || 'production'
});
