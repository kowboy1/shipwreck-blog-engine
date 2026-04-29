# Engine Rollout — How Updates Reach Every Site

**Question:** when we fix a bug or ship a feature in `@shipwreck/blog-core`, how does it reach every site we've ever deployed the engine to?

**Answer:** **two complementary paths**, both backed by the same site registry. The engine is deliberately hosting-, DNS-, and CDN-agnostic — the same architecture works on cheap shared cPanel, OpenLiteSpeed/CyberPanel, dedicated VPS, Cloudflare Pages, Netlify, Vercel, S3+CloudFront, raw nginx, or anywhere else that serves static files.

| | Pull (default — universal) | Push (optional — when we control SSH) |
|---|---|---|
| Trigger | Daily cron on the host | CI / manual command |
| Tool on the host | `shipwreck-updater.php` | (none) |
| Tool we run | (none) | `scripts/deploy-blog.mjs` |
| Works on cheap shared cPanel | ✅ | ❌ (needs SSH/SFTP) |
| Works on a dedicated VPS we own | ✅ | ✅ |
| Works on a host we can't SSH into | ✅ | ❌ |
| Works on PHP-less static hosts (Cloudflare Pages, Netlify, Vercel) | ⚠️ N/A — those auto-redeploy from git | ✅ via their build hook (or skip and let the platform redeploy) |
| Engine→host credentials needed | none (host pulls) | SSH key per server |
| Median update latency | up to 24h | minutes |
| Setup complexity per site | Low (drop one PHP file + cron) | Medium (configure CI secrets) |

The pull model is the default and the universal answer — it's the one we use everywhere unless there's a specific reason not to. The push model is an optional fast-path for hosts we control.

---

## Path A — Pull (the universal model)

Same architecture as a WordPress plugin pulling updates from GitHub: each site polls daily, sees if there's a new build, downloads itself.

### How it works

```
shipwreck-blog-engine                              ← THE ENGINE (this repo)
  │  - releases tagged vX.Y.Z
  │  - on tag: GH Action fires repository_dispatch → every registered consumer
  ▼
<site>-blog (per-site source repo)                ← PER-SITE CONTENT REPO
  │  - holds: site.config.ts, tokens.css, SiteShell/, content/posts/, content/authors/
  │  - CI: builds blog with latest engine when triggered
  │    Triggers: push to main, repository_dispatch (engine update), or manual
  │  - Output: tarball of dist/ attached to a GitHub Release
  ▼
<consumer hosting>                                ← THE HOST (any tier, anywhere)
     - one file: <docroot>/shipwreck-updater.php
     - one cron: <RANDOM_MIN> <RANDOM_HOUR_23-02> * * * curl ...?token=...
     - script: read installed version → check repo's latest release →
       if newer, download tarball → atomic swap → optionally purge CDN cache
```

The host doesn't run Node, doesn't need SSH, doesn't need git. It's PHP + cron — every cPanel-style host ships with both, and most VPS hosts have them too.

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
- Add to any uptime monitor as an HTTP keyword check: alert if `"is_current":true` is missing for >7 days
- Per-site update history in `<install>/.update-log` (one JSON line per event)

### Files we ship for this path

- [scripts/shipwreck-updater.php](scripts/shipwreck-updater.php) — the universal updater (drops on the host)
- [scripts/install-updater.sh](scripts/install-updater.sh) — one-shot installer that drops the PHP, generates the token + random cron time, prints next steps
- [.github/workflows/release-dispatch.yml](.github/workflows/release-dispatch.yml) — engine-side: fans out `repository_dispatch` to every registered consumer site repo on engine release
- [templates/site-blog-build.yml](templates/site-blog-build.yml) — copy into a consumer-site repo at `.github/workflows/blog-build.yml` during integration

### One-time setup per new site

```bash
# On the consumer host (any platform with shell access — VPS, cPanel terminal, WHM root):
curl -fsSL https://raw.githubusercontent.com/<engine-org>/shipwreck-blog-engine/main/scripts/install-updater.sh | bash -s -- \
  --release-repo <git-org>/<site-name>-blog \
  --install-path /home/<domain>/public_html/blog \
  --domain <domain> \
  --cloudflare-zone-id <ZONE_ID> \
  --cloudflare-token <CF_TOKEN>
```

