import { SlashCommandBuilder } from 'discord.js'; 
import { getPersonality, getSettings } from '../database/settings.js'; 
import { duration } from '../utils/messages.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show Evon status');

export async function execute(i) { 
  const [p, s] = await Promise.all([getPersonality(i.user.id), getSettings()]); 
  const m = process.memoryUsage(); 
  await i.reply(`**EVON STATUS**\n\n● Online\n● AI: ${s.paused ? 'Paused' : 'Operational'}\n● Your Personality: ${p[0].toUpperCase() + p.slice(1)}\n● Typing Delay: ${s.typingDelay}s\n● Global AI: ${s.paused ? 'Paused' : 'Active'}\n● Servers: ${i.client.guilds.cache.size}\n● Uptime: ${duration(i.client.uptime)}\n● Memory: ${Math.round(m.rss / 1024 / 1024)}MB`); 
}
