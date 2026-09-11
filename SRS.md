# Software Requirements Specification (SRS)

**Project:** Daybook — Personal Activity Management System
**Version:** 1.0
**Status:** Implemented (FastAPI backend, SQLite persistence, browser UI, gamified quest layer)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **Daybook**, a personal activity management dashboard. It is intended to guide design, development, and testing, and to serve as the single source of truth for what the system does.

### 1.2 Scope
Daybook allows a single user to sign in, log daily activities, mark them complete, view today's activities, edit or delete entries, and review a history of previously completed activities. An additive gamification layer generates quests from those real activities, tracks XP/level/rank, awards badges, and delivers one-way mentor messages. The application is a browser UI served by FastAPI with data stored in SQLite.

### 1.3 Intended Audience
- Developers implementing or extending the system
- Reviewers/QA validating behavior against requirements
- Stakeholders evaluating scope for future backend integration

### 1.4 Definitions & Acronyms
| Term | Meaning |
|---|---|
| SRS | Software Requirements Specification |
| FR | Functional Requirement |
| NFR | Non-Functional Requirement |
| Activity / Task | A logged item with a title, optional notes, a date, a completion state, and an optional priority flag |
| Streak | Count of consecutive days with at least one completed activity |
| Quest | A generated challenge derived from the user's own logged activities |
| Mentor | A session-locked guide persona that delivers original, one-way motivational messages |
| XP / Level / Rank | Experience points earned from completions; level is derived from cumulative XP; rank is a theme-flavored title unlocked by level |

### 1.5 References
- `REQUIREMENTS.md` — condensed requirements checklist derived from this SRS
- User Stories US-01–US-06 and Use Cases UC-01–UC-06 (defined during requirements analysis for this project)

---

## 2. Overall Description

### 2.1 Product Perspective
Daybook is a web application with a browser frontend (`index.html`, `style.css`, `script.js`) and a FastAPI backend using SQLite. Functional scope is limited to the requirements in Section 3.

### 2.2 Product Functions (Summary)
1. User Account Login
2. Activity Logger
3. Completion Marker
4. Daily Activity View
5. Edit and Delete Tasks
6. Activity History
7. Pre-login theme and mentor selection (locked for the session)
8. XP, level, and theme-aware rank
9. Activity-driven quest generation and Quest Board
10. Badges and one-way mentor messages

### 2.3 User Characteristics
There is a single actor in scope: **the User** (represented in the demo as `user1`). No administrator, guest, or multi-user roles are defined.

### 2.4 Assumptions & Dependencies
- The application runs in a modern desktop, tablet, or mobile web browser.
- The FastAPI server must be running so the UI can call `/api` endpoints.
- Web fonts are loaded from Google Fonts when a network connection is available.

### 2.5 Constraints
- Single demo account (`user1`) only.
- The system must not invent functionality beyond what is defined in Section 3.

---

## 3. Functional Requirements

### FR-01 — User Account Login
**Description:** The system shall allow the user to securely sign in to access their personal activity dashboard.
**Inputs:** Username, passcode.
**Processing:** Validate credentials against the stored account.
**Outputs:** Access granted to the dashboard, or an error message on mismatch.
**Priority:** High

### FR-02 — Activity Logger
**Description:** The system shall let the user quickly add new tasks/activities with a title and optional notes.
**Inputs:** Title (required), notes (optional).
**Processing:** Create a new activity record dated to the current day, initially marked pending.
**Outputs:** New activity appears in the Daily Activity View.
**Priority:** High

### FR-03 — Completion Marker
**Description:** The system shall let the user mark a task as finished with a single click/toggle, and revert it if needed.
**Inputs:** Toggle action on a specific activity.
**Processing:** Flip the activity's completed state and record completion time.
**Outputs:** Updated status reflected immediately in the UI.
**Priority:** High

