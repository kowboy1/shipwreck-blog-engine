> ⚠️ **STOP** — if you are an agent and havent read [AGENTS.md](AGENTS.md) yet, read that first.
> This file is referenced FROM the agent runbook in `AGENTS.md`, not a starting point.
> Continue here only if `AGENTS.md` routed you to this file.

# Contributing

How to work on the Shipwreck Blog Engine.

## Setup

```bash
git clone git@github.com:YOUR_ORG/shipwreck-blog-engine.git
cd shipwreck-blog-engine
npm install
npm run dev
# opens http://localhost:4321/blog/
```

Node 20+ required.

## Repo layout

```
packages/
  blog-core/             # @shipwreck/blog-core — schemas, components, SEO, utils
  blog-theme-default/    # @shipwreck/blog-theme-default — Tailwind preset, tokens
  create-shipwreck-blog/ # scaffolder CLI

examples/
  demo-site/             # reference Astro app (also serves as the per-site template)
```

## Where to add things

| Adding... | Goes in |
|---|---|
| A new SEO field on posts | `packages/blog-core/src/schemas/post.ts` |
| A new schema.org generator | `packages/blog-core/src/seo/schema-org.ts` |
| A reusable visual component | `packages/blog-core/src/components/` |
| A site-specific component | `examples/demo-site/src/components/` (and document the pattern) |
| A theme token | `packages/blog-theme-default/tokens.css` + the Tailwind preset |
| A new page route | `examples/demo-site/src/pages/` |
| A new CTA | `examples/demo-site/src/components/cta/` and register in `registry.ts` |
| A redirect | `examples/demo-site/src/redirects.json` |

## Versioning rules

- **Bump only the patch (last) decimal place** unless the user explicitly approves a minor or major bump. `0.3.1 → 0.3.2 → 0.3.3 → ... → 0.3.99 → 0.3.100`. Even when a change feels semver-justifying as a minor bump, bump patch and note in the CHANGELOG why this would normally warrant higher — the user decides whether to retag.
- **Don't break the post schema** without an explicit major bump approved by the user, plus a migration note in `UPGRADE-GUIDE.md`.
- New schema fields must be optional or have defaults.
- New component props must be optional.

## Hosting / CDN / site agnosticism is a hard rule

The engine and its universal docs (skills in `.claude/skills/`, README, ROLLOUT, scripts) **must not** contain hosting-specific, server-specific, DNS-specific, or CDN-specific assumptions. The engine is designed to install onto any static-file-serving host on earth — bake one stack in and we lose that.

When in doubt:

- ✅ "the host's webserver may need a rewrite skip for `/blog/*`; for Apache/.htaccess that looks like X, for nginx like Y, for static hosts no action"
- ✅ "if the host sits behind a CDN, configure cache purge; if not, skip"
- ❌ "On Prem4, edit the Apache vhost at `/etc/apache2/sites-enabled/...`"
- ❌ "Cloudflare zone IDs go in `cloudflare.zoneId`" (correct: "CDN config goes in `cdn.*` with a `provider` field — Cloudflare is one provider")

Stack-specific quirks discovered during real integrations belong in `.claude/skills/stack-notes/<stack>.md`, never in the universal docs. See `.claude/skills/stack-notes/README.md` for the convention.

One-off handover docs (briefs for a specific job) ARE allowed to be specific — they describe one specific job, not the universal procedure. Keep them out of the index of "files agents should read for general context", and **delete them once the job is done** so stale ones don't accumulate. Lessons learned during the job graduate into CHANGELOG entries, `.claude/skills/stack-notes/<stack>.md` files, or the universal skill itself.

## When adding something to the engine, ask yourself

1. Does this add a hosting/server/CDN-specific assumption to a universal doc? → No, it must not. Refactor to a placeholder + (optional) `stack-notes/<stack>.md` entry.
2. Does this require a new theming knob? → Add it to `TOKEN-CONTRACT.md` first (with a how-to-find-it-on-the-host recipe), then to `tokens.css`, then to the Tailwind preset.
3. Does this add a new file the integration agent must read? → Update the index in [README.md](README.md). The README is the single source of truth for "what every file in this repo is for".
4. Does this need to propagate to existing sites? → Make sure the change lives inside the package (not in per-site templates). Consumer sites should only need `npm update + rebuild`, not template patches.

## Testing changes

Manual for now:

```bash
npm run build      # all packages + demo-site
npm run typecheck  # type errors
```

Browse the demo-site after `npm run build && npm run preview` and check:

- [ ] Index page renders, pagination works
- [ ] Post page renders ToC, related, author, CTA, tags
- [ ] Tag/category/author archives work
- [ ] `/blog/sitemap-index.xml` exists in `dist/`
- [ ] `/blog/rss.xml` exists in `dist/`
- [ ] `/blog/robots.txt` lists the sitemap
- [ ] 404 page exists at `/blog/404/`
- [ ] No console errors

## Pull request hygiene

- One concern per PR
- Update `CHANGELOG.md` under `[Unreleased]`
- If the change is breaking: also update `UPGRADE-GUIDE.md` with a migration section
- If the change is a new component: add an example usage in the demo site
