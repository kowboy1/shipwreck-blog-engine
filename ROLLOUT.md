# Engine Rollout — How Updates Reach Every Site

**Question:** when we fix a bug or ship a feature in `@shipwreck/blog-core`, how does it reach every site we've ever deployed the engine to?

**Answer:** **two complementary paths**, both backed by the same site registry.

| | Pull (default — universal) | Push (optional — our own servers) |
|---|---|---|
| Trigger | Daily cron on the host | CI / manual command |
| Tool on the host | `shipwreck-updater.php` | (none) |
| Tool we run | (none) | `scripts/deploy-blog.mjs` |
| Works on cheap shared cPanel | ✅ | ❌ (needs SSH/SFTP) |
| Works on Prem3/Prem4 | ✅ | ✅ |
| Works on a host we can't SSH into | ✅ | ❌ |
| Engine→host credentials needed | ✅ none (host pulls) | ❌ SSH key per server |
| Median update latency | up to 24h | minutes |
| Setup complexity per site | Low (drop one PHP file + cron) | Medium (configure CI secrets) |

The pull model is the default and the universal answer — it's the one we use everywhere unless there's a reason not to. The push model is an optional fast-path for our own servers when we want a release to ship inside a few minutes.

---

## Path A — Pull (the universal model)

Same architecture as a WordPress plugin pulling updates from GitHub: each site polls daily, sees if there's a new build, downloads itself.

### How it works

```
shipwreck-blog-engine                              ← THE ENGINE (this repo)
  │  - releases tagged vX.Y.Z
  │  - on tag: GH Action fires repository_dispatch → every registered consumer
  ▼
<site>-blog (per-site repo on GitHub)             ← PER-SITE CONTENT REPO
  │  - holds: site.config.ts, tokens.css, SiteShell/, content/posts/, content/authors/
  │  - GH Action: builds blog with latest engine when triggered
  │    Triggers: push to main, repository_dispatch (engine update), or manual
  │  - Output: tarball of dist/ attached to a GitHub Release (this repo's releases)
  ▼
<consumer hosting>                                ← THE HOST (any tier, anywhere)
     - one file: /public_html/shipwreck-updater.php
     - one cron: <RANDOM_MIN> <RANDOM_HOUR_23-02> * * * curl ...?token=...
     - script: read installed version → check repo's latest release →
       if newer, download tarball → atomic swap → optionally purge Cloudflare
```

The host doesn't run Node, doesn't need SSH, doesn't need git. It's PHP + cron — every cPanel ships with both.

### Random cron timing (why it matters)

The installer picks a **random minute (0–59) and a random hour from the low-traffic window {23, 0, 1, 2}** when it sets up the cron line. That gives 240 distinct slots so 100+ sites don't all hit GitHub at the same minute. Once chosen, the time stays fixed (so people know when their cron runs); only re-randomized on reinstall.

### Atomic + rollback-safe

- Updater extracts new version to `<install>.new`
- Renames current `<install>` → `<install>.old.<timestamp>`
- Renames `<install>.new` → `<install>`
- The site is **never broken** — only ever serves a fully-extracted dist
- Last 3 `.old.*` retained; `?action=rollback` reverts to the most recent old

### Security

- Auth via 32-char shared token in a config file **outside the public path** (`~/.shipwreck-updater.config.php`, not under `public_html/`)
- HTTPS-only enforced; refuses `http://` requests
- GitHub release tarball SHA256 verified against the release notes before extract
- No write access to anything except `<install>` and its siblings

### Monitor it

- `?action=status` returns JSON with installed vs latest version
- Add to Uptime Kuma as an HTTP keyword monitor: alert if `"is_current":true` is missing for >7 days
- Per-site update history in `<install>/.update-log` (one JSON line per event)

### Files we ship for this path

