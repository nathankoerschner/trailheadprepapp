-- Base tables: organizations, tutors, students, tests, questions

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table tutors (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table tests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_by uuid not null references tutors(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  total_questions int not null default 0,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  question_number int not null,
  image_url text,
  question_text text,
  answer_a text,
  answer_b text,
  answer_c text,
  answer_d text,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  section text not null check (section in ('reading_writing', 'math')),
  concept_tag text,
  ai_confidence float,
  has_graphic boolean not null default false,
  graphic_url text,
  created_at timestamptz not null default now(),
  unique(test_id, question_number)
);

create index idx_questions_test on questions(test_id);
create index idx_questions_concept on questions(concept_tag);
create index idx_questions_section on questions(section);
