-- Retest and progress report tables

create table retest_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  source text not null check (source in ('missed', 'padding')),
  question_order int not null,
  created_at timestamptz not null default now()
);

create table retest_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_answer text check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  answered_at timestamptz not null default now(),
  unique(session_id, student_id, question_id)
);

create table progress_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, student_id)
);

create index idx_retest_questions_student on retest_questions(session_id, student_id);
create index idx_retest_answers_student on retest_answers(session_id, student_id);