- [scripts/shipwreck-updater.php](scripts/shipwreck-updater.php) — the universal updater (drops on the host)
- [scripts/install-updater.sh](scripts/install-updater.sh) — one-shot installer that drops the PHP, generates the token + random cron time, prints next steps
- [.github/workflows/release-dispatch.yml](.github/workflows/release-dispatch.yml) — engine-side: fans out `repository_dispatch` to every registered consumer site repo on engine release
- [templates/site-blog-build.yml](templates/site-blog-build.yml) — copy into a consumer-site repo at `.github/workflows/blog-build.yml` during integration

### One-time setup per new site

```bash
# On the consumer host (cheap cPanel, Prem3, Prem4 — anywhere):
curl -fsSL https://raw.githubusercontent.com/1tronic/shipwreck-blog-engine/main/scripts/install-updater.sh | bash -s -- \
  --release-repo 1tronic/wollongong-weather-blog \
  --install-path /home/wollongongweather.com/public_html/blog \
  --domain wollongongweather.com \
  --cloudflare-zone-id <ZONE_ID> \
  --cloudflare-token <CF_TOKEN>
```

After that, the site is self-updating. Done.

---

## Path B — Push (for our own SSH-capable hosts)

For sites where we control the server (Prem3, Prem4, Ops), we can also push updates directly without waiting for the daily cron. Two reasons we'd want this:

1. **Faster turnaround** — push a fix at 2pm, see it live at 2:05pm, not 11pm tomorrow.
2. **First deploy of a new site** — the host doesn't have the blog yet, so there's nothing for the cron to update.

The push path uses [scripts/deploy-blog.mjs](scripts/deploy-blog.mjs):

```bash
node scripts/deploy-blog.mjs --site wollongong-weather             # build + push
node scripts/deploy-blog.mjs --site wollongong-weather --dry-run   # build + diff only
node scripts/deploy-blog.mjs --all                                  # all rsync sites
```

What it does per site:

1. Build the blog locally (uses local source under `source.localPath/_blog/`)
2. Run [`scripts/visual-diff.mjs`](scripts/visual-diff.mjs) against the live host (with `--diff`)
3. Push `dist/` via rsync (`deploy.method: "rsync"`) or lftp (`deploy.method: "sftp"`)
4. Cloudflare cache purge (if `cloudflare.zoneId` configured)
5. Update `engineVersion` + `lastDeployed` in `.shipwreck/sites.json`

The push path is **complementary**, not a replacement, for the pull path. The same site can have both: cron pulls daily for routine updates, push deploys for urgent fixes. The pull model handles the hands-off long-tail; push handles the immediate.

---

## Site registry

`.shipwreck/sites.json` — single source of truth for every site running the engine.

```json
[
  {
    "name": "wollongong-weather",
    "domain": "wollongongweather.com",
    "blogPath": "/blog",
    "deploy": {
      "method": "pull",
      "fallback": "rsync",
      "server": "prem4",
      "sshHost": "157.173.210.110",
      "sshUser": "nyxi",
      "remotePath": "/home/wollongongweather.com/public_html/blog/"
    },
    "source": {
      "repo": "1tronic/wollongong-weather-blog",
      "localPath": "/home/rick/projects/wollongong-weather",
      "blogSourcePath": "_blog"
    },
    "cloudflare": {
      "zoneId": "<zone-id>",
      "purgeOnDeploy": true
    },
    "engineVersion": "0.3.0",
    "lastDeployed": null,
    "owner": "rick",
    "goldenScreenshots": ".shipwreck/goldens/wollongong-weather/",
    "notes": "Free-form per-site notes — quirks, custom CTAs, etc."
  }
]
```

Field meanings:

