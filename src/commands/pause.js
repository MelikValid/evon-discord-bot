import { SlashCommandBuilder } from 'discord.js'; 
import { config } from '../config.js'; 
import { isOwner } from '../utils/permissions.js'; 
import { setPaused } from '../database/settings.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause global AI conversations');

export async function execute(i) {
  if (!isOwner(i, config.ownerId)) return i.reply({ content: 'Owner only.', ephemeral: true });
  await setPaused(true);
  await i.reply('Global AI conversations are paused.');
}
