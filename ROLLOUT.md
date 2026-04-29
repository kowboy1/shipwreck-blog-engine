> ⚠️ **STOP** — if you are an agent and havent read [AGENTS.md](AGENTS.md) yet, read that first.
> This file is referenced FROM the agent runbook in `AGENTS.md`, not a starting point.
> Continue here only if `AGENTS.md` routed you to this file.

# Engine Rollout — How Updates Reach Every Site

**The blog is static HTML. How it gets to the host is whatever the host already does for everything else.**

The engine doesn't impose a deploy mechanism. There is no separate per-site blog repo, no daily cron, no self-updater PHP, no GitHub-Actions fan-out. Each host site already has a way to publish files (rsync, FTP, cPanel File Manager, push-to-Cloudflare-Pages, Netlify, GitHub-Pages-from-host-repo, custom Docker pipeline, whatever) — the blog dist tarball is just files. Use the existing mechanism.

---

## What an integration produces

```
<host-site>/                                   ← existing host repo / filesystem
  ...host site source...
  _blog/                                       ← BLOG SOURCE (where the user wants it)
    site.config.ts
    src/styles/tokens.css                      ← host-themed tokens (Phase 2)
    src/components/SiteShell/Header.astro      ← host-ported header (Phase 3)
    src/components/SiteShell/Footer.astro
    src/content/posts/*.mdx                    ← real content (no demo posts)
    package.json                               ← engine deps via file:/git
    ...

<host-docroot>/blog/                           ← BUILT OUTPUT (what gets served)
  index.html
  <slug>/index.html (per post)
  _astro/*.css
  sitemap-index.xml
  rss.xml
  admin/...
```

The `_blog/` source can live:
- Inside the host site's git repo (typical when host is on GitHub/GitLab/etc.) — commit it alongside the rest
- In a sibling directory (typical when host has no git)
- Anywhere the agent decides makes sense for that host

The built `dist/` always goes to `<host-docroot>/blog/`.

---

## How updates propagate

For each site, on each engine release:

1. **Bump engine deps** in the site's `_blog/package.json`:
   ```json
   "@shipwreck/blog-core": "<new-version-spec>",
   "@shipwreck/blog-theme-default": "<new-version-spec>"
   ```
2. **Rebuild:** `cd _blog && npm install && npm run build`
3. **Deploy via the host's existing mechanism** — push the new `dist/` to wherever the host serves `/blog/`. Some examples:
   - Host on Cloudflare Pages with auto-deploy from git: commit + push, pages re-deploys
   - Host on Netlify/Vercel/GitHub Pages: same — auto-deploy picks it up
   - Host on cPanel/VPS with SSH: rsync `dist/` to `/home/<domain>/public_html/blog/`
   - Host on cheap shared cPanel without SSH: SFTP or cPanel File Manager upload
4. **Verify:** `npx shipwreck-blog-doctor --final --phase9-confirmed --feedback-status=...`

That's it. No central infrastructure, no daily polling, no tokens, no cron.

---

## Why this is a deliberate simplification

Previous versions of this engine had:
- A per-site `<site>-blog` GitHub repo
- A `shipwreck-updater.php` cron-polled script on the host
- A `release-dispatch.yml` workflow on the engine repo that fired `repository_dispatch` events to N consumer repos
- A `templates/site-blog-build.yml` that consumer repos used to build + publish releases

That architecture solved a problem we don't actually have: **"updating an unmanaged host."** Every site we care about already has a deploy mechanism (it's how the host got there in the first place). Reusing that mechanism is simpler and removes ~5 moving parts per integration.

Reverted in v0.3.5. The engine has fewer components, the integration skill has fewer phases, and the per-site overhead is roughly half.

---

## Optional helpers

A few scripts remain for cases where they're convenient — none are required:

- [scripts/deploy-blog.mjs](scripts/deploy-blog.mjs) — convenience helper for SSH-capable hosts; builds locally then rsyncs to a configured remote. Not load-bearing — equivalent to running `npm run build && rsync` yourself. Use only if it saves you typing.
- [scripts/extract-theme.mjs](scripts/extract-theme.mjs) — Playwright tool that visits a host URL and emits a draft `tokens.css`. Use during Phase 2.
- [scripts/visual-diff.mjs](scripts/visual-diff.mjs) — region-by-region pixel diff between host and blog. Use during Phase 5.
- [scripts/test-integration.sh](scripts/test-integration.sh) — full simulation of a clean install on a tmp dir. Used by CI; useful locally to catch regressions.

---

## Site registry

`.shipwreck/sites.json` tracks which sites are running which engine version. The schema is intentionally minimal:

```json
[
  {
    "name": "<site-name>",
    "domain": "<domain>",
    "blogPath": "/blog",
    "blogSourcePath": "<absolute or relative path to _blog/ source>",
    "engineVersion": "0.3.5",
    "lastDeployed": "2026-04-29T...",
    "owner": "<who-maintains>",
    "notes": "Free-form per-site notes — quirks, custom CTAs, integration date, etc."
  }
]
```

The registry isn't load-bearing for any automation — it's a list of "sites we have running the engine, so we can ping them when bumping versions." Update it during integration Phase 8.

---

## Webserver hygiene (any host)

When integrating, two things to verify regardless of stack:

1. **The webserver doesn't intercept `/blog/*`.** Any host running an apex CMS (WordPress, Drupal, Ghost, etc.) typically has a rewrite that catches every path. The blog is a static directory — let the webserver serve it directly.
   - Apache/.htaccess: add `RewriteRule ^blog/ - [L]` above framework rules
   - nginx: add `location /blog/ { try_files $uri $uri/ =404; }` before the catch-all
   - Cloudflare Pages / Netlify / Vercel: no action needed
   - Test: `curl -I https://<domain>/blog/` returns 200

2. **CDN cache rule for `/blog/*`** (optional, recommended if there's a CDN). Static HTML/CSS/JS, no auth, no per-user state — aggressive edge-caching is safe. Set a long edge-TTL and a long browser-TTL with cache_everything. The cache gets purged whenever the next deploy happens via the host's normal mechanism.

The integration skill ([Phase 6/7](.claude/skills/integrate-shipwreck-blog.md)) walks through these.

---

## Stack-specific notes

The integration skill is universal. As we encounter new stacks during real integrations, we record stack-specific quirks in `.claude/skills/stack-notes/<stack>.md` so future integrations on the same stack benefit. See [.claude/skills/stack-notes/README.md](.claude/skills/stack-notes/README.md) for the convention.

---

## Repeating this for future engines

The simplified pattern is portable. Any future static-site engine (a leads dashboard generator, a review platform builder, anything) ships:

- Engine source (npm-style packages with components, helpers, schemas, page renderers)
- A doctor preflight script
- An integration skill (`.claude/skills/integrate-<engine>.md`)
- A token contract (if themable)
- Optional helpers (theme extractor, visual diff, deploy convenience)

That's it. No per-site repos. No central polling infrastructure. The host site's existing deploy mechanism does the work.
