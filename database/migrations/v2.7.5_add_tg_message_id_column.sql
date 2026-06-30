-- Add Telegram message ID for deleting source messages from Telegram channels

ALTER TABLE files ADD COLUMN tg_message_id TEXT;