The `--cloudflare-*` flags are optional. Omit them if the host doesn't sit behind Cloudflare; the updater still works, it just skips cache purging. Equivalent flags can be added in the future for other CDNs (Fastly, BunnyCDN, etc.).

After this runs, the site is self-updating. Done.

---

## Path B — Push (when we control SSH/SFTP)

For hosts where we have SSH/SFTP and want sub-minute deploy latency, we can push directly without waiting for the daily cron. Two reasons we'd want this:

1. **Faster turnaround** — push a fix at 2pm, see it live at 2:05pm, not at the random cron time tomorrow.
2. **First deploy of a new site** — the host doesn't have any blog yet, so there's nothing for the cron to update.

The push path uses [scripts/deploy-blog.mjs](scripts/deploy-blog.mjs):

```bash
node scripts/deploy-blog.mjs --site <site-name>             # build + push
node scripts/deploy-blog.mjs --site <site-name> --dry-run   # build + diff only
node scripts/deploy-blog.mjs --all                          # all push-eligible sites
```

What it does per site:

1. Build the blog locally (uses local source under `source.localPath/_blog/`)
2. Run [`scripts/visual-diff.mjs`](scripts/visual-diff.mjs) against the live host (with `--diff`)
3. Push `dist/` via rsync (`deploy.method: "rsync"`) or lftp (`deploy.method: "sftp"`)
4. CDN cache purge (if `cloudflare.zoneId` or equivalent CDN config is set on the registry entry)
5. Update `engineVersion` + `lastDeployed` in `.shipwreck/sites.json`

The push path is **complementary**, not a replacement, for the pull path. The same site can have both: cron pulls daily for routine updates, push deploys for urgent fixes. The pull model handles the hands-off long-tail; push handles the immediate.

---

## Site registry

`.shipwreck/sites.json` — single source of truth for every site running the engine. Schema:

```json
[
  {
    "name": "<site-name>",
    "domain": "<domain>",
    "blogPath": "/blog",
    "deploy": {
      "method": "pull",
      "fallback": "rsync",
      "stack": "cpanel-litespeed",
      "sshHost": "<ip-or-hostname>",
      "sshUser": "<user>",
      "remotePath": "/home/<domain>/public_html/blog/"
    },
    "source": {
      "repo": "<git-org>/<site-name>-blog",
      "localPath": "/path/to/local/checkout",
      "blogSourcePath": "_blog"
    },
    "cdn": {
      "provider": "cloudflare",
      "zoneId": "<zone-id>",
      "purgeOnDeploy": true
    },
    "engineVersion": "0.3.1",
    "lastDeployed": null,
    "owner": "<who-maintains-this>",
    "goldenScreenshots": ".shipwreck/goldens/<site-name>/",
    "notes": "Free-form per-site notes — quirks, custom CTAs, stack peculiarities."
  }
]
```

Field meanings:

- **`deploy.method`** — `"pull"` (host runs the updater cron — default), `"rsync"` (we push via SSH), `"sftp"` (we push via SFTP), or `"manual"` (we build, owner uploads).
- **`deploy.fallback`** — secondary method available. Lets a site use both: pull as default + rsync for urgent.
- **`deploy.stack`** — free-form label identifying the host's stack (`cpanel-litespeed`, `cyberpanel-openlitespeed`, `nginx-php-fpm`, `apache-modphp`, `cloudflare-pages`, `netlify`, etc.). Matches a file in `.claude/skills/stack-notes/<stack>.md` if one has been written.
- **`source.repo`** — the per-site git repo that holds `_blog/` source and runs the build workflow. Required for `deploy.method: "pull"` (the updater pulls releases from this repo).
- **`cdn.provider`** — `"cloudflare"` | `"fastly"` | `"bunny"` | `"cloudfront"` | `"none"` | etc. Drives the optional cache-purge step.
- **`engineVersion`** + **`lastDeployed`** — updated automatically by `deploy-blog.mjs` after a successful push, or by the consumer build workflow's release tag for pull-deployed sites.

