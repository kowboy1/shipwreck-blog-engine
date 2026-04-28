# Handover — Shipwreck Blog Engine (for Nyxi)

**From:** Claude Code session, 2026-04-28
**For:** Nyxi (ops/Harbour Control administrator)
**Status:** Phase 1 scaffold complete, dev server verified booting clean

---

## TL;DR

A new local project exists at `/home/rick/projects/shipwreck-blog-engine` on the WSL dev box (RGB-Skank). It's a drop-in blog engine that will be added to multiple Shipwreck sites instead of using WordPress. **It is not yet deployed anywhere.** No production hosting impact yet.

---

## What it is

A monorepo (npm workspaces) containing:

| Package | Type | Purpose |
|---|---|---|
| `@shipwreck/blog-core` | npm package | Content schema (Zod), SEO helpers (schema.org, OG, meta), reusable types |
| `@shipwreck/blog-theme-default` | npm package | Tailwind preset + CSS token defaults |
| `@shipwreck/blog-demo-site` (examples/demo-site) | Astro app | Reference integration. Doubles as the per-site template that gets copied into host sites |

**Stack:** Astro 5 + MDX + Tailwind 3 + Zod. TypeScript strict. Static output.

**Why it exists:** Standardise on one fast, SEO-first blog engine across Shipwreck sites (review-removals first, others later) to replace WordPress dependency. See `PROJECT-BRIEF.md` and `ARCHITECTURE.md` in the repo for full context.

---

## Where it lives

- **Repo:** `/home/rick/projects/shipwreck-blog-engine` (WSL Ubuntu-24.04, RGB-Skank dev box)
- **No git remote yet** — repo is local only. Recommend creating a private GitHub repo before first integration so sites can pull via git+ssh.
- **No production deployment.** When sites integrate it, they will copy `examples/demo-site` into their own repo as `/blog/` and build static HTML there.

---

## How it runs (dev only, currently)

Verified on 2026-04-28 by Rick:

```bash
cd ~/projects/shipwreck-blog-engine
npm install        # 487 packages, ~48s, 8 moderate vulns (typical, not blocking)
npm run dev        # boots Astro on http://localhost:4321/blog/
```

**Port used in dev:** 4321 (Astro default). Bound to localhost only — not exposed to network without `--host` flag. Won't conflict with any production service.

**Build output (when running `npm run build`):** `examples/demo-site/dist/` — static HTML, ready to drop into any host.

---

## How it integrates with sites (the operational model)

This is the most important thing to understand for ops:

**Per-site, not centralised.** Each site that adopts the blog gets its own copy of the demo-site template inside its own repo (typically at `site-repo/blog/`). That copy:

- Has its own `content/posts/*.mdx` (per-site content, lives in the site's git)
- Has its own `site.config.ts` (per-site brand/SEO config)
- Depends on `@shipwreck/blog-core` and `@shipwreck/blog-theme-default` via npm/git+ssh
- Builds independently to static HTML
- Gets mounted at `/blog/` on the host (static copy or reverse proxy)

**Engine updates flow via package version bumps**, not central deploys:

```bash
# in any site that has the blog integrated:
cd <site-repo>/blog
npm update @shipwreck/blog-core
npm run build
# redeploy site
```

There is no central blog server to monitor. The operational footprint is:

1. **This repo** (engine source, dev only) — no uptime concern
2. **Each integrated site's `/blog/` build** — same lifecycle as the host site itself

---

## What Nyxi should track

### Now
- Add this project to your project registry
- No monitoring needed yet (no prod deployment)

### When the first integration ships (Review Removals, planned Phase 2)
- Note that review-removals will gain a `/blog/` subpath serving static HTML
- Build pipeline change: review-removals deploy will need to also build the `blog/` workspace before deploy (`npm run build` in `blog/` then copy `dist/` into the served path)
- Sitemap impact: the blog generates its own sitemap at `/blog/sitemap-index.xml` — Search Console submission may need updating
- robots.txt: confirm `/blog/` is not blocked

### Ongoing
- When `@shipwreck/blog-core` ships an update, rolling it out to N sites is `npm update` + redeploy per site. Could be a future Harbour Control automation candidate.

---

## Known issues / followups

| # | Item | Severity | Action |
|---|---|---|---|
| 1 | 8 moderate npm audit vulnerabilities post-install | Low | Run `npm audit` to identify; defer fixes to a maintenance pass unless prod-bound |
| 2 | Astro 6.1.9 available (we installed 5.18.1) | Low | Stay on 5 for v1 stability; plan a 6 upgrade once integrations are stable |
| 3 | No git remote configured | Medium | Create private GitHub repo before first integration so sites can `npm install` via git+ssh |
| 4 | No CI / no published packages | Medium | Acceptable for v1 (git+ssh covers it); revisit when 2+ sites integrate |
| 5 | No CONTRIBUTING / UPGRADE-GUIDE docs yet | Low | Add when first integration happens — that's when versioning discipline starts mattering |

---

## Decisions locked (don't re-litigate)

- Renderer: **Astro** (not Next.js, not custom React/Vite SSR)
- Content format: **MDX** in git (not a database)
- Distribution: **git+ssh** (not npm registry)
- Multi-tenancy: **per-site copy** (not central server)
- Theming: **per-site `SiteShell/Header.astro` + `Footer.astro`** + Tailwind preset overrides — agents follow `INTEGRATION.md` recipe to match host sites
- Admin UI: **deferred to Phase 4** (write MDX in editor for now)
- First real integration: **Review Removals**

---

## Files Nyxi should read for context

In order of importance:

1. `PROJECT-BRIEF.md` — original mandate
2. `ARCHITECTURE.md` — how it's built and why
3. `INTEGRATION.md` — what happens when a site adopts it (this is the ops-relevant doc)
4. `README.md` — surface overview

---

## What I (Claude Code) did this session

1. Read the project brief
2. Pushed back on the "central server" idea I'd initially floated — drop-in-per-site is the right model
3. Wrote `ARCHITECTURE.md` and `INTEGRATION.md` (the latter doubles as an agent recipe for theming the blog to match a host site)
4. Scaffolded the monorepo: root `package.json` workspaces, two npm packages, demo-site Astro app
5. Implemented Phase 1 essentials: Zod content schema (every SEO field), schema.org generators, OG/meta builders, BaseLayout with full SEO `<head>`, blog index page, dynamic post page, RSS endpoint, sitemap integration, default Tailwind preset with CSS-var token system, one example MDX post
6. Stopped before `npm install` and asked Rick to run it — verified clean boot

## What Claude Code did NOT do

- Create a git remote
- Deploy anything
- Touch any production system
- Modify any other Shipwreck project
- Start any background processes
- Configure any services on RGB-Skank beyond installing npm packages in the project's own `node_modules`
