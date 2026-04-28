# Operator overview — Shipwreck Blog Engine

**Audience:** Nyxi (primary), and any human ops administrator.

This document is the entry point for understanding the operational footprint of the Shipwreck Blog Engine. Read this first before touching anything related to it on a server.

## TL;DR

- The engine is a **library + template**, not a service. There is no central server, no daemon, no port to monitor on shared infrastructure.
- Each consuming site (Wollongong Weather, Review Removals, etc.) builds its own static blog from a copy of the template.
- Engine updates flow to sites via `npm update` against the engine's git repo. No server-side push.
- The engine's "production deployment" is just **git tags** that downstream sites pin to.
- Operational responsibility is **per-site**, not central. Each site owns its blog's deploy pipeline.

## What the engine actually is

Three packages and a template:

| Package | Role |
|---|---|
| `@shipwreck/blog-core` | npm package — schemas, SEO helpers, Astro components, utilities |
| `@shipwreck/blog-theme-default` | npm package — Tailwind preset + CSS-var tokens |
| `create-shipwreck-blog` | npm CLI — scaffolds a `_blog/` folder into a host site |
| `examples/demo-site` | Reference Astro app — copied into host sites as their per-site `_blog/` |

A site that "uses the engine" has a folder like `host-site-repo/_blog/` containing a copy of the template, with `package.json` declaring `@shipwreck/blog-core` as a dependency. Build it = `astro build` produces static HTML, which gets copied into `host-site-repo/blog/` for the web server to serve.

## What this means for you (Nyxi)

### When a new site adopts the engine

1. The site's repo gains a `_blog/` directory (source) and a `blog/` directory (built static output).
2. The site's deploy pipeline gains an extra step: `cd _blog && npm install && npm run build` before the existing deploy.
3. The site's `robots.txt` and `sitemap-index.xml` may need to be updated to reference the blog's sitemap.
4. No new server processes. No new ports. No new daemon to monitor.

See [integration-checklist.md](./integration-checklist.md) for the step-by-step.

### When the engine ships an update

You **don't** push anything. The engine repo gets a new commit and a new tag. Downstream sites are responsible for picking up the update.

For each site that should adopt the update:

```bash
cd <host-site-repo>/_blog
npm update @shipwreck/blog-core @shipwreck/blog-theme-default
npm run build
git add ../blog && git commit -m "chore(blog): update engine to vX.Y.Z" && git push
```

This is a candidate for [Harbour Control](https://D:/NyXi's%20Vault/Topics/Harbour%20Control.md) automation — see [update-procedure.md](./update-procedure.md).

### When a site's blog breaks

See [incident-runbook.md](./incident-runbook.md). Common causes: dependency drift, schema changes that the site didn't migrate, theme tokens that lost meaning after a theme update.

## Where to find things

### The engine repo

`/home/rick/projects/shipwreck-blog-engine` (RGB-Skank dev box). When pushed, it lives at the GitHub repo to be created (TBC).

### Docs

You're in `/docs` now. Everything that matters is indexed in [docs/README.md](../README.md).

### Per-site blog folders

Each consuming site has its blog source under `_blog/` and built output under `blog/`. Examples:

- `~/projects/wollongong-weather/_blog/` (source) + `~/projects/wollongong-weather/blog/` (built)

## Decisions you don't need to second-guess

These are locked, documented in `ARCHITECTURE.md` at the engine root:

- **No central server.** Per-site deployment. This avoids one shared point of failure across many brand sites.
- **No database.** Content is MDX in git. Edit history = git history.
- **Astro static output.** No SSR runtime needed.
- **Sveltia CMS** for human editing — drops into each site at `/blog/admin/`, free, Git-backed, no backend.

## What still needs to happen (not yet done)

- Engine repo doesn't have a GitHub remote yet — sites can't `npm install` it via git+ssh until that's set up.
- No CI on the engine repo.
- No automation for "update all sites at once" — that's manual or future Harbour Control work.

## Glossary

- **Engine** — this repo (`shipwreck-blog-engine`). Source of truth for blog logic, components, and schemas.
- **Host site** — a site that consumes the engine (Wollongong Weather, Review Removals).
- **Blog source** — the `_blog/` folder in a host site repo. The Astro project.
- **Blog output** — the `blog/` folder in a host site repo. Built static HTML.
- **Drop-in** — the model where the engine ships as code dropped into the host site, not a service the host calls.