---

## Webserver hygiene (any host)

Two things to verify when integrating, regardless of stack:

1. **The webserver doesn't intercept `/blog/*`.** Any host running an apex CMS (WordPress, Drupal, Ghost, etc.) typically has a rewrite that catches every path. The blog is a static directory — let the webserver serve it directly.
   - **Apache / OpenLiteSpeed (`.htaccess`):** add `RewriteRule ^blog/ - [L]` above the framework rules
   - **nginx:** add a `location /blog/ { try_files $uri $uri/ =404; }` block before the framework's catch-all
   - **Cloudflare Pages / Netlify / Vercel / static hosts:** no action needed
   - Test with `curl -I https://<domain>/blog/` — should return `200` once the install path has any file in it

2. **No upstream caching layer should break the dist swap.** Static blog pages don't need server-side cache (they're already static). If the host has aggressive `cache.set` rules at the webserver level (LiteSpeed Cache, Varnish, etc.), exclude `/blog/*` from them — the blog dist swap is atomic but the webserver-level cache wouldn't know that.

3. **CDN cache rule for `/blog/*` (optional, recommended if there's a CDN).** Static HTML/CSS/JS, no auth, no per-user state — aggressive edge-caching is safe.
   - **Cloudflare:** Cache Rule, phase `http_request_cache_settings`, when `(http.request.uri.path matches "^/blog/")`, action `cache_level=cache_everything`, `edge_ttl=86400`.
   - **Other CDNs:** equivalent rule (path prefix match, long edge TTL)
   - **No CDN:** skip — the host serves directly.

The integration skill ([Phase 6](.claude/skills/integrate-shipwreck-blog.md)) walks through these checks per integration.

---

## Stack-specific notes

The integration skill is universal. As we encounter new stacks during real integrations, we record stack-specific quirks in `.claude/skills/stack-notes/<stack>.md` so future integrations on the same stack benefit. See [.claude/skills/stack-notes/README.md](.claude/skills/stack-notes/README.md) for the convention.

---

## Sequencing (where we are now)

### Done
- ✅ Page renderers in `@shipwreck/blog-core/pages/` — per-site templates are ~10-line wrappers
- ✅ `shipwreckBlog()` Astro integration auto-wires remark plugins
- ✅ `shipwreck-updater.php` + `install-updater.sh` (universal pull updater)
- ✅ `deploy-blog.mjs` (push deploy for SSH-capable hosts)
- ✅ `release-dispatch.yml` engine-side fan-out workflow
- ✅ `templates/site-blog-build.yml` per-site build workflow template
- ✅ Site registry schema + bootstrap entry
- ✅ Token contract + integration skill + post-add skill + extract-theme + visual-diff
- ✅ Stack-notes directory convention

### Next (after first end-to-end test of pull path on a real production host)
- Per-site repo template generator (`npx create-shipwreck-blog-site` — scaffolds the per-site repo with config + content collections + build workflow already in place)
- Golden-screenshot capture as part of integration Phase 6
- Uptime monitor template for the `?action=status` endpoint
- `--rollback-on-diff-fail` flag for `deploy-blog.mjs`

### After site count > 5
- Engine version drift report (which sites are pinned to old versions, why)
- Auto-purge of `.old.*` dirs older than N days

---

## Repeating this for future engines

The pattern is portable. Any future static-site engine ships the same bag of pieces:

| Engine ships | Why |
| --- | --- |
| Engine source + npm package | Core logic + components |
| `scripts/<engine>-updater.php` | Same pattern, renamed for the engine |
| `scripts/install-updater.sh` | Same pattern, takes engine-specific args |
| `templates/site-build.yml` | Per-site build workflow template |
| `.github/workflows/release-dispatch.yml` | Engine-side fan-out |
| `TOKEN-CONTRACT.md` | If themable |
| `.claude/skills/integrate-<engine>.md` | Agent runbook |
| `.claude/skills/stack-notes/` | Per-stack quirks accumulated over time |
| `.shipwreck/sites.json` (or equivalent registry) | Source of truth |

The blog engine is the prototype. Once a single end-to-end production deploy works, the same architecture clones to whatever's next.
