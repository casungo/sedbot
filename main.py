import logging
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters
from secret import token

# Set up the Updater with the provided token
updater = Updater(token, use_context=True)
# Get the dispatcher to register command and message handlers
dispatcher = updater.dispatcher

# Configure logging to write to a file
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# Start command handler
def start(update, context):
    context.bot.send_animation(chat_id=update.message.chat_id, animation="https://raw.githubusercontent.com/casungo/sedbot/master/assets/example.gif", caption="Hello\! I'm a simple bot that can perform search and replace on text 🔍\n\nTo use this feature, reply to a message with text that begins with `s/` followed by the text you want to search for and the text you want to replace it with, separated by a `/` character\.\n\nFor example: `s/old/new` 😉\n\nIf you need any help you can [contact me](https://casungo.top/)", parse_mode='MarkdownV2')
    # Log the use of the /start command
    logger.info("Username:{} used /start".format(update.message.from_user.username))

# Text message handler
def text_handler(update, context):
    # Get the text of the message
    message = update.message.text
    # Get the text of the message to which this message is a reply, if any
    replymessage = getattr(update.message.reply_to_message, "text", "")
    # If there is a replied-to message
    if replymessage != "":
        # If the message starts with "s/", it is a search and replace command
        if message.startswith("s/"):
            # Split the message into the search and replace strings
            split = message.split("/", 2)
            old = split[1]
            new = split[2]
            # If the search and replace strings are not empty
            if old != "" and new != "":
                # Perform the search and replace on the replied-to message
                output = "{}".format(replymessage.replace(old, new))
                # Send the updated message to the chat
                context.bot.send_message(chat_id=update.message.chat_id, text=output, reply_to_message_id=update.message.reply_to_message.message_id, parse_mode='HTML')
                # Log the use of the search and replace feature
                logger.info("Username: @{}\nUsing {}:\n\n{}\n\nbecame\n\n{}".format(update.message.from_user.username, message, getattr(update.message.reply_to_message, "text", ""), replymessage.replace(old, new)))

# Add command and message handlers to the dispatcher
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(MessageHandler(Filters.text, text_handler))

# Start the bot
updater.start_polling()
# Run the bot until the user presses Ctrl-C or the process receives SIGINT,
# SIGTERM or SIGABRT
updater.idle()
