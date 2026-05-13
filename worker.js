export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    try {
      if (update?.guest_message) {
        await handleGuestUpdate(update.guest_message, env);
        return new Response('OK', { status: 200 });
      }

      if (update?.message) {
        await handleMessageUpdate(update.message, env);
      }
    } catch (error) {
      console.error('Error processing update', error);
    }

    return new Response('OK', { status: 200 });
  },
};

async function handleMessageUpdate(message, env) {
  if (!message?.text) return;

  if (message.text.startsWith('/start')) {
    await sendMessage(env, message.chat.id, helpText(), {
      reply_to_message_id: message.message_id,
    });
    return;
  }

  if (!message.reply_to_message?.text) return;

  const parsed = parseSedCommand(message.text);
  if (!parsed) return;

  const modified = applySed(message.reply_to_message.text, parsed);
  await sendMessage(env, message.chat.id, `Modified text:\n${modified}`, {
    reply_to_message_id: message.reply_to_message.message_id,
  });
}

async function handleGuestUpdate(guestMessage, env) {
  const queryId = guestMessage?.guest_query_id;
  const summonText = guestMessage?.text;
  if (!queryId || !summonText) return;

  try {
    const parsed = parseSedCommand(summonText);
    if (!parsed) {
      await answerGuestQuery(env, queryId, 'Reply with: s/pattern/replacement/flags and include a target message.');
      return;
    }

    const sourceText = guestMessage?.reply_to_message?.text || guestMessage?.quoted_message?.text;
    if (!sourceText) {
      await answerGuestQuery(env, queryId, 'I need a replied text message to transform.');
      return;
    }

    const modified = applySed(sourceText, parsed);
    await answerGuestQuery(env, queryId, `Modified text:\n${modified}`);
  } catch (error) {
    await answerGuestQuery(env, queryId, `❌ Error: ${String(error.message || error)}`);
  }
}

function applySed(sourceText, parsed) {
  const { pattern, replacement, flags } = parsed;
  const jsFlags = `${flags.includes('i') ? 'i' : ''}${flags.includes('m') ? 'm' : ''}${flags.includes('g') ? 'g' : ''}`;
  const regex = new RegExp(pattern, jsFlags);
  return sourceText.replace(regex, replacement);
}

function helpText() {
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

function parseSedCommand(command) {
  if (!command || command[0] !== 's') return null;
  const sep = command[1];
  if (!sep) return null;

  const sections = [];
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
  const flags = sections[2] || '';

  if (/[^gim]/.test(flags)) {
    throw new Error('Unsupported flags. Use only g, i, m');
  }

  return { pattern, replacement, flags };
}

async function sendMessage(env, chatId, text, extra = {}) {
  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    ...extra,
  };

  await telegramCall(endpoint, payload);
}

async function answerGuestQuery(env, guestQueryId, text) {
  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerGuestQuery`;
  const payload = {
    guest_query_id: guestQueryId,
    text,
  };

  await telegramCall(endpoint, payload);
}

async function telegramCall(endpoint, payload) {
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
