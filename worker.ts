import { Bot, webhookCallback } from 'grammy';

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
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
  quoted_message?: {
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
      if (update.guest_message) {
        await handleGuestUpdate(update.guest_message, env);
        return new Response('OK', { status: 200 });
      }

      const bot = getBot(env);
      const handler = webhookCallback(bot, 'cloudflare-mod');
      return await handler(request);
    } catch (error: unknown) {
      console.error('Error processing update', error);
      return new Response('OK', { status: 200 });
    }
  },
};

function getBot(env: Env): Bot {
  const cached = botCache.get(env.TELEGRAM_BOT_TOKEN);
  if (cached) return cached;

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

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

  botCache.set(env.TELEGRAM_BOT_TOKEN, bot);
  return bot;
}

async function handleGuestUpdate(guestMessage: GuestMessage, env: Env): Promise<void> {
  const queryId = guestMessage.guest_query_id;
  const summonText = guestMessage.text;
  if (!queryId || !summonText) return;

  try {
    const parsed = parseSedCommand(summonText);
    if (!parsed) {
      await answerGuestQuery(env, queryId, 'Reply with: s/pattern/replacement/flags and include a target message.');
      return;
    }

    const sourceText = guestMessage.reply_to_message?.text ?? guestMessage.quoted_message?.text;
    if (!sourceText) {
      await answerGuestQuery(env, queryId, 'I need a replied text message to transform.');
      return;
    }

    const modified = applySed(sourceText, parsed);
    await answerGuestQuery(env, queryId, `Modified text:\n${modified}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await answerGuestQuery(env, queryId, `❌ Error: ${message}`);
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

async function answerGuestQuery(env: Env, guestQueryId: string, text: string): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerGuestQuery`;
  const payload = {
    guest_query_id: guestQueryId,
    text,
  };

  await telegramCall(endpoint, payload);
}

async function telegramCall(endpoint: string, payload: Record<string, string>): Promise<void> {
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
