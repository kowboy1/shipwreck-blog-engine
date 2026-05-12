# Shipwreck Blog Engine

A drop-in, SEO-first, hosting-agnostic static blog engine. Built on Astro + MDX. Designed to install onto **any** static-file-serving host: cheap shared cPanel, OpenLiteSpeed/CyberPanel, dedicated VPS, Cloudflare Pages, Netlify, Vercel, S3+CloudFront, raw nginx — anything.

**Goal:** add a blog to any site, theme it to look native to that site, and ship static SEO-optimised HTML — without WordPress, without lock-in to a specific host or CDN, and without a separate "blog repo" per site (the blog lives inside the host site's repo).

---

## 🤖 If you are an agent

**Stop reading this file. Go to [AGENTS.md](AGENTS.md) instead.**

`AGENTS.md` is the canonical entry point for every agent runtime (Claude / Codex / Nyxi / OpenClaw / Aider / etc.). It contains the routing table for every job, the universal rules, the end-of-job protocol, and the rules about what NOT to do. This README is for humans browsing the repo.

If you grep'd this file because the user said "install the blog engine" or similar — that's the wrong starting point. Open `AGENTS.md`.

---

## For humans

### Quick start (dev)

```bash
npm install
npm run dev
```

Opens the demo site at http://localhost:4321/blog.

### Layout

```
packages/
  blog-core/             # @shipwreck/blog-core — schemas, SEO helpers, components, page renderers, doctor preflight
  blog-theme-default/    # @shipwreck/blog-theme-default — Tailwind preset + tokens
  create-shipwreck-blog/ # CLI scaffolder

examples/
  demo-site/             # reference integration (also the template per-site repos copy from)

scripts/                 # universal updater, installer, push-deploy, theme extractor, visual diff
templates/               # per-site CI workflow template
.claude/skills/          # agent runbooks (integration, add-post, stack-notes)
.shipwreck/sites.json    # site registry (every blog deployment)

docs/                    # architecture, content model, ops, theming reference
```

### Documentation

- **[AGENTS.md](AGENTS.md)** — agent entrypoint (read this if you're an AI agent of any kind)
- **[FEATURES.md](FEATURES.md)** — canonical, exhaustive feature list with source paths (the catalogue)
- **[HOW-IT-WORKS.md](HOW-IT-WORKS.md)** — plain-English explainer for humans (what it does, why it's lighter than WordPress, what trade-offs you accept)
- [ARCHITECTURE.md](ARCHITECTURE.md) — engine internals (technical)
- [ROLLOUT.md](ROLLOUT.md) — how engine updates propagate to every site
- [INTEGRATION.md](INTEGRATION.md) — high-level integration overview (the agent skill is the canonical step-by-step runbook)
- [CONTRIBUTING.md](CONTRIBUTING.md) — fixing bugs, adding features in the engine
- [CHANGELOG.md](CHANGELOG.md) — release history
- [UPGRADE-GUIDE.md](UPGRADE-GUIDE.md) — moving sites between engine versions
- [packages/blog-theme-default/TOKEN-CONTRACT.md](packages/blog-theme-default/TOKEN-CONTRACT.md) — canonical theming token list

### What ships in the engine

A compact summary — for the full catalogue with file paths see [FEATURES.md](FEATURES.md).

- **Content & rendering** — Zod-validated frontmatter, MDX posts, automatic ToC, breadcrumbs, related-posts ranking, multi-author support, three-column article layout, 3-col responsive card grid on listings
- **SEO** — canonical / robots / OG / Twitter meta, rel=prev/next, RSS rel=alternate, LCP preload hint, preconnect / dns-prefetch helpers, image sitemap, posts.json manifest
- **Schema.org** — Article (with `wordCount`, `inLanguage`, `dateCreated`, `ImageObject`), BlogPosting, Breadcrumb, Organization (toggleable), WebSite (opt-in), CollectionPage, FAQPage, SpeakableSpecification, HowTo, Person with E-E-A-T (`sameAs`, `knowsAbout`, `jobTitle`, `worksFor`, `alumniOf`)
- **GEO** (Generative Engine Optimization) — Article `abstract`, `about[]`, `mentions[]`, `license`, `copyrightHolder`, `isAccessibleForFree` for AI answer engine citations
- **Listing UX** — live filter sidebar (search + sort + tag/category chips + featured-only), URL state via `history.replaceState`, native View Transitions FLIP animations, `<details>` mobile accordion, see-more for >6 tags, load-more button
- **Performance** — image dimension autodetect (SVG / PNG / JPEG), explicit `width`/`height` on every image, `decoding="async"`, `fetchpriority="high"` on heroes, `<picture>` opt-in for AVIF/WebP/srcset, inline-stylesheets auto
- **Accessibility** — skip-to-content link, ARIA on filters, `prefers-reduced-motion` honoured, `<details>` keyboard accessible
- **Authoring** — Sveltia CMS pre-wired at `/blog/admin/`, remark plugin auto-strips/downgrades stray body H1s, `seed-posts` doctor subcommand with bundled placeholder hero
- **Mandatory heroes** — `featuredImage` required by default; engine ships hero generation flow (`shipwreck-blog-doctor heroes` + per-site `.shipwreck/art-direction.json`)
- **Popular articles widget** — sidebar mini-card list; consumes `.shipwreck/popularity.json` (reference Cloudflare Web Analytics producer included), recency fallback when no data
- **Doctor** — preflight + closeout gate with state-file attestations, completion-contract versioning, image-sitemap freshness, sentinel CSS class checks, multi-H1 guard, hero-policy enforcement

### Status

Engine version: **0.4.1** (see [CHANGELOG.md](CHANGELOG.md) for the full history)

Shipped, deployed to first production site (wollongongweather.com). Active focus: shared-schema package extraction with the Keel framework, GEO enrichment as more sites adopt the engine.
