-- Add paused status to session_status enum
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'paused' AFTER 'testing';

-- Add pause tracking columns
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_paused_ms bigint NOT NULL DEFAULT 0;
