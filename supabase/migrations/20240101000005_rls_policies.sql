-- Row Level Security policies
-- Students use service-role client (no RLS), tutors use anon/authenticated client with RLS

alter table organizations enable row level security;
alter table tutors enable row level security;
alter table students enable row level security;
alter table tests enable row level security;
alter table questions enable row level security;
alter table sessions enable row level security;
alter table session_students enable row level security;
alter table student_answers enable row level security;
alter table analysis_jobs enable row level security;
alter table lesson_groups enable row level security;
alter table lesson_group_students enable row level security;
alter table lesson_plans enable row level security;
alter table retest_questions enable row level security;
alter table retest_answers enable row level security;
alter table progress_reports enable row level security;

-- Tutors can read their organization
create policy "tutors_read_org" on organizations
  for select to authenticated
  using (id in (select org_id from tutors where id = auth.uid()));

-- Tutors can read their own record
create policy "tutors_read_self" on tutors
  for select to authenticated
  using (id = auth.uid());

-- Tutors can manage students in their org
create policy "tutors_manage_students" on students
  for all to authenticated
  using (org_id in (select org_id from tutors where id = auth.uid()))
  with check (org_id in (select org_id from tutors where id = auth.uid()));

-- Tutors can manage tests in their org
create policy "tutors_manage_tests" on tests
  for all to authenticated
  using (org_id in (select org_id from tutors where id = auth.uid()))
  with check (org_id in (select org_id from tutors where id = auth.uid()));

-- Tutors can manage questions for their tests
create policy "tutors_manage_questions" on questions
  for all to authenticated
  using (test_id in (select id from tests where org_id in (select org_id from tutors where id = auth.uid())))
  with check (test_id in (select id from tests where org_id in (select org_id from tutors where id = auth.uid())));

-- Tutors can manage sessions in their org
create policy "tutors_manage_sessions" on sessions
  for all to authenticated
  using (org_id in (select org_id from tutors where id = auth.uid()))
  with check (org_id in (select org_id from tutors where id = auth.uid()));

-- Tutors can read session students
create policy "tutors_read_session_students" on session_students
  for select to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

-- Tutors can read student answers
create policy "tutors_read_student_answers" on student_answers
  for select to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

-- Tutors can read/manage analysis jobs
create policy "tutors_manage_analysis_jobs" on analysis_jobs
  for all to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())))
  with check (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

-- Tutors can read lesson groups
create policy "tutors_read_lesson_groups" on lesson_groups
  for select to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

-- Tutors can read lesson group students
create policy "tutors_read_lesson_group_students" on lesson_group_students
  for select to authenticated
  using (group_id in (select id from lesson_groups where session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid()))));

-- Tutors can read lesson plans
create policy "tutors_read_lesson_plans" on lesson_plans
  for select to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

-- Tutors can read retest data
create policy "tutors_read_retest_questions" on retest_questions
  for select to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

create policy "tutors_read_retest_answers" on retest_answers
  for select to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

create policy "tutors_read_progress_reports" on progress_reports
  for select to authenticated
  using (session_id in (select id from sessions where org_id in (select org_id from tutors where id = auth.uid())));

-- Storage bucket for test images
insert into storage.buckets (id, name, public) values ('test-images', 'test-images', true);

create policy "tutors_upload_test_images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'test-images');

create policy "public_read_test_images" on storage.objects
  for select to public
  using (bucket_id = 'test-images');
