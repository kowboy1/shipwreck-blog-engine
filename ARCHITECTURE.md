# Shipwreck Blog Engine — Architecture Plan

**Goal:** A drop-in blog engine for any Shipwreck site, where engine updates flow to all sites via `npm update`, but content and branding stay per-site.

---

## 1. The split (most important decision)

Three layers, with strict boundaries:

### A) Shared engine — `@shipwreck/blog-core` (npm package)
**Lives in this repo. Published to npm (or git+ssh). Updates roll out via version bumps.**

- Astro components: `<PostLayout>`, `<BlogIndex>`, `<ArchivePage>`, `<PostCard>`, `<Breadcrumbs>`, `<TableOfContents>`, `<RelatedPosts>`, `<AuthorBio>`
- SEO helpers: meta tag builder, Article/Organization/BreadcrumbList schema.org generators, OG image helpers
- Content collection Zod schema (every SEO field from the brief)
- Sitemap + RSS generators
- Tailwind preset (design tokens, typography plugin config)
- TypeScript types
- Utility functions (slug, reading time, related-posts ranker)

### B) Shared theme — `@shipwreck/blog-theme-default` (npm package)
**Default visual layer. Sites can swap this for a custom theme.**

- Default Tailwind theme extension
- Default component styling
- Default OG image template

### C) Per-site template (copy-once scaffold)
**Lives in each site's repo at `site-repo/blog/`. Copied once via scaffolder. Doesn't auto-update — but rarely needs to.**

- `package.json` — depends on `@shipwreck/blog-core` + theme
- `astro.config.ts` — minimal, integrations wired
- `site.config.ts` — brand, baseUrl, CTAs, OG defaults
- `tailwind.config.ts` — extends shared preset, brand color overrides
- `content/posts/*.mdx` — the actual blog posts
- `src/pages/` — thin re-exports of core route handlers
- `public/` — site-specific images, OG defaults

**The key insight:** the template is *thin*. 90% of the code lives in `blog-core`. The template is just config + content + glue. So `npm update @shipwreck/blog-core` actually rolls out real improvements.

---

## 2. Update rollout mechanism

| Change type | How it flows | Effort per site |
|---|---|---|
| Bug fix in component | Patch bump → `npm update` | Zero (or `npm update` in CI) |
| New SEO feature | Minor bump → `npm update` | Zero |
| New optional component | Minor bump, opt-in import | Zero unless adopting |
| Breaking schema change | Major bump + migration script | Run migration once |
| Template scaffold improvement | New scaffolder version | Only affects new sites |
| Content model field added | Minor bump, field optional | Zero (backfill when needed) |

**Hosting:** Either publish to npm (public or private registry), or use git+ssh URLs in `package.json` pointing to this repo (free, no registry needed). Recommend git+ssh for v1 — zero friction.

---

## 3. Repo structure (this repo)

```
shipwreck-blog-engine/
├── packages/
│   ├── blog-core/              # the engine
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── layouts/
│   │   │   ├── schemas/        # Zod content schemas
│   │   │   ├── seo/            # schema.org, meta, OG
│   │   │   ├── pages/          # Astro page handlers (re-exported by sites)
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── blog-theme-default/     # default visual theme
│   │   └── src/
│   │
│   └── create-shipwreck-blog/  # scaffolder CLI (Phase 2)
│       └── template/           # what gets copied into a site
│
├── examples/
│   └── demo-site/              # reference integration — used for dev + testing
│
├── docs/
│   ├── ARCHITECTURE.md         # this file
│   ├── INTEGRATION.md          # how to add to a site
│   ├── CONTENT-MODEL.md        # schema reference
│   └── UPGRADE-GUIDE.md        # version migration notes
│
├── package.json                # workspaces
├── pnpm-workspace.yaml         # or npm workspaces
└── PROJECT-BRIEF.md
```

Monorepo with pnpm workspaces. Lets us develop core + theme + demo site together; publishes packages independently.

---

## 4. Per-site integration contract

When a site adds the blog, here's what they touch:

