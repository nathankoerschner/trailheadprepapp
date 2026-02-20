# Grid View — Tutor Test Monitoring

## Overview

Real-time grid view that replaces the current tutor session view during `testing` status. Shows student answer progress in a question-by-row, student-by-column matrix. Persists as a read-only results view after testing ends.

---

## Layout

### Grid Structure
- **Rows**: One per question. First column is the question number (e.g., `Q1`, `Q2`, …), clickable.
- **Columns**: One per student. Header shows **first name only** (e.g., "Emma", "Jake").
- **Frozen first column**: Question numbers stay pinned on the left; student columns scroll horizontally when there are many students.
- **Desktop only**: No responsive/mobile considerations needed.

### Cell States
| State | Display |
|---|---|
| Unanswered | Blank / empty cell |
| Correct answer | Answer letter (e.g., "B") on **green** background |
| Incorrect answer | Answer letter (e.g., "A") on **red** background |

- No distinction between "not yet reached" and "skipped" — both show blank.
- No animation or flash on update — cells silently populate when new data arrives.
- No row-level or column-level aggregate stats.
- Cells are **not interactive** — no click, hover, or tooltip behavior on individual answer cells.

---

## Question Popup (Modal)

- Triggered by clicking a **question number** in the frozen first column.
- Opens a **centered dialog/modal** overlaying the grid.
- Displays:
  - Full question text
  - All answer choices
  - The **correct answer** clearly indicated
- Must support **KaTeX math rendering** — reuse the same question rendering component used in the student test view.
- No aggregate stats (no "3/5 correct" or distribution charts).
- Close button to dismiss.

---

## Session Control

- Include an **"End Test" / "Start Analysis"** button directly on the grid view.
- This button transitions the session status from `testing` → `analyzing` and kicks off the AI pipeline.
- After the test ends, the grid remains visible in **read-only mode** (same layout, same data, but the "End Test" button is gone and status reflects post-test).

---

## Data & Polling

- **Questions**: Already stored in the database before the session enters `testing` status. Query them on mount.
- **Answers**: Submitted per-question via the existing student answer API endpoint. Each answer record includes the student, question, selected choice, and correctness.
- **Real-time updates**: Extend the existing **3-second session polling** to include answer grid data in the response. No dedicated endpoint — piggyback on the current poll.
- Poll response should include: list of answers keyed by `(student_id, question_id)` → `{ choice, is_correct }`.

---

## Implementation Notes

- This view **replaces** the current tutor view during `testing` status — not a tab or toggle.
- Reuse the question rendering component from the student test view (including KaTeX support) for the popup modal.
- Use Radix UI `Dialog` for the question popup modal.
- Grid can be a simple HTML `<table>` or CSS grid with `overflow-x: auto` on the student columns container and `position: sticky` on the question number column.
