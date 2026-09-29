import { Client, GatewayIntentBits, Partials, Collection, Events } from 'discord.js';
import { createServer } from 'node:http';
import { config } from './config.js';
import { initDatabase, closeDatabase } from './database/database.js';
import { getPersonality, getSettings } from './database/settings.js';
import { answer } from './ai/provider.js';
import { sendLong } from './utils/messages.js';
import * as help from './commands/help.js';
import * as ping from './commands/ping.js';
import * as status from './commands/status.js';
import * as personality from './commands/personality.js';
import * as typing from './commands/typing.js';
import * as pause from './commands/pause.js';
import * as resume from './commands/resume.js';
import * as shutdown from './commands/shutdown.js';
import * as purge from './commands/purge.js';

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Evon Bot is online!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Web server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

const commands = new Collection([
  ['help', help],
  ['ping', ping],
  ['status', status],
  ['personality', personality],
  ['typing', typing],
  ['pause', pause],
  ['resume', resume],
  ['shutdown', shutdown],
  ['purge', purge]
]);

client.once(Events.ClientReady, c => {
  console.log(`✓ Evon ready as ${c.user.tag}`);
  console.log(`✓ Connected to ${c.guilds.cache.size} server(s)`);
  console.log(`✓ AI Model: ${config.aiModel}`);
  console.log(`✓ Using OpenRouter API`);
});

client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = commands.get(i.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(i);
  } catch (e) {
    console.error(`Command ${i.commandName} error:`, e);

    const msg = 'Something went wrong while processing that command.';

    if (i.replied || i.deferred) {
      await i.followUp({
        content: msg,
        ephemeral: true
      }).catch(() => {});
    } else {
      await i.reply({
        content: msg,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async m => {
  if (m.author.bot || !m.guild) return;

  const mentioned = m.mentions.has(client.user);
  let replied = false;

  if (m.reference?.messageId) {
    try {
      const ref = await m.fetchReference();
      replied = ref.author.id === client.user.id;
    } catch {}
  }

  if (!mentioned && !replied) return;

  const settings = await getSettings();

  if (settings.paused) {
    console.log(`Ignoring message from ${m.author.tag} (AI paused)`);
    return;
  }

  const text = m.content
    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
    .trim();

  if (!text) return;

  const conversationKey = `${m.guild.id}:${m.channel.id}`;

  try {
    console.log(`[${m.author.tag}] ${text}`);

    await m.channel.sendTyping();

    const delayMs = Math.min(settings.typingDelay * 1000, 30000);

    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }

    const personality = await getPersonality(m.author.id);

    const result = await answer({
      conversationKey,
      userId: m.author.id,
      text,
      personality
    });

    console.log(
      `[Evon → ${m.author.tag}] ${result.substring(0, 50)}...`
    );

    await sendLong(m.channel, result);
  } catch (e) {
    console.error('AI error:', e.message);

    const errorMsg = e.message.includes('auth')
      ? 'Authentication error. Check your OpenRouter API key.'
      : e.message.includes('rate limit')
      ? "I'm being rate limited. Please try again in a moment."
      : 'Sorry, I could not process that right now. Please try again shortly.';

    await m.reply(errorMsg).catch(() => {});
  }
});

client.on(Events.RateLimit, info => {
  console.warn(
    `Discord rate limit hit: ${info.method} ${info.path}, retry_after: ${info.limit}ms`
  );
});

process.on('unhandledRejection', e => {
  console.error('Unhandled rejection:', e);
});

const gracefulShutdown = async () => {
  console.log('\n✓ Shutting down gracefully...');

  try {
    await closeDatabase();
  } catch (error) {
    console.error('Database shutdown error:', error);
  }

  client.destroy();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

(async () => {
  try {
    console.log('✓ Initializing database...');

    await initDatabase();

    console.log('✓ Database ready');
    console.log('✓ Logging in to Discord...');

    await client.login(config.token);
  } catch (error) {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  }
})();

export default client;