### FR-04 — Daily Activity View
**Description:** The system shall display a clean list of all pending and completed activities scheduled for today.
**Inputs:** None (derived from stored activities filtered by today's date).
**Processing:** Partition today's activities into Pending and Completed groups.
**Outputs:** Two grouped lists rendered on the Today page.
**Priority:** High

### FR-05 — Edit and Delete Tasks
**Description:** The system shall let the user update an activity's title/notes, or permanently remove it.
**Inputs:** Edited title/notes, or a delete confirmation.
**Processing:** Update the matching activity record, or remove it from the collection after confirmation.
**Outputs:** Activity list reflects the update or removal.
**Priority:** High

### FR-06 — Activity History
**Description:** The system shall show a record of previously completed activities, grouped by date, so the user can review past productivity.
**Inputs:** Optional date filter.
**Processing:** Filter completed activities with a date earlier than today; group by date.
**Outputs:** History page listing grouped, completed past activities.
**Priority:** Medium

### FR-07 — Pre-Login Theme & Mentor Selection
**Description:** Before the login form, the system shall require the user to choose a visual theme and then one mentor for that theme. Theme and mentor are locked for the signed-in session.
**Inputs:** Theme id, mentor id.
**Processing:** Persist the pair on the login session. Reject any later attempt to change them until logout.
**Outputs:** Selected theme applied after login; mentor identity visible in-app; no in-session theme/mentor switcher.
**Priority:** High

Mentor options by theme:
| Theme | Mentor options |
|---|---|
| One Piece | Zoro, Luffy, Rayleigh |
| Bleach | Ichigo, Kisuke Urahara, Aizen |
| Naruto | Naruto, Kakashi, Might Guy |
| Black Clover | Yami Sukehiro, Asta |

### FR-08 — XP & Level System
**Description:** Completing an activity shall award XP (base XP plus a streak bonus). Level is computed from cumulative XP using a rising curve. Current level and XP progress shall remain visible in the header or sidebar.
**Inputs:** Activity completion (and reversal).
**Processing:** Recalculate XP/level from completed activities and current streak.
**Outputs:** Level number and XP toward the next level.
**Priority:** High

### FR-09 — Rank / Title Progression (Theme-Aware)
**Description:** Each locked-in theme shall expose a rank ladder unlocked by level. Rank labels stay tied to the session theme.
**Inputs:** Current level and session theme.
**Outputs:** Current rank title (theme-flavored, generic tropes only).
**Priority:** Medium

Rank ladders:
- **One Piece:** Rookie Sailor → Supernova → Emperor-Class
- **Bleach:** Unseated Officer → Seated Officer → Lieutenant → Captain
- **Naruto:** Academy Student → Genin → Chunin → Jonin → Kage
- **Black Clover:** Junior Magic Knight → Intermediate Knight → Senior Knight → Squad Captain

### FR-10 — Activity-Driven Quest Generation
**Description:** The system shall generate quests from the user's logged activities (titles, notes, frequency, completion, optional priority). Quests must not be fabricated without backing activity data.
**Inputs:** Activity create/complete (and an explicit generate check).
**Processing:** Create or complete quests of these types:
| Quest Type | Trigger Rule |
|---|---|
| Daily Quest | Complete N activities logged today (default N = 3) |
| Streak Quest | Maintain the daily streak for X consecutive days (default X = 3) |
| Focus Quest | Complete all activities sharing a keyword found in titles or notes |
| Weekly Trial | Complete a target number of activities within the current week (default 5) |
| Boss Challenge | Complete a single activity flagged as high-priority |
**Outputs:** Quest records referencing real activity data; flavor text is templated and theme-aware.
**Priority:** High

### FR-11 — Quest Board UI
**Description:** A Quests section in the existing sidebar shall list active quests (with progress) and completed quests. Completing the underlying activity completes the quest; there is no separate manual complete-quest action.
**Priority:** High

### FR-12 — Badges & Milestones
**Description:** Award a badge on rank-up and on defined XP/streak milestones. Earned badges appear on the Dashboard.
**Priority:** Medium

### FR-13 — Mentor Guide Messages
**Description:** The session mentor shall deliver short, original, personality-consistent messages at: login greeting, quest assigned, quest completed, streak milestone, level-up, and rank-up. Messages are one-way (toast and/or mentor panel). No chat. No verbatim source-material dialogue. Rank-up uses a theme-flavored animation consistent with the existing neo-brutalist style.
**Priority:** Medium

---

## 4. External Interface Requirements

### 4.1 User Interface
- Pre-login gate: theme selection, then mentor selection, then the existing login form.
- Sidebar navigation (Dashboard, Today, History, Quests), header with search and profile menu, XP/level/rank indicator, mentor panel, summary cards, data tables, modals for edit/delete confirmation.
- Responsive layout for desktop, tablet, and mobile (sidebar collapses to a toggled off-canvas menu below 768px).
- No in-session control to change theme or mentor.

### 4.2 Hardware Interfaces
None. Standard input devices (keyboard, mouse, touch) only.

### 4.3 Software Interfaces
Runs in any modern browser. The frontend communicates with the FastAPI JSON API (`/api/login`, `/api/logout`, `/api/me`, `/api/activities`, `/api/session/start`, `/api/quests`, `/api/quests/generate`, `/api/progress`, `/api/badges`, `/api/mentor/message`). Data is stored in SQLite (`daybook.db`).

### 4.4 Communications Interfaces
HTTP between the browser and the local FastAPI server.

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Usability | Navigation between modules must not reload the page; the active section must be visually indicated at all times. |
| NFR-02 | Responsiveness | The UI must remain usable and readable on desktop, tablet, and mobile viewport widths. |
| NFR-03 | Performance | Adding, completing, editing, or deleting an activity must update the UI as soon as the API response returns; the UI must not reload the page. |
| NFR-04 | Security | Login is validated by the backend against a hashed password. Sessions use bearer tokens. This demo is still not a production multi-user security design. |
| NFR-05 | Maintainability | HTML, CSS, and JavaScript must remain in separate files with readable, commented code. |
| NFR-06 | Feedback | The system should confirm user actions (add/complete/edit/delete) with clear, immediate visual feedback. |

---

## 6. UI/UX Design Requirements

These requirements govern presentation only; they do not add or change functional scope (Section 3).

| ID | Requirement |
|---|---|
| UX-01 | The interface shall use a consistent visual design system (neo-brutalist: bold borders, offset shadows, bold typography). |
| UX-02 | Theme is chosen once before login (One Piece, Bleach, Naruto, Black Clover) and locked for the session. Themes change presentation (color, type, atmosphere, rank/quest flavor) only, not FR-01–FR-06 structure. |
| UX-03 | The Dashboard shall display a daily streak indicator (consecutive days with a completed activity), including a progress-to-milestone display. |
| UX-04 | The Dashboard shall include a rotating highlights slideshow (streak status, weekly summary, tips) with manual and automatic navigation. |
| UX-05 | User actions (add/complete/edit/delete/login) shall trigger a transient toast notification. |
| UX-06 | Page and component transitions (page switch, modal open/close, card hover) shall use subtle animation rather than instant state changes. |
| UX-07 | Mentor messages and rank-up feedback shall reuse the existing toast/animation language; mentors are name/title plus simple theme-colored iconography only (no character artwork, logos, or verbatim source dialogue). |

---

## 7. Use Case Traceability

| Use Case | Title | Related FR |
|---|---|---|
| UC-01 | User Account Login | FR-01 |
| UC-02 | Activity Logger | FR-02 |
| UC-03 | Completion Marker | FR-03 |
| UC-04 | Daily Activity View | FR-04 |
| UC-05 | Edit and Delete Tasks | FR-05 |
| UC-06 | Activity History | FR-06 |
| UC-07 | Pre-Login Theme & Mentor Selection | FR-07 |
| UC-08 | XP & Level System | FR-08 |
| UC-09 | Rank Progression | FR-09 |
| UC-10 | Activity-Driven Quest Generation | FR-10 |
| UC-11 | Quest Board | FR-11 |
| UC-12 | Badges & Milestones | FR-12 |
| UC-13 | Mentor Guide Messages | FR-13 |

---

## 8. Out of Scope (Current Version)

- Multi-user accounts, roles, or permissions
- Notifications outside the browser (email, push, SMS)
- Two-way mentor chat or a second authentication system
- Quests that are not derived from the user's logged activities
- In-session theme or mentor switching
- Character artwork, logos, or verbatim dialogue from any series
- Any module not listed in Section 3

---

## 9. Appendix — Traceability Matrix

| User Story | Use Case | Functional Requirement |
|---|---|---|
| US-01 | UC-01 | FR-01 |
| US-02 | UC-02 | FR-02 |
| US-03 | UC-03 | FR-03 |
| US-04 | UC-04 | FR-04 |
| US-05 | UC-05 | FR-05 |
| US-06 | UC-06 | FR-06 |
| US-07 | UC-07 | FR-07 |
| US-08 | UC-08 | FR-08 |
| US-09 | UC-09 | FR-09 |
| US-10 | UC-10 | FR-10 |
| US-11 | UC-11 | FR-11 |
| US-12 | UC-12 | FR-12 |
| US-13 | UC-13 | FR-13 |
