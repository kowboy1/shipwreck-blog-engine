# Shipwreck Blog Engine

A drop-in, SEO-first blog engine for Shipwreck sites. Built on Astro + MDX.

**Goal:** add a blog to any site, theme it to match, and ship static SEO-optimised HTML — without WordPress.

## Layout

```
packages/
  blog-core/             # @shipwreck/blog-core — schemas, SEO helpers, components
  blog-theme-default/    # @shipwreck/blog-theme-default — Tailwind preset + tokens

examples/
  demo-site/             # reference integration (also serves as the per-site template)

docs/
  ARCHITECTURE.md
  INTEGRATION.md
```

## Quick start (dev)

```bash
npm install
npm run dev
```

Opens the demo site at http://localhost:4321/blog.

## Adding the blog to a site

See [INTEGRATION.md](./INTEGRATION.md) — covers install + theming a host site.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Status

**Phase 1 — Engine MVP** ✓ complete (build verified, 16 pages, full SEO output)

- [x] Monorepo scaffold (npm workspaces)
- [x] Content schemas (Zod): post, site config, author, redirects
- [x] SEO helpers: Article / Organization / BreadcrumbList / FAQPage schema.org, OG + Twitter + meta builder
- [x] Utilities: reading time, slug, related-post ranker
- [x] Reusable Astro components: Breadcrumbs, TableOfContents, RelatedPosts, AuthorBio, PostCard, Pagination, TagList, CTABlock
- [x] Default Tailwind preset + CSS-var tokens
- [x] Demo site: paginated index, dynamic post page, tag/category/author archives, 404, robots.txt, redirects generator, RSS, sitemap
- [x] CTA system (per-site components, registry, category overrides)
- [x] `create-shipwreck-blog` scaffolder CLI
- [x] Docs: ARCHITECTURE, INTEGRATION, CHANGELOG, UPGRADE-GUIDE, CONTRIBUTING, HANDOVER-NYXI
- [x] Build verified end-to-end

**Phase 1.5 — CMS layer** ✓ complete
- [x] Sveltia CMS pre-wired at `/blog/admin/` (Git-backed, free, no server)
- [x] CMS form fields mirror Zod schema 1:1
- [x] Authors converted to folder collection (CMS-manageable)
- [x] `/blog/posts.json` manifest for AI agents + internal-link tooling
- [x] `suggestInternalLinks()` helper exported from blog-core
- [x] Build verified — 16 pages, posts.json + admin assets all in `dist/`

**Phase 2 — Next:**
- [ ] First real integration: Review Removals
- [ ] Create private GitHub repo so engine can be consumed via git+ssh
- [ ] Add OG image generation (Phase 3)
