# Deployment model

## The shape of "production"

There is no production deployment of the engine itself. The engine is a library that lives in git. "Production" is whatever each consuming site does with the static HTML the engine helps them build.

```
┌─────────────────────────────────┐
│  shipwreck-blog-engine (repo)   │   ← engine source, library, never deployed
│  - npm packages                 │
│  - reference template           │
└──────────────┬──────────────────┘
               │ git+ssh consumed by
               ▼
┌─────────────────────────────────┐
│  host-site-repo                 │   ← e.g. wollongong-weather
│  ├─ index.html (host content)   │
│  ├─ _blog/  (Astro source)      │   ← imports @shipwreck/blog-core
│  ├─ blog/   (built static HTML) │   ← committed AFTER `npm run build`
│  └─ assets/                     │
└──────────────┬──────────────────┘
               │ deployed to
               ▼
┌─────────────────────────────────┐
│  Web server                     │   ← Apache / Nginx / Cloudflare Pages
│  Serves /blog/ statically       │
└─────────────────────────────────┘
```

## Why per-site, not central

The engine could have been a multi-tenant SaaS that hosts content for all sites. We chose not to do that. Reasons:

- **Isolation.** A central server going down takes every site's blog with it. Per-site builds = per-site failure domains.
- **Hosting cost.** Static HTML hosted alongside each site costs nothing extra. A central server costs money continuously.
- **Editorial control.** Each site's content lives in that site's git history. No tenancy bugs, no cross-site leaks.
- **Build caching.** Each site's CI is already there; reusing it saves infra.
- **Migration risk.** If we want to leave Astro one day, each site can migrate independently.

The cost of per-site is that engine updates have to be rolled out N times. We mitigate that with [the update procedure](./update-procedure.md) and (eventually) [Harbour Control](https://D:/NyXi's%20Vault/Topics/Harbour%20Control.md) automation.

## The build pipeline (per site)

A host site that consumes the engine has this build flow:

```bash
# 1. Fetch (CI checks out the host repo)
git clone <host-repo>

# 2. Install (only on engine version change; cached otherwise)
cd _blog && npm ci

# 3. Build (Astro emits static HTML)
npm run build

# In our convention, the "build" script also copies dist/ into ../blog/
# so the static output is under the host site's served root.

# 4. Commit (or use as a build artifact)
cd ..
git add blog/
git commit -m "chore(blog): rebuild"
git push

# 5. Web server picks up the static files via its existing deploy mechanism
```

For sites with proper CI (Cloudflare Pages, Vercel, GitHub Pages), steps 4-5 collapse into "the CI pipeline". For sites that deploy via FTP/rsync, the built `blog/` folder gets uploaded.

## Deployment patterns by host type

### Static HTML site (Apache / Nginx / Cloudflare Pages)

This is the wollongong-weather model.

- Blog source under `_blog/` is in the same repo as the host static site
- Build emits `blog/` next to the host's `index.html`
- Web server serves `host.com/blog/` as static files
- Apache `.htaccess` handles trailing-slash redirects for clean URLs

### React / Vue / Next.js host site

- Blog source under `_blog/` (still its own Astro app)
- Two CI jobs: build the host app, build the blog. Both deploy to the same hosting.
- Mount the blog at the host's `/blog/` path via reverse-proxy or static asset copy
- Or: deploy blog to a subdomain (`blog.example.com`) — separate hosting target, simpler routing

### Subdomain pattern

If routing the blog under the host's domain is painful (e.g. host is on Vercel and blog isn't), put the blog on a subdomain:

- `_blog/site.config.ts` sets `baseUrl: "https://blog.example.com"`, `blogBasePath: "/"`
- Blog deploys independently to its own static host
- Host site links out to `blog.example.com/...`
- Sitemap lives on the subdomain; reference both in Search Console as separate properties

## Static output structure

After `npm run build`, the `blog/` folder contains:

```
blog/
├── index.html                    # blog index
├── page/                         # paginated index (page/2/, page/3/...)
├── <post-slug>/                  # one folder per post
│   └── index.html
├── tags/<tag>/                   # one folder per tag
├── categories/<category>/        # one folder per category
├── authors/<author>/             # one folder per author
├── admin/                        # Sveltia CMS (login page only)
│   ├── index.html
│   └── config.yml
├── 404.html
├── robots.txt
├── rss.xml
├── posts.json                    # public manifest for AI agents / external tools
├── sitemap-index.xml
├── sitemap-0.xml
└── _astro/                       # bundled CSS/JS (cache-busted filenames)
```

Total payload for a small blog (3 posts): ~250KB. Scales linearly with post count plus the `_astro/` bundle (~100KB fixed cost).

## What gets committed vs gitignored

In the host site repo:

- ✅ `_blog/src/**` — content + theming + config (committed)
- ✅ `_blog/package.json`, `_blog/astro.config.ts`, etc. — config (committed)
- ✅ `_blog/public/**` — static assets including `admin/config.yml` (committed)
- ❌ `_blog/node_modules/` — gitignored
- ❌ `_blog/.astro/` — gitignored
- ❌ `_blog/dist/` — gitignored
- ✅ `blog/**` — built static output (committed if hosting from same repo; gitignored if CI builds it)

The choice on `blog/`: commit if your hosting reads from git directly (gh-pages, Apache cloned from git). Gitignore if CI builds and deploys (Cloudflare Pages, Vercel, Netlify).

## What gets monitored

There's nothing engine-specific to monitor. Standard per-site monitoring suffices:

- HTTP status of the blog index and a sample post (Uptime Kuma / UptimeRobot)
- Build success/failure in CI
- Search Console for indexation and crawl errors
- Sitemap submission status

If you wanted central monitoring of "are all sites running compatible engine versions", a small script could query each site's `/blog/posts.json` (or a future `/blog/version.json`) — that's a future Harbour Control candidate.
