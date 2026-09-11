# Kinweb — Project Brief (v1)

A global, crowdsourced family-heritage platform. Claim your profile, connect your relatives, and watch your family tree grow organically — like a spider web, one true connection at a time.

Rendered version with better formatting: https://claude.ai/code/artifact/457f52ad-3ec0-4c67-80a4-d209236462a4

## Read this before writing a line of product code

This product's entire premise is collecting and linking personal data about real people — including people who never signed up and never consented. That is the single biggest risk in this brief, bigger than any technical choice. Uganda's Data Protection and Privacy Act 2019, GDPR, and most other privacy regimes treat this pattern as high-risk. Default every living person's profile to the most private tier, build a real claim/consent flow before any profile is publicly searchable, and get the Legal role to review this brief specifically before real user data enters the system — not after. See "Privacy & legal" below.

## The core idea

Most family-tree tools are single-user documents: one person builds a tree, alone, from scratch. Kinweb treats each person as a node and each relationship as an edge in one shared, growing graph. When someone adds a parent, sibling, or cousin, Kinweb checks whether that relative already has a profile — added by someone else, somewhere else in the graph — and offers to link or merge instead of duplicating. Over time the graph stops being a collection of separate trees and becomes one connected web: your tree touches your cousin's tree touches a whole clan's tree.

### The core loop

1. Someone claims or creates their own profile.
2. They add known relatives (name, relationship, approximate dates, whatever they know).
3. Kinweb surfaces likely matches for each added relative already in the graph, and suggests a link.
4. Each linked relative is invited to claim their own profile, verify the relationship, and add more of their own.
5. The graph compounds — each new claim can reveal a dozen more probable connections.

## Data model

| Entity | Key fields | Notes |
|---|---|---|
| **Person** | `id`, `displayName`, `birthYear±`, `deathYear±`, `photoUrl`, `bio`, `privacyTier`, `claimedByUserId`, `verified` | Dates are approximate by default — most contributors won't know exact dates for older generations. |
| **Relationship** | `personA`, `personB`, `type` (parent / spouse / sibling — child is the inverse of parent), `addedByUserId`, `confirmedBy[]` | A relationship is "confirmed" once both connected profiles' claimants agree, or a majority of linked relatives do. |
| **ClaimRequest** | `personId`, `requestingUserId`, `evidence`, `status` | How an unclaimed profile becomes claimed by the real person or a verified close relative. |
| **MergeSuggestion** | `personIdA`, `personIdB`, `matchScore`, `sharedRelatives[]` | Surfaced, never auto-applied — a wrong merge is worse than a missed one. |

## Privacy & legal — the load-bearing wall

- **Default tier.** Every new profile for a living person defaults to **Family-only** visibility, never Public. Public requires the claimant to opt in explicitly.
- **Minors.** Profiles for anyone under 18 are never public, never searchable, and never show a photo without a parent/guardian's account attached.
- **Non-consenting subjects.** Anyone can request removal or privacy-lockdown of a profile representing them, even if a relative created and manages it — this needs an honest, working flow from day one, not a backlog item.
- **Deceased persons.** Generally lower-risk and the main source of genuine genealogical value, but some jurisdictions still restrict health/cause-of-death data — keep that field freeform text, not structured.
- **Cross-border.** "Anyone in the world" means data residency and transfer questions from day one, not after a certain user count — Legal should scope this before the first real signup, not after.
- **Right to erasure.** A living person must be able to delete or lock their own node even when someone else "owns" it in the UI. This is a product requirement, not a legal footnote.

## Suggested architecture

Match whatever stack conventions the team already uses elsewhere (check the existing repos before introducing a new one) — the graph itself doesn't need a specialized graph database at launch. A relational database with a `people` and `relationships` table, and an application-level graph traversal for tree/web views, comfortably handles the first hundreds of thousands of profiles. Revisit a dedicated graph database only if traversal queries become the actual bottleneck, not preemptively.

For the "spider web" view itself: a force-directed graph layout (the family-web visualization is the product's signature moment — the thing people screenshot and share) with a conventional pedigree/tree view as the default, more familiar layout. The web view is the marketing asset; the tree view is the daily-use tool.

## Go-to-market angle

This is a brief for Growth and Research to run with, not a finished plan:

- **Network-effect loop is the growth engine.** Every invite to confirm a relationship pulls in a new user who brings their own branch of the graph. Growth should design the invite/claim moment as carefully as any onboarding screen — it's the whole engine.
- **SEO surface.** Public, claimed profiles are long-tail search pages (name + place + approximate era) the same way genealogy incumbents rank for name searches — but only once the privacy model above is solid; don't index anything before that's real.
- **Beachhead market.** Given the team's existing footprint, Ugandan and wider East African diaspora communities are a strong initial wedge — clan and lineage systems already carry real cultural weight there, ahead of a broader global rollout.
- **Shareable artifact.** The web-view visualization, exportable as an image, is a natural social-share object — treat it as a growth feature, not just a data view.

## What happens next

Once scaffolding starts, Engineering builds the initial data model and a bare-bones claim/add-relative flow with the privacy defaults above already enforced — not added later. Research profiles the genealogy space (Ancestry, MyHeritage, FamilySearch, Geni, WikiTree) for what's actually differentiated here versus what's already solved. Legal reviews this brief specifically — data-protection posture, consent flow, minors, erasure — before any real user's family data enters the system. Growth holds off on any public-facing positioning until Legal has signed off on the privacy model going live.
