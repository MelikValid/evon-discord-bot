import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Show bot and API latency');

export async function execute(i) { 
  await i.reply(`🏓 Pong!\nBot Latency: ${Date.now() - i.createdTimestamp}ms\nAPI Latency: ${Math.round(i.client.ws.ping)}ms`); 
}
