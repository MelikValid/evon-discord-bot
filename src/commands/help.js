import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show Evon commands');

export async function execute(i) { 
  const embed = new EmbedBuilder()
    .setTitle('Evon Commands')
    .setColor(0x5865f2)
    .addFields(
      { name: 'General', value: '`/help` `/ping` `/status` — Everyone' },
      { name: 'AI', value: '`/personality bot|human` — Everyone' },
      { name: 'Owner', value: '`/typing` `/pause` `/resume` `/shutdown` — Bot owner only' },
      { name: 'Moderation', value: '`/purge amount` — Requires Manage Messages' }
    ); 
  await i.reply({ embeds: [embed] }); 
}
