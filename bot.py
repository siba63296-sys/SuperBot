import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional, Union

from telegram import (
    ChatMember,
    ChatMemberUpdated,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MessageOriginChannel,
    Update,
)
from telegram.constants import ChatMemberStatus, ChatType
from telegram.error import BadRequest, Forbidden, NetworkError, RetryAfter, TelegramError
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    ChatMemberHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
# Silence overly verbose httpx logs so Railway logs stay clean and readable
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration & Constants
# ---------------------------------------------------------------------------
BOT_TOKEN: Optional[str] = os.environ.get("BOT_TOKEN")

# Channel invite link where users must join first
JOIN_CHANNEL_URL: str = os.environ.get(
    "JOIN_CHANNEL_URL",
    "https://t.me/+maKoLPmHtag0ZDFl",
)

# Second link unlocked only after verification succeeds
UNLOCKED_LINK_URL: str = os.environ.get(
    "UNLOCKED_LINK_URL",
    "https://t.me/+4sZzvY5R6hI3ZWVl",
)

# Callback data identifier for the Verify Join button
VERIFY_CALLBACK_DATA: str = "verify_join"

# Exact required messages
WELCOME_MESSAGE: str = (
    "👋 Welcome!\n"
    "🔒 Please join our Telegram channel first to unlock your link."
)

NOT_JOINED_MESSAGE: str = "❌ You have not joined our channel yet. Please join first!"

VERIFIED_MESSAGE: str = (
    "🎉 Verification Successful!\n"
    "Here is your requested link:"
)

# File used to persist auto-detected Channel ID if CHANNEL_ID env var is not set
CONFIG_FILE = Path("channel_config.json")


# ---------------------------------------------------------------------------
# Channel ID Resolution Helpers
# ---------------------------------------------------------------------------
def parse_channel_id(raw_value: Optional[str]) -> Optional[Union[int, str]]:
    """Convert CHANNEL_ID string into an integer (for -100... IDs) or @username."""
    if not raw_value:
        return None
    cleaned = raw_value.strip()
    if not cleaned:
        return None
    # Numeric channel IDs (e.g. -1001234567890)
    if cleaned.lstrip("-").isdigit():
        return int(cleaned)
    # Public channel username (e.g. @mychannel)
    if cleaned.startswith("@"):
        return cleaned
    return cleaned


def load_saved_channel_id() -> Optional[Union[int, str]]:
    """Load the channel ID from environment variable or auto-detected config file."""
    env_channel = parse_channel_id(os.environ.get("CHANNEL_ID"))
    if env_channel is not None:
        return env_channel

    if CONFIG_FILE.exists():
        try:
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            return parse_channel_id(str(data.get("channel_id", "")))
        except Exception as exc:
            logger.warning("Could not read %s: %s", CONFIG_FILE, exc)
    return None


def save_channel_id(channel_id: Union[int, str], channel_title: str = "") -> None:
    """Persist auto-detected channel ID locally so the bot remembers the channel."""
    try:
        CONFIG_FILE.write_text(
            json.dumps(
                {"channel_id": channel_id, "channel_title": channel_title},
                indent=2,
            ),
            encoding="utf-8",
        )
        logger.info("Saved verification channel ID: %s (%s)", channel_id, channel_title)
    except Exception as exc:
        logger.warning("Failed to save channel ID to file: %s", exc)


