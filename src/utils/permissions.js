import { PermissionFlagsBits } from 'discord.js';
export const isOwner = (interaction, ownerId) => interaction.user.id === ownerId;
export const hasManageMessages = interaction => interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
