# Trailhead Prep — SAT Assessment & Adaptive Tutoring App

## Overview

An in-person SAT preparation app that runs a full session workflow: students take a practice SAT, AI analyzes gaps at the question level, generates tutor lesson plans and student groupings, provides scaffolded practice, and delivers a targeted retest — all within a single class day.

Designed for a single tutoring organization with small classes (6–12 students, 1–3 tutors).

---

## Session Workflow

A session progresses through five tutor-controlled phases. The tutor advances the entire class through each phase.

### Phase 1: Sign-In
- Tutor creates a session with a PIN code
- Students join by entering the PIN + selecting their name from the roster (persistent accounts)
- Tutor sees a lobby view showing who has joined
- Tutor starts the test when all students are present

### Phase 2: Practice Test (~3 hours)
- Full-length SAT covering both Reading/Writing and Math sections
- Free navigation: students can move between questions and sections freely within the overall timer
- Tutor sees minimal live info: just whether each student has submitted or is still working
- When the timer expires, all unsubmitted tests auto-submit
- Students who arrive late take the test from where time remains; their partial data is analyzed gracefully

### Phase 3: AI Analysis & Lesson Planning
- Triggered when the tutor ends the test phase
- AI grades all tests and performs question-level gap analysis
- Identifies which specific questions each student missed, clusters students by shared weak concepts
- Uses **priority clustering**: the two most common gap areas become tutor-led groups; remaining students go to independent practice
- Outputs:
  - **Per-tutor teaching guide** (brief, for experienced tutors): which students are in their group, what concepts to cover, key problems to walk through
  - **Independent practice queue**: scaffolded problems for students not in a tutor group, delivered on-screen with instant right/wrong feedback and brief explanations

### Phase 4: Lesson Units
- Tutor-led groups work off-screen with their tutor (tutor reads from the teaching guide)
- Independent group works through AI-generated practice problems on their devices
- Practice problems are **scaffolded**: start easier than the missed question, build up to original difficulty across 3–4 problems per concept
- Questions render as formatted text with LaTeX/MathJax for math; if the original question contained a graphic, AI extracts and reuses that graphic in the variation
- Tutor advances to the next phase when lesson time is complete

### Phase 5: Retest
- Each student gets a personalized 20-question timed retest
- Questions are the same ones they missed on the initial test
- If a student missed fewer than 20 questions, pad with related questions from concepts covered during the lesson
- Timed proportionally based on SAT pacing (~1.5 min/question for math, ~1.25 min/question for R/W, blended based on mix)
- After submission, student sees an **in-app progress report**: what they missed originally, what they practiced, and how they performed on the retest

---

## Question Management

### Upload Flow
- Tutor uploads a PDF of a complete SAT practice test (or batch of images)
- AI (GPT-4o vision) processes the entire document, splitting it into individual questions
- For each question, AI extracts:
  - Question text/content (or flags it as image-based if it contains graphics)
  - Graphics/figures embedded in the question (preserved as images)
  - Multiple choice answer options (A/B/C/D) as structured text
  - Correct answer
  - SAT section (Reading/Writing or Math)
  - Concept/skill tag (e.g., "systems of equations," "subject-verb agreement," "inference")
- **Quick review carousel**: tutor swipes through each extracted question, seeing the original image side-by-side with the parsed result. Tutor can edit any field before confirming.
- High-confidence extractions are pre-accepted but still visible in the carousel for spot-checking

### Question Display
- During the test, the original uploaded image is displayed for each question
- Multiple choice answers are extracted from the image and rendered as interactive, clickable answer buttons below the image
- During lesson practice, AI-generated variations render as formatted text/LaTeX with any extracted graphics reused