# ---------------------------------------------------------------------------
# Keyboard Builders
# ---------------------------------------------------------------------------
def get_join_keyboard() -> InlineKeyboardMarkup:
    """Build the inline keyboard with JOIN CHANNEL and VERIFY JOIN buttons."""
    keyboard = [
        [InlineKeyboardButton("📢 JOIN CHANNEL", url=JOIN_CHANNEL_URL)],
        [InlineKeyboardButton("✅ VERIFY JOIN", callback_data=VERIFY_CALLBACK_DATA)],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_unlocked_keyboard() -> InlineKeyboardMarkup:
    """Build the inline keyboard with the unlocked OPEN LINK button."""
    keyboard = [
        [InlineKeyboardButton("🔓 OPEN LINK", url=UNLOCKED_LINK_URL)],
    ]
    return InlineKeyboardMarkup(keyboard)


# ---------------------------------------------------------------------------
# Membership Check Logic (Telegram Bot API getChatMember)
# ---------------------------------------------------------------------------
def is_active_member(chat_member: ChatMember) -> bool:
    """
    Evaluate a Telegram ChatMember object returned by getChatMember.
    Returns True only if the user is currently inside the channel.
    """
    status = chat_member.status

    if status in (
        ChatMemberStatus.OWNER,
        ChatMemberStatus.ADMINISTRATOR,
        ChatMemberStatus.MEMBER,
    ):
        return True

    # A restricted user may still be inside the chat if is_member is True
    if status == ChatMemberStatus.RESTRICTED:
        return bool(getattr(chat_member, "is_member", False))

    # ChatMemberStatus.LEFT or ChatMemberStatus.BANNED
    return False


async def check_user_membership(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
) -> tuple[bool, Optional[str]]:
    """
    Query Telegram's getChatMember API in real time.
    Returns (is_member, configuration_error_message).
    """
    channel_id = load_saved_channel_id()

    if channel_id is None:
        logger.error(
            "CHANNEL_ID is not configured yet. Add the bot as an Admin to your channel "
            "or set the CHANNEL_ID environment variable in Railway."
        )
        return (
            False,
            "⚠️ Bot Setup Pending: Please add this bot as an Administrator to your "
            "verification channel (or forward any post from the channel to this bot) "
            "so it can check memberships.",
        )

    try:
        chat_member = await context.bot.get_chat_member(
            chat_id=channel_id,
            user_id=user_id,
        )
        return is_active_member(chat_member), None

    except BadRequest as exc:
        error_text = str(exc).lower()
        # Standard Telegram responses when a user has never joined the channel
        if any(
            phrase in error_text
            for phrase in (
                "user not found",
                "participant_id_invalid",
                "user_not_participant",
            )
        ):
            return False, None

        # Configuration issues (bot not admin in channel or wrong CHANNEL_ID)
        if "chat not found" in error_text or "member list is inaccessible" in error_text:
            logger.error(
                "getChatMember failed for channel_id=%s: %s. "
                "Make sure the bot is added as an Administrator in the channel!",
                channel_id,
                exc,
            )
            return (
                False,
                "⚠️ Channel Admin Required: Please make sure this bot is added as an "
                "Administrator in the verification channel.",
            )

        logger.error("Telegram BadRequest during getChatMember: %s", exc)
        return False, None

    except Forbidden as exc:
        logger.error(
            "Bot lacks permission in channel %s: %s. Ensure the bot is an Administrator.",
            channel_id,
            exc,
        )
        return (
            False,
            "⚠️ Permission Error: The bot must be an Administrator in the channel to verify members.",
        )

    except TelegramError as exc:
        logger.error("Telegram API error while verifying user %s: %s", user_id, exc)
        return False, "⚠️ Temporary Telegram error. Please tap VERIFY JOIN again in a moment."


# ---------------------------------------------------------------------------
# Bot Command & Callback Handlers
# ---------------------------------------------------------------------------
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command and send welcome prompt with inline buttons."""
    if update.effective_message is None:
        return

    await update.effective_message.reply_text(
        text=WELCOME_MESSAGE,
        reply_markup=get_join_keyboard(),
    )


async def verify_join_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle clicks on the '✅ VERIFY JOIN' inline button.
    Checks real-time membership via getChatMember on EVERY attempt.
    """
    query = update.callback_query
    if query is None or query.from_user is None:
        return

    user_id = query.from_user.id
    is_member, config_error = await check_user_membership(context, user_id)

    if config_error:
        await query.answer(text=config_error, show_alert=True)
        return

    if is_member:
        # Acknowledge button press
        await query.answer(text="✅ Verification Successful!")
        # Send the unlocked link message and button
        if query.message:
            await query.message.reply_text(
                text=VERIFIED_MESSAGE,
                reply_markup=get_unlocked_keyboard(),
            )
    else:
        # User has NOT joined: show alert and message without revealing the second link
        await query.answer(
            text=NOT_JOINED_MESSAGE,
            show_alert=True,
        )
        if query.message:
            await query.message.reply_text(
                text=NOT_JOINED_MESSAGE,
                reply_markup=get_join_keyboard(),
            )


# ---------------------------------------------------------------------------
# Automatic Channel ID Discovery (Beginner-Friendly Setup)
# ---------------------------------------------------------------------------
async def track_bot_channel_status(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
) -> None:
    """
    Automatically detect and save the Channel ID when the user adds the bot
    as an Administrator to their Telegram channel.
    """
    my_member: Optional[ChatMemberUpdated] = update.my_chat_member
    if my_member is None:
        return

    chat = my_member.chat
    new_status = my_member.new_chat_member.status

    if chat.type == ChatType.CHANNEL and new_status in (
        ChatMemberStatus.ADMINISTRATOR,
        ChatMemberStatus.OWNER,
    ):
        save_channel_id(chat.id, chat.title or "Telegram Channel")
        logger.info(
            "✅ Automatically detected verification channel! Title: '%s' | CHANNEL_ID: %s",
            chat.title,
            chat.id,
        )


async def handle_channel_post(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
) -> None:
    """
    If no CHANNEL_ID is saved yet and a post occurs in a channel where the bot is admin,
    automatically save that channel's ID.
    """
    if update.channel_post and load_saved_channel_id() is None:
        chat = update.channel_post.chat
        save_channel_id(chat.id, chat.title or "Telegram Channel")
        logger.info(
            "✅ Automatically captured CHANNEL_ID from channel post: %s (%s)",
            chat.id,
            chat.title,
        )


async def handle_forwarded_channel_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
) -> None:
    """
    Allow the owner to forward any message from their channel to the bot in private chat
    to view and automatically configure the CHANNEL_ID.
    """
    message = update.effective_message
    if message is None or message.forward_origin is None:
        return

    origin = message.forward_origin
    if isinstance(origin, MessageOriginChannel):
        channel_chat = origin.chat
        # Only auto-save if CHANNEL_ID environment variable is not already locked in
        if os.environ.get("CHANNEL_ID") is None:
            save_channel_id(channel_chat.id, channel_chat.title or "Channel")

        await message.reply_text(
            f"✅ Channel Detected!\n\n"
            f"📢 Channel Name: {channel_chat.title}\n"
            f"🆔 CHANNEL_ID: {channel_chat.id}\n\n"
            f"Make sure this bot is added as an Administrator in '{channel_chat.title}' "
            f"so it can verify members."
        )


