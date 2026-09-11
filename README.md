# Daybook — Personal Activity Management System

Daybook lets a single user sign in, log daily activities, mark them complete, edit or delete them, and review past completed work. An additive **quest layer** turns those real logs into XP, ranks, badges, and one-way mentor messages. The app is a browser UI served by **FastAPI** with data in **SQLite**.

## Features (SRS scope)

- Sign in / sign out (`user1`)
- Add activities (title required, notes optional, optional high-priority flag)
- Toggle complete / pending
- Today view split into Pending and Completed
- Edit and delete with confirmation
- History of completed past activities, grouped by date, with a date filter
- Header search, dashboard stats, streak, highlights slideshow, badges
- **Pre-login theme + mentor selection** (locked until logout): One Piece, Bleach, Naruto, Black Clover
- Quest Board generated from logged activities (daily, streak, focus, weekly, boss)
- XP, level, theme-aware rank, and original mentor lines (no source-material dialogue)

## Requirements

- Python 3.10 or newer
- A modern web browser

## Setup and run

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

On macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

1. Pick a theme, then a mentor.
2. Sign in with **user1** / **demo1234**.
3. Theme and mentor stay locked until you sign out.

`daybook.db` is created on first start. Existing databases are migrated (priority column, quest tables) without dropping activity data.

## Tests

```powershell
.\.venv\Scripts\Activate.ps1
python -m pytest -q
```

## Project layout

| Path | Role |
|---|---|
| `index.html`, `style.css`, `script.js` | Frontend (separate files) |
| `backend/` | FastAPI app, models, quest/XP/mentor logic |
| `daybook.db` | SQLite database (created at runtime) |
| `SRS.md`, `REQUIREMENTS.md` | Source of truth for scope |

Do not open `index.html` as a file. Serve it through the FastAPI app so login and the quest APIs can reach `/api`.
