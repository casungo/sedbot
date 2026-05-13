import { Bot, webhookCallback } from 'grammy';

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  CF_PAGES?: string;
  CF_PAGES_BRANCH?: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  reply_to_message?: {
    text?: string;
  };
}

interface GuestMessage {
  guest_query_id?: string;
  text?: string;
  reply_to_message?: {
    text?: string;
  };
}

interface TelegramUpdate {
  guest_message?: GuestMessage;
}

interface ParsedSedCommand {
  pattern: string;
  replacement: string;
  flags: string;
}

const botCache = new Map<string, Bot>();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = (await request.clone().json()) as TelegramUpdate;
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    try {
      const botToken = getBotToken(env);
      if (!botToken) {
        console.error(
          'Missing TELEGRAM_BOT_TOKEN; skipping update processing. Verify the secret is set on this exact Worker environment.'
        );
        return new Response('OK', { status: 200 });
      }

      if (update.guest_message) {
        await handleGuestUpdate(update.guest_message, botToken);
        return new Response('OK', { status: 200 });
      }

      const bot = getBot(botToken);
      const handler = webhookCallback(bot, 'cloudflare-mod');
      return await handler(request);
    } catch (error: unknown) {
      console.error('Error processing update', error);
      return new Response('OK', { status: 200 });
    }
  },
};

function getBotToken(env: Env): string | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  return token ? token : null;
}

function getBot(botToken: string): Bot {
  const cached = botCache.get(botToken);
  if (cached) return cached;

  const bot = new Bot(botToken);

  bot.command('start', async (ctx) => {
    await ctx.reply(helpText(), {
      reply_parameters: { message_id: ctx.msg.message_id },
    });
  });

  bot.on('message:text', async (ctx) => {
    const message = ctx.message as TelegramMessage;
    if (!message.reply_to_message?.text) return;

    const parsed = parseSedCommand(message.text ?? '');
    if (!parsed) return;

    const modified = applySed(message.reply_to_message.text, parsed);
    await ctx.reply(`Modified text:\n${modified}`, {
      reply_parameters: { message_id: message.message_id },
    });
  });

  bot.catch((error) => {
    console.error('grammY error', error.error);
  });

  botCache.set(botToken, bot);
  return bot;
}

async function handleGuestUpdate(guestMessage: GuestMessage, botToken: string): Promise<void> {
  const queryId = guestMessage.guest_query_id;
  const summonText = guestMessage.text;
  if (!queryId || !summonText) return;

  try {
    const sedCommand = extractSedCommand(summonText);
    const parsed = sedCommand ? parseSedCommand(sedCommand) : null;
    if (!parsed) {
      await answerGuestQuery(botToken, queryId, 'Reply with: s/pattern/replacement/flags and include a target message.');
      return;
    }

    const sourceText = guestMessage.reply_to_message?.text;
    if (!sourceText) {
      await answerGuestQuery(botToken, queryId, 'I need a replied text message to transform.');
      return;
    }

    const modified = applySed(sourceText, parsed);
    await answerGuestQuery(botToken, queryId, `Modified text:\n${modified}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await answerGuestQuery(botToken, queryId, `❌ Error: ${message}`);
  }
}

function applySed(sourceText: string, parsed: ParsedSedCommand): string {
  const { pattern, replacement, flags } = parsed;
  const jsFlags = `${flags.includes('i') ? 'i' : ''}${flags.includes('m') ? 'm' : ''}${flags.includes('g') ? 'g' : ''}`;
  const regex = new RegExp(pattern, jsFlags);
  return sourceText.replace(regex, replacement);
}

function helpText(): string {
  return (
    '👋 Welcome to SedBot!\n\n' +
    'Reply to any message with: s/pattern/replacement/flags\n\n' +
    'Flags:\n' +
    '• g - Replace all occurrences\n' +
    '• i - Case-insensitive matching\n' +
    '• m - Multiline matching\n\n' +
    'Guest mode is supported when enabled in BotFather.'
  );
}

function parseSedCommand(command: string): ParsedSedCommand | null {
  if (!command || command[0] !== 's') return null;
  const sep = command[1];
  if (!sep) return null;

  const sections: string[] = [];
  let current = '';
  let escaped = false;

  for (let i = 2; i < command.length; i += 1) {
    const ch = command[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }

    if (ch === sep) {
      sections.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  sections.push(current);
  if (sections.length < 2) return null;

  const pattern = sections[0];
  const replacement = sections[1];
  const flags = sections[2] ?? '';

  if (pattern === undefined || replacement === undefined) return null;

  if (/[^gim]/.test(flags)) {
    throw new Error('Unsupported flags. Use only g, i, m');
  }

  return { pattern, replacement, flags };
}

function extractSedCommand(text: string): string | null {
  const tokens = text.trim().split(/\s+/);
  for (const token of tokens) {
    if (token.startsWith('s') && token.length >= 4) {
      return token;
    }
  }
  return null;
}

async function answerGuestQuery(botToken: string, guestQueryId: string, text: string): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${botToken}/answerGuestQuery`;
  const payload = {
    guest_query_id: guestQueryId,
    result: {
      type: 'article',
      id: 'sedbot-response',
      title: 'SedBot Response',
      input_message_content: {
        message_text: clampTelegramMessageText(text),
      },
    },
  };

  await telegramCall(endpoint, payload);
}

function clampTelegramMessageText(text: string): string {
  const maxLength = 4096;
  if (text.length <= maxLength) return text;

  const suffix = '\n\n[truncated]';
  return `${text.slice(0, maxLength - suffix.length)}${suffix}`;
}

async function telegramCall(endpoint: string, payload: unknown): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }
}
