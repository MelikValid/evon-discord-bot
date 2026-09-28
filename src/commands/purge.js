import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js'; 
import { hasManageMessages } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete messages in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(o => o
    .setName('amount')
    .setDescription('1-100 messages')
    .setRequired(true)
    .setMinValue(1)
    .setMaxValue(100)
  );

export async function execute(i) {
  if (!hasManageMessages(i)) return i.reply({ content: 'You need Manage Messages.', ephemeral: true });
  if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) 
    return i.reply({ content: 'I need Manage Messages in this channel.', ephemeral: true });
  
  const n = i.options.getInteger('amount');
  await i.deferReply({ ephemeral: true });
  
  try {
    const deleted = await i.channel.bulkDelete(n, true);
    await i.editReply(`Deleted ${deleted.size} message(s) from this channel.`);
  } catch (e) {
    console.error('Purge error', e);
    await i.editReply('Could not delete those messages. They may be older than Discord allows.');
  }
}
