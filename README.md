# Shipwreck Blog Engine

A drop-in, SEO-first, hosting-agnostic static blog engine. Built on Astro + MDX. Designed to install onto **any** static-file-serving host: cheap shared cPanel, OpenLiteSpeed/CyberPanel, dedicated VPS, Cloudflare Pages, Netlify, Vercel, S3+CloudFront, raw nginx — anything.

**Goal:** add a blog to any site, theme it to look native to that site, and ship static SEO-optimised HTML — without WordPress, without lock-in to a specific host or CDN.

---

## 🤖 For agents starting a job in this repo (Claude / Codex / Nyxi / OpenClaw / Aider / any other)

**This is the universal entry point.** Read this section first regardless of which agent runtime you are. The same routing applies to every agent.

> **In practice, the agent doing this is almost always Nyxi (OpenClaw).** She has direct access to the user's server fleet (SSH credentials in her workspace, vault access for Cloudflare and other API tokens, Harbour Control dashboard with every site → server → access mapping, Tailscale into ops). When the universal docs say "look it up if not given to you", that's specifically a hint that Nyxi can read these things directly. Other agents may not have that access — they should ask the user.
>
> The docs themselves stay universal. The shortcuts Nyxi has are conveniences, not assumptions baked into the runbook.

### Identify your job, then go to the runbook

| If you've been told to… | Read this next, follow it phase-by-phase |
|---|---|
| Install the blog engine on a site (any site, any host, any stack) | [.claude/skills/integrate-shipwreck-blog.md](.claude/skills/integrate-shipwreck-blog.md) |
| Add, write, or publish a blog post on a site that already has the engine | [.claude/skills/add-shipwreck-blog-post.md](.claude/skills/add-shipwreck-blog-post.md) |
| Theme an already-installed blog (change colours/fonts/buttons to match a host) | [packages/blog-theme-default/TOKEN-CONTRACT.md](packages/blog-theme-default/TOKEN-CONTRACT.md) — fill every token, then rebuild |
| Push a fresh build of an existing site's blog (when we have SSH) | [scripts/deploy-blog.mjs](scripts/deploy-blog.mjs) — `node scripts/deploy-blog.mjs --site <name>` |
| Install the universal self-updater on a host (one-time, per site) | [scripts/install-updater.sh](scripts/install-updater.sh) |
| Diagnose why a recently-integrated site looks broken | [.claude/skills/integrate-shipwreck-blog.md](.claude/skills/integrate-shipwreck-blog.md) → "Common failure modes" table |
| Understand how the engine propagates updates to all sites | [ROLLOUT.md](ROLLOUT.md) |
| Fix a bug or ship a feature in the engine itself | [CONTRIBUTING.md](CONTRIBUTING.md) + [ARCHITECTURE.md](ARCHITECTURE.md) |
| Anything not on this list | Ask the user to clarify before improvising |

### Things every agent must know before starting any job

1. **Hosting/DNS/CDN-agnostic by design.** Don't bake site-specific, server-specific, or CDN-specific behaviour into the engine, the skills, or the universal docs. If the user gives you a specific stack, that's an INPUT to the runbook (it influences which deploy mode you pick), not a baked-in assumption. Stack-specific quirks discovered during real integrations go in [.claude/skills/stack-notes/](.claude/skills/stack-notes/) — don't pollute the universal skill.

2. **Two repos per integration. Don't conflate them.**
   - **Host site repo** — the existing live website. Blog is NOT installed here. Only edits: footer link, optional nav link, optional `robots.txt` sitemap reference.
   - **Per-site blog repo** (`<site-name>-blog`) — a SEPARATE git repo containing only the blog source.

3. **Versioning rule:** bump the patch component (last decimal) only. `0.3.1 → 0.3.2 → 0.3.3 → ... → 0.3.99 → 0.3.100`. Don't auto-bump minor or major even if changes feel semver-justifying. Asking for a minor or major bump is the user's call.

4. **Where to find site/server/access info if not given to you in the prompt:**
   - Site domain, server, document root, deploy method → look up in the user's agent dashboard (Harbour Control, or whatever the user maintains for site→server mapping); ask the user if no dashboard access.
   - CDN zone IDs / API tokens → check the user's secret store; never guess credentials.
   - GitHub org / repo names → ask the user, or read existing entries in `.shipwreck/sites.json`.

5. **The site registry is the source of truth.** Every site running the engine is recorded in [.shipwreck/sites.json](.shipwreck/sites.json) with its domain, deploy method, server, source repo, CDN config, engine version. After integrating a new site, append it there. Before working on an existing site, read its entry there for context.

### What to do at the end of any job

After successfully completing an integration, post-add, deploy, or theme update:

1. Update the relevant entry in [.shipwreck/sites.json](.shipwreck/sites.json) (engine version, last deployed)
2. If you discovered something the dev agent should fix in the engine itself: write a `FEEDBACK-FOR-CLAUDE-<job>.md` at the repo root (existing convention)
3. If you saw stack-specific quirks: write a session log following the template in [.claude/skills/stack-notes/README.md](.claude/skills/stack-notes/README.md)
4. Log the session per whatever the user's session-log convention is (varies per agent runtime)

