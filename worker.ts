import { Bot, webhookCallback } from 'grammy';
import { runSed, type SedOptions } from './sedEngine';

interface Env {
  TELEGRAM_BOT_TOKEN: SecretsStoreSecret;
  TELEGRAM_WEBHOOK_SECRET?: SecretsStoreSecret;
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

const botCache = new Map<string, Bot>();
const DONATE_URL = 'https://casungo.top/donate';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    try {
      const webhookSecret = await getOptionalSecret(env.TELEGRAM_WEBHOOK_SECRET);
      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (webhookSecret && secret !== webhookSecret) {
        return new Response('Unauthorized', { status: 401 });
      }

      let update: TelegramUpdate;
      try {
        update = (await request.clone().json()) as TelegramUpdate;
      } catch {
        return new Response('Bad Request', { status: 400 });
      }

      const botToken = await getBotToken(env);
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

async function getBotToken(env: Env): Promise<string | null> {
  const token = (await env.TELEGRAM_BOT_TOKEN.get()).trim();
  return token ? token : null;
}

async function getOptionalSecret(binding: SecretsStoreSecret | undefined): Promise<string | null> {
  if (!binding) return null;

  const value = (await binding.get()).trim();
  return value ? value : null;
}

function getBot(botToken: string): Bot {
  const cached = botCache.get(botToken);
  if (cached) return cached;

  const bot = new Bot(botToken);

  bot.command('start', async (ctx) => {
    await ctx.reply(startText(), {
      reply_parameters: { message_id: ctx.msg.message_id },
    });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(helpText(), {
      reply_parameters: { message_id: ctx.msg.message_id },
    });
  });

  bot.on('message:text', async (ctx) => {
    const message = ctx.message as TelegramMessage;
    if (!message.reply_to_message?.text) return;

    const invocation = parseSedInvocation(message.text ?? '');
    if (!invocation) return;

    try {
      const modified = runSed(invocation.script, message.reply_to_message.text, invocation.options);
      await ctx.reply(`Modified text:\n${modified}`, {
        reply_parameters: { message_id: message.message_id },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Error: ${errorMessage}`, {
        reply_parameters: { message_id: message.message_id },
      });
    }
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
    const invocation = extractSedInvocation(summonText);
    if (!invocation) {
      await answerGuestQuery(botToken, queryId, 'Reply with a sed script such as s/pattern/replacement/g and include a target message.');
      return;
    }

    const sourceText = guestMessage.reply_to_message?.text;
    if (!sourceText) {
      await answerGuestQuery(botToken, queryId, 'I need a replied text message to transform.');
      return;
    }

    const modified = runSed(invocation.script, sourceText, invocation.options);
    await answerGuestQuery(botToken, queryId, `Modified text:\n${modified}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await answerGuestQuery(botToken, queryId, `❌ Error: ${message}`);
  }
}

function startText(): string {
  return (
    '👋 Welcome to SedBot!\n\n' +
    'I run sed scripts on replied Telegram messages.\n\n' +
    'Quick use:\n' +
    '1. Reply to a text message.\n' +
    '2. Send a sed script, for example: s/cat/dog/g\n\n' +
    'Useful commands:\n' +
    '/help - detailed syntax, examples, supported commands, and limits\n' +
    `/start - this quick introduction\n\n` +
    `Support the project: ${DONATE_URL}`
  );
}

function helpText(): string {
  return (
    'SedBot help\n\n' +
    'How to use it\n' +
    'Reply to any text message with a sed script. SedBot applies the script to the replied text and sends back the modified text.\n\n' +
    'Basic examples\n' +
    's/cat/dog/       replace the first cat on each line\n' +
    's/cat/dog/g      replace every cat on each line\n' +
    's/error/ERROR/i  case-insensitive replacement\n' +
    's/[0-9]/#/g      replace digits with #\n' +
    's/foo/(&)/       & expands to the full match\n' +
    's/\\(foo\\)/[\\1]/  BRE capture and backreference\n\n' +
    'Options\n' +
    'sed -n SCRIPT    suppress default output; print only with p, =, etc.\n' +
    'sed -E SCRIPT    use extended regular expressions\n' +
    'sed -En SCRIPT   combine -E and -n\n' +
    'SCRIPT           you can also send the script without the sed prefix\n\n' +
    'Addresses\n' +
    '2p               print line 2\n' +
    '$p               print the last line\n' +
    '/error/p         print lines matching error\n' +
    '2,5d             delete lines 2 through 5\n' +
    '/start/,/end/p   select a regex range\n' +
    '3!d              apply the command when line 3 is not selected\n\n' +
    'Substitution flags\n' +
    'g                replace all non-overlapping matches\n' +
    'i                case-insensitive match\n' +
    'p                print the pattern space if a replacement happened\n' +
    '2, 3, ...        replace only that occurrence\n\n' +
    'Supported commands\n' +
    's  substitute text\n' +
    'y  transliterate characters\n' +
    'p/P print pattern space or first line of it\n' +
    'd/D delete pattern space or first line of it\n' +
    'n/N read or append the next input line\n' +
    'q  quit\n' +
    'a/i/c append, insert, or change text\n' +
    'h/H/g/G/x use hold space\n' +
    'b/t/: branch, test substitutions, and labels\n' +
    '=  print the current line number\n' +
    'l  print an unambiguous escaped form\n' +
    '#  comment line; #n also enables -n\n' +
    '{ } group commands under one address\n\n' +
    'More examples\n' +
    "sed -n '2,5p'        output only lines 2 through 5\n" +
    '/^$/d               remove empty lines\n' +
    'y/abc/ABC/          change a, b, c into A, B, C\n' +
    'N;s/hello\\nworld/hi/ join two-line text and replace it\n' +
    ':x;s/  / /g;tx      collapse repeated spaces\n\n' +
    'Telegram limits\n' +
    'SedBot works on the replied message text only. It cannot read stdin, command-line files, or script files. File-backed r, w, and s///w file are rejected because the bot has no user filesystem in chat mode.\n\n' +
    `Support the project: ${DONATE_URL}`
  );
}

function parseSedInvocation(text: string): { script: string; options: SedOptions } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('sed ')) {
    return looksLikeSedScript(trimmed) ? { script: trimmed, options: {} } : null;
  }

  const tokens = trimmed.split(/\s+/);
  const options: SedOptions = {};
  const scripts: string[] = [];
  const rest: string[] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    if (token === '-n') {
      options.suppressDefault = true;
    } else if (token === '-E') {
      options.extended = true;
    } else if (token === '-En' || token === '-nE') {
      options.suppressDefault = true;
      options.extended = true;
    } else if (token === '-e') {
      const script = tokens[index + 1];
      if (script) {
        scripts.push(script);
        index += 1;
      }
    } else {
      rest.push(...tokens.slice(index));
      break;
    }
  }

  if (rest.length > 0) scripts.push(rest.join(' '));
  const script = scripts.join('\n');
  return script ? { script, options } : null;
}

function extractSedInvocation(text: string): { script: string; options: SedOptions } | null {
  const direct = parseSedInvocation(text);
  if (direct) return direct;

  const tokens = text.trim().split(/\s+/);
  for (const token of tokens) {
    const invocation = parseSedInvocation(token);
    if (invocation) return invocation;
  }
  return null;
}

function looksLikeSedScript(text: string): boolean {
  const first = text.trimStart()[0];
  return first !== undefined && /[0-9$/\\#!{}acdgGhHilnNpPqstyx:=]/.test(first);
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
