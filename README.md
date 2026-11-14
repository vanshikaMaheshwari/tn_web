# TechNeeds 2.0 — Blueprint Notebook

> **Innovortex 4.0 · Reimagathon · Team Paradox** (Vanshika Maheshwari, Unnati Gautam)
> A full reimagining of the TechNeeds IGDTUW mentorship platform: `all_you_need_to_know_about_tech`.

**Live demo:** [tn-web-eight.vercel.app](https://tn-web-eight.vercel.app) · **API:** [tn-web-8ynw.onrender.com](https://tn-web-8ynw.onrender.com) · **Demo video:** [Google Drive](https://drive.google.com/drive/folders/1ol9zAUihc1z5DvUpBgU6YnwGxKXdWBBG?usp=drive_link) · **Public AI card:** [/u/TN-WEBD-0004](https://tn-web-eight.vercel.app/u/TN-WEBD-0004)

---

## The concept: a blueprint notebook

Learning is a blueprint you draft, revise and build, so the whole UI lives on blue graph paper.

| Idea | Where you see it |
|---|---|
| **Learning is a blueprint** | Graph-paper canvas, monospace `snake_case` labels |
| **Missions, not tasks** | Launchpad, mission board, rank shown as a rocket in orbit (extends “Upgrade Yourself!”) |
| **Stickers & scribbles** | Badges are tilted stickers, handwritten nudges like “do this one first ↓” |
| **Brand blue, made bold** | TechNeeds blues + highlighter yellow for wins, high contrast, 44px+ touch targets |

Fonts: Bricolage Grotesque (display), DM Sans (body), Space Mono (labels), Caveat (notes).

## Features by role

**Core team (hidden admin)** (`/mentor?tab=deck|events|inbox`)
- There is no public admin login any more. Admin is a **core-team permission on a mentor account** (`Mentor.isAdmin`, or the email is listed in `ADMIN_EMAILS`). Only those mentors see the extra “core team only” section in Mission Control; every admin API re-checks it on the server.
- **Command deck:** create cohorts, recruit mentors with auto-generated passwords, assign mentors, give/remove core-team access, post the Techboard announcement, refresh all AI cards via Render Workflows
- **Events:** add/edit/unpublish events with a live preview card (poster, tracks, venue, external registration link, close date, gallery and recap for past events)
- **Inbox:** questions from the FAQ page (reply, open in email, resolve; askers track replies by ticket) and feedback from events, missions and the site-wide Feedback tab, with a 30-day average

**Mentor · Mission control** (`/mentor`, `/mentor/crew`)
- Cohort switcher, overview stats (crew, missions, % through, need-a-nudge, to-review)
- **Mission builder** for videos, timed quizzes (question editor, unlock + deadline window) and projects, with deadlines and max scores
- **Crew list**: add mentees with **auto enrollment numbers** (`TN-WEBD-0001`) + one-time password “boarding pass”, search, status filters (on track / needs a nudge / inactive), progress bars, password reset, AI nudge (copy emails of inactive mentees)
- **Review queue**: open GitHub + live links, score with feedback (“Stamp it ✓”), automatic late penalty
- Mission list with completion rates and delete
- **Modules editor** (`/mentor?tab=modules`): Module → sub-topics → missions; rename, reorder, “lock until previous” per sub-topic, move missions between sub-topics; the mission builder asks where each new mission goes

**Mentee · Launchpad** (`/dashboard`)
- Login with enrollment number + password
- **Self-explanatory:** first-visit welcome guide, a 1-minute guided tour, an (i) explanation on every stat, a “your next step” card, and legends for mission types and status labels
- Missions grouped as **modules → sub-topics** with progress bars and “you are here”; locked sub-topics explain how to unlock; thumbs up/down feedback on finished missions
- Hero with next deadline and **rocket-orbit rank**, stat stickers (score %, streak, missions done, next deadline)
- **Mission board** sorted by urgency with filters: watch videos (auto-scored, −1 per late day), focused **quiz mode** (timer, question grid, autosave, auto-submit, one attempt) and **project submission** (checklist, links, build log, review timeline)
- Mini leaderboard and AI tip

**AI learner card** (`/profile`)
- **Gemini 2.5 Flash** writes a headline, summary, sticker badges and next steps from real activity (strict JSON schema, server-side stats only)
- **Rules-engine fallback** with the same shape when there is no key, quota runs out or the API fails
- DiceBear avatar seeded by name + top interest, editable interest tags, Recharts skill radar + score trajectory, shareable summary, 6-hour cache

**AI card explained** (`/profile`): a “Your AI card in 4 ideas” guide, numbered sections, a source tag on each (✦ AI writes this · ▦ Calculated from your data · ✍ Written by your mentor · 🔒 You control this), a “What it means” line under each, a yellow-mark legend and a “Show me around” tour.

**Public**
- **Home** guides newcomers through a 4-step path (find a cohort → register → enrollment number → log in) with a 60-second captioned explainer video (`frontend/public/video/`)
- **Events** (`/events`): featured event on top (InnoVortex 4.0), upcoming with Register + Add-to-calendar, past events with photos and star ratings
- **FAQ** rebuilt with search, categories and an “Ask your question” form that returns a ticket; **Techboard** is now a live pinboard (live event, leaderboard, hall of fame, cohorts, photo wall, announcement)
- Feedback tab on every public page
- Home with cohorts, how it works, FAQs · **live leaderboard** (`/leaderboard`, 30s refresh, podium, cohort filter, scoring rules) · existing Techboard / Team / FAQ pages

## Backend improvements (bonus)

| Area | Change |
|---|---|
| Security | Admin auth added; all program/mentor writes require admin; program data requires mentor ownership; role claim on every token |
| Passwords | Mentee passwords bcrypt-hashed (legacy plain-text accepted once, then re-hashed); temp passwords returned once |
| Bugs fixed | Quizzes never unlocked (`isLocked: true` by default); any resource could be “marked done” for full marks; project verify double-counted score and used the wrong token; project submit URL typo |
| New APIs | `/api/admin/login`, `/api/admin/stats`, `/api/m/profile`, `/api/m/profile/ai`, `/api/m/interests`, `/api/m/change-password`, mentee password reset, resource delete, program-filtered leaderboard |
| Config | `PORT=8000`, `CORS_ORIGIN`, `GEMINI_API_KEY`, `.env.example`; real `.env` removed from git |

## Tech stack

Next.js 15 (App Router) · React 19 · Recharts · GSAP · Express 5 · Mongoose 8 · MongoDB Atlas · JWT · bcrypt · Gemini 2.5 Flash · DiceBear · Render (API) · Vercel / Render (web)

```
frontend/  Next.js app (src/app/* routes, src/components/*, src/lib/api.js)
backend/   Express API (routes/, models/, middleware/, services/aiProfile.js, scripts/seed.js)
docs/      ARCHITECTURE.md
```

## Run locally

**1. Backend**
```bash
cd backend
cp .env.example .env        # add your MongoDB Atlas URI, a JWT secret, ADMIN_EMAILS, optional GEMINI_API_KEY
npm install
npm run seed:reset          # demo cohort, mentor, 8 mentees, quizzes, a project in review
npm run dev                 # http://localhost:8000
```

**2. Frontend**
```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm install
npm run dev                 # http://localhost:3000
```

**Demo logins (after seeding)**

| Role | Login | Password |
|---|---|---|
| Mentor + core team | `mentor@techneeds.dev` | `mentor123` |
| Mentee | `TN-WEBD-0004` (or 0001–0008) | `mentee123` |

## Deploy

- **Backend → Render:** New Web Service from this repo, root `backend`, build `npm install`, start `npm start`. Set `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAILS` (comma-separated core-team emails), `GEMINI_API_KEY`, `CORS_ORIGIN=<frontend URL>`. (`render.yaml` in the repo root does this as a Blueprint.)
- **Frontend → Vercel or Render:** root `frontend`, set `NEXT_PUBLIC_API_URL=<Render backend URL>`.
- Run `npm run seed` once against the production database for demo data.

## AI learner card (v2)

`/profile` turns real activity into a card the learner can flip, share and act on:

- **Dev ID card**: a generative SVG avatar built from interest tags, strongest skill, level and streak (it gains a headset at Lvl 5 and a jetpack at Lvl 10), an AI archetype title, a rarity tier from rank percentile, and a Skill DNA radar on the back.
- **Evidence-backed AI read-out**: Gemini may only highlight phrases from a server-computed `facts` list (e.g. `[[12-day streak]]`); the backend strips any highlight that isn't a real fact.
- **Rank forecast**: which open missions move the learner up the leaderboard, and whom they pass.
- **Growth constellation**: every mission is a star, grouped by interest tag; AI-suggested next stars pulse and link straight to the mission.
- **Skill DNA bars** with weekly change and cohort average, **next best missions** with points and skill impact, **badges** (earned plus locked goals with progress), and a **10-week journey** chart with milestones.
- **Mentor's take**: mentors open any mentee's card from the Crew list (`/mentor/mentee/[id]`) and add a one-line endorsement.
- **Privacy first**: the public card (`/u/TN-WEBD-0004`) is off by default. Learners choose whether to show their rank or an "open to opportunities" tag, and can download the card as a PNG.

Endpoints: `GET /api/m/card`, `POST /api/m/card/ai`, `PUT /api/m/privacy`, `GET /api/m/u/:enrollment`, `GET /api/mentees/:id/card`, `PUT /api/mentees/:id/endorse`.

## AI pipeline on Render Workflows

AI cards are generated by a **Render Workflows** service (`backend/workflows/index.js`) instead of inside the web request:

```
Learner clicks "refresh"  ─▶  API (Render web service)  ── startTask ──▶  Render Workflows: generateAiCard
                                   ▲                                         │ Gemini 3.5 Flash → fallback models
       card page polls status ─────┘                                         │ retries 4× with backoff on 503/429
                                                                             ▼
                                                                    MongoDB Atlas (card saved)
Admin "Refresh all AI cards"  ──▶  refreshAllCards  ──▶  fans out generateAiCard in batches of 5
```

- **`generateAiCard(menteeId, { force })`**: builds the learner's stats, calls Gemini (main model, then fallbacks), and saves the card. If every model is busy, the task throws and Render **retries it 4 times with exponential backoff** (5s, 10s, 20s, 40s).
- **`refreshAllCards({ staleHours })`**: finds stale or rules-engine cards and runs `generateAiCard` for each, in batches of 5, to respect Gemini rate limits.
- The card page shows "Render Workflows · generating with Gemini…" and updates by itself when the run finishes. The Command Deck has a **Refresh all AI cards** button with live run status.
- Without `RENDER_API_KEY` / `AI_WORKFLOW_SLUG` (e.g. local dev), the API generates cards inline exactly as before, with the rules engine as a fallback.

### Cohort automations (also Render Workflows)

The same workflow service runs two scheduled jobs. They show up on the core team's **Automations** page (`/mentor?tab=automations`), which has the pipeline diagram, a **Run now** button per task, live run status and the run history.

| Task | When | What it does | Where it shows |
|---|---|---|---|
| `deadlineDigest` | daily, 08:00 IST | For every mentee, finds missions due in the next 48 h or already overdue (using the same status rules as the Launchpad, so locked missions are skipped) and saves the day's reminders | “Today's reminders” card on the Launchpad |
| `weeklyCohortReport` | Mondays, 08:30 IST | Computes each cohort's week: active mentees, points, completion, top movers, who went quiet, lowest-completion missions, next deadlines. Saves a rules summary first, then **chains `summarizeCohortReport`** per cohort | Weekly report card on the mentor Overview + Automations page |
| `summarizeCohortReport` | subtask | Gemini writes a 2–3 sentence summary and mentor action items from the numbers only; **4 retries with backoff**. If Gemini never answers, the rules summary stays, so nothing is lost | the report's “✦ Gemini summary” tag |

```
GitHub Actions schedule ──POST /api/cron/:task (x-cron-secret)──▶ API ──startTask──▶ Render Workflows
                                                                                   │
Core team "Run now" ───────POST /api/admin/automations/:task──────▶ API ─────────┘   ▼
                                                                          MongoDB: Reminder, CohortReport, WorkflowRun
```

- **Scheduling** is a free GitHub Actions workflow (`.github/workflows/schedules.yml`) that only “rings the bell”. The API checks a shared `CRON_SECRET` (constant-time compare) and starts the Render task, and every run is logged in `WorkflowRun`.
- Without Render configured, “Run now” runs the job inline in the API, so the feature still works in local dev.
- Endpoints: `GET/POST /api/admin/automations[/:task]`, `POST /api/cron/:task`, `GET /api/m/reminders`, `GET /api/programs/:id/report`.

**Deploy the workflow** (Render dashboard → **New → Workflow**): repo `tn_web`, root `backend`, build `npm install`, start `node workflows/index.js`, name `techneeds-ai`, env `MONGO_URI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `NODE_VERSION=22`. Then add `RENDER_API_KEY`, `AI_WORKFLOW_SLUG=techneeds-ai` and `CRON_SECRET` (any long random string) to the API service. For the schedule, add the GitHub repo secrets `TN_API_URL` (your API URL) and `CRON_SECRET` (same value), and enable Actions on the repo.
