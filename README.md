# Dota 2 schedule bot

[English](README.md) | [Русский](README.ru.md)

[![CI](https://github.com/hu553in/dota2-schedule-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/hu553in/dota2-schedule-bot/actions/workflows/ci.yml)

Telegram bot for Dota 2 schedules, live matches, results, tournament seasons, and favorites. Match
data comes from PandaScore. The production runtime uses Cloudflare Workers and D1.

Open [@d2_schedule_bot](https://t.me/d2_schedule_bot) to use the hosted instance.

## What it does

- Searches PandaScore Dota 2 teams and tournament seasons
- Shows upcoming, live, and completed matches with pagination
- Links available broadcasts on upcoming and live matches
- Groups every stage under its complete tournament season
- Shows the tournament and exact stage for team matches
- Hides matches where both participants are still unknown
- Displays completed and live scores with Telegram digit emoji
- Saves teams and complete tournament seasons as per-user favorites
- Supports English and Russian UI, dates, commands, and setup instructions
- Supports Telegram-localized dates or a manually saved UTC offset
- Stores each user's PandaScore token encrypted in D1
- Runs production updates through a secret-protected Telegram webhook

## Requirements for users

- A Telegram account
- A free PandaScore account and personal access token

The free [PandaScore Schedules, Results & Context Data plan](https://www.pandascore.co/pricing)
currently allows 1,000 REST API requests per hour. A normal bot screen uses one or two requests, so
the plan is sufficient for individual use. Current limits are documented in the
[PandaScore rate limit reference](https://developers.pandascore.co/docs/rate-and-connections-limits).

## User guide

### Connect a PandaScore token

1. [Create a PandaScore account](https://app.pandascore.co/signup).
2. Open the [PandaScore dashboard](https://app.pandascore.co/dashboard/main).
3. Copy the value from **Your access token**.
4. Open the bot in a private chat.
5. Open **Settings** -> **PandaScore token** -> **Enter token**.
6. Send the token as a reply to the bot's prompt.

The bot immediately tries to delete the message, validates the token against PandaScore, and stores
it only after both operations succeed. If Telegram cannot delete the message, the token is not
saved. Delete the message manually, rotate the token in PandaScore, and try again.

Use **Check** or `/status` to validate the saved token later. Replacing or deleting a token does not
remove favorites.

### Find a team

1. Tap **Find team** in the main menu.
2. Reply to the search prompt with at least two characters, for example `Team Spirit`, `OG`, or
   `Liquid`.
3. Select a team from the paginated results.
4. Switch between **Live now**, **Upcoming**, and **Results**.

Every team match includes its tournament season and exact stage. Match cards also include the
current scheduled or actual start time, UTC offset when set manually, the correct series format such
as `BO3` or `FT3`, score when available, and links to available upcoming or live broadcasts.

If nothing is found, reply to the same prompt with another or shorter name. No additional retry
button is required.

### Find a tournament

1. Tap **Find tournament** in the main menu.
2. Reply with a season name, for example `Esports World Cup 2026`, `The International`, or
   `ESL One`.
3. Select the complete season, such as `Esports World Cup · 2026`.
4. Browse matches from all stages through the same live, upcoming, and results tabs.

PandaScore exposes individual stages as tournaments inside a series. The bot deliberately presents
the series as one user-facing tournament season. Favorites therefore save the complete season, not
one playoff, qualifier, group, or survival stage. The exact PandaScore stage remains visible on
each match.

### Browse matches

- **Live now** opens by default and always occupies its own keyboard row.
- **Upcoming** shows scheduled matches in chronological order.
- **Results** shows only matches PandaScore marks as finished, newest first.
- Every list uses the same previous and next pagination controls.
- A match with one unknown participant remains visible as `Participant TBD`.
- A match with both participants unknown is omitted.
- Live and completed scores use digit emoji; an unavailable score is shown as `❔`.
- Draws, postponed matches, and unrecognized statuses are labeled explicitly.

### Use favorites

Open a team or tournament season and tap **☆ Add to favorites**. Saved entities appear under
**Favorites** and open their matches in one tap. Tap **★ Remove from favorites** on the same match
screen to remove one.

Favorites are stored separately from the PandaScore token. They remain available after the token is
replaced or deleted, but match loading still requires a valid token.

### Change language

Open **Settings** -> **Language** and select **English** or **Russian**.

Before a language is selected manually, the bot uses the Telegram device language when it is
Russian and falls back to English for every other language. The saved language applies to all bot
screens, deployment help, and dates formatted with a manual UTC offset. In automatic time zone
mode, Telegram controls the date language as well as the time zone.

### Set the time zone

Open **Settings** -> **Time zone**.

Automatic mode lets supported Telegram clients render timestamps in the device time zone. Telegram
does not expose the actual device time zone to bots, so clients that do not localize the timestamp
may show UTC. In that case:

1. Tap **Enter UTC offset**.
2. Reply with a value such as `+6`, `-3`, or `+5:30`.
3. Return to any match list; the saved offset now applies to every date.

Send `auto` or tap **Use Telegram automatically** to remove the manual offset. Accepted offsets are
from `-12:00` through `+14:00`.

### Commands

| Command       | Description                             |
| ------------- | --------------------------------------- |
| `/start`      | Open the main menu                      |
| `/favorites`  | Open favorites                          |
| `/timezone`   | Open the time zone setting              |
| `/settoken`   | Connect or replace the PandaScore token |
| `/status`     | Check the saved PandaScore token        |
| `/cleartoken` | Delete the saved PandaScore token       |
| `/help`       | Show the in-bot user guide              |

The bot is designed for private chats. Commands and callbacks used in a group direct the user to a
private chat so tokens and personal state cannot mix between users.

## Self-hosting requirements

- Bun 1.3.14
- Node.js 22.18 or newer
- A Cloudflare account with Workers and D1 access
- Wrangler authenticated with the target Cloudflare account
- A Telegram bot created through [@BotFather](https://t.me/BotFather)
- A local `.dev.vars` file containing the required secrets

### Set the BotFather artwork

Ready-to-upload artwork is available in `assets/botfather/`. In
[@BotFather](https://t.me/BotFather), send `/mybots`, select the bot and open **Edit Bot**:

- Choose **Edit Botpic** and upload [`botpic.png`](assets/botfather/botpic.png) as the 512x512
  profile picture.
- Choose **Edit Description Picture** and upload
  [`description-picture.png`](assets/botfather/description-picture.png) as the 640x360 image shown
  with the bot description to new users.

## Local setup

Install dependencies and create the local configuration:

```bash
bun ci
cp .dev.vars.example .dev.vars
```

Set `BOT_TOKEN` to the token from BotFather. Generate the two local cryptographic secrets:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Use the base64 value as `PS_MASTER_KEY` and the hexadecimal value as `WEBHOOK_SECRET` in
`.dev.vars`:

```env
BOT_TOKEN=123456789:replace-with-the-bot-token
PS_MASTER_KEY=replace-with-base64-encoded-32-random-bytes
WEBHOOK_SECRET=replace-with-at-least-32-random-characters
```

Start local development:

```bash
bun dev
```

The script:

1. Validates `.dev.vars` and generates missing local cryptographic secrets.
2. Reads the bot identity from Telegram.
3. Configures English and Russian bot commands.
4. Applies all migrations to the local D1 database.
5. Starts the local Worker.
6. Receives Telegram updates through long polling and forwards them to the Worker.

Secret generation applies only to missing values or untouched example placeholders. The script
fails on any other invalid secret instead of silently replacing an existing key.

Local D1 state is stored under `.wrangler/`. Press `Ctrl+C` to stop the bot.

Long polling removes the active Telegram webhook. Use a separate BotFather bot for local
development after a production instance is live, or run `bun run deploy` afterwards to restore the
production webhook.

## Configuration

Runtime configuration is validated in `src/config.ts`.

| Name             | Location                  | Required | Description                                             |
| ---------------- | ------------------------- | -------- | ------------------------------------------------------- |
| `BOT_TOKEN`      | Secret                    | Yes      | Telegram bot token                                      |
| `PS_MASTER_KEY`  | Secret                    | Yes      | Base64-encoded 32-byte AES-GCM master key               |
| `WEBHOOK_SECRET` | Secret                    | Yes      | Telegram webhook secret, 32-256 URL-safe characters     |
| `BOT_NAME`       | `wrangler.jsonc` variable | Yes      | Telegram bot display name used without a network lookup |
| `BOT_USERNAME`   | `wrangler.jsonc` variable | Yes      | Telegram bot username without `@`                       |
| `DB`             | D1 binding                | Yes      | D1 database for tokens, favorites, and preferences      |

`PS_MASTER_KEY` must remain stable after users connect tokens. Changing it makes existing encrypted
tokens unreadable. `WEBHOOK_SECRET` must have the same value in the deployed Worker and in the
environment that runs `bun run deploy`.

Do not commit `.dev.vars`, `.env`, BotFather tokens, PandaScore tokens, or Cloudflare credentials.

## Cloudflare deployment

Authenticate Wrangler:

```bash
bunx wrangler login
```

Create a D1 database in the target Cloudflare account:

```bash
bunx wrangler d1 create d2-schedule-bot
```

Replace `database_id` in `wrangler.jsonc` with the returned UUID. Change the Worker `name` when
deploying a fork under a different name. `bun run deploy` synchronizes `BOT_NAME` and `BOT_USERNAME`
with the BotFather bot automatically.

Run the complete deployment:

```bash
bun run deploy
```

When `.dev.vars` exists, `bun run deploy` validates it and uploads its runtime secrets with the Worker.
The command also reads the current bot identity from Telegram, applies pending remote D1 migrations,
deploys the Worker with the correct bot name and username, reads the published `workers.dev` URL,
configures the secret-protected Telegram webhook, installs English and Russian commands, and verifies
the final webhook URL through Telegram.

The deployment fails instead of silently succeeding when migrations, Worker deployment, webhook
configuration, command configuration, or webhook verification fails.

### Automatic deployment from Git

Cloudflare Workers Builds can deploy every push to `main` without a GitHub Actions deployment
workflow:

1. Open the Worker in Cloudflare -> **Settings** -> **Build**.
2. Connect the GitHub repository.
3. Under **API token**, select or create a user token that can deploy Workers and also has
   **Account** -> **D1** -> **Edit** for the target account. This additional permission is required
   because `bun run deploy` applies remote D1 migrations.
4. Set the production branch to `main`.
5. Set the build command to `bun check`.
6. Set the deploy command to `bun run deploy`.
7. Disable non-production branch builds unless preview deployments are required.
8. Add `BOT_TOKEN` and `WEBHOOK_SECRET` as build secrets.
9. Add `NODE_VERSION=22.18.0` and `BUN_VERSION=1.3.14` as build variables.

Build secrets are available only to the deployment process. The Worker still requires its separate
runtime `BOT_TOKEN`, `PS_MASTER_KEY`, and `WEBHOOK_SECRET` secrets under **Variables and Secrets**.
The build and runtime values for `BOT_TOKEN` and `WEBHOOK_SECRET` must match.

Cloudflare configuration references:

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

## Data and security

D1 contains three application tables:

- `user_tokens` stores one encrypted PandaScore token per Telegram user
- `user_favorites` stores saved teams and tournament seasons
- `user_preferences` stores an optional language and manual UTC offset

PandaScore tokens are encrypted with AES-256-GCM. Every write uses a random 96-bit IV, and the
Telegram user ID is included as authenticated additional data. A ciphertext copied to a different
user ID cannot be decrypted successfully.

Webhook requests must contain the configured Telegram secret header. Bot interactions are limited
to private chats, sensitive messages are deleted before persistence, and errors are logged without
secret values.

Users who do not want to trust the hosted instance can deploy this repository in their own
Cloudflare account and use a private D1 database. The complete source is available at
[github.com/hu553in/dota2-schedule-bot](https://github.com/hu553in/dota2-schedule-bot).

## Runtime behavior

- Production uses Telegram webhooks; local development uses long polling
- PandaScore calls use bounded request and total timeouts with one library-managed GET retry
- Search, match, and favorite pages contain six entries
- A tournament favorite is a PandaScore series; individual stages are never saved separately
- Translations are static JSON resources loaded with i18next, not database records
- User language and UTC offset are loaded from D1 for each update
- Dates use the device language and time zone through Telegram in automatic mode, or the saved
  language and UTC offset in manual mode
- Link previews are disabled in bot messages
- Cloudflare observability is enabled in `wrangler.jsonc`

## Development

Run the complete local gate:

```bash
bun check
```

Focused commands:

```bash
bun run build      # Run a dry deployment build
bun check:types    # Generate Worker types and run TypeScript
bun lint           # Ultracite check
bun lint:fix       # Ultracite fixes
bun check:unused   # Knip
bun check:vulns    # Production dependency audit
bun run test       # Vitest
bun test:coverage  # Coverage thresholds
```

## Project structure

```text
assets/botfather/ Ready-to-upload Telegram bot artwork
migrations/       D1 schema migrations
scripts/          Local development and production deployment entry points
src/api/          PandaScore client and response schemas
src/bot/          grammY handlers, keyboards, messages, and runtime helpers
src/locales/      Static English and Russian translations
src/storage/      D1 token, favorite, and preference stores
tests/            Worker, API, storage, message, and handler tests
wrangler.jsonc    Cloudflare Worker, D1, variables, and observability configuration
```

## Tech stack

- TypeScript, Bun, Cloudflare Workers
- Cloudflare D1
- grammY and grammY plugins
- PandaScore REST API
- i18next, ky, Zod
- Vitest with the Cloudflare Workers pool
- Ultracite, Knip, Lefthook, commitlint

## License

MIT
