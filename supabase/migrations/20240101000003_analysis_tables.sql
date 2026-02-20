-- Analysis and lesson tables

create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade unique,
  status text not null default 'pending' check (status in ('pending', 'grading', 'analyzing', 'clustering', 'generating_lessons', 'generating_practice', 'complete', 'error')),
  progress int not null default 0 check (progress between 0 and 100),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table lesson_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  group_type text not null check (group_type in ('tutor_1', 'tutor_2', 'tutor_3', 'independent')),
  concept_focus text,
  created_at timestamptz not null default now()
);

create table lesson_group_students (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references lesson_groups(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  unique(group_id, student_id)
);

create table lesson_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  group_id uuid not null references lesson_groups(id) on delete cascade,
  tutor_guide text,
  practice_problems jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_lesson_groups_session on lesson_groups(session_id);
create index idx_lesson_group_students_group on lesson_group_students(group_id);
create index idx_lesson_plans_session on lesson_plans(session_id);
