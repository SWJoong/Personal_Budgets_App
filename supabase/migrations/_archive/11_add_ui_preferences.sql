-- Add ui_preferences JSONB column to participants table
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS ui_preferences JSONB
  DEFAULT '{"enabled_blocks":["yearly_balance","monthly_trend","recent_transactions","plan_shortcut","evaluation_letter"]}'::jsonb;

-- Backfill existing rows that have NULL
UPDATE public.participants
  SET ui_preferences = '{"enabled_blocks":["yearly_balance","monthly_trend","recent_transactions","plan_shortcut","evaluation_letter"]}'::jsonb
  WHERE ui_preferences IS NULL;
