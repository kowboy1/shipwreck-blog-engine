# Incident runbook — when a site's blog breaks

Common failure modes and how to fix them. Use this when a blog deployment goes sideways.

## Triage decision tree

```
Is the blog page returning 5xx or not loading at all?
├─ Yes → "Site outage" (below)
└─ No, page loads but...
   ├─ Looks unstyled / broken → "Theme/CSS broken"
   ├─ Missing posts / wrong content → "Content sync issue"
   ├─ Build failed in CI → "Build failure"
   ├─ SEO broken (no meta tags / 404 sitemap) → "SEO output issue"
   └─ CMS won't load / can't save → "CMS issue"
```

## Site outage (5xx, 404, blog page won't load)

**Likely causes:**

1. The web server isn't serving the `blog/` folder
2. The build output wasn't deployed
3. Path/routing config broke

**What to check:**

```bash
# On the dev box, build a fresh copy
cd <host-site-repo>/_blog
npm install
npm run build
ls ../blog/  # confirm files exist
```

If local build works but production 404s:

- Check the host's web server config (`.htaccess`, Nginx config, Cloudflare Pages routes)
- Confirm the `blog/` directory was deployed (file exists on the server)
- Check the host site's main `index.html` and links to `/blog/` — confirm the path matches

If local build itself fails, jump to "Build failure" below.

## Build failure

The CI build of `_blog/` is erroring. Look at the build log:

### "Type X is not assignable to Y" or schema errors

A post's frontmatter doesn't match the Zod schema. This happens when:
- Engine updated and added a now-required field that an existing post doesn't have
- Someone (Sveltia or human) wrote bad frontmatter

**Fix:**
- Read the error — it tells you the file and field
- Fix the post's frontmatter
- Re-run build

### "Cannot find module '@shipwreck/blog-core'"

Engine package isn't installed. Either:
- `node_modules/` is gone — run `npm ci` or `npm install`
- The git+ssh URL in `package.json` is unreachable — check SSH keys, network, repo access
- The `file:` path is wrong (engine moved on disk)

### "Astro check found errors"

TypeScript errors in the blog source. Usually from:
- Engine update changed a type signature
- Local component shadowing got out of sync with the engine

**Fix:**
- Run `npx astro check` locally to see the full error
- If from an engine update: read CHANGELOG/UPGRADE-GUIDE for the relevant version
- If from local code: fix the TS error

### Build hangs or runs out of memory

Astro's content sync on a large content collection can OOM in low-memory CI. Usually a Node 20+ default is fine. If hitting limits:

```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run build
```

## Theme/CSS broken (page loads but looks wrong)

**Likely causes:**

1. Tailwind didn't include the engine's component paths in its `content` glob
2. CSS custom properties got renamed in an engine update
3. Theme tokens file lost a `:root` block
4. `@tailwindcss/typography` plugin missing

**What to check:**

`_blog/tailwind.config.ts` — the `content` array must include the engine's component path:

```ts
content: [
  "./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
  "../../<engine-or-node_modules-path>/components/*.astro",
]
```

`_blog/src/styles/global.css` — confirm `:root` block is still there with overrides for the host site's brand.

## Content sync issue (missing posts, wrong content)

**Likely causes:**

1. Posts have `status: draft` and aren't being published
2. Posts have a future `publishDate` (if a scheduled-publish filter is enabled)
3. Files weren't committed/pushed
4. CMS commits went to a different branch

**What to check:**

```bash
ls _blog/src/content/posts/
git log --oneline _blog/src/content/posts/  # are recent edits committed?
```

If using Sveltia: check the Activity log on GitHub for commits with the `content(blog):` prefix to see if Sveltia is committing successfully.

If a post is missing in production but exists in source: confirm the build was rebuilt + redeployed since the post was added.

## SEO output issue

### Sitemap missing or 404

- Confirm `@astrojs/sitemap` integration is in `astro.config.ts`
- Confirm `site:` is set in `astro.config.ts` (usually pulled from `site.config.ts`'s `baseUrl`)
- Sitemap should be at `/blog/sitemap-index.xml` after build

### Meta tags missing

- View source on a post page. If `og:title`, `og:description`, etc. are absent: BaseLayout isn't being used by that page
- If meta tags ARE present but wrong: check `site.config.ts` and the post frontmatter

### JSON-LD missing or wrong

- View source, search for `application/ld+json`
- Should see at least 2 blocks on a post page (Article + BreadcrumbList)
- If FAQ schema is expected but missing: post needs `faqItems` in frontmatter

### `robots.txt` blocking the blog

- Check `<host>/blog/robots.txt`
- Should `Allow: /` and reference the sitemap
- If it's blocking, check `_blog/src/pages/robots.txt.ts` wasn't edited to include `Disallow:`

## CMS issue (Sveltia)

### "Sign in" doesn't work

- Check `_blog/public/admin/config.yml` `backend.repo` matches the actual GitHub repo
- For PKCE OAuth: confirm a GitHub OAuth app is registered and `client_id` matches
- For PAT auth: confirm the PAT has `repo` scope and isn't expired
- Try the "Sign In Using Access Token" path as a workaround

### Logged in but no posts shown

- `folder:` paths in `config.yml` must match the actual repo paths (e.g. `_blog/src/content/posts`, NOT `src/content/posts` if the repo has a `_blog/` prefix)
- Check the GitHub branch in `config.yml` matches where content actually lives

### Save fails with "permission denied"

- The signed-in user needs write access to the GitHub repo
- For org repos: check the user's org membership and repo permissions
- For PAT: regenerate with `repo` scope

### Editor opens but fields look wrong

- `config.yml` field definitions are out of sync with the Zod schema
- Compare `_blog/public/admin/config.yml` `collections.posts.fields` against `packages/blog-core/src/schemas/post.ts`
- Update the YAML to match

## When you're stuck

1. **Read the engine's CHANGELOG** for the version the site is pinned to. Did something obvious change?
2. **Compare with a working site** — if Wollongong Weather works and Site B doesn't, diff their `_blog/` configs and `package.json`.
3. **Roll back** — if the issue appeared after an update, pin to the previous engine version (see [update-procedure.md](./update-procedure.md) → Rollback).
4. **Open an issue in the engine repo** with: site URL, engine version, error messages, what you've tried.

## Common "it's not actually broken" cases

- **Cache** — Cloudflare / browser caches stale HTML. Hard refresh + purge CDN.
- **Trailing slash** — visiting `/blog/post` vs `/blog/post/` may return different things on Apache without redirect rules. Apache `.htaccess` needs the slash redirect; or the blog needs `trailingSlash: "always"` set (which it does by default).
- **Dev vs prod URL** — `site.config.ts` `baseUrl` should be the production URL. Local dev uses `localhost:4321` regardless. If you see canonical URLs pointing at `demo.example.com` in production, you forgot to update `baseUrl`.