### Things you MUST NOT do without asking

- Bump engine versions beyond patch
- Tag GitHub releases on the engine repo (the user does this manually after verification)
- Push to the host site repo for anything other than the footer/nav/robots integration
- Modify the universal skill or universal docs to add hosting-specific assumptions
- Skip the validation checklist in TOKEN-CONTRACT.md when theming
- Ship a half-working integration "for now" — Phase 5 visual verification must pass before Phase 6 deploy

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
  blog-core/             # @shipwreck/blog-core — schemas, SEO helpers, components, page renderers
  blog-theme-default/    # @shipwreck/blog-theme-default — Tailwind preset + tokens
  create-shipwreck-blog/ # CLI scaffolder

examples/
  demo-site/             # reference integration (also the template per-site repos copy from)

scripts/                 # universal updater, installer, push-deploy, theme extractor, visual diff
templates/               # per-site CI workflow template
.claude/skills/          # agent runbooks (integration, add-post, stack-notes)
.shipwreck/sites.json    # site registry (every blog deployment)

docs/
  ARCHITECTURE.md
  INTEGRATION.md         # high-level integration concepts (the agent skill is the canonical runbook)
  ROLLOUT.md → ../ROLLOUT.md  # update propagation strategy
```

### Complete index of files in this repo

#### Universal docs (read these to understand the engine end-to-end)

- [ARCHITECTURE.md](ARCHITECTURE.md) — engine internals
- [ROLLOUT.md](ROLLOUT.md) — how engine updates propagate to every site (pull + push paths)
- [INTEGRATION.md](INTEGRATION.md) — high-level integration overview (the agent skill is the canonical step-by-step runbook)
- [CONTRIBUTING.md](CONTRIBUTING.md) — fixing bugs, adding features in the engine
- [CHANGELOG.md](CHANGELOG.md) — release history
- [UPGRADE-GUIDE.md](UPGRADE-GUIDE.md) — moving sites between engine versions

#### Agent skills (the runbooks)

- [.claude/skills/integrate-shipwreck-blog.md](.claude/skills/integrate-shipwreck-blog.md) — install on a site (9 phases, 4 deploy modes)
- [.claude/skills/add-shipwreck-blog-post.md](.claude/skills/add-shipwreck-blog-post.md) — write/publish a post (9 phases, full SEO discipline)
- [.claude/skills/stack-notes/](.claude/skills/stack-notes/) — stack-specific quirks accumulated from real integrations

#### Theming

- [packages/blog-theme-default/TOKEN-CONTRACT.md](packages/blog-theme-default/TOKEN-CONTRACT.md) — canonical list of every theming token (must fill all of them)
- [packages/blog-theme-default/tokens.css](packages/blog-theme-default/tokens.css) — engine defaults
- [packages/blog-theme-default/tailwind-preset.js](packages/blog-theme-default/tailwind-preset.js) — Tailwind config preset (auto-scans engine components + pages)

#### Scripts (helpers used during integration + maintenance)

- [scripts/install-updater.sh](scripts/install-updater.sh) — one-shot installer for the universal self-updater on any host
- [scripts/shipwreck-updater.php](scripts/shipwreck-updater.php) — the universal self-updater itself (drops on the host)
- [scripts/deploy-blog.mjs](scripts/deploy-blog.mjs) — push deploy for SSH-capable hosts (alternative to the pull updater)
- [scripts/extract-theme.mjs](scripts/extract-theme.mjs) — Playwright tool that visits a host URL and emits a draft `tokens.css`
- [scripts/visual-diff.mjs](scripts/visual-diff.mjs) — region-by-region pixel diff between host and blog
- [scripts/README.md](scripts/README.md) — script usage reference

#### Templates copied into per-site repos at integration time

- [templates/site-blog-build.yml](templates/site-blog-build.yml) — per-site CI workflow (builds the blog and publishes release tarballs)
- [examples/demo-site/](examples/demo-site/) — reference per-site source layout

#### Engine-side automation

- [.github/workflows/release-dispatch.yml](.github/workflows/release-dispatch.yml) — fires `repository_dispatch` to every registered consumer-site repo when the engine releases a new version

#### State / source of truth

- [.shipwreck/sites.json](.shipwreck/sites.json) — registry of every site running the engine

#### One-off / historical (not for general reading)

- `HANDOVER-NYXI.md` — handover note for the first end-to-end integration test
- `HANDOFF-NYXI-REBUILD-WOLLONGONG-031.md` — one-off rebuild note
- `FEEDBACK-FOR-CLAUDE-*.md` — feedback logs from real integrations (input for engine improvements)

### Status

Engine version: **0.3.1** (see [CHANGELOG.md](CHANGELOG.md) for the full history)

The engine is feature-complete for the integration story. Active focus: end-to-end production deploy on the first live site, then graduating stack-specific quirks into [.claude/skills/stack-notes/](.claude/skills/stack-notes/).
