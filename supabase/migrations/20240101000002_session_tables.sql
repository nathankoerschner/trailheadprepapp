-- Session tables

create type session_status as enum (
  'lobby', 'testing', 'analyzing', 'lesson', 'retest', 'complete'
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  test_id uuid not null references tests(id) on delete cascade,
  created_by uuid not null references tutors(id) on delete cascade,
  pin_code text not null unique,
  status session_status not null default 'lobby',
  tutor_count int not null default 1 check (tutor_count between 1 and 3),
  retest_question_count int not null default 20,
  test_duration_minutes int not null default 180,
  test_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table session_students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  joined_at timestamptz not null default now(),
  test_started_at timestamptz,
  test_submitted boolean not null default false,
  test_submitted_at timestamptz,
  unique(session_id, student_id)
);

create table student_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_answer text check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  answered_at timestamptz not null default now(),
  unique(session_id, student_id, question_id)
);

create index idx_session_students_session on session_students(session_id);
create index idx_student_answers_session on student_answers(session_id);
create index idx_student_answers_student on student_answers(student_id);
create index idx_sessions_pin on sessions(pin_code);
