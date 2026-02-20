-- Add counterpart_json column to questions for AI-generated counterpart questions
alter table questions
  add column counterpart_json jsonb;
