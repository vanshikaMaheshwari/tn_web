# TechNeeds 2.0 — Blueprint Notebook

> **Innovortex 4.0 · Reimagathon · Team Paradox** (Vanshika Maheshwari, Unnati Gautam)
> A full reimagining of the TechNeeds IGDTUW mentorship platform: `all_you_need_to_know_about_tech`.

**Live demo:** `(https://tn-web-eight.vercel.app)` · **API:** `(https://tn-web-8ynw.onrender.com · )` · **Demo video:** `(https://drive.google.com/drive/folders/1ol9zAUihc1z5DvUpBgU6YnwGxKXdWBBG?usp=drive_link)`

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

**Admin · Command deck** (`/admin`)
- Secure admin login (credentials in env, JWT role claim)
- Create cohorts, recruit mentors with **auto-generated passwords** (shown once, stored with bcrypt)
- Assign / remove mentors per cohort, “needs a mentor!” flag, platform stats, mentor roster

**Mentor · Mission control** (`/mentor`, `/mentor/crew`)
- Cohort switcher, overview stats (crew, missions, % through, need-a-nudge, to-review)
- **Mission builder** for videos, timed quizzes (question editor, unlock + deadline window) and projects, with deadlines and max scores
- **Crew list**: add mentees with **auto enrollment numbers** (`TN-WEBD-0001`) + one-time password “boarding pass”, search, status filters (on track / needs a nudge / inactive), progress bars, password reset, AI nudge (copy emails of inactive mentees)
- **Review queue**: open GitHub + live links, score with feedback (“Stamp it ✓”), automatic late penalty
- Mission list with completion rates and delete

**Mentee · Launchpad** (`/dashboard`)
- Login with enrollment number + password
- Hero with next deadline and **rocket-orbit rank**, stat stickers (score %, streak, missions done, next deadline)
- **Mission board** sorted by urgency with filters: watch videos (auto-scored, −1 per late day), focused **quiz mode** (timer, question grid, autosave, auto-submit, one attempt) and **project submission** (checklist, links, build log, review timeline)
- Mini leaderboard and AI tip

**AI learner card** (`/profile`)
- **Gemini 2.5 Flash** writes a headline, summary, sticker badges and next steps from real activity (strict JSON schema, server-side stats only)
- **Rules-engine fallback** with the same shape when there is no key, quota runs out or the API fails
- DiceBear avatar seeded by name + top interest, editable interest tags, Recharts skill radar + score trajectory, shareable summary, 6-hour cache

**Public**
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
cp .env.example .env        # add your MongoDB Atlas URI, a JWT secret, admin email/password, optional GEMINI_API_KEY
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
| Admin | `ADMIN_EMAIL` from `.env` | `ADMIN_PASSWORD` from `.env` |
| Mentor | `mentor@techneeds.dev` | `mentor123` |
| Mentee | `TN-WEBD-0004` (or 0001–0008) | `mentee123` |

## Deploy

- **Backend → Render:** New Web Service from this repo, root `backend`, build `npm install`, start `npm start`. Set `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `CORS_ORIGIN=<frontend URL>`. (`render.yaml` in the repo root does this as a Blueprint.)
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
