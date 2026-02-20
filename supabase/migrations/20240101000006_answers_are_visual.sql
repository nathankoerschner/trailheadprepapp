-- Add flag for questions where answer choices are visual (graphs, diagrams)
alter table questions add column answers_are_visual boolean not null default false;
