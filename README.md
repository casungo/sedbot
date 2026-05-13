<h1 align="center">
<a href="https://t.me/sedbot">SedBot for Telegram</a>
</h1>

<p align="center">
<a href="https://www.gnu.org/licenses/gpl-3.0.en.html"><img alt="license" src="https://img.shields.io/github/license/casungo/sedbot"/></a>
<a href="https://casungo.top"><img alt="author" src="https://img.shields.io/badge/author-casungo-red"/></a>
<a href="https://developer.mozilla.org/docs/Web/TypeScript"><img alt="language" src="https://img.shields.io/badge/language-typescript-blue"/></a>
<a href="https://workers.cloudflare.com/"><img alt="runtime" src="https://img.shields.io/badge/runtime-cloudflare--workers-orange"/></a>
</p>

<p align="center">
<img alt="GitHub stars" src="https://img.shields.io/github/stars/casungo/sedbot?style=social">
<img alt="GitHub forks" src="https://img.shields.io/github/forks/casungo/sedbot?style=social">
<img alt="GitHub watchers" src="https://img.shields.io/github/watchers/casungo/sedbot?style=social">
</p>

## 🤖 About

SedBot is a Telegram bot that brings POSIX `sed`-style text transformations to your chats. It runs sed scripts against replied text messages, including support for guest mode updates.

![Example of how the bot behaves](./assets/example.gif)

## ✨ Features

- 🔄 Run sed scripts against replied text
- 🎯 Support for addresses, ranges, grouped commands, labels, and hold space
- 📝 Support for common POSIX commands including `s`, `y`, `p`, `d`, `D`, `n`, `N`, `q`, `a`, `c`, `i`, `b`, `t`, `h`, `H`, `g`, `G`, `x`, `l`, and `=`
- 🔎 Supports `-n`, `-E`, and `s///` flags `g`, `i`, `p`, numeric occurrence selection, and text-mode `w` detection
- 💬 Works in private chats, groups, and guest mode
- ☁️ Designed for Cloudflare Workers deployment

## ☁️ Deploy on Cloudflare Workers

1. Clone this repository:

```bash
git clone https://github.com/casungo/sedbot.git
cd sedbot
```

2. Install dependencies:

```bash
pnpm install
```

3. Set worker secrets:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

4. Deploy:

```bash
pnpm run deploy
```

5. Configure Telegram webhook (replace placeholders):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-worker>.workers.dev" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","guest_message"]'
```

After deployment, the worker handles `/start`, `/help`, and sed scripts from Telegram updates sent via webhook.

If you are deploying from Cloudflare Pages CI, ensure the project type is **Workers** (not Pages static assets) and run `pnpm exec wrangler deploy --config wrangler.toml`.

Guest Mode (Bot API 10.0) is supported: if enabled in BotFather, the worker processes `guest_message` updates and replies using `answerGuestQuery`.

To verify Guest Mode is enabled, call `getMe` and check that `supports_guest_queries` is `true`.

Guest updates are stateless: the bot only receives the message that mentioned it and optional replied context, not full chat history or member lists.

## 📖 Usage

Commands:

- `/start` - Show a short introduction and support link
- `/help` - Show detailed syntax, examples, supported sed commands, and Telegram-mode limits

Reply to any message with a sed script:

```
s/pattern/replacement/flags
```

You can also use a `sed` prefix for options:

```
sed -n '/ERROR/p'
sed -E 's/(cat|dog)/pet/g'
```

Supported `s///` flags:

- `g` - replace all non-overlapping occurrences
- `i` - case-insensitive matching
- `p` - print the pattern space if a replacement was made
- number - replace only that occurrence

Examples:

- `s/cat/dog/g` - Replace all instances of "cat" with "dog"
- `s/ERROR/error/i` - Replace "ERROR" with "error" (case-insensitive)
- `s/old//` - Remove the first occurrence of "old"
- `sed -n '2,5p'` - Print only lines 2 through 5
- `/start/,/end/d` - Delete a selected range

Telegram text mode does not provide a filesystem, so file-backed POSIX `r`, `w`, and `s///w file` operations are rejected instead of reading or writing server files.

## 📄 License

This project is licensed under the [GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) License.