# ---------------------------------------------------------------------------
# Global Error Handler
# ---------------------------------------------------------------------------
async def global_error_handler(
    update: object,
    context: ContextTypes.DEFAULT_TYPE,
) -> None:
    """Log all errors cleanly and keep the bot running smoothly."""
    err = context.error
    if isinstance(err, RetryAfter):
        logger.warning("Rate limited by Telegram. Retrying after %s seconds.", err.retry_after)
        return
    if isinstance(err, NetworkError):
        logger.warning("Temporary network error: %s. Polling will automatically reconnect.", err)
        return
    logger.error("Unhandled exception while processing update %s:", update, exc_info=err)


# ---------------------------------------------------------------------------
# Main Entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    """Start the Telegram Verification Bot using long polling."""
    if not BOT_TOKEN:
        logger.critical(
            "❌ ERROR: BOT_TOKEN environment variable is missing! "
            "Please add BOT_TOKEN in your Railway service Variables tab."
        )
        sys.exit(1)

    configured_channel = load_saved_channel_id()
    if configured_channel:
        logger.info("Using verification CHANNEL_ID: %s", configured_channel)
    else:
        logger.warning(
            "No CHANNEL_ID environment variable set yet. "
            "The bot will automatically detect your channel as soon as you add the bot "
            "as an Administrator to your channel or forward a channel message to it!"
        )

    application: Application = (
        ApplicationBuilder()
        .token(BOT_TOKEN)
        .build()
    )

    # 1. /start command handler
    application.add_handler(CommandHandler("start", start_command))

    # 2. "✅ VERIFY JOIN" button click handler
    application.add_handler(
        CallbackQueryHandler(verify_join_callback, pattern=f"^{VERIFY_CALLBACK_DATA}$")
    )

    # 3. Auto-detect channel ID when bot is added as Admin to the channel
    application.add_handler(
        ChatMemberHandler(track_bot_channel_status, ChatMemberHandler.MY_CHAT_MEMBER)
    )

    # 4. Auto-detect channel ID from channel posts or forwarded channel messages
    application.add_handler(
        MessageHandler(filters.ChatType.CHANNEL, handle_channel_post)
    )
    application.add_handler(
        MessageHandler(filters.ChatType.PRIVATE & filters.FORWARDED, handle_forwarded_channel_message)
    )

    # 5. Global error handler to keep the bot running 24/7
    application.add_error_handler(global_error_handler)

    logger.info("🚀 Telegram Channel Join Verification Bot is running with polling...")
    application.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True,
    )


if __name__ == "__main__":
    main()
