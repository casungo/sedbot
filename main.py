import re
import os
import logging
from dotenv import load_dotenv
from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters

# Load environment variables
load_dotenv()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN not found in environment variables")

# Set up logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def start(update: Update, context):
    """Send welcome message with usage instructions"""
    help_text = (
        "👋 Welcome to SedBot!\n\n"
        "I can help you transform text messages using sed-style commands.\n\n"
        "🔧 Basic Usage:\n"
        "1. Reply to any message\n"
        "2. Use the format: s/pattern/replacement/flags\n\n"
        "🚀 Available Flags:\n"
        "• g - Replace all occurrences\n"
        "• i - Case-insensitive matching\n"
        "• m - Multiline matching\n\n"
        "📝 Examples:\n"
        "• s/hello/hi/g - Replace all 'hello' with 'hi'\n"
        "• s/ERROR/error/i - Replace 'ERROR' case-insensitive\n"
        "• s/old// - Remove first 'old'\n\n"
        "💡 Tip: You can use regular expressions in the pattern!"
    )
    await update.message.reply_text(help_text)

async def handle_message(update: Update, context):
    """Process sed commands in replied messages"""
    if not update.message.reply_to_message:
        return
    
    try:
        original_text = update.message.reply_to_message.text
        command = update.message.text
        
        # Parse sed command (supports s/pattern/replace/flags format)
        if command.startswith("s/"):
            sep = command[1]
            parts = command.split(sep)
            
            pattern = parts[1]
            replacement = parts[2]
            flags = parts[3] if len(parts) > 3 else ""
            
            # Handle flags
            re_flags = 0
            if "i" in flags:
                re_flags |= re.IGNORECASE
            if "m" in flags:
                re_flags |= re.MULTILINE
                
            # Perform substitution
            modified = re.sub(
                pattern=pattern,
                repl=replacement,
                string=original_text,
                count=0 if "g" in flags else 1,
                flags=re_flags
            )
            
            # Send modified text with attribution
            await update.message.reply_text(
                f"Modified text:\n{modified}",
                reply_to_message_id=update.message.reply_to_message.message_id
            )
            
    except Exception as e:
        logger.error(f"Error processing command: {e}")
        await update.message.reply_text(f"❌ Error: {str(e)}")

def main():
    """Start the bot"""
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Command handlers
    application.add_handler(CommandHandler("start", start))
    
    # Message handler for sed commands
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )
    
    # Set menu commands
    commands = [
        BotCommand("start", "Get usage instructions")
    ]
    application.bot.set_my_commands(commands)
    
    # Start polling
    application.run_polling()

if __name__ == "__main__":
    main()