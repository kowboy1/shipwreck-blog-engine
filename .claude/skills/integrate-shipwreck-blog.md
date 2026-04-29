---
description: Integrate the Shipwreck Blog Engine into a host site. Triggers when the user says "add the blog", "install shipwreck blog", "drop the blog into <site>", or sets up `@shipwreck/blog-core` for a new property. Produces a themed, building blog at /blog/ that visually matches the host AND is self-updating (pulls new engine releases via daily cron).
---

# Skill — Integrate Shipwreck Blog into a Host Site

You are integrating `@shipwreck/blog-engine` into a host site. The end state:

1. A **per-site GitHub repo** (e.g. `1tronic/wollongong-weather-blog`) holds the blog source — site config, theme tokens, SiteShell, content/posts, content/authors. A GitHub Action there builds the static blog and publishes a tarball to GitHub Releases on every engine update.
2. The **host site server** has `shipwreck-updater.php` + a daily cron that pulls the latest release tarball and atomically swaps it into `<docroot>/blog/`.
3. The blog is **themed to look native** to the host site and **self-updates** without any further action from us.

**Don't improvise.** Follow the procedure. Every phase has an output you can verify. If a verification fails, fix that phase before moving on.

---

## Inputs you need from the user before starting

1. **Host site name and domain** (e.g. "Wollongong Weather", `wollongongweather.com`)
2. **Server the host runs on** — Prem3, Prem4, Cloudflare Pages, or external (cheap shared cPanel, etc.)
3. **Where the blog mounts** — usually `/blog/`. **This is locked in for the life of the site** — internal links bake it in, so moving it later breaks every blog URL. Confirm with the user before proceeding if it's anything other than `/blog/`.
4. **Cloudflare zone ID** for the domain (look it up in the Cloudflare dashboard) — needed for cache purge after updates
5. **Whether a per-site GitHub repo exists** for the blog source (if not, you'll create one in Phase 1)
6. **Where the host site's main nav lives** (which file or component) — needed in Phase 7 to add a "Blog" entry
7. **Where the host site's footer lives** (which file or component) — needed in Phase 7 to add a "Blog" link

If any are missing, ask. Don't guess.

---

## Choose a deploy mode FIRST (before any phases)

The integration runs in one of three modes. Pick before starting Phase 1 — they branch the runbook in different places.

### Mode A — Full production deploy (default)

The site lives on a real production server (Prem3, Prem4, cheap shared cPanel, anywhere with SSH/SFTP/HTTP). Self-update via `shipwreck-updater.php` + cron pulling from a per-site GitHub repo's releases.

**Use when:** integrating into a live client site that's actually deployed somewhere we control or have access to.

**Includes:** all 9 phases. Cloudflare zone setup, GH per-site repo, GH Actions, host-side updater install, cron, Uptime Kuma monitor.

### Mode B — Local-dev integration (no remote, no Cloudflare, no GH workflow)

The site is being developed locally — usually on `/home/rick/projects/<site>/`, often served via a Cloudflare Tunnel or local dev server (e.g. `python3 -m http.server`). No real production deploy yet. We just need the blog rendering correctly inside the local site so the user can iterate before going live.

**Use when:** the user says "set this up locally", "just integrate it for dev", "I'll deploy later", or the host site isn't on a production server yet.

**Skip these phases:**
- Phase 1's `gh repo create` step — keep the per-site source as a local directory, no remote
- Phase 6's host-side installer (`install-updater.sh`) — no remote host to install on
- Phase 6's "trigger first update via curl" step
- Phase 8's Uptime Kuma monitor

**Replace with:**
- Build the blog source locally with `npm run build`
- Copy `_blog/dist/` to `<host-site>/blog/` (or whatever subpath the local server serves from)
- Document the build-and-copy command in the per-site repo's README so it's reproducible

**Run mostly normally:**
- Phases 2 (tokens), 3 (SiteShell), 4 (CTAs), 5 (visual verification), 7 (host wiring — footer link, optional nav, robots.txt) all still apply
- Phase 8 still register in `.shipwreck/sites.json` but with `deploy.method: "manual"` and a note that it's local-dev only

When the site is ready to go live later, re-enter the runbook at Phase 6 (production deploy) — the per-site source is already done, just needs a GH repo + the updater install.

### Mode C — Hand-off / external host

The site is on a third-party host we don't control (client's own server, GoDaddy, etc.). We build the dist tarball; the client uploads it.

