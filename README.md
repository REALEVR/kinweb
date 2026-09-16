# Kinweb

A global, crowdsourced family-heritage platform. Claim your profile, connect your relatives, and watch your family tree grow organically — like a spider web, one true connection at a time.

Full project brief: [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).

## Status

Scaffolded. The data model, the privacy gate, and a bare-bones claim / add-relative / search flow exist and are covered by tests. The force-directed "web" visualisation is not built yet — `PersonPage` currently lists connected relatives as plain cards.

**No real user data should enter this system until Legal has reviewed the brief's privacy section.** That review is a prerequisite in the brief, and nothing here substitutes for it.

## The privacy model is code, not policy

The brief calls privacy "the load-bearing wall", so it is built as one. Every read of a `Person` goes through [`server/src/lib/visibility.ts`](server/src/lib/visibility.ts), and the rules are enforced there rather than trusted to callers:

| Rule | Where |
|---|---|
| New profiles default to **family-only**, never public | schema default + `effectiveTier` |
| Under-18s are **never** public and **never** searchable — by anyone, including family | `isKnownMinor`, `isSearchable` |
| A minor's photo needs a guardian account attached | `mayShowPhoto` |
| Anyone can request lockdown **without an account** | `POST /api/erasure` |
| A locked node discloses nothing but keeps its edges | `projectPerson` |
| Cause-of-death stays freeform text, never structured health data | `Person.deceasedNotes` |
| Merge suggestions are surfaced, never auto-applied | `MergeSuggestion.status` |

Two decisions worth knowing about, both deliberately conservative:

- **Unknown birth year is not treated as adult.** We cannot prove a living person with no recorded birth year is over 18, so they cannot go public. The cost is that a claimant supplies a birth year before opting in; deceased profiles — the main genealogical value — are unaffected.
- **Erasure locks first, adjudicates second.** A wrongly-locked node is a reversible inconvenience; a slowly-locked one exposes someone who asked not to be listed.

`npm test -w server` covers all of the above — 19 cases.

## Stack

Matches the conventions already used elsewhere in the org, per the brief:

- **Server**: Node, Express, TypeScript, Prisma, Postgres (Neon free tier for hosted trials), JWT auth
- **Client**: React, Vite, TypeScript, React Router

Deliberately **not** a graph database. The brief calls for a relational store with application-level traversal; a bounded BFS (`server/src/lib/graph.ts`) handles the first hundreds of thousands of profiles. Revisit only if traversal is a measured bottleneck.

## Quick start

```bash
npm install

cp server/.env.example server/.env
cp client/.env.example client/.env

# Needs a Postgres. Quickest:
#   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kinweb postgres:16-alpine
npm run db:migrate
npm run db:seed        # a small invented family that demonstrates every privacy tier

npm run dev            # API on :4000, client on :5173
```

The seed signs in as `amina@example.com` / `password123`. It is throwaway demo data — no real person is represented, and those credentials must not be reused anywhere.

Worth doing once seeded: search as a signed-out visitor. `Nakato` returns a public profile; `Mukasa` returns nothing (living relatives are family-only); `Grace` returns nothing (she is 10).

## Deployment

Client is a static Vite SPA and deploys to Vercel — set root directory to `client`, and `VITE_API_BASE_URL` to the API's public URL. `client/vercel.json` handles SPA routing.

The API needs a normal always-on host (Render/Railway/Fly free tiers all work) and a Neon Postgres URL. Use Neon's **pooled** connection string for the app and the **direct** one for `prisma migrate`.
