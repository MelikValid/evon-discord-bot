import { SlashCommandBuilder } from 'discord.js'; 
import { setPersonality } from '../database/settings.js';

export const data = new SlashCommandBuilder()
  .setName('personality')
  .setDescription('Choose your personal Evon personality')
  .addStringOption(o => o
    .setName('style')
    .setDescription('Your personality')
    .setRequired(true)
    .addChoices(
      { name: 'Bot', value: 'bot' },
      { name: 'Human', value: 'human' }
    )
  );

export async function execute(i) { 
  const style = i.options.getString('style'); 
  await setPersonality(i.user.id, style); 
  await i.reply(`Your Evon personality is now **${style}**. This only affects your responses.`); 
}
