# Shipwreck Blog Engine

A drop-in, SEO-first, hosting-agnostic static blog engine. Built on Astro + MDX. Designed to install onto **any** static-file-serving host: cheap shared cPanel, OpenLiteSpeed/CyberPanel, dedicated VPS, Cloudflare Pages, Netlify, Vercel, S3+CloudFront, raw nginx — anything.

**Goal:** add a blog to any site, theme it to look native to that site, and ship static SEO-optimised HTML — without WordPress, without lock-in to a specific host or CDN.

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
- [ARCHITECTURE.md](ARCHITECTURE.md) — engine internals
- [ROLLOUT.md](ROLLOUT.md) — how engine updates propagate to every site (pull + push paths)
- [INTEGRATION.md](INTEGRATION.md) — high-level integration overview (the agent skill is the canonical step-by-step runbook)
- [CONTRIBUTING.md](CONTRIBUTING.md) — fixing bugs, adding features in the engine
- [CHANGELOG.md](CHANGELOG.md) — release history
- [UPGRADE-GUIDE.md](UPGRADE-GUIDE.md) — moving sites between engine versions
- [packages/blog-theme-default/TOKEN-CONTRACT.md](packages/blog-theme-default/TOKEN-CONTRACT.md) — canonical theming token list

### Status

Engine version: **0.3.2** (see [CHANGELOG.md](CHANGELOG.md) for the full history)

The engine is feature-complete for the integration story. Active focus: end-to-end production deploy on the first live site, then graduating stack-specific quirks into [.claude/skills/stack-notes/](.claude/skills/stack-notes/).