**Use when:** the user explicitly says "we don't have access to that host" or the integration is for a site outside our hosting fleet.

**Phases:** 1, 2, 3, 4, 5, 7 (host wiring done by client), 8 (registry only, no monitor). Phase 6 produces the tarball and a one-page upload-instructions doc; the client takes it from there.

---

If unclear which mode applies, **ask the user**: "Is this going to a production server we'll deploy to, or just local dev for now?"

---

## Critical model concept (read before Phase 1)

Two repos, kept separate:

- **Host site repo** (e.g. `1tronic/wollongong-weather`): the existing live website. The blog is **NOT installed here**. The only changes you make to this repo are: a footer link, a nav link, and optionally a `robots.txt` reference to the blog sitemap. **Do not** add `_blog/` here. **Do not** add `_blog/node_modules` to its `.gitignore`. **Do not** put any blog Astro source here.
- **Per-site blog repo** (e.g. `1tronic/wollongong-weather-blog`): a SEPARATE GitHub repo containing only the blog source. Its GH Action builds + publishes release tarballs that the host's `shipwreck-updater.php` pulls.

If you find yourself committing to the host repo for anything other than the footer/nav/robots integration in Phase 7, **stop** — you're in the wrong place.

---

## Phase 1 — Create the per-site blog repo

