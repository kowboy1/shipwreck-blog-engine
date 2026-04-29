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
3. **Where the blog mounts** — usually `/blog/`. Confirm if different.
4. **Cloudflare zone ID** for the domain (look it up in the Cloudflare dashboard) — needed for cache purge after updates
5. **Whether a per-site GitHub repo exists** for the blog source (if not, you'll create one in Phase 1)

If any are missing, ask. Don't guess.

---

## Phase 1 — Create the per-site blog repo

Each blog deployment needs its own GitHub repo for the source. Why a separate repo (not just a directory in the host site's repo): the consumer-site GH Action publishes its own releases, which the host pulls from. Decoupling content from the live site repo keeps deploys clean.

```bash
# Locally:
mkdir -p ~/projects/<site-name>-blog
cd ~/projects/<site-name>-blog
git init -b main

# Copy the demo-site as the starter
cp -r <path-to>/shipwreck-blog-engine/examples/demo-site/* .
cp -r <path-to>/shipwreck-blog-engine/examples/demo-site/.* . 2>/dev/null || true

# Copy the per-site build workflow template
mkdir -p .github/workflows
cp <path-to>/shipwreck-blog-engine/templates/site-blog-build.yml .github/workflows/blog-build.yml

# Move the site source into _blog/ (the workflow assumes this layout)
# (the demo-site's contents become the _blog/ contents — check current shape)
```

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

Commit and push the per-site repo. The included GH Action will build automatically on push and create a `blog-dist.tar.gz` release.

```bash
git add -A
git commit -m "feat: initial blog scaffold for <site-name>"
git push -u origin main
```

Wait for the GH Action to complete (~2 min). Verify a release was published with the tarball asset.

Then on the host server, run the **one-shot installer**:

```bash
# SSH into the host (Prem3/Prem4/cPanel/anywhere)
ssh user@<server>

# Run the installer (replace placeholders):
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
4. Adds the cron line
5. Prints the resulting status URL + manual-trigger URL

**Trigger the first update manually** to seed `/blog/`:
```bash
curl "https://<domain>/shipwreck-updater.php?token=<TOKEN_FROM_INSTALLER_OUTPUT>"
```

Verify in the browser: `https://<domain>/blog/` should now render.

---

## Phase 7 — Apache + Cloudflare hygiene

Two checks per site, especially on cPanel hosts where WordPress or another app already runs at the apex:

1. **`.htaccess` doesn't intercept `/blog/*`**
   Test by `curl https://<domain>/blog/` and confirm it serves the static index.html (not WP). If the WP rewrite catches it, add to `.htaccess` BEFORE WP rules:
   ```apacheconf
   RewriteRule ^blog/ - [L]
   ```

2. **Cloudflare cache rule for `/blog/*`** — recommended. Phase: `http_request_cache_settings`. When: `(http.request.uri.path matches "^/blog/")`. Action: `cache_level=cache_everything`, `edge_ttl=86400`. The updater purges cache on each push.

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

---

## After integration succeeds

The site is now fully self-updating. Future engine releases auto-propagate through:

1. Engine repo tags `vX.Y.Z`
2. Engine GH Action `release-dispatch.yml` fires `repository_dispatch` to every registered site repo
3. Per-site repo's `blog-build.yml` runs, builds with new engine, publishes new release
4. Host's daily cron picks up the release within 24h, atomically swaps to new version
5. Cloudflare cache purged automatically

**Nothing else for us to do per release** unless something breaks. If something breaks: visual-diff in the GH Action will catch it (TODO: wire that in), or Uptime Kuma will catch the keyword regression, or someone notices.
