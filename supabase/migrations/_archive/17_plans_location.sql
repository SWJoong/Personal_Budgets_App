-- Migration 17: Add location fields to plans table
-- Allows participants to pin planned locations during plan creation

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS place_name TEXT,
  ADD COLUMN IF NOT EXISTS place_lat  NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS place_lng  NUMERIC(10, 7);