```
site-repo/
└── blog/                       # scaffolded once
    ├── package.json
    ├── astro.config.ts
    ├── site.config.ts          # ← edit this
    ├── tailwind.config.ts      # ← edit brand colors here
    ├── content/posts/          # ← write MDX here
    └── src/pages/
        ├── index.astro         # 1 line: re-exports core BlogIndex
        ├── [slug].astro        # 1 line: re-exports core PostPage
        └── [...rest].astro     # archives, etc.
```

Build output: `site-repo/blog/dist/` → mounted at `/blog/` on the live site (static HTML, copy to host or proxy to subpath).

For React/Vite host sites that serve their own routing: blog builds independently to static HTML, host site links out to it. No runtime coupling.

---

## 5. Content model (Phase 1)

Single Zod schema in `blog-core/src/schemas/post.ts`. Every field from the brief, all optional except the essentials:

**Required:** `title`, `slug` (auto from filename), `publishDate`, `body`
**SEO:** `metaTitle`, `metaDescription`, `canonical`, `noindex`, `ogTitle`, `ogDescription`, `ogImage`
**Editorial:** `author`, `category`, `tags[]`, `excerpt`, `featuredImage`, `updatedDate`, `status` (draft/published/scheduled), `featured`, `sticky`
**Schema.org:** `articleType`, `faqItems[]` (optional FAQ schema)
**Relations:** `relatedPosts[]` (manual), `ctaBlock` (key into site config)

Validated at build time — bad frontmatter = build fails with a clear error.

---

## 6. Phasing (revised)

### Phase 1 — Engine MVP (target: 1 week)
**Definition of done: a site can `npm install` the engine, write MDX, and ship a static `/blog/` with full SEO.**

- Monorepo scaffold (pnpm workspaces)
- `blog-core` package: schema, components, layouts, SEO helpers, sitemap, RSS
- `blog-theme-default` package: baseline styling
- `examples/demo-site`: working reference integration
- `INTEGRATION.md`: copy-paste setup steps
- Manual scaffold (no CLI yet — just copy `examples/demo-site` into a real site)

### Phase 2 — Scaffolder + first real integration (target: 3–5 days)
- `create-shipwreck-blog` CLI: `npx create-shipwreck-blog ./blog`
- Pick first real site to integrate (suggest: review-removals — most blog-hungry)
- Document gotchas, fix what breaks
- Versioning policy locked in (semver, changelog discipline)

### Phase 3 — Polish + second site
- Roll into a second site to prove the update mechanism works
- Add: redirects manager, search page, related-posts auto-suggester
- OG image generation pipeline (`@vercel/og` or satori)

### Phase 4 — Optional admin (only if needed)
- React+Vite admin UI that commits MDX to site repos via git
- Or: Decap CMS / TinaCMS as a free alternative (both write to git)
- **Decision deferred until you actually need non-dev editing**

### Phase 5 — Advanced SEO
- Internal linking suggestions (analyze content, suggest links)
- Topic cluster support
- Content scoring against target keywords
- Programmatic SEO page templates

---

## 7. Locked decisions

1. **Distribution:** git+ssh URLs in `package.json` (free, no registry)
2. **Renderer:** Astro
3. **Theming:** Tailwind preset + CSS custom properties for tokens, plus per-site `SiteShell` slot components for header/footer. **An agent can theme the blog to match a host site by following the recipe in `INTEGRATION.md`.**
4. **Content format:** MDX
5. **Versioning:** Git history only (no revisions table)
6. **First integration target:** Review Removals
7. **Package manager:** npm workspaces (no pnpm needed)

---

## 8. What we are explicitly NOT building (yet)

- A web admin UI
- A central server
- A database (content is files in git)
- A page builder
- Comments
- Multi-author workflow / approval flows
- Analytics (delegate to existing GA/Plausible)
- Newsletter (delegate to existing tool)
- Search beyond client-side filter (Phase 3+)

Each of these can be added later without re-architecture. Most should never be added.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Breaking changes break N sites at once | Strict semver; sites pin major version; migration scripts for breaks |
| Per-site customization drifts from core | Theme tokens + slot-based component composition; document the extension points |
| Astro changes ecosystem direction | Astro is stable + funded; content collections are core API; low risk |
| Scaffold becomes stale across sites | Engine is in core (npm), template is thin — stale template rarely matters |
| One site needs a feature that doesn't fit | Site can override locally (Astro lets you shadow components); land in core if it generalizes |
