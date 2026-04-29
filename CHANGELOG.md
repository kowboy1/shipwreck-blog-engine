# Changelog

All notable changes to the Shipwreck Blog Engine. Format: [Keep a Changelog](https://keepachangelog.com). Versioning: [SemVer](https://semver.org).

## [Unreleased]

## [0.2.0] - 2026-04-29

### Fixed (out-of-the-box presentation)

Three root-cause bugs were making fresh integrations look broken. All fixed in the engine so consumer sites get a usable result without per-site patches:

- **Tailwind preset now self-registers engine component sources.** Previously each consumer site had to add `"../../packages/blog-core/src/components/*.astro"` to their `tailwind.config.ts` content array — a monorepo-relative path that silently failed on installed packages. As a result, every utility class used inside engine components (including `lg:hidden`, `hidden lg:block`, sticky / max-h, ring, rounded-full, etc.) was tree-shaken out, breaking the ToC at desktop width and many other components. The shared preset (`@shipwreck/blog-theme-default/tailwind-preset`) now includes `./node_modules/@shipwreck/blog-core/src/components/**/*.{astro,...}` in its `content` array, so consumer sites only need their own `./src/**/*` path.
- **OG image is no longer used as an in-page hero fallback.** `[...slug].astro` and `PostCard` previously fell back to `siteConfig.seo.defaultFeaturedImage` for the article hero and card thumbnails — which on most sites is the OG/brand banner. The result was a giant brand banner above every article and inside every "More articles" card. Hero now only renders when the post explicitly sets `featuredImage`. PostCard / RelatedPosts no longer accept a `defaultImage` prop.
- **Duplicate H1 stripped automatically.** Authors who started MDX bodies with `# Same Title As Frontmatter` produced two H1s on the rendered page (layout renders one from frontmatter; content adds another). New `remarkStripDuplicateH1` plugin in `@shipwreck/blog-core/remark/strip-duplicate-h1.mjs` removes the leading H1 from MDX when its text matches the frontmatter `title`. Wired into the demo-site `astro.config.ts`.

### Added
- `@shipwreck/blog-core/remark/strip-duplicate-h1` — remark plugin (see Fixed above)
- `./remark/*` export entry in `@shipwreck/blog-core` package.json

### Changed
- `PostCard` no longer accepts `defaultImage` prop — text-only card when post has no `featuredImage`
- `RelatedPosts` no longer accepts `defaultImage` prop
- `TagList` chips redesigned: pill shape, uppercase tracking, no `#` prefix, accent hover
- `AuthorBio` tightened: smaller avatar (64 → 72 retained at 64), tighter padding, `mt-10` (was `mt-12`)
- All demo-site listing pages (`index.astro`, `tags/[tag].astro`, `categories/[category].astro`, `authors/[author].astro`, `page/[page].astro`) no longer pass `defaultImage` to `PostCard`
- Demo-site `tailwind.config.ts` simplified — engine component path now in shared preset

### Migration (consumers upgrading from 0.1.x)

1. Bump `@shipwreck/blog-core` and `@shipwreck/blog-theme-default` to `0.2.0`
2. Remove the engine-components content path from your `tailwind.config.ts`:
   ```diff
     content: [
       "./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
   -   "./node_modules/@shipwreck/blog-core/src/components/*.astro",
     ],
   ```
   The shared preset adds it now.
3. Remove `defaultImage={siteConfig.seo.defaultFeaturedImage}` props from any `<PostCard>` / `<RelatedPosts>` usages
4. Remove the `?? siteConfig.seo.defaultFeaturedImage` fallback on `heroImage` in your `[...slug].astro`
5. Add the H1-stripper to your `astro.config.ts`:
   ```ts
   import { remarkStripDuplicateH1 } from "@shipwreck/blog-core/remark/strip-duplicate-h1.mjs"
   // ...
   markdown: { remarkPlugins: [remarkReadingTime, remarkStripDuplicateH1] }
   ```
6. Rebuild

## [0.1.2] - 2026-04-28

### Fixed
- Article layout was unusable: `BaseLayout` constrained everything to `max-w-3xl` (768px), so the 3-column ArticleLayout grid never had room and stacked into one tiny column with broken text wrapping. `BaseLayout` no longer applies a width constraint; pages set their own `max-w-3xl` (index/archives) or `max-w-7xl` (post page) wrapper.

### Added
- `<AuthorAvatar>` component — avatar with initials fallback when author has no `avatar` set. Used in byline + AuthorBio.
- `siteConfig.seo.defaultAuthorAvatar` — site-wide fallback avatar image
- AuthorBio `href` prop — avatar + name link to the author's archive page
- AuthorBio `fallbackImage` prop — passed through to AuthorAvatar
- RelatedPosts `layout` prop — `"grid"` (3-up horizontal at md+, default) or `"stack"` (vertical)
- Post page now shows author avatar + name in the byline, linked to `/blog/authors/<id>/`. Multi-author posts show stacked avatars.

### Changed
- Article page restructured to match SydneyPI reference layout:
  - Wide container (`max-w-7xl`)
  - **Left:** sticky ToC
  - **Middle:** title, byline (with avatar), excerpt, hero image, body, tags, multi-author bios
  - **Right:** sticky CTA only (FeaturedPosts removed from sidebar)
  - **Below:** "More articles" horizontal 3-column grid (uses `RelatedPosts layout="grid"`)
- Index/archive pages now wrap content in `max-w-3xl` (was implicit via BaseLayout)
- All listing pages now pass `defaultImage={siteConfig.seo.defaultFeaturedImage}` to PostCard

### Notes
- FeaturedPosts component still exists and can be used in custom layouts (it's just not used in the default post page anymore)

## [0.1.1] - 2026-04-28

### Added
- `<ArticleLayout>` component — three-column grid (ToC sidebar / main / featured sidebar) with mobile collapse
- `<FeaturedPosts>` component — sticky sidebar list of featured (or recent) posts with thumbnails, falls back to `siteConfig.seo.defaultFeaturedImage` when a post has no featured image
- `authors: string[]` field on `postSchema` for multi-author posts. Legacy `author: string` still supported via `getPostAuthorIds()` helper
- `getPostAuthorIds()` exported from `@shipwreck/blog-core/utils` — normalizes single/multi author into a flat list
- `seo.defaultFeaturedImage` on `siteConfigSchema` — used as fallback for PostCard, FeaturedPosts, and the post hero image
- `defaultImage` prop on `<PostCard>` and `<FeaturedPosts>` for fallback images
- `articleSchema()` now accepts an `authors[]` array (also keeps legacy `authorName`/`authorUrl` for backward compat) and emits an array of Person entities for multi-author posts
- Hero featured image rendered above the article body when `featuredImage` (or site default) is set
- Sveltia CMS config updated: `author` field is now an `authors` relation widget with `multiple: true`

### Changed
- `<TableOfContents>` default `maxDepth` is now 4 (was 3); added `sticky` prop for desktop sticky positioning
- Post page (`[...slug].astro`) restructured to use `<ArticleLayout>` with sidebar ToC + featured posts
- Author archive page (`/authors/<id>/`) now lists posts where author appears in either the legacy `author` field or the new `authors[]` array
- Multi-author posts render byline as "Author A & Author B" with each name linking to their URL

### Fixed
- (none)

## [0.1.0] - 2026-04-28

### Added
- Phase 1 engine MVP
- `@shipwreck/blog-core`: Zod schemas (post, site config, author, redirects), SEO helpers (Article/Organization/BreadcrumbList/FAQPage schema.org, OG + Twitter + meta builder), utilities (reading time, slug, related-post ranker), reusable Astro components (Breadcrumbs, TableOfContents, RelatedPosts, AuthorBio, PostCard, Pagination, TagList, CTABlock)
- `@shipwreck/blog-theme-default`: Tailwind preset + CSS-var-driven design tokens
- `examples/demo-site`: full reference integration — paginated index, dynamic post page with ToC/related/author/CTA, tag/category/author archives, 404, robots.txt, redirects generator, RSS, sitemap
- `create-shipwreck-blog`: scaffolder CLI for adding the blog to an existing site
- Docs: `ARCHITECTURE.md`, `INTEGRATION.md`, `CONTRIBUTING.md`, `UPGRADE-GUIDE.md`, `HANDOVER-NYXI.md`

### Added — Phase 1.5 (CMS layer)
- Sveltia CMS pre-wired at `/blog/admin/` (Git-backed, browser-based, free)
- `public/admin/index.html` + `public/admin/config.yml` with form fields mirroring the Zod schema 1:1
- Authors converted from single-file JSON to folder collection (one JSON file per author) so they can be created/edited via the CMS
- `/blog/posts.json` manifest endpoint — JSON list of every published post (id, title, url, tags, category, dates) for AI agents and external tools
- `suggestInternalLinks()` exported from `@shipwreck/blog-core/utils` — heuristic ranker for "what should this post link to"
- INTEGRATION.md updated with "Enable the CMS" section

### Notes
- Distribution: git+ssh URLs, no npm registry yet
- Renderer: Astro 5
- Content format: MDX in git (Sveltia commits MDX back to git)
- Admin: Sveltia CMS dropped in (was Phase 4 — pulled forward as the lightweight option)

