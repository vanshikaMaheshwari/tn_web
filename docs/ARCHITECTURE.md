# TechNeeds 2.0 — Architecture & Implementation Plan

> Innovortex 4.0 · Reimagathon · TechNeeds IGDTUW platform redesign

## 1. Goals (mapped to judging criteria)

| Criterion | Marks | What we ship |
|---|---|---|
| Frontend UI/UX & redesign | 10 | "Blueprint Notebook" design system (`globals.css` tokens): graph paper, sticker cards, handwritten nudges, brand blues + highlighter yellow |
| Role flow & multi-panel | 10 | One unified `/login` with role tabs (Admin / Mentor / Mentee), role-aware navbar, guarded dashboards, credential hand-off cards |
| AI profile | 8 | `/profile` — Gemini-generated summary, skill badges, recommendations; DiceBear avatar seeded from interests; skill radar + score timeline |
| Backend (bonus) | 7 | Admin auth, bcrypt for mentees, auth on all program routes, quiz unlock fix, profile + interests API, seed script, env-based config |
| Code quality & responsiveness | 5 | Central API client, env-driven base URL, no hardcoded URLs, mobile-first layouts |

## 2. System overview

```
Next.js 15 (App Router, React 19)            Express 5 + Mongoose            MongoDB
┌───────────────────────────┐   REST/JSON   ┌──────────────────────┐       ┌─────────┐
│ /login  (role tabs)       │ ────────────► │ /api/admin/*  (JWT)  │ ────► │ Admin   │
│ /admin  programs, mentors │               │ /api/*  mentor (JWT) │       │ Mentor  │
│ /mentor mentees, resources│               │ /api/m/* mentee(JWT) │       │ Mentee  │
│ /dashboard  mentee        │               │ /api/m/profile/ai ───┼──► Gemini 2.x Flash│
│ /profile  AI profile      │               └──────────────────────┘       │ Program │
│ /leaderboard (public)     │                                              │ Resource│
└───────────────────────────┘                                              │ Quiz    │
     NEXT_PUBLIC_API_URL                                                   └─────────┘
```

## 3. Role flows

- **Admin** → logs in (env-seeded `ADMIN_EMAIL`/`ADMIN_PASSWORD`) → creates program → creates mentor (password auto-generated, shown once in a copyable credential card) → assigns mentor to program(s).
- **Mentor** → logs in → picks program → adds mentees (enrollment number auto-generated `TN-<PROG>-<0001>` if blank, password auto-generated, shown once) → publishes Video / Quiz / Project with deadline + max score → reviews project submissions and scores them → sees cohort progress.
- **Mentee** → logs in with enrollment no. + password → dashboard (stat cards, filterable task list grouped by status, deadlines countdown) → watches video / attempts quiz / submits project → score + streak update → leaderboard → AI profile.

## 4. AI-generated profile

Input signals (server-side, never trusts the client):
- completed resources by type, scores vs max, on-time ratio
- streak, rank, percentile
- interest tags (mentee-editable)
- upcoming / pending resources (for recommendations)

Pipeline:
1. `GET /api/m/profile` → computes stats deterministically.
2. `POST /api/m/profile/ai` → sends stats JSON to Gemini with a strict JSON response schema → `{ headline, summary, strengths[], growthAreas[], badges[{name, icon, reason}], recommendations[{title, why, resourceId?}] }`.
3. Result cached on the mentee document (`aiProfile`, `aiProfileAt`) for 6h to stay within free-tier quota.
4. Fallback: if no `GEMINI_API_KEY` or the call fails, a rule-based generator returns the same shape — the page never breaks during judging.
5. Avatar: DiceBear (`notionists`/`bottts`) seeded from name + top interest, so it shifts as the learner's focus changes.

## 5. Backend changes

| Area | Change |
|---|---|
| Security | Admin JWT role; `/programs`, `/mentors` writes require admin; program mentee/resource lists require mentor; role claim in all tokens |
| Passwords | Mentee passwords bcrypt-hashed; temp password returned once only; legacy plaintext accepted once then rehashed |
| Bugs | Quizzes were created `isLocked: true` and never unlocked → now locked only outside start/end window; project verify used wrong token key; project submit URL typo (`hhttps`); verify double-counted `totalScore` |
| New | `/api/admin/login`, `/api/admin/stats`, `/api/m/profile`, `/api/m/profile/ai`, `/api/m/interests`, `/api/mentor/overview`, `DELETE` resource |
| Config | `PORT=8000`, `CORS_ORIGIN`, `GEMINI_API_KEY`, `.env.example`; `npm run seed` creates demo data |

## 6. Frontend changes (restyle in place)

Routes: `/` home · `/login` (role tabs) · `/leaderboard` · `/dashboard` · `/dashboard/quiz/[id]` · `/dashboard/project/[id]` · `/profile` · `/mentor` (overview / missions / review) · `/mentor/crew` · `/admin`.
- `globals.css` — Blueprint Notebook tokens + component classes (`tn-card`, `tn-btn`, `tn-navy`, `tn-mission`, `tn-sticker`, `tn-pill`, `tn-option`), Bricolage Grotesque / DM Sans / Space Mono / Caveat.
- `lib/api.js` — single client, `NEXT_PUBLIC_API_URL`, token helpers, all calls moved here.
- Shared: `components/ui` (Icon, Logo, Orbit, Toast, Loading), `components/mentor/MentorApp.js`, role-aware `navbar`, `lib/useAuth.js` route guards, `lib/useReveal.js` (GSAP).
- `alert()` replaced by an inline toast.

## 7. Deploy

- Backend → Render web service (`npm start`, env vars above) using redeemed Render credits.
- Frontend → Vercel or Render static (`NEXT_PUBLIC_API_URL=https://<render-backend>`).
- Mongo → MongoDB Atlas free cluster.
