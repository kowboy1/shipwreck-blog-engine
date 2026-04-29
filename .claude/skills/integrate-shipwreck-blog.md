---
description: Integrate the Shipwreck Blog Engine into a host site. Triggers when the user says "add the blog", "install shipwreck blog", "drop the blog into <site>", or sets up `@shipwreck/blog-core` for a new property. Produces a themed, building blog at /blog/ that visually matches the host AND is self-updating (pulls new engine releases via daily cron).
---

# Skill — Integrate Shipwreck Blog into a Host Site

You are integrating `@shipwreck/blog-engine` into a host site. **This skill is hosting-, DNS-, and CDN-agnostic.** It works for any host that can serve static files (every cPanel tier, Plesk, DirectAdmin, OpenLiteSpeed, raw nginx/Apache, S3+CloudFront, Cloudflare Pages, Netlify, Vercel, GitHub Pages, a self-hosted VPS, an old-school FTP-only shared host — anything).

The end state:

1. A **per-site source repo** (typically on GitHub) holds the blog source — site config, theme tokens, SiteShell, content/posts, content/authors. A CI workflow builds the static blog and publishes a tarball release on every engine update.
2. The **host site** serves the built blog at `<docroot>/blog/` (or whatever subpath was chosen). For hosts with PHP+cron, `shipwreck-updater.php` runs daily and self-updates. For hosts without PHP, an external runner (or scheduled GitHub Action) pushes the build via SSH/SFTP/FTP.
3. The blog is **themed to look native** to the host site.

**Don't improvise.** Follow the procedure. Every phase has an output you can verify. If a verification fails, fix that phase before moving on.

---

## Inputs you need before starting

These come from the user's prompt, OR you look them up via Harbour Control (the dashboard tracks every site → server → DNS provider → access method). Don't guess.

1. **Host site name and domain** — the live URL the blog will be added to
2. **Hosting environment** — which server/platform the host site lives on (any cPanel tier, OpenLiteSpeed/CyberPanel box, dedicated VPS, Cloudflare Pages, Netlify, etc.). What matters: SSH/SFTP availability, whether it serves PHP, who has access.
3. **DNS / CDN provider** — Cloudflare, AWS, the registrar's nameservers, etc. Only matters for the optional "purge cache after deploy" step. If unknown or no CDN, the engine works without it.
4. **Where the blog mounts** — usually `/blog/`. **Locked in for the life of the site** — internal links bake the path in, so moving it later breaks every URL. Confirm with the user before proceeding if it's anything other than `/blog/`.
5. **Whether a per-site source repo exists** — typically `<site-name>-blog` on the same git host as everything else. If not, Phase 1 creates one.
6. **Where the host site's main nav lives** (which file or component) — for Phase 7 nav link
7. **Where the host site's footer lives** — for Phase 7 footer link

If any are missing AND you can't infer them from Harbour Control, ask the user.

---

## Choose a deploy mode FIRST (before any phases)

Pick **one** of three modes based on the host's capabilities. They branch the runbook differently.

### Mode A — Self-update pull (universal, default for live sites)

The host can run PHP and cron. Daily cron hits a token-protected `shipwreck-updater.php` endpoint, which polls the per-site repo's GitHub Releases and atomically swaps in newer builds.

**Use when:** the host runs on any cPanel / Plesk / DirectAdmin / OpenLiteSpeed / nginx+php-fpm / Apache+mod_php — basically anywhere that ships PHP. **This is the default.** If unsure, this is the right answer.

**Includes:** all 9 phases. Per-site source repo, build CI, host-side updater install, cron, optional cache purge wiring, optional uptime monitor.

**Does NOT require:** SSH access from us to the host, control over the DNS, a specific CDN, root, or anything beyond a normal cPanel control-panel account.

### Mode B — Local-dev integration (no remote, no CI, no CDN)

The site is being developed locally and isn't on a production host yet. Often served via a tunnel (Cloudflare Tunnel, ngrok, etc.) or a local dev server. No CI, no remote install, no cache purge.

**Use when:** the user says "set it up locally", "I'll deploy later", or the host site is currently a local checkout on the developer's machine.

**Skip:** the per-site repo's GitHub create, the host-side updater install, any CI workflows, uptime monitor.

**Replace with:** local `npm run build` + copy `dist/` to `<host-site-checkout>/blog/`. Document the build-and-copy command in the per-site repo's README so it's reproducible.

**Run normally:** Phases 2 (tokens), 3 (SiteShell), 4 (CTAs), 5 (visual verification), 7 (host wiring), 8 (registry, with `deploy.method: "manual"`).

