import { SlashCommandBuilder } from 'discord.js'; 
import { config } from '../config.js'; 
import { isOwner } from '../utils/permissions.js'; 
import { setTypingDelay } from '../database/settings.js';

export const data = new SlashCommandBuilder()
  .setName('typing')
  .setDescription('Set global typing delay (owner only)')
  .addNumberOption(o => o
    .setName('seconds')
    .setDescription('0.001 to 30 seconds')
    .setRequired(true)
    .setMinValue(0.001)
    .setMaxValue(30)
  );

export async function execute(i) { 
  if (!isOwner(i, config.ownerId)) return i.reply({ content: 'Owner only.', ephemeral: true }); 
  const n = i.options.getNumber('seconds'); 
  await setTypingDelay(n); 
  await i.reply(`Global typing delay set to **${n}s**.`); 
}
