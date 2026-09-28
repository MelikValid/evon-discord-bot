# Evon

Evon is a production Discord Gateway bot built with Node.js, Discord.js v14, PostgreSQL, and the Vercel AI SDK. It responds only to mentions and direct replies to Evon messages.

## Requirements

- Node.js 20+
- PostgreSQL
- A Discord application and bot
- Persistent hosting such as Railway, Render, Wispbyte, or a VPS
- An OpenAI-compatible provider key (the AI SDK OpenAI provider is used)

## Discord setup

1. Create an application at the Discord Developer Portal and add a Bot.
2. Copy the bot token and application/client ID.
3. Under **Bot > Privileged Gateway Intents**, enable **Message Content Intent**.
4. Invite the bot with scopes `bot` and `applications.commands`, and permissions `View Channel`, `Send Messages`, `Read Message History`, `Send Messages`, `Manage Messages` (for purge), and `Use Application Commands`.
5. Use the OAuth2 URL generator and keep the token secret.

## Install and configure

```bash
cp .env.example .env
npm install
npm run register-commands
npm start
```

Set `DISCORD_TOKEN`, `CLIENT_ID`, `DATABASE_URL`, `AI_GATEWAY_API_KEY`, and `AI_MODEL`. `OWNER_ID` must remain `1360006388847218870` unless you intentionally change ownership. Never commit `.env`.

The database tables are created automatically at startup. PostgreSQL persists the global typing delay, global pause state, per-user personality, and bounded recent conversation history. The default personality is `bot`; `/personality` changes only the invoking Discord user's preference, even within the same server/channel.

## Commands

- `/help`, `/ping`, `/status`, `/personality`: everyone
- `/typing`, `/pause`, `/resume`, `/shutdown`: exact owner ID only
- `/purge amount`: users and bot require Manage Messages; deletion is limited to the current channel and Discord's bulk-delete rules

Typing delay is global (0.001–30 seconds). Pause/resume is global. Shutdown closes PostgreSQL and the Discord client. AI responses are split at Discord's 2,000-character limit, and failures are replaced with a safe user-facing message.

## Hosting

Run the process on a persistent Node.js service. Set environment variables in the host dashboard, attach a managed PostgreSQL database, run `npm install`, register commands once, and use `npm start` as the start command. Do not run the Discord Gateway process in a normal Vercel serverless function.

## Troubleshooting

- **Commands missing:** run `npm run register-commands`; global command propagation can take time.
- **No message responses:** enable Message Content Intent and verify the bot can read/send in the channel.
- **Database error:** verify `DATABASE_URL`, SSL/provider settings, and database availability.
- **AI error:** verify the provider key/model and check provider limits; private errors are logged server-side without exposing credentials.
- **Purge failure:** messages older than Discord's bulk-delete window cannot be bulk deleted.

Logs include startup, readiness, rate limits, database/command/AI errors, and configuration events, but not conversation contents or secrets.
