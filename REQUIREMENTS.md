# Requirements — Daybook Activity Management System

A condensed, actionable requirements checklist derived from `SRS.md`. Use this for development tracking and QA sign-off.

---

## 1. Functional Requirements

### FR-01 — User Account Login
- [x] User can sign in with a username and passcode.
- [x] Invalid credentials show an error and block access.
- [x] Successful login reveals the dashboard and hides the login screen.
- [x] User can sign out, returning to the login screen.

### FR-02 — Activity Logger
- [x] User can open a form to add a new activity from the Today page.
- [x] Title is required; notes are optional.
- [x] Submitting with an empty title does not create an activity.
- [x] New activity is dated today and starts as "pending".

### FR-03 — Completion Marker
- [x] Each activity has a single-click/tap toggle to mark it complete.
- [x] Toggling again reverts it to pending.
- [x] Completion time is recorded when marked complete.
- [x] UI updates immediately, no page reload.

### FR-04 — Daily Activity View
- [x] Today page shows only activities dated today.
- [x] Activities are split into "Pending" and "Completed Today" groups.
- [x] Empty states are shown when a group has no items.

### FR-05 — Edit and Delete Tasks
- [x] User can edit an activity's title and notes via a modal.
- [x] Saving with an empty title is blocked.
- [x] Canceling an edit discards changes.
- [x] Delete requires confirmation before removing an activity.
- [x] Canceling a delete keeps the activity unchanged.

### FR-06 — Activity History
- [x] History page shows completed activities from days before today.
- [x] Activities are grouped by date, most recent first.
- [x] A date filter can narrow the view to a single day.
- [x] Empty state is shown when no history matches the filter.

### FR-07 — Pre-Login Theme & Mentor Selection
- [x] Theme is chosen before the login form (One Piece, Bleach, Naruto, Black Clover).
- [x] A mentor for that theme is chosen before the login form.
- [x] Theme + mentor are stored on the session and applied after login.
- [x] Theme and mentor cannot be changed while logged in.
- [x] Logout returns the user to the pre-login selection screen.

### FR-08 — XP & Level System
- [x] Completing an activity awards base XP plus a streak bonus.
- [x] Level is computed from cumulative XP on a rising curve.
- [x] Level and XP progress are visible in the header or sidebar at all times.

### FR-09 — Rank / Title Progression
- [x] Rank title is derived from level and the locked session theme.
- [x] Rank labels follow the documented theme ladders.

### FR-10 — Activity-Driven Quest Generation
- [x] Daily, streak, focus, weekly, and boss quests are generated from real activities.
- [x] Boss challenges require an optional high-priority flag on an activity.
- [x] Quest text references actual activity titles/notes and is theme-flavored.
- [x] Quests generate on create/complete (and via generate check), not by manual authoring.

### FR-11 — Quest Board UI
- [x] Quests appears in the sidebar with the same no-reload navigation pattern.
- [x] Active quests show progress; completed quests are listed.
- [x] Completing the underlying activity completes the quest (no separate complete action).

### FR-12 — Badges & Milestones
- [x] A badge is awarded on rank-up and on XP/streak milestones.
- [x] Earned badges display on the Dashboard.

### FR-13 — Mentor Guide Messages
- [x] The selected mentor delivers original one-way messages on login, quest assigned/completed, streak, level-up, and rank-up.
- [x] Messages are original tone-matched text, not verbatim source dialogue.
- [x] Rank-up uses a theme-flavored animation in the existing visual language.
- [x] There is no two-way mentor chat.

---

## 2. Non-Functional Requirements

- [x] **Navigation:** Switching between Dashboard / Today / History / Quests never reloads the page; the active nav item is always visually marked.
- [x] **Responsiveness:** Layout adapts cleanly to desktop, tablet, and mobile widths.
- [x] **Performance:** All CRUD actions (add/complete/edit/delete) reflect in the UI as soon as the API responds (no page reload, no artificial delay).
- [x] **Security:** Login is validated by FastAPI against a hashed password; sessions use bearer tokens. Demo-only account (`user1`).
- [x] **Code structure:** HTML, CSS, and JS remain in separate, readable files.
- [x] **Feedback:** Every create/update/delete/login action produces a visible confirmation (toast).

---

## 3. UI/UX Requirements (Presentation Layer Only)

These do not change functional scope — they define how the functional requirements above are presented.

- [x] Consistent neo-brutalist visual style (bold borders, offset shadows, bold type) across all pages.
- [x] Switchable presentation themes — **chosen before login and locked for the session:** One Piece, Bleach, Naruto, Black Clover.
- [x] Dashboard shows a **daily streak** counter (consecutive days with a completed activity) with a milestone progress bar.
- [x] Dashboard shows a rotating **highlights slideshow** (streak, weekly summary, tips) with dots, arrows, and autoplay.
- [x] Transient toast notifications confirm add / complete / edit / delete / login actions.
- [x] Page switches, modal open/close, and card hovers use subtle animation rather than instant snaps.
- [x] Pre-login theme then mentor selection; no in-session theme switcher.
- [x] Mentor panel uses name/title and theme iconography only (no character artwork).

---

## 4. Actors

| Actor | Description |
|---|---|
| User (`user1`) | The single end user who logs in and manages their own activities. |

---

## 5. Out of Scope

- Multiple user accounts, roles, or permissions
- External notifications (email, push, SMS)
- Two-way mentor chat or a second auth system
- Quests unrelated to logged activities
- In-session theme/mentor switching
- Character artwork, logos, or verbatim source dialogue
- Any feature not listed in Section 1

---

## 6. Traceability Reference

| FR | User Story | Use Case |
|---|---|---|
| FR-01 | US-01 | UC-01 |
| FR-02 | US-02 | UC-02 |
| FR-03 | US-03 | UC-03 |
| FR-04 | US-04 | UC-04 |
| FR-05 | US-05 | UC-05 |
| FR-06 | US-06 | UC-06 |
| FR-07 | US-07 | UC-07 |
| FR-08 | US-08 | UC-08 |
| FR-09 | US-09 | UC-09 |
| FR-10 | US-10 | UC-10 |
| FR-11 | US-11 | UC-11 |
| FR-12 | US-12 | UC-12 |
| FR-13 | US-13 | UC-13 |