Each blog deployment needs its own GitHub repo for the source. Why a separate repo (not just a directory in the host site's repo): the consumer-site GH Action publishes its own releases, which the host pulls from. Decoupling content from the live site repo keeps deploys clean.

```bash
# Locally:
mkdir -p ~/projects/<site-name>-blog
cd ~/projects/<site-name>-blog
git init -b main

# Copy the demo-site contents into _blog/ (the workflow + skill assume this layout)
mkdir -p _blog
cp -r <path-to>/shipwreck-blog-engine/examples/demo-site/. _blog/

# Copy the per-site build workflow template (Mode A only — skip in Mode B local-dev)
mkdir -p .github/workflows
cp <path-to>/shipwreck-blog-engine/templates/site-blog-build.yml .github/workflows/blog-build.yml
```

### Fix engine package dep specifiers

The demo-site's `_blog/package.json` ships with `file:../../packages/...` paths that resolve correctly inside the engine monorepo, but **break in a per-site sibling repo**. Update them to point at the local engine checkout:

```diff
   "dependencies": {
-    "@shipwreck/blog-core": "file:../../packages/blog-core",
-    "@shipwreck/blog-theme-default": "file:../../packages/blog-theme-default",
+    "@shipwreck/blog-core": "file:../../shipwreck-blog-engine/packages/blog-core",
+    "@shipwreck/blog-theme-default": "file:../../shipwreck-blog-engine/packages/blog-theme-default",
```

Once the engine is published to npm (or a private GitHub Packages registry), switch these to versioned specifiers:

```json
"@shipwreck/blog-core": "^0.3.0",
"@shipwreck/blog-theme-default": "^0.3.0",
```

(Until then, the `file:` path is the canonical install method and works for both local dev and CI builds where the engine repo is checked out alongside.)

**Edit `_blog/site.config.ts`** with the user's inputs:

```ts
import type { SiteConfig } from "@shipwreck/blog-core"

const config: SiteConfig = {
  siteName: "<SITE_NAME>",
  baseUrl: "<BASE_URL>",
  blogBasePath: "/blog",
  brand: {
    organizationName: "<SITE_NAME>",
    logoUrl: "/assets/logo.svg",
  },
  seo: {
    defaultOgImage: "<BASE_URL>/assets/og-image.png",
    locale: "en_AU",
  },
  layout: {
    postsPerPage: 10,
    showReadingTime: true,
    showAuthor: true,
    showTableOfContents: true,
    showRelatedPosts: true,
    relatedPostsCount: 3,
  },
  ctaBlocks: { default: "default" },
}
export default config
```

Push the repo to GitHub:
```bash
gh repo create 1tronic/<site-name>-blog --private --source=. --remote=origin --push
```

**Verify Phase 1:**
```bash
cd _blog && npm install && npm run dev
# open http://localhost:4321/blog/ — should render unstyled blog with demo MDX post
```

---

## Phase 2 — Extract host design tokens

You're filling out [TOKEN-CONTRACT.md](../../packages/blog-theme-default/TOKEN-CONTRACT.md). The contract enumerates every theming token the engine exposes — your job is to fill each with a host-correct value.

### 2a — Source the values

Pick the highest-fidelity source available, in this order:

1. **Host repo Tailwind config** — read `theme.extend.colors`, `fontFamily`, `borderRadius`. Best signal.
2. **Host CSS custom properties** — grep for `:root` and `--color-*` / `--font-*` in any global CSS.
3. **Host computed styles via browser** — if no repo access, run [extract-theme.mjs](../../scripts/extract-theme.mjs):
   ```bash
   node scripts/extract-theme.mjs https://<host-domain> > _blog/src/styles/tokens.draft.css
   ```
   Heuristics are best-effort; review every value before committing.

### 2b — Write `_blog/src/styles/tokens.css`

Use the [TOKEN-CONTRACT skeleton](../../packages/blog-theme-default/TOKEN-CONTRACT.md#where-to-write-the-values) as the template. Fill **every** token — leaving one at the engine default when the host has a different value is a visible mismatch.

Ensure it loads in `_blog/src/layouts/BaseLayout.astro`:
```astro
---
import "../styles/tokens.css"
import "../styles/global.css"
---
```

### 2c — Validate every token

Run through the [Validation checklist](../../packages/blog-theme-default/TOKEN-CONTRACT.md#validation-checklist). Every item must be ✓.

---

## Phase 3 — Port the SiteShell (header + footer)

Copy the host's existing header/footer markup into:
- `_blog/src/components/SiteShell/Header.astro`
- `_blog/src/components/SiteShell/Footer.astro`

**Conversion rules:**
- React/Vue/Nuxt → Astro: `className` → `class`, no JSX expressions, no framework `<Link>` — use plain `<a>`
- Drop client-only state (search bars, login buttons) unless the blog needs them
- Keep all nav menu items intact
- Add a "Blog" link to the nav if not present
- Preserve all utility classes verbatim — Phase 2 tokens make them resolve correctly

If the host loads Google Fonts via `<link>` in `<head>`, port the same `<link>` into `_blog/src/layouts/BaseLayout.astro` `<head>`.

---

## Phase 4 — Custom CTAs (optional)

If the host has a primary CTA the blog should reuse, create `_blog/src/components/cta/<CtaName>.astro` and register it in `site.config.ts`:

```ts
ctaBlocks: {
  default: "<cta-name>",
  categoryOverrides: {
    "category-slug": "<other-cta-name>",
  },
}
```

Buttons read tokens (`--button-bg`, `--button-radius`, etc.), so they should match host visuals automatically once Phase 2 is done.

---

## Phase 5 — Build & visual verification

```bash
cd _blog
npm install
npm run build
```

Output goes to `_blog/dist/`. Then verify:

```bash
# Start preview server
npx astro preview --host 0.0.0.0 --port 4322 &

# Diff against host
node scripts/visual-diff.mjs https://<host-domain>/ http://localhost:4322/blog/
```

Any region with >5% pixel diff fails. Fix tokens, rebuild, re-verify. Manual sanity check at minimum:

- [ ] Header looks identical to host (logo, nav, spacing, colors)
- [ ] Footer looks identical
- [ ] Inline link in a blog post matches host link color + hover
- [ ] H1 font matches host H1 (family, weight, tracking)
- [ ] Body text matches host body (family, size, line-height, color)
- [ ] Primary CTA button matches host's most prominent CTA
- [ ] Card border-radius matches host card style
- [ ] No engine-default colors leaking through

**Capture goldens** — once visual verification passes, capture screenshots of the live blog preview as the regression baseline:
```bash
mkdir -p .shipwreck/goldens/<site-name>/
# (capture script TBD — for now, save manual screenshots of post page, index, tag page)
```

---

## Phase 6 — Deploy & enable self-update

Commit and push the **per-site blog repo** (NOT the host site repo — see "Critical model concept" at the top). The included GH Action will build automatically on push and create a `blog-dist.tar.gz` release.

```bash
cd ~/projects/<site-name>-blog
git add -A
git commit -m "feat: initial blog scaffold for <site-name>"
git push -u origin main
```

Wait for the GH Action to complete (~2 min). Verify a release was published on the per-site repo's GitHub Releases page with the tarball asset.

### Pre-host-side setup (do these BEFORE running the installer)

These prevent the very common "first update succeeds but `/blog/` returns 404 or a WordPress page" failure mode:

1. **Pre-create the install directory** (some cheap cPanel hosts won't let the updater `mkdir` arbitrary paths the first time):
   ```bash
   ssh user@<server>
   mkdir -p /home/<domain>/public_html/blog
   ```

2. **Add `.htaccess` rewrite skip BEFORE installing the updater.** If the host serves WordPress (or any framework) at the apex, the existing `.htaccess` likely has `RewriteRule . /index.php [L]` which would catch `/blog/*` requests. Add this **above** any framework rules in the host's `.htaccess`:
   ```apacheconf
   # Static blog mount — let Apache serve files directly
   RewriteRule ^blog/ - [L]
   ```
   Test with `curl -I https://<domain>/blog/` — should return `200` (not `404` from WordPress) once the install path has any file in it.

3. **Cloudflare cache rule for `/blog/*`** — recommended add. Phase: `http_request_cache_settings`. When: `(http.request.uri.path matches "^/blog/")`. Action: `cache_level=cache_everything`, `edge_ttl=86400`. The updater purges cache on each successful update.

### Run the one-shot installer

```bash
# SSH into the host (Prem3/Prem4/cPanel/anywhere with shell access)
# For shell-less cPanel tiers, run install-updater.sh from your machine and SFTP the
# resulting shipwreck-updater.php + config; or use cPanel's terminal feature if available.

curl -fsSL https://raw.githubusercontent.com/1tronic/shipwreck-blog-engine/main/scripts/install-updater.sh | bash -s -- \
  --release-repo 1tronic/<site-name>-blog \
  --install-path /home/<domain>/public_html/blog \
  --domain <domain> \
  --cloudflare-zone-id <ZONE_ID> \
  --cloudflare-token <CF_API_TOKEN>
```

The installer:
1. Downloads `shipwreck-updater.php` to the host's `public_html/`
2. Generates a 32-char random token and writes the config to `~/.shipwreck-updater.config.php` (above public_html, never web-served)
3. Picks a random update minute (0–59) + random hour (23/00/01/02) so this site doesn't poll GitHub at the same minute as every other site
4. Adds the cron line (with `-m 60` curl timeout — sufficient for tarball download; don't drop below `30`)
5. Prints the resulting status URL + manual-trigger URL

**Trigger the first update manually** to seed `/blog/`:
```bash
curl "https://<domain>/shipwreck-updater.php?token=<TOKEN_FROM_INSTALLER_OUTPUT>"
# expect: {"ok":true,"updated":true,"from":null,"to":"<engine-version>"}
```

Verify in the browser: `https://<domain>/blog/` should now render. If it 404s, recheck the `.htaccess` rewrite skip from step 2 above.

---

## Phase 7 — Wire the blog into the host site

This is the step that makes the blog **discoverable**. Without it, the blog is technically live but invisible — no link from anywhere on the host site to `/blog/`.

You're editing the **host site repo** (NOT the per-site blog repo). These are the only host-repo edits the integration should ever make:

### 7a — Footer link (required)

Open the host site's footer file/component (the user told you where in the inputs phase). Add a "Blog" link near other footer nav links (Privacy, Terms, etc.). Use the host's existing footer link styling — copy the surrounding markup pattern. Example for a static HTML host:

```html
... &middot; <a href="/blog/" class="footer-link">Blog</a> &middot; ...
```

For a React/Vue/Astro host, follow the host's component patterns. Don't add new styles — match what's there.

**Verify:** load the host homepage in a browser, scroll to footer, see "Blog" link, click it → `/blog/` loads correctly.

### 7b — Main nav link (ask the user)

Some sites want "Blog" in the main nav, some prefer footer-only. Ask:

> "Want to add a 'Blog' link to the main nav on the homepage as well? Some sites prefer footer-only to keep the nav clean."

If yes: open the host's nav file/component, add the link in the host's existing nav-item style. Place it sensibly — usually after content nav items, before any login/CTA buttons. Verify in browser.

### 7c — `robots.txt` reference to blog sitemap (recommended)

The blog auto-generates `/blog/sitemap-index.xml` listing every post. Add it to the host's `robots.txt` so search engines find it:

```
Sitemap: https://<domain>/blog/sitemap-index.xml
```

(Place at the bottom of `robots.txt` alongside any existing `Sitemap:` lines.)

### 7d — Skip these unless the user asks

These are NOT default integration tasks — only do them if Phase 9 questions trigger them:

- Latest-3-posts callout on the homepage (requires fetching `/blog/posts.json` at host build time)
- RSS link in footer pointing at `/blog/rss.xml`
- Cross-linking individual blog posts from other host pages

---

## Phase 8 — Register & monitor

1. **Add to site registry.** Edit `<engine-repo>/.shipwreck/sites.json`, append the new site entry. Set `engineVersion` to the version that's installed (read from `https://<domain>/shipwreck-updater.php?token=…&action=status`). Commit + push the engine repo.

2. **Add an Uptime Kuma monitor** for the status endpoint:
   - URL: `https://<domain>/shipwreck-updater.php?token=<TOKEN>&action=status`
   - Type: HTTP keyword
   - Keyword: `"is_current":true`
   - If the keyword goes missing for >7 days, the site has fallen behind on updates — alert.

3. **Update `D:/NyXi's Vault/Topics/<SiteName>.md`** with:
   - Engine version installed
   - Theme integration date
   - Custom CTAs added
   - Per-site quirks (host-specific fonts, dark-mode, .htaccess gotchas)
   - Reference to the per-site blog repo

---

## Phase 9 — Post-install integration questions (ASK the user)

After verifying the blog is live and themed correctly, ask the user about optional integrations. **Don't assume** — present each as a question. The user may want some, none, or all:

1. **"Want a 'Latest 3 posts' callout on the homepage?"**
   The blog publishes `/blog/posts.json` listing every post. We can wire a small fetch into the host's homepage build that pulls the most recent 3 and renders them as cards. If yes, ask where on the homepage they should appear.

2. **"Want an RSS feed link in the footer pointing to `/blog/rss.xml`?"**
   The blog auto-generates RSS. Adding a discoverable link helps RSS readers + some AI crawlers find it.

3. **"Should I submit `https://<domain>/blog/sitemap-index.xml` to Google Search Console?"**
   If the user has the GSC property already verified, you can do this through GSC API or just give them the URL to add manually. Same for Bing Webmaster Tools.

4. **"Are there specific host pages that should cross-link to specific blog posts?"**
   E.g., for wollongong-weather, the suburb pages might reference relevant blog posts ("See our guide on East Coast Lows" on the Thirroul page). Get a list, then either edit the host repo or note for later.

5. **"Want me to set up a content-writer onboarding doc for whoever writes posts going forward?"**
   Points them at the `add-shipwreck-blog-post` skill (for agents) or the Sveltia CMS at `/blog/admin/` (for humans).

6. **"Any host pages that mention 'articles', 'guides', or 'news' but don't link to the blog yet?"**
   Quick grep through the host repo — `grep -ri "articles\|guides\|news" --include='*.html' --include='*.astro'` — surfaces missed link opportunities.

7. **"Want to enable Sveltia CMS at `/blog/admin/` for non-dev editing?"**
   Already pre-wired in the engine. Just needs the user to fill in `_blog/public/admin/config.yml` with their GitHub repo + branch + register a GitHub OAuth app. See `INTEGRATION.md` Part 4 for steps.

For each "yes", do the work and verify. For each "no" or "later", log it in the site's vault topic note as a deferred follow-up.

---

## Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| ToC duplicated at desktop width | `@shipwreck/blog-theme-default < 0.2.0` (Tailwind not scanning engine components) | Ensure `npm update` pulled `^0.2.0` of both engine packages |
| Giant brand banner above article | Old `defaultFeaturedImage` hero fallback | Upgrade `@shipwreck/blog-core >= 0.2.0`; thin wrappers in `>= 0.3.0` no longer have this risk |
| Two H1s on every post | MDX starts with same H1 as frontmatter title | The `shipwreckBlog()` integration auto-strips it from `>= 0.3.0`. If still seeing it, confirm `astro.config.ts` uses the integration. |
| Buttons don't match host | `--button-*` tokens not set in tokens.css | Sample host's primary CTA in browser devtools, copy values |
| Blog body looks "almost" right but slightly off | One or more tokens at engine default | Re-run [Validation checklist](../../packages/blog-theme-default/TOKEN-CONTRACT.md#validation-checklist) |
| Updater says `github_unreachable` | Outbound HTTPS blocked on the host | Most cPanel hosts allow it. If blocked, contact host or use Path B (SSH push) |
| Updater says `sha256_mismatch` | Tarball corrupted or release notes don't include the SHA line | Check the per-site repo's GH Action output. The build workflow writes the SHA into the release body automatically — if it's missing, the workflow file may be out of date |
| `403 Forbidden` from updater URL | Wrong token | Read it from `~/.shipwreck-updater.config.php` |
| First `/blog/` request returns 404 or WordPress page | Host `.htaccess` is rewriting `/blog/*` to the framework before Apache serves the static file | Add `RewriteRule ^blog/ - [L]` ABOVE existing rewrite rules in `.htaccess` (Phase 6 pre-step) |
| Updater can't `mkdir` the install path on first run | cPanel restricts `mkdir` from PHP for some paths | Pre-create the install directory via shell/SFTP (Phase 6 pre-step) |
| Blog deployed but unreachable from the host site | Forgot Phase 7 — no footer/nav link added | Add the footer link (Phase 7a, required); ask about main nav (7b) |
| Engine version drift across sites (some on 0.2.0, others on 0.3.0) | Per-site GH Action didn't run on engine release | Check that `SHIPWRECK_DISPATCH_PAT` secret is set on the engine repo with `repo` scope; manually trigger via `gh workflow run release-dispatch.yml -f version=0.3.0` |

---

## After integration succeeds

The site is now fully self-updating. Future engine releases auto-propagate through:

1. Engine repo tags `vX.Y.Z`
2. Engine GH Action `release-dispatch.yml` fires `repository_dispatch` to every registered site repo
3. Per-site repo's `blog-build.yml` runs, builds with new engine, publishes new release
4. Host's daily cron picks up the release within 24h, atomically swaps to new version
5. Cloudflare cache purged automatically

**Nothing else for us to do per release** unless something breaks. If something breaks: visual-diff in the GH Action will catch it (TODO: wire that in), or Uptime Kuma will catch the keyword regression, or someone notices.