When the site goes to production later, re-enter at Phase 6 — the source is already built, just needs a remote + the updater install.

### Mode C — Push from CI (when we control SSH but the host can't run the updater)

The host has SSH/SFTP we can use, but we'd rather push than have the host pull. Useful when the host's PHP version is too old, or when sub-minute deploy latency matters. We build in a runner (GitHub Action, local machine) and push the dist via rsync/lftp.

**Use when:** the user wants push-style deploy AND we have working SSH/SFTP credentials for the host.

**Phases:** all 9, but Phase 6 uses `scripts/deploy-blog.mjs` instead of `install-updater.sh`. Cron lives on our runner, not the host.

### Mode D — Hand-off to external host (we don't control the host at all)

The host is owned by a third party we don't have any access to. We build the dist tarball; the host owner uploads it themselves.

**Use when:** the user explicitly says "we don't have access to that server" or the host is owned by someone outside our reach.

**Phases:** 1, 2, 3, 4, 5, 7 (host wiring done by the third party), 8 (registry, no monitor). Phase 6 produces the tarball + a one-page upload-instructions doc.

---

If unclear which mode applies, ask: "Does the host run PHP+cron and can I SSH/control-panel into it?" — if yes, Mode A. If it's local dev, Mode B. If yes-to-SSH-but-want-push, Mode C. If we can't touch the host, Mode D.

---

## Critical model concept (read before Phase 1)

Two repos, kept separate. **This applies regardless of which mode you chose.**

- **Host site repo**: the existing live website. The blog is **NOT installed here**. The only changes you make to this repo are: a footer link, a nav link, and optionally a `robots.txt` reference to the blog sitemap. **Do not** add `_blog/` here. **Do not** add `_blog/node_modules` to its `.gitignore`. **Do not** put any blog Astro source here.
- **Per-site blog repo**: a SEPARATE git repo (typically `<site-name>-blog`) containing only the blog source. Its CI builds + publishes release tarballs that the host's updater pulls (or that we push to the host).

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

2. **If the host's webserver intercepts `/blog/*`, add an early skip.** Any host running an apex CMS (WordPress, Drupal, Ghost, etc.) likely has a rewrite rule that catches every path. The blog is a static directory — let the webserver serve it directly.

   - **Apache / OpenLiteSpeed (`.htaccess`):** add **above** any framework rules:
     ```apacheconf
     # Static blog mount — let Apache serve files directly
     RewriteRule ^blog/ - [L]
     ```
   - **nginx:** add a `location /blog/ { try_files $uri $uri/ =404; }` block before the catch-all that proxies to the framework
   - **Cloudflare Pages / Netlify / Vercel / static hosts:** no action needed — they serve subpaths directly.

   Test with `curl -I https://<domain>/blog/` — should return `200` (not the framework's 404) once the install path has any file in it.

3. **CDN cache rule for `/blog/*` (optional, recommended if there's a CDN).** The blog is fully static; aggressive edge-caching is safe. The updater purges cache after each successful update via the configured CDN API.

   - **Cloudflare:** Cache Rule, phase `http_request_cache_settings`, when `(http.request.uri.path matches "^/blog/")`, action `cache_level=cache_everything`, `edge_ttl=86400`.
   - **Other CDNs (Fastly, BunnyCDN, AWS CloudFront, etc.):** equivalent rule — match path prefix, allow long edge TTL.
   - **No CDN:** skip.

### Run the one-shot installer

The installer runs ON THE HOST. Use whichever shell access is available:

- SSH (most VPS, Prem-style boxes, dedicated hosts): standard
- cPanel "Terminal" feature (most cPanel tiers in the last few years): same effect
- WHM root shell (if you're an admin): same
- Shell-less cPanel: run `install-updater.sh` from a local machine, then SFTP `shipwreck-updater.php` + `.shipwreck-updater.config.php` into place yourself, and add the cron via the cPanel "Cron Jobs" UI.

```bash
curl -fsSL https://raw.githubusercontent.com/1tronic/shipwreck-blog-engine/main/scripts/install-updater.sh | bash -s -- \
  --release-repo <git-org>/<site-name>-blog \
  --install-path /home/<domain>/public_html/blog \
  --domain <domain> \
  --cloudflare-zone-id <ZONE_ID> \
  --cloudflare-token <CF_API_TOKEN>
```

The `--cloudflare-*` flags are optional. Omit them if the host doesn't sit behind Cloudflare; the updater still works, it just skips cache purging.

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
   E.g., for a local-news site the location/category pages might reference relevant blog posts ("See our guide on X"); for an e-commerce site product pages might reference how-to articles. Get a list from the user, then either edit the host repo or note for later.

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
