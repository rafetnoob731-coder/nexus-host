import os
import sys
import time
import logging
import platform
from datetime import datetime, timezone

logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN")
if not BOT_TOKEN:
    logger.error("BOT_TOKEN environment variable is not set")
    sys.exit(1)

HOST = os.environ.get("HOST", platform.node())
PORT = int(os.environ.get("PORT", 8080))
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "")
DEPLOY_MODE = os.environ.get("DEPLOY_MODE", "polling")
START_TIME = time.time()

def uptime_str():
    secs = int(time.time() - START_TIME)
    h, r = divmod(secs, 3600)
    m, s = divmod(r, 60)
    return f"{h}h {m}m {s}s"

try:
    import telebot
    USE_PYTG = True
    logger.info("Using pyTelegramBotAPI")
except ImportError:
    try:
        from telegram.ext import Application, CommandHandler
        USE_PYTG = False
        logger.info("Using python-telegram-bot")
    except ImportError:
        logger.error("No Telegram bot library installed. Run: pip install pyTelegramBotAPI")
        sys.exit(1)

def build_status():
    return (
        f"🚀 *NEXUS CLOUD — Bot Hosting Status*\n"
        f"├ Host: `{HOST}`\n"
        f"├ Uptime: `{uptime_str()}`\n"
        f"├ Mode: `{DEPLOY_MODE}`\n"
        f"├ Python: `{platform.python_version()}`\n"
        f"├ Platform: `{platform.system()} {platform.release()}`\n"
        f"├ Time: `{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}`\n"
        f"├ Bot: `{'pyTelegramBotAPI' if USE_PYTG else 'python-telegram-bot'}`\n"
        f"└ Deploy: `{'Webhook' if DEPLOY_MODE == 'webhook' else 'Long Polling'}`"
    )

if USE_PYTG:
    bot = telebot.TeleBot(BOT_TOKEN, parse_mode="Markdown")

    @bot.message_handler(commands=["start"])
    def cmd_start(msg):
        bot.reply_to(
            msg,
            f"👋 Hello *{msg.from_user.first_name}*!\n\n"
            f"I'm a *NEXUS CLOUD* hosted bot. I'm running on `{HOST}`.\n\n"
            f"Commands:\n"
            f"• `/ping` — Latency check\n"
            f"• `/status` — Hosting details\n"
            f"• `/deploy` — Deployment info",
            parse_mode="Markdown",
        )
        logger.info(f"User {msg.from_user.id} (@{msg.from_user.username}) started bot")

    @bot.message_handler(commands=["ping"])
    def cmd_ping(msg):
        t1 = time.time()
        reply = bot.reply_to(msg, "⏳ Pong!")
        t2 = time.time()
        bot.edit_message_text(
            f"🏓 *Pong!* `{((t2 - t1) * 1000):.0f}ms`\n"
            f"├ Host: `{HOST}`\n"
            f"└ Uptime: `{uptime_str()}`",
            chat_id=msg.chat.id,
            message_id=reply.message_id,
            parse_mode="Markdown",
        )

    @bot.message_handler(commands=["status"])
    def cmd_status(msg):
        bot.reply_to(msg, build_status(), parse_mode="Markdown")

    @bot.message_handler(commands=["deploy"])
    def cmd_deploy(msg):
        bot.reply_to(
            msg,
            f"📦 *NEXUS CLOUD — Deployment*\n"
            f"├ Platform: `{DEPLOY_MODE == 'webhook' and 'Webhook' or 'Polling'}`\n"
            f"├ Webhook: `{WEBHOOK_URL or 'N/A'}`\n"
            f"├ Host: `{HOST}`\n"
            f"├ Port: `{PORT}`\n"
            f"├ Restarts: Graceful\n"
            f"└ Logs: Streamed to console\n\n"
            f"_Hosted on NEXUS CLOUD_",
            parse_mode="Markdown",
        )

    logger.info("Starting bot in polling mode...")
    try:
        bot.infinity_polling(timeout=30, long_polling_timeout=30)
    except Exception as e:
        logger.critical(f"Polling error, restarting in 5s: {e}")
        time.sleep(5)
        os.execv(sys.executable, ["python"] + sys.argv)

else:
    from telegram import Update
    from telegram.ext import Application, CommandHandler, ContextTypes

    application = Application.builder().token(BOT_TOKEN).build()

    async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            f"👋 Hello *{update.effective_user.first_name}*!\n\n"
            f"I'm a *NEXUS CLOUD* hosted bot on `{HOST}`.\n\n"
            f"Commands:\n• `/ping` — Latency check\n• `/status` — Hosting details\n• `/deploy` — Deployment info",
            parse_mode="Markdown",
        )
        logger.info(f"User {update.effective_user.id} started bot")

    async def cmd_ping(update: Update, context: ContextTypes.DEFAULT_TYPE):
        t1 = time.time()
        msg = await update.message.reply_text("⏳ Pong!")
        t2 = time.time()
        await msg.edit_text(
            f"🏓 *Pong!* `{((t2 - t1) * 1000):.0f}ms`\n├ Host: `{HOST}`\n└ Uptime: `{uptime_str()}`",
            parse_mode="Markdown",
        )

    async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(build_status(), parse_mode="Markdown")

    async def cmd_deploy(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            f"📦 *NEXUS CLOUD — Deployment*\n├ Platform: `Polling`\n├ Host: `{HOST}`\n├ Port: `{PORT}`\n└ Restarts: Graceful",
            parse_mode="Markdown",
        )

    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("ping", cmd_ping))
    application.add_handler(CommandHandler("status", cmd_status))
    application.add_handler(CommandHandler("deploy", cmd_deploy))

    logger.info("Starting bot in polling mode (python-telegram-bot)...")
    try:
        application.run_polling(allowed_updates=["message"])
    except Exception as e:
        logger.critical(f"Polling error: {e}")
        sys.exit(1)
