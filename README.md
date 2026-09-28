# Evon Discord Bot (OpenRouter Edition)

Evon is a production-ready Discord Gateway bot with AI conversations powered by OpenRouter. It responds only to mentions and direct replies to Evon messages.

## Features

- **AI-Powered Conversations** via OpenRouter API (configurable model)
- **Per-User Personalities** (Bot/Human)
- **Conversation Memory** with bounded history
- **Slash Commands** for configuration and control
- **Owner-Only Controls** (typing delay, pause/resume, shutdown)
- **Server Moderation** (message purging)
- **PostgreSQL Persistence** (settings, personalities, conversation history)
- **Rate Limit Handling** (OpenRouter & Discord)
- **Graceful Error Handling**

## Requirements

- Node.js 20+
- PostgreSQL database
- Discord application & bot token
- OpenRouter API key
- Persistent hosting (Railway, Render, Wispbyte, VPS, etc.)

## Setup

### 1. Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Add a Bot to the application
4. Copy the **Token** and **Client ID**
5. Enable **Message Content Intent** under Bot > Privileged Gateway Intents
6. Invite the bot using OAuth2 with scopes: `bot` `applications.commands`
7. Grant permissions: `View Channels`, `Send Messages`, `Read Message History`, `Manage Messages`, `Use Application Commands`

### 2. OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai)
2. Sign up and create an account
3. Navigate to **Keys** and create a new API key
4. Copy the key (format: `sk-or-...`)

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Discord
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
OWNER_ID=1360006388847218870

# Database
DATABASE_URL=postgresql://user:password@host:5432/evon

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_key
AI_MODEL=qwen/qwen3.8-27b:free

# Environment
NODE_ENV=production
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Register Slash Commands

Run once to register commands with Discord:

```bash
npm run register-commands
```

### 6. Start the Bot

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Commands

### Public Commands

- `/help` — Show available commands
- `/ping` — Check bot and API latency
- `/status` — View bot status and your personality
- `/personality bot|human` — Set your personal AI personality

### Owner-Only Commands

- `/typing <seconds>` — Set global typing delay (0.001–30s)
- `/pause` — Pause global AI conversations
- `/resume` — Resume global AI conversations
- `/shutdown` — Safely shut down the bot

### Moderation Commands

- `/purge <amount>` — Delete recent messages (requires Manage Messages)

## Personalities

### Bot Personality
Professional and helpful, like a standard AI assistant.

**Example:**
```
Evon: Hello! I'm happy to help. What can I assist you with?
```

### Human Personality
Casual and conversational, like a Discord user.

**Example:**
```
Evon: yo what's up 😭 what do you need?
```

**Each user's personality setting is independent.** User A can have Bot while User B has Human in the same channel.

## AI Model Configuration

Change the model by updating `AI_MODEL` in `.env`:

```env
# Free models
AI_MODEL=qwen/qwen3.8-27b:free
AI_MODEL=meta-llama/llama-3-8b-instruct:free
AI_MODEL=mistralai/mistral-7b-instruct:free

# Premium models
AI_MODEL=openai/gpt-4o
AI_MODEL=anthropic/claude-3-opus
```

No code changes needed—just update `.env` and restart.

## Hosting

### Railway

1. Connect your GitHub repo
2. Create a new Postgres plugin
3. Set environment variables in Railway dashboard
4. Deploy with `npm start`

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Use `npm start` as start command
4. Attach PostgreSQL database
5. Set environment variables
6. Deploy

### Wispbyte

1. Upload code via Git or SFTP
2. Create PostgreSQL database
3. Set environment variables in host panel
4. Use `npm start` as start command

## Architecture

```
src/
├── index.js                 # Main bot client & message handler
├── config.js                # Environment configuration
├── ai/
│   ├── provider.js          # AI answer function
│   ├── openrouter.js        # OpenRouter API integration
│   └── prompts.js           # System prompts
├── database/
│   ├── database.js          # PostgreSQL connection & init
│   ├── settings.js          # Global/per-user settings
│   └── conversations.js     # Conversation history
├── commands/
│   ├── help.js
│   ├── ping.js
│   ├── status.js
│   ├── personality.js
│   ├── typing.js
│   ├── pause.js
│   ├── resume.js
│   ├── shutdown.js
│   └── purge.js
├── utils/
│   ├── permissions.js       # Permission checks
│   ├── messages.js          # Message utilities
│   └── registerCommands.js  # Command registration
└── events/
    ├── interactionCreate.js # (handled in index.js)
    └── messageCreate.js     # (handled in index.js)
```

## Error Handling

### OpenRouter Errors

- **Rate Limit (429):** Automatic retry with exponential backoff
- **Auth Error (401):** Check `OPENROUTER_API_KEY`
- **Server Error (5xx):** Automatic retry up to 3 times
- **Timeout/Network:** Automatic retry with increasing delay

### Database Errors

If database connection fails:
- Bot continues running (commands that need DB will fail gracefully)
- Errors logged with details for troubleshooting

### AI Errors

- Logged server-side only (no credentials exposed)
- User sees friendly message
- Bot remains stable

## Logging

Evon logs:

- ✓ Startup and readiness
- ✓ Command registration
- ✓ AI conversation starts/ends
- ✓ Database operations
- ✓ Rate limits
- ✓ Errors and warnings

**Does NOT log:**
- Conversation content
- User IDs in messages (privacy)
- API keys or secrets

## Troubleshooting

### Commands not showing

```bash
npm run register-commands
```

Global commands can take 1 hour to appear. Restart the bot or try in a private test server.

### No responses to mentions

1. Verify **Message Content Intent** is enabled
2. Check bot permissions in the channel
3. Ensure bot is in the server
4. Check logs for errors: `npm start`

### Database connection fails

- Verify `DATABASE_URL` format
- Check database is running and accessible
- For hosted databases, ensure SSL is configured

### OpenRouter API errors

- Verify `OPENROUTER_API_KEY` is correct
- Check OpenRouter account has credits
- Verify `AI_MODEL` is valid
- Check OpenRouter status page

### Bot crashes

Check logs:

```bash
npm start 2>&1 | tee evon.log
```

Look for:
- Missing environment variables
- Database connection errors
- Discord token issues

## Development

Use watch mode for development:

```bash
npm run dev
```

Bot will restart on file changes.

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong PostgreSQL password
- [ ] Keep `DISCORD_TOKEN` and `OPENROUTER_API_KEY` secret (add to `.gitignore`)
- [ ] Set up monitoring/uptime alerts
- [ ] Test `/shutdown` command
- [ ] Test `/pause` and `/resume` for maintenance
- [ ] Configure rate limit handling if expecting high load
- [ ] Set up log aggregation (optional)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review logs with `npm start`
3. Verify `.env` configuration
4. Check Discord Developer Portal bot settings
5. Verify OpenRouter account and API key

## License

MIT
