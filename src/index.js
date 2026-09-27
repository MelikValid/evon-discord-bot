import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  Client,
  GatewayIntentBits,
  Events,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIG
// ============================================================================

const config = {
  discordToken: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.DISCORD_GUILD_ID || '',
  ownerId: process.env.DISCORD_OWNER_ID || '',
  adminRoleId: process.env.BOT_ADMIN_ROLE_ID || '',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  dbPath: process.env.DB_PATH || './data/evon.db',
};

// ============================================================================
// DATABASE
// ============================================================================

const dbDirectory = path.dirname(config.dbPath);
if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

const schema = `
  CREATE TABLE IF NOT EXISTS server_settings (
    guild_id TEXT PRIMARY KEY,
    personality TEXT NOT NULL DEFAULT 'human',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversation_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversation_summary (
    guild_id TEXT,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, channel_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS long_response_states (
    guild_id TEXT,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    total_parts INTEGER NOT NULL,
    current_part INTEGER NOT NULL,
    parts_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, channel_id, user_id)
  );
`;

db.exec(schema);

function getServerPersonality(guildId) {
  const row = db.prepare('SELECT personality FROM server_settings WHERE guild_id = ?').get(guildId);
  return row?.personality || 'human';
}

function setServerPersonality(guildId, personality) {
  db.prepare(`
    INSERT INTO server_settings (guild_id, personality, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id)
    DO UPDATE SET personality = excluded.personality, updated_at = CURRENT_TIMESTAMP
  `).run(guildId, personality);
}

