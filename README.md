# Dota 2 schedule bot

[English](README.md) | [Русский](README.ru.md)

[![CI](https://github.com/hu553in/dota2-schedule-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/hu553in/dota2-schedule-bot/actions/workflows/ci.yml)

Telegram bot for Dota 2 schedules, live matches, results, tournament seasons, and favorites. Match
data comes from PandaScore. The production runtime uses Cloudflare Workers and D1.

Open [@d2_schedule_bot](https://t.me/d2_schedule_bot) to use the hosted instance. To keep the bot
and its data in your own accounts, follow the [step-by-step self-hosting guide](#self-hosting).

## What it does

- Searches PandaScore Dota 2 teams and tournament seasons
- Shows upcoming, live, and completed matches with pagination
- Links available broadcasts on upcoming and live matches, with optional Telegram Premium provider
  icons for self-hosted bots
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
one playoff, qualifier, group, or survival stage. The exact PandaScore stage remains visible on each
match.

### Browse matches

- **Live now** opens by default and always occupies its own keyboard row.
- **Upcoming** shows scheduled matches in chronological order.
- **Results** shows only matches PandaScore marks as finished, newest first.
- Every list uses the same previous and next pagination controls.
- A match with one unknown participant remains visible as `Participant TBD`.
- A match with both participants unknown is omitted.
- Live and completed scores use digit emoji; an unavailable score is shown as `❔`.
- Draws, postponed matches, and unrecognized statuses are labeled explicitly.

Broadcasts are comma-separated links. English and Russian broadcast languages are shown as `🇺🇸` and
`🇷🇺`; other language codes remain visible as text. In the default mode, the complete label and its
details — for example, `Twitch (🇷🇺 main)` — open the stream. A self-hosted bot can replace a known
provider name with a custom emoji; the complete parenthesized details remain linked.

### Use favorites

Open a team or tournament season and tap **☆ Add to favorites**. Saved entities appear under
**Favorites** and open their matches in one tap. Tap **★ Remove from favorites** on the same match
screen to remove one.

Favorites are stored separately from the PandaScore token. They remain available after the token is
replaced or deleted, but match loading still requires a valid token.

### Change language

Open **Settings** -> **Language** and select **🇺🇸 English** or **🇷🇺 Русский**.

Before a language is selected manually, the bot uses the Telegram device language when it is Russian
and falls back to English for every other language. The saved language applies to all bot screens,
deployment help, and dates formatted with a manual UTC offset. In automatic time zone mode, Telegram
controls the date language as well as the time zone.

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

## Self-hosting

This guide takes you from an empty Cloudflare account to a working private bot. No Telegram bot or
Cloudflare development experience is required. Run the commands below one block at a time in a
terminal; if a command opens a browser, complete the requested sign-in there and return to the
terminal.

### 1. Install the required tools

You need:

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download)
- [Bun](https://bun.sh/docs/installation)
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A Telegram account

After installing the tools, close and reopen the terminal. These commands should print their
versions instead of an error:

```bash
git --version
node --version
bun --version
```

On Windows, use WSL or Git Bash for the commands in this guide.

### 2. Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram and send `/newbot`.
2. Choose the display name shown to users.
3. Choose a username ending in `bot`, for example `my_dota_schedule_bot`.
4. Copy the bot token returned by BotFather. Treat it like a password and never publish it.

The token looks similar to `123456789:AA...`. You will add it to a local configuration file in the
next step.

### 3. Download and configure the project

Download the repository, enter its directory, install the exact dependencies from the lockfile, and
create a private local configuration:

```bash
git clone https://github.com/hu553in/dota2-schedule-bot.git
cd dota2-schedule-bot
bun ci
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` in any text editor and replace only the `BOT_TOKEN` value with the token from
BotFather. Leave the other two placeholders unchanged for now:

```env
BOT_TOKEN=123456789:replace-with-the-real-bot-token
PS_MASTER_KEY=replace_with_base64_encoded_32_random_bytes
WEBHOOK_SECRET=replace_with_random_secret
```

Do not upload `.dev.vars`, add it to Git, or send it to anyone.

### 4. Test the bot locally

Start the local bot:

```bash
bun dev
```

On the first run, the script safely generates `PS_MASTER_KEY` and `WEBHOOK_SECRET` in `.dev.vars`,
creates the local D1 database, applies its migrations, configures the Telegram commands, and prints
the bot link. Open that link in Telegram and send `/start`. Local data is stored under `.wrangler/`.

Press `Ctrl+C` in the terminal to stop the bot.

Local development uses Telegram long polling, which removes any existing webhook for the same bot.
After the production bot is deployed, either use a second BotFather bot for local development or run
`bun deploy` again when local testing is finished.

### 5. Create the Cloudflare database

Authorize Wrangler in your Cloudflare account:

```bash
bunx wrangler login
```

Create the production D1 database:

```bash
bunx wrangler d1 create d2-schedule-bot
```

Wrangler prints a `database_id` UUID. Open `wrangler.jsonc` and replace the existing `database_id`
value with that UUID. Only the value between the quotes needs to change. You may also change the
top-level Worker `name` if you want a different name in the Cloudflare dashboard.

### 6. Deploy the bot

Deploy the Worker and connect it to Telegram:

```bash
bun deploy
```

The command uploads the secrets from `.dev.vars`, applies remote D1 migrations, deploys the Worker,
configures the protected Telegram webhook and English and Russian commands, and verifies the final
webhook URL. When it finishes successfully, open the bot in Telegram and send `/start`.

Keep a secure backup of `.dev.vars`. In particular, `PS_MASTER_KEY` must not change after users have
connected PandaScore tokens: a different key cannot decrypt the existing tokens. Re-running
`bun deploy` with the same file is safe.

### 7. Set the BotFather artwork

Ready-to-upload artwork is available in `assets/botfather/`. In BotFather, send `/mybots`, select
the bot and open **Edit Bot**:

- Choose **Edit Botpic** and upload [`botpic.png`](assets/botfather/botpic.png) as the profile
  picture.
- Choose **Edit Description Picture** and upload
  [`description-picture.png`](assets/botfather/description-picture.png) as the image shown with the
  bot description to new users.

### 8. Optional: enable Premium stream-provider icons

The public [`Dota 2 Stream Providers`](https://t.me/addemoji/Dota2StreamProviders) pack and its IDs
are already configured. If the account that owns the bot has Telegram Premium, set
`TELEGRAM_PREMIUM` to `"true"` in `wrangler.jsonc`, run `bun check` and deploy. Users do not need
Premium. Otherwise, keep the default `"false"` and the bot will use complete text links. The
ordinary emoji assigned while creating the pack exist only as Telegram's mandatory custom-emoji
placeholders. Telegram may display a placeholder in system notifications or forwarded messages where
the custom emoji cannot be rendered; the bot never uses it as a standalone provider label.

To rebuild an icon or create an independent pack, follow the short
[`PACK.md`](assets/custom-emoji/dota2-stream-providers/PACK.md) guide. The repository keeps only the
ready-to-upload WEBP files, source references and conversion instructions. For another pack, replace
the corresponding public `customEmojiId` values in `src/bot/streams.ts`.

### Automatic deployment from Git

The manual deployment above is enough to run the bot. To deploy future changes automatically, fork
this repository to your GitHub account and connect that fork through Cloudflare Workers Builds:

1. Open the Worker in Cloudflare -> **Settings** -> **Build** and connect the GitHub repository.
2. Under **API token**, select or create a token that can deploy Workers and has **Account** ->
   **D1** -> **Edit** for the target account.
3. Set the production branch to `main`.
4. Set the build command to `bun check`.
5. Set the deploy command to `bun deploy`.
6. Disable non-production branch builds unless you need preview deployments.
7. Add `BOT_TOKEN` and `WEBHOOK_SECRET` as build secrets. Use the same values as in `.dev.vars`.
8. Add `NODE_VERSION` and `BUN_VERSION` as build variables, using the minimum Node.js version and
   the Bun version declared in `package.json`.

The initial manual deployment already creates the Worker's runtime secrets. Do not delete
`BOT_TOKEN`, `PS_MASTER_KEY`, or `WEBHOOK_SECRET` from **Variables and Secrets**. Build secrets are
separate and are available only while Cloudflare runs the deployment command.

Cloudflare configuration references:

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

## Configuration reference

Runtime configuration is validated in `src/config.ts`.

| Name               | Location                  | Required | Description                                             |
| ------------------ | ------------------------- | -------- | ------------------------------------------------------- |
| `BOT_TOKEN`        | Secret                    | Yes      | Telegram bot token                                      |
| `PS_MASTER_KEY`    | Secret                    | Yes      | Base64-encoded 32-byte AES-GCM master key               |
| `WEBHOOK_SECRET`   | Secret                    | Yes      | Telegram webhook secret, 32-256 URL-safe characters     |
| `BOT_NAME`         | `wrangler.jsonc` variable | Yes      | Telegram bot display name used without a network lookup |
| `BOT_USERNAME`     | `wrangler.jsonc` variable | Yes      | Telegram bot username without `@`                       |
| `TELEGRAM_PREMIUM` | `wrangler.jsonc` variable | No       | Whether the bot owner has Premium; defaults to `false`  |
| `DB`               | D1 binding                | Yes      | D1 database for tokens, favorites, and preferences      |

`bun dev` and `bun deploy` synchronize `BOT_NAME` and `BOT_USERNAME` with the BotFather bot.
`WEBHOOK_SECRET` must have the same value in the deployed Worker and in the environment that runs
`bun deploy`. `TELEGRAM_PREMIUM` accepts only `"true"` or `"false"`; valid provider IDs are still
required before the enabled mode can render custom emoji.

## Data and security

D1 contains three application tables:

- `user_tokens` stores one encrypted PandaScore token per Telegram user
- `user_favorites` stores saved teams and tournament seasons
- `user_preferences` stores an optional language and manual UTC offset

PandaScore tokens are encrypted with AES-256-GCM. Every write uses a random 96-bit IV, and the
Telegram user ID is included as authenticated additional data. A ciphertext copied to a different
user ID cannot be decrypted successfully.

Webhook requests must contain the configured Telegram secret header. Bot interactions are limited to
private chats, sensitive messages are deleted before persistence, and errors are logged without
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
- Broadcast labels and all parenthesized details are links; configured Premium icons replace only
  known provider names
- Cloudflare observability is enabled in `wrangler.jsonc`

## Development

Run the complete local gate:

```bash
bun check      # Full local gate
bun check:fix  # Full local gate with automatic fixes
```

Focused commands:

```bash
bun lint           # Ultracite check
bun lint:fix       # Ultracite fixes
bun check:types    # Generate Worker types and run TypeScript
bun run build      # Run a dry deployment build
bun check:unused   # Knip
bun check:vulns    # Production dependency audit
bun run test       # Vitest
bun test:coverage  # Coverage thresholds
```

## Project structure

```text
assets/botfather/     Ready-to-upload Telegram bot artwork
assets/custom-emoji/  Ready-to-upload stream-provider emoji and its short guide
migrations/           D1 schema migrations
scripts/              Local development and production deployment entry points
src/api/              PandaScore client and response schemas
src/bot/              grammY handlers, keyboards, messages, and runtime helpers
src/locales/          Static English and Russian translations
src/storage/          D1 token, favorite, and preference stores
tests/                Worker, API, storage, message, and handler tests
wrangler.jsonc        Cloudflare Worker, D1, variables, and observability configuration
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

[MIT](LICENSE)
