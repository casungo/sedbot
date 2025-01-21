<h1 align="center">
<a href="https://t.me/sedbot">SedBot for Telegram</a>
</h1>

<p align="center">
<a href="https://www.gnu.org/licenses/gpl-3.0.en.html"><img alt="license" src="https://img.shields.io/github/license/casungo/sedbot"/></a>
<a href="https://python-telegram-bot.org/"><img alt="framework" src="https://img.shields.io/badge/framework-python--telegram--bot-informational"/></a>
<a href="https://casungo.top"><img alt="author" src="https://img.shields.io/badge/author-casungo-red"/></a>
<a href="https://python.org"><img alt="author" src="https://img.shields.io/badge/language-python-yellow"/></a>
</p>

<p align="center">
<img alt="GitHub stars" src="https://img.shields.io/github/stars/casungo/sedbot?style=social">
<img alt="GitHub forks" src="https://img.shields.io/github/forks/casungo/sedbot?style=social">
<img alt="GitHub watchers" src="https://img.shields.io/github/watchers/casungo/sedbot?style=social">
</p>

## 🤖 About

SedBot is a powerful Telegram bot that brings the Unix `sed` command's text transformation capabilities to your chats. It allows you to perform regex-based search and replace operations on messages, making it perfect for quick text corrections and transformations.

![Example of how the bot behaves](./assets/example.gif)

## ✨ Features

- 🔄 Replace text using regular expressions
- 🎯 Support for global and case-insensitive replacements
- 📝 Multiple replacement flags (g, i, m)
- 💬 Works in both private chats and groups
- 🚀 Fast and reliable performance

## 🛠️ Installation

1. Clone this repository:

```bash
git clone https://github.com/casungo/sedbot.git
```

```bash
cd sedbot
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set up your bot:

   - Get a token from [@BotFather](https://t.me/botfather)
   - Rename `.env.sample` to `.env`
   - Add your bot token to `.env`

4. Start the bot:

```bash
python main.py
```

## 📖 Usage

Reply to any message with a sed-style command:

```
s/pattern/replacement/flags
```

Flags:

- `g` - Replace all occurrences (global)
- `i` - Case-insensitive matching
- `m` - Multiline matching

Examples:

- `s/cat/dog/g` - Replace all instances of "cat" with "dog"
- `s/ERROR/error/i` - Replace "ERROR" with "error" (case-insensitive)
- `s/old//` - Remove the first occurrence of "old"

## 📄 License

This project is licensed under the [GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) License.