function saveConversationMessage({ guildId, channelId, userId, role, content }) {
  db.prepare(`
    INSERT INTO conversation_messages (guild_id, channel_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(guildId || null, channelId, userId, role, content);
}

function getConversationHistory({ guildId, channelId, userId, limit = 20 }) {
  return db.prepare(`
    SELECT role, content
    FROM conversation_messages
    WHERE guild_id = ? AND channel_id = ? AND user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(guildId || null, channelId, userId, limit).reverse();
}

function clearConversationHistory({ guildId, channelId, userId }) {
  db.prepare(`
    DELETE FROM conversation_messages
    WHERE guild_id = ? AND channel_id = ? AND user_id = ?
  `).run(guildId || null, channelId, userId);

  db.prepare(`
    DELETE FROM conversation_summary
    WHERE guild_id = ? AND channel_id = ? AND user_id = ?
  `).run(guildId || null, channelId, userId);
}

function getConversationSummary({ guildId, channelId, userId }) {
  const row = db.prepare(`
    SELECT summary FROM conversation_summary WHERE guild_id = ? AND channel_id = ? AND user_id = ?
  `).get(guildId || null, channelId, userId);
  return row?.summary || null;
}

function saveConversationSummary({ guildId, channelId, userId, summary }) {
  db.prepare(`
    INSERT INTO conversation_summary (guild_id, channel_id, user_id, summary, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id, channel_id, user_id)
    DO UPDATE SET summary = excluded.summary, updated_at = CURRENT_TIMESTAMP
  `).run(guildId || null, channelId, userId, summary);
}

function saveLongResponseState({ guildId, channelId, userId, parts }) {
  const totalParts = parts.length;
  db.prepare(`
    INSERT INTO long_response_states (guild_id, channel_id, user_id, total_parts, current_part, parts_json, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id, channel_id, user_id)
    DO UPDATE SET total_parts = excluded.total_parts, current_part = excluded.current_part, parts_json = excluded.parts_json, updated_at = CURRENT_TIMESTAMP
  `).run(guildId || null, channelId, userId, totalParts, JSON.stringify(parts));
}

function getLongResponseState({ guildId, channelId, userId }) {
  const row = db.prepare(`
    SELECT total_parts, current_part, parts_json
    FROM long_response_states
    WHERE guild_id = ? AND channel_id = ? AND user_id = ?
  `).get(guildId || null, channelId, userId);

  if (!row) {
    return null;
  }

  return {
    totalParts: row.total_parts,
    currentPart: row.current_part,
    parts: JSON.parse(row.parts_json),
  };
}

function updateLongResponseState({ guildId, channelId, userId, currentPart }) {
  db.prepare(`
    UPDATE long_response_states
    SET current_part = ?, updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ? AND channel_id = ? AND user_id = ?
  `).run(currentPart, guildId || null, channelId, userId);
}

function deleteLongResponseState({ guildId, channelId, userId }) {
  db.prepare(`
    DELETE FROM long_response_states
    WHERE guild_id = ? AND channel_id = ? AND user_id = ?
  `).run(guildId || null, channelId, userId);
}

// ============================================================================
// AI / OPENAI
// ============================================================================

const aiClient = new OpenAI({ apiKey: config.openAiApiKey });

async function checkAiHealth() {
  if (!config.openAiApiKey) {
    return false;
  }

  try {
    const models = await aiClient.models.list();
    return Array.isArray(models?.data) && models.data.length > 0;
  } catch (error) {
    return false;
  }
}

function buildSystemPrompt(personality) {
  if (personality === 'bot') {
    return `You are Evon, a polished Discord assistant. Be professional, helpful, and clear. Use proper grammar, keep answers concise unless the user asks for detail, and sound conversational but not robotic. Remember previous context in the same conversation and respond naturally. If asked for code, preserve formatting and explain clearly. Avoid filler. Keep responses in Discord-friendly markdown when useful.`;
  }

  return `You are Evon, a relaxed and natural Discord conversational partner. Speak like a real person: casual, warm, witty when appropriate, and conversational. Match the tone of the user without sounding robotic or overly formal. Use slang naturally when it fits, but still be clear. Do not mention that you are an AI unless the user directly asks. Keep replies friendly, concise, and human.`;
}

async function generateAssistantReply({ personality, recentMessages, historySummary, userMessage }) {
  if (!config.openAiApiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const systemPrompt = buildSystemPrompt(personality);
  const messages = [{ role: 'system', content: systemPrompt }];

  if (historySummary) {
    messages.push({ role: 'system', content: `Conversation summary: ${historySummary}` });
  }

  for (const message of recentMessages) {
    messages.push({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    });
  }

  messages.push({ role: 'user', content: userMessage });

  const completion = await aiClient.chat.completions.create({
    model: config.openAiModel,
    temperature: 0.8,
    max_tokens: 800,
    messages,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return content;
}

// ============================================================================
// MEMORY / CONTEXT
// ============================================================================

function summarizeOlderMessages(messages) {
  const summary = messages
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
    .join(' | ')
    .slice(0, 500);

  return summary || 'Conversation recap unavailable.';
}

function buildConversationMemory({ guildId, channelId, userId }) {
  const rows = getConversationHistory({ guildId, channelId, userId, limit: 40 });
  const historicalSummary = getConversationSummary({ guildId, channelId, userId });

  if (rows.length > 18) {
    const overflow = rows.slice(0, rows.length - 18);
    const nextSummary = summarizeOlderMessages(overflow);
    saveConversationSummary({ guildId, channelId, userId, summary: nextSummary });
    return {
      summary: historicalSummary || nextSummary,
      recentMessages: rows.slice(-18),
    };
  }

  return {
    summary: historicalSummary,
    recentMessages: rows,
  };
}

// ============================================================================
// MESSAGE QUEUE / RATE LIMIT HANDLING
// ============================================================================

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeSend(channel, content, options = {}) {
  try {
    return await channel.send({
      content,
      ...options,
      allowedMentions: {
        parse: ['users', 'roles'],
      },
    });
  } catch (error) {
    if (error?.code === 429) {
      const retryAfter = Number(error.retryAfter || 1000);
      await delay(retryAfter);
      return channel.send({
        content,
        ...options,
        allowedMentions: {
          parse: ['users', 'roles'],
        },
      });
    }

    throw error;
  }
}

// ============================================================================
// RESPONSE SPLITTING
// ============================================================================

function splitLongText(content, limit = 1800) {
  if (content.length <= limit) {
    return [content];
  }

  const parts = [];
  const lines = content.split('\n');
  let current = '';

  for (const line of lines) {
    const nextText = current ? `${current}\n${line}` : line;

    if (nextText.length > limit && current) {
      parts.push(current);
      current = line;
      continue;
    }

    current = nextText;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts.length ? parts : [content.slice(0, limit)];
}

function formatLongResponsePart(part, total, current) {
  return `**Part ${current}/${total}**\n\n${part}`;
}

// ============================================================================
// CONTINUATION
// ============================================================================

function matchesContinuationIntent(text) {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === 'continue' ||
    normalized === 'next' ||
    normalized === 'next part' ||
    normalized === 'send the next part' ||
    normalized === 'send next' ||
    normalized === 'send next part' ||
    normalized === 'send the next half' ||
    normalized === 'send part 2' ||
    normalized.includes('continue') ||
    normalized.includes('next part') ||
    normalized.includes('next half') ||
    normalized.includes('send part')
  );
}

function isContinuationRequest(message) {
  return matchesContinuationIntent(message.content || '');
}

async function handleContinuationRequest({ message }) {
  const guildId = message.guildId || null;
  const state = getLongResponseState({ guildId, channelId: message.channel.id, userId: message.author.id });

  if (!state) {
    return false;
  }

  const nextPart = state.currentPart + 1;

  if (nextPart > state.totalParts) {
    await safeSend(message.channel, 'That was the last part of the response.');
    deleteLongResponseState({ guildId, channelId: message.channel.id, userId: message.author.id });
    return true;
  }

  const partText = state.parts[nextPart - 1];
  await safeSend(message.channel, `**Part ${nextPart}/${state.totalParts}**\n\n${partText}`);

  if (nextPart >= state.totalParts) {
    deleteLongResponseState({ guildId, channelId: message.channel.id, userId: message.author.id });
    return true;
  }

  updateLongResponseState({ guildId, channelId: message.channel.id, userId: message.author.id, currentPart: nextPart });
  return true;
}

// ============================================================================
// COMMANDS
// ============================================================================

const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('personality')
    .setDescription('Set the current personality mode for the server.')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Choose a personality mode')
        .setRequired(true)
        .addChoices(
          { name: 'Human', value: 'human' },
          { name: 'Bot', value: 'bot' },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show how to interact with Evon.')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear the current conversation context for your channel.')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check whether Evon and the AI service are online.')
    .toJSON(),
];

// ============================================================================
// BOT LOGIC
// ============================================================================

function isAdminOrOwner(member) {
  if (!member) {
    return false;
  }

  if (member.id === config.ownerId) {
    return true;
  }

  if (member.permissions && member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return true;
  }

  if (config.adminRoleId && member.roles && member.roles.cache.has(config.adminRoleId)) {
    return true;
  }

  return false;
}

async function registerSlashCommands(client) {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  if (!config.clientId) {
    return;
  }

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commandDefinitions });
  console.log('Slash commands registered.');
  return client;
}

async function fetchReferencedMessage(message) {
  if (!message.reference || !message.reference.messageId) {
    return null;
  }

  try {
    return await message.channel.messages.fetch(message.reference.messageId);
  } catch (error) {
    return null;
  }
}

async function isConversationTarget(message, client) {
  if (message.author.bot) {
    return false;
  }

  if (message.channel.isDMBased()) {
    return true;
  }

  if (message.mentions.has(client.user.id)) {
    return true;
  }

  const referencedMessage = await fetchReferencedMessage(message);
  if (referencedMessage && referencedMessage.author.id === client.user.id) {
    return true;
  }

  try {
    const recentMessages = await message.channel.messages.fetch({ limit: 12 });
    const recentBot = [...recentMessages.values()].find((msg) => msg.author.id === client.user.id && msg.createdTimestamp > Date.now() - 1000 * 60 * 20);
    return Boolean(recentBot);
  } catch (error) {
    return false;
  }
}

async function createBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, async () => {
    console.log(`Evon is online as ${client.user.tag}`);
    await registerSlashCommands(client);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === 'personality') {
      if (!isAdminOrOwner(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to change Evon personality.', ephemeral: true });
        return;
      }

      const mode = interaction.options.getString('mode');
      setServerPersonality(interaction.guildId || 'dm', mode);
      const serverLabel = interaction.guild ? `for ${interaction.guild.name}` : 'for this DM';
      await interaction.reply({ content: `Evon personality set to ${mode} ${serverLabel}.`, ephemeral: false });
      return;
    }

    if (interaction.commandName === 'help') {
      const helpText = [
        'Evon listens naturally in Discord.',
        'Ways to talk to me:',
        '- Mention me: @Evon hello',
        '- Reply to one of my messages',
        '- Continue a conversation in thread or channel context',
        'Admin command: /personality set to Human or Bot',
      ].join('\n');
      await interaction.reply({ content: helpText, ephemeral: false });
      return;
    }

    if (interaction.commandName === 'clear') {
      const guildId = interaction.guildId || 'dm';
      const channelId = interaction.channelId;
      const userId = interaction.user.id;
      clearConversationHistory({ guildId, channelId, userId });
      await interaction.reply({ content: 'Conversation context cleared for this channel.', ephemeral: false });
      return;
    }

    if (interaction.commandName === 'status') {
      const running = await checkAiHealth();
      await interaction.reply({
        content: running ? 'Evon is online and the AI service is available.' : 'Evon is online, but the AI service is currently unavailable.',
        ephemeral: false,
      });
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
      return;
    }

    if (isContinuationRequest(message)) {
      const handled = await handleContinuationRequest({ message });
      if (handled) {
        return;
      }
    }

    const shouldRespond = await isConversationTarget(message, client);
    if (!shouldRespond) {
      return;
    }

    const guildId = message.guildId || 'dm';
    const channelId = message.channel.id;
    const userId = message.author.id;
    const cleanInput = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

    if (!cleanInput) {
      return;
    }

    saveConversationMessage({ guildId, channelId, userId, role: 'user', content: cleanInput });

    const memory = buildConversationMemory({ guildId, channelId, userId });

    try {
      const personality = getServerPersonality(guildId);
      const reply = await generateAssistantReply({
        personality,
        recentMessages: memory.recentMessages,
        historySummary: memory.summary,
        userMessage: cleanInput,
      });

      saveConversationMessage({ guildId, channelId, userId, role: 'assistant', content: reply });

      const chunks = splitLongText(reply, 1800);
      if (chunks.length > 1) {
        saveLongResponseState({ guildId, channelId, userId, parts: chunks });

        const firstPart = formatLongResponsePart(chunks[0], chunks.length, 1);
        await safeSend(message.channel, firstPart);
        return;
      }

      await safeSend(message.channel, reply);
    } catch (error) {
      console.error('AI reply failed:', error);
      await safeSend(message.channel, "I'm having trouble processing that right now. Try again in a moment.");
    }
  });

  if (!config.discordToken) {
    throw new Error('DISCORD_TOKEN is missing. Check your .env settings.');
  }

  await client.login(config.discordToken);
  return client;
}

// ============================================================================
// STARTUP
// ============================================================================

try {
  await createBot();
  console.log('Evon bot is ready!');
} catch (error) {
  console.error('Failed to start Evon:', error);
  process.exit(1);
}
