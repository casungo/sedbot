from telegram.ext import Updater, CommandHandler, MessageHandler, Filters
import config

updater = Updater(token=config.BOT_TOKEN, use_context=True)
dispatcher = updater.dispatcher

def start(update, context):
    context.bot.send_message(chat_id=update.message.chat_id, text="<b>I'm online</b>", parse_mode='HTML')

def text_handler(update, context):
    message = update.message.text
    replymessage = update.message.reply_to_message.text
    if replymessage != "":
        if message.startswith("s/"):
            split = message.split("/", 2)
            old = split[1]
            new = split[2]
            if old != "" and new != "":
                output = "I think this is better:\n<code>{}</code>".format(replymessage.replace(old, new))
                context.bot.send_message(chat_id=update.message.chat_id, text=output, reply_to_message_id=update.message.reply_to_message.message_id, parse_mode='HTML')

message_handler = MessageHandler(Filters.text, text_handler)
dispatcher.add_handler(message_handler)
start_handler = CommandHandler("start", start)
dispatcher.add_handler(start_handler)

updater.start_polling()