### Question Bank
- All uploaded questions are auto-tagged by concept/skill and stored in a persistent, reusable bank
- AI can pull from the full question bank when generating practice variations (not limited to the current session's test)
- Questions belong to their originating test but are queryable across tests by tag

---

## User Model

### Roles
- **Admin/Tutor**: Creates sessions, uploads tests, configures session parameters (number of tutors, retest length), reviews AI outputs, controls session flow
- **Student**: Persistent account with a name, joins sessions via PIN, takes tests, completes practice, views progress reports

### Authentication
- **Students**: Enter a session PIN code + select their name from the class roster. No passwords.
- **Tutors**: Standard login (email + password) to access the dashboard and manage tests/sessions. Single organization — no multi-tenancy.

### Persistent Data
- Student accounts persist across sessions
- Per-session: test results and retest results are stored
- No cross-session longitudinal analysis (kept minimal for MVP)

---

## AI Integration

All AI features use **OpenAI GPT-4o** via API.

### AI Tasks
1. **Vision parsing**: Extract questions, answers, graphics, and correct answers from uploaded test PDFs/images
2. **Concept tagging**: Auto-tag each question with SAT section and specific skill/concept
3. **Gap analysis**: After grading, identify which questions each student missed and cluster by concept
4. **Priority clustering**: Determine the two most impactful tutor group topics based on class-wide gap frequency
5. **Lesson plan generation**: Create brief tutor teaching guides (experienced-tutor level: concept, key points, example problems)
6. **Scaffolded question generation**: Create 3–4 variation questions per concept, progressing from easier to original difficulty. Reuse extracted graphics where relevant.
7. **Retest assembly**: Select the right 20 questions per student (missed questions + padding from studied concepts)
8. **Progress report generation**: Summarize each student's session performance

---

## Session Configuration

Before starting a session, the tutor configures:
- **Which test** to use (from uploaded test bank)
- **Number of tutors** available (1–3)
- **Retest question count** (default: 20)
- **Class roster** (select which students are expected)

---

## Tech Stack Recommendation (MVP)

### Frontend
- **Next.js** (React) with TypeScript
- Deployed on **Vercel**
- Responsive web app (works on classroom Chromebooks, tablets, laptops — reliable WiFi assumed)
- **KaTeX** for math rendering
- Simple polling (no WebSockets needed — tutor only needs to know when students finish, not real-time question tracking)

### Backend
- **Next.js API routes** (serverless functions on Vercel)
- **PostgreSQL** via **Supabase** (managed Postgres with built-in auth, storage for uploaded PDFs/images, real-time features available if needed later)
- **Supabase Storage** for uploaded test PDFs and extracted question images

### AI
- **OpenAI GPT-4o API** for all AI tasks (vision, text generation, structured output)
- Structured output (JSON mode) for question extraction and lesson plan generation

### Auth
- Supabase Auth for tutor login (email + password)
- Session PIN system built on top of the database (no auth library needed for students)

---

## Data Model (Core Entities)

- **Organization**: single org for MVP
- **Tutor**: email, password hash, name
- **Student**: name, org reference
- **Test**: name, SAT sections included, created_by tutor
- **Question**: belongs to test, image_url, question_text, answer_options (A/B/C/D), correct_answer, section (R/W or Math), concept_tag, ai_confidence_score
- **Session**: test reference, pin_code, status (lobby/testing/analyzing/lesson/retest/complete), tutor_count, retest_question_count
- **SessionStudent**: session + student join table, with test_submitted boolean
- **StudentAnswer**: session, student, question, selected_answer, is_correct
- **LessonGroup**: session, group_type (tutor_1/tutor_2/independent), concept_focus, assigned_students
- **LessonPlan**: session, group reference, tutor_guide_text, practice_problems (JSON)
- **RetestQuestion**: session, student, question reference, source (missed/padding)
- **RetestAnswer**: session, student, question, selected_answer, is_correct
- **ProgressReport**: session, student, summary_json

---

## Edge Cases

- **Late arrival**: Student joins mid-test. They take whatever time remains. AI analyzes only the questions they answered; they are grouped based on partial data with a flag noting incomplete test.
- **Early departure**: If a student leaves before retest, their test data is still analyzed and contributes to grouping. Retest report is simply not generated.
- **Sparse gaps**: If a student missed very few questions, they go to the independent group with practice problems drawn from the broader question bank on concepts covered that day.
- **No clear clusters**: If student weaknesses are too scattered for meaningful tutor groups, AI recommends the best available grouping and flags the situation for the tutor with a note.
- **Extraction errors**: Low-confidence AI extractions are highlighted in the review carousel. Tutor can re-upload individual question images if extraction failed completely.

---

## MVP Scope

**In scope:**
- Tutor auth + student PIN-based session join
- PDF/image bulk upload with AI extraction + review carousel
- Full-length timed practice test with free navigation
- AI-powered grading, gap analysis, and priority clustering
- Tutor teaching guides + on-screen independent practice with instant feedback
- Scaffolded AI-generated variation questions
- Personalized 20-question timed retest
- In-app student progress report

**Out of scope (future):**
- Cross-session longitudinal analytics
- Parent-facing reports
- Multi-organization / multi-tenancy
- Offline support
- Adaptive test difficulty (digital SAT style)
- Mobile-native apps
- Student self-study mode outside of sessions
