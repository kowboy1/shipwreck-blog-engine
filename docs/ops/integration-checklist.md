# Integration checklist — adding the blog to a new site

Step-by-step walkthrough. Copy this into a Linear/issue ticket when starting a new integration; tick boxes as you go.

## Prerequisites

- [ ] Host site exists in git (private or public, doesn't matter)
- [ ] Host site can serve static files at `/blog/` (Apache root, Nginx static, Cloudflare Pages, etc.)
- [ ] Node 20+ available on the dev box
- [ ] Engine repo is reachable (cloned locally OR git+ssh URL is accessible)

## Step 1 — Scaffold the blog source

If using the scaffolder CLI:

```bash
cd <host-site-repo>
npx create-shipwreck-blog ./_blog
```

If scaffolding manually (recommended while engine has no GitHub remote):

```bash
cd <host-site-repo>
rsync -a --exclude=node_modules --exclude=.astro --exclude=dist \
  /home/rick/projects/shipwreck-blog-engine/examples/demo-site/ ./_blog/
```

- [ ] `_blog/` directory exists in the host site repo
- [ ] `_blog/package.json`, `_blog/astro.config.ts`, `_blog/site.config.ts` all present

## Step 2 — Wire engine dependencies

Edit `_blog/package.json` so `@shipwreck/blog-core` and `@shipwreck/blog-theme-default` resolve. Three options:

| Option | When | How |
|---|---|---|
| `file:` path | Local dev when engine is in a sibling folder | `"@shipwreck/blog-core": "file:../../shipwreck-blog-engine/packages/blog-core"` |
| Git tag | Production after engine has a GitHub remote | `"@shipwreck/blog-core": "git+ssh://git@github.com:YOUR_ORG/shipwreck-blog-engine.git#v0.1.0&workspace=@shipwreck/blog-core"` |
| Git branch | Pre-release, dev branch | `"@shipwreck/blog-core": "git+ssh://git@github.com:YOUR_ORG/shipwreck-blog-engine.git#main&workspace=@shipwreck/blog-core"` |

- [ ] Engine deps resolve when running `npm install` in `_blog/`

## Step 3 — Configure for this site

Edit `_blog/site.config.ts`:

- [ ] `siteName` set
- [ ] `baseUrl` set to the production URL (no trailing slash)
- [ ] `blogBasePath` set (`/blog` is the default)
- [ ] `brand.organizationName` set
- [ ] `brand.logoUrl` set if the site has a logo
- [ ] `seo.defaultOgImage` set
- [ ] `seo.locale` set if not `en_AU`
- [ ] `seo.twitterHandle` set if applicable
- [ ] `ctaBlocks.default` set to a registered CTA key (or remove if no CTAs yet)

See [reference/site-config.md](../reference/site-config.md) for every field.

## Step 4 — Theme to match the host site

This is the largest step. You're porting the host site's existing chrome into the blog.

**Header & footer:**

- [ ] Read host site's `<header>` markup
- [ ] Port to `_blog/src/components/SiteShell/Header.astro`. Convert framework-specific link components to plain `<a>`. Add a `Blog` link to the nav.
- [ ] Read host site's `<footer>` markup
- [ ] Port to `_blog/src/components/SiteShell/Footer.astro`

**Design tokens:**

- [ ] Read host site's color palette (Tailwind config `theme.extend.colors` OR `:root` CSS custom properties OR design system)
- [ ] Override the engine's CSS custom properties in `_blog/src/styles/global.css`:
  - `--color-bg`, `--color-text`, `--color-muted`, `--color-primary`, `--color-accent`, `--color-border`
  - `--font-sans`, `--font-heading`
  - `--radius-card`
- [ ] If host uses self-hosted fonts, mirror the `@font-face` rules or `<link>` in the BaseLayout

**Visual diff:**

- [ ] Run `npm run dev` and open the host site + blog side by side
- [ ] Compare: header (logo, nav, spacing, colors), footer, body fonts, primary button color, link color, background, card style

## Step 5 — Replace example content

The scaffolded `_blog/` has demo content from the engine reference. Remove or replace.

- [ ] `_blog/src/content/posts/*.mdx` — delete demo posts, add your first real post (or leave one demo post until your first post is ready)
- [ ] `_blog/src/content/authors/*.json` — add the real author(s), delete demo
- [ ] `_blog/src/components/cta/` — replace demo CTAs with site-appropriate ones, update `registry.ts`

## Step 6 — Build & verify locally

```bash
cd _blog
npm install
npm run build
```

- [ ] Build completes with 0 errors
- [ ] `dist/` (or in our convention `../blog/` after the post-build copy) contains: `index.html`, post folders, tag/category/author folders, `404.html`, `robots.txt`, `rss.xml`, `sitemap-index.xml`, `posts.json`, `admin/`
- [ ] `npm run dev` then visit `http://localhost:4321/blog/` — looks themed correctly
- [ ] All SEO meta tags render correctly on a sample post (right-click → View Source, search for `og:`, `twitter:`, `application/ld+json`)

## Step 7 — Wire the CMS (optional but recommended)

Edit `_blog/public/admin/config.yml`:

- [ ] `backend.repo` set to `<github-org>/<host-site-repo>` (NOT the engine repo)
- [ ] `backend.branch` set to the host site's main branch
- [ ] `media_folder` and `public_folder` paths reflect the host site's structure (typically `_blog/public/uploads` + `/blog/uploads`)
- [ ] Folder paths under `collections:` reflect the host site's structure (typically `_blog/src/content/posts`, `_blog/src/content/authors`)
- [ ] `site_url` and `display_url` set to the production blog URL

For OAuth: Sveltia uses GitHub PKCE OAuth. Either register a GitHub OAuth app and use it across all sites, or use the "Sign In Using Access Token" flow with a personal access token.

- [ ] Visit `/blog/admin/` locally and confirm it loads (login won't work locally without GitHub OAuth setup, but the page should render)

## Step 8 — Wire the build into the host's deploy pipeline

Add a step before the host's existing deploy:

```bash
cd _blog && npm ci && npm run build
```

- [ ] CI/deploy runs `npm ci` (faster than `npm install` and uses the lockfile)
- [ ] CI/deploy runs `npm run build`
- [ ] Built static HTML lands in the right path on the web server

## Step 9 — Update host site's robots.txt and sitemap

The blog generates its own `robots.txt` and sitemap. Resolve the conflict with the host site's existing files:

- [ ] If host has its own `robots.txt`: merge in `Sitemap: https://example.com/blog/sitemap-index.xml`
- [ ] If host has its own root sitemap: add a sitemap-index entry pointing to `/blog/sitemap-index.xml`
- [ ] Or: let the blog's sitemap stand alone and submit it separately to Search Console

## Step 10 — Deploy + verify

- [ ] Push to main (or merge the integration PR)
- [ ] Watch CI for green build
- [ ] Visit production blog URL — confirm it loads, looks right
- [ ] Run a Lighthouse SEO audit on a sample post — should score 95+
- [ ] Submit `https://<host>/blog/sitemap-index.xml` to Google Search Console
- [ ] Submit to Bing Webmaster Tools if relevant
- [ ] If site has analytics, confirm pageviews are tracked on blog pages

## Step 11 — Document the integration

In the host site's CLAUDE.md or README:

- [ ] Note that the blog is built from `_blog/` to `blog/`
- [ ] Document any custom theming/components specific to this site
- [ ] Link to the engine repo and the engine version pinned

In the engine docs (if anything new came up):

- [ ] If you discovered a missing feature or rough edge — file an issue or write it up in the engine's CHANGELOG `[Unreleased]`

## Step 12 — Hand off

- [ ] Tell Nyxi: "Site X now has the blog integrated, here's what changed in the build pipeline, here's the engine version pinned"
- [ ] Update the engine's `docs/ops/README.md` "consuming sites" list (if we maintain one)

## Common pitfalls

- **`base: "/blog"` in astro.config + asset URLs:** Astro's base path applies to internal asset URLs automatically. Don't manually prefix `/blog/` in your component code; it'll get double-prefixed.
- **Trailing slash mismatch:** Host's `.htaccess` may not redirect `/blog/post` → `/blog/post/`. Make sure trailing slashes are consistent or your internal links will break.
- **CSS bleeding between host and blog:** If host's CSS is loaded globally and the blog runs in the same DOM (subpath, not subdomain), test for unintended overrides. Tailwind's preflight is usually fine.
- **node_modules in the wrong place:** If you accidentally install at the host repo root instead of inside `_blog/`, the workspace structure breaks.
- **Engine dep version drift:** If the host repo's `_blog/package-lock.json` pins an old engine version, `npm update` might not pick up the latest. Use exact tag pinning to be predictable.