- **`deploy.method`** — `"pull"` (default — host runs the updater cron), `"rsync"` (we push via SSH), `"sftp"` (we push via SFTP, no shell), or `"manual"` (we build, you push).
- **`deploy.fallback`** — secondary method available. Lets a site use both: pull as default + rsync for urgent.
- **`deploy.server`** — `prem3` | `prem4` | `ops` | `cloudflare-pages` | `external`. Documentation only — drives nothing automatically.
- **`source.repo`** — the per-site GitHub repo that holds `_blog/` source and runs the build workflow. Required for `deploy.method: "pull"` (the updater pulls releases from this repo).
- **`source.localPath`** — local checkout path used by `deploy-blog.mjs --all`. Optional unless `deploy.method` is `rsync`/`sftp`/`manual`.
- **`engineVersion`** + **`lastDeployed`** — updated automatically by `deploy-blog.mjs` after a successful push. Updated by the consumer build workflow's release tag for pull-deployed sites.
- **`goldenScreenshots`** — path to pinned visual-diff baselines. Captured during integration Phase 6.

---

## Apache + Cloudflare hygiene

Two things to verify when integrating into Prem3/Prem4 or any cPanel host:

1. **Apache vhost (or `.htaccess`) doesn't catch `/blog/*`.** Most WordPress hosts have `RewriteRule . /index.php [L]` which would route `/blog/anything` to WordPress. Add an early skip:
   ```apacheconf
   RewriteRule ^blog/ - [L]
   ```
   or rely on Apache serving the static directory before the rewrite (works in most CyberPanel configs by default).

2. **LiteSpeed/Apache cache rules don't apply to `/blog/*`.** Static blog pages don't need server-side cache. Default behavior is fine; only matters if a site has aggressive `cache.set` rules at the LSCache level — exclude `/blog/*` if so.

3. **Cloudflare cache rule for `/blog/*`** (recommended):
   - Phase: `http_request_cache_settings`
   - When: `(http.request.uri.path matches "^/blog/")`
   - Action: `cache_level=cache_everything`, `edge_ttl=86400`, `browser_ttl=3600`
   - Why safe: it's static HTML/CSS/JS, no auth, no per-user state. The updater purges cache on each push or daily cron update.

The integration skill ([Phase 6](.claude/skills/integrate-shipwreck-blog.md)) runs these checks.

---

## Sequencing (where we are now)

### Done in this work block
- ✅ Page renderers moved into `@shipwreck/blog-core/pages/` — per-site templates are now ~10-line wrappers
- ✅ `shipwreckBlog()` Astro integration auto-wires remark plugins
- ✅ `shipwreck-updater.php` + `install-updater.sh` (universal pull updater)
- ✅ `deploy-blog.mjs` (push deploy for our own servers)
- ✅ `release-dispatch.yml` engine-side fan-out workflow
- ✅ `templates/site-blog-build.yml` per-site build workflow template
- ✅ Site registry schema + bootstrap entry

### Next (after first end-to-end test of pull path)
- Per-site repo template generator (`npx create-shipwreck-blog-site` — scaffolds the per-site repo with config + content collections + build workflow already in place)
- Golden-screenshot capture as part of integration Phase 6
- Uptime Kuma monitor template for the `?action=status` endpoint
- `--rollback-on-diff-fail` flag for `deploy-blog.mjs`

### After site count > 5
- Engine version drift report (which sites are pinned to old versions, why)
- Auto-purge of `.old.*` dirs older than N days (currently last-3 retention is per-update-event)

---

## Repeating this for future engines

The pattern is portable. Any future static-site engine (a leads dashboard generator, a review platform builder, anything) ships the same bag of pieces:

| Engine ships | Why |
| --- | --- |
| Engine source + npm package | Core logic + components |
| `scripts/<engine>-updater.php` | Same pattern, renamed for the engine |
| `scripts/install-updater.sh` | Same pattern, takes engine-specific args |
| `templates/site-build.yml` | Per-site build workflow template |
| `.github/workflows/release-dispatch.yml` | Engine-side fan-out |
| `TOKEN-CONTRACT.md` | If themable |
| `.claude/skills/integrate-<engine>.md` | Agent runbook |
| `.shipwreck/sites.json` (or equivalent registry) | Source of truth |

The blog engine is the prototype. Once this works end-to-end on one site (Nyxi's upcoming integration of wollongong-weather), the same architecture clones to whatever's next.
