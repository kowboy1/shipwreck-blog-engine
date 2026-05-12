# Shipwreck Blog Engine — Feature List

> ⚠️ **STOP** — if you are an agent and haven't read [AGENTS.md](AGENTS.md) yet, read that first.
> This is a reference catalogue, not a runbook. Continue here only when you need to look up what's supported / where it lives.
>
> _Current as of engine version **0.4.1** (2026-05-13)._

The canonical, exhaustive list of what the engine ships out of the box. Each item links to its source so an agent can find the implementation in one hop. Items are grouped by concern, not by release.

For per-release detail, see [CHANGELOG.md](CHANGELOG.md). For a plain-English overview, see [HOW-IT-WORKS.md](HOW-IT-WORKS.md). For the agent runbook on integrating into a new site, see [AGENTS.md](AGENTS.md) and [.claude/skills/integrate-shipwreck-blog.md](.claude/skills/integrate-shipwreck-blog.md).

---

## Contents

1. [Content model](#1-content-model)
2. [Page renderers + layouts](#2-page-renderers--layouts)
3. [Rendering components](#3-rendering-components)
4. [Technical SEO](#4-technical-seo)
5. [Schema.org / structured data](#5-schemaorg--structured-data)
6. [GEO (Generative Engine Optimization)](#6-geo-generative-engine-optimization)
7. [Performance + Core Web Vitals](#7-performance--core-web-vitals)
8. [Accessibility](#8-accessibility)
9. [Listing UX (filter sidebar, cards, load-more)](#9-listing-ux)
10. [Authoring + CMS](#10-authoring--cms)
11. [Integration + ops](#11-integration--ops)
12. [Doctor / validation gates](#12-doctor--validation-gates)
13. [Configuration knobs (siteConfig)](#13-configuration-knobs-siteconfig)
14. [Public exports](#14-public-exports-shipwreckblog-core)

---

## 1. Content model

Zod-validated frontmatter at build time — invalid posts fail the build with a clear error.

**Post fields** ([packages/blog-core/src/schemas/post.ts](packages/blog-core/src/schemas/post.ts))

| Field | Required | Notes |
|---|---|---|
| `title` | ✅ | 1–120 chars |
| `publishDate` | ✅ | ISO date, coerced |
| `status` | default `published` | `draft` / `published` / `scheduled` |
| `excerpt` | optional | ≤ 320 chars |
| `body` | optional in frontmatter | normally lives below `---` as MDX |
| `metaTitle` / `metaDescription` | optional | SEO overrides |
| `canonical` | optional | full URL override |
| `noindex` | default false | when true, emits `robots: noindex,nofollow` |
| `author` / `authors[]` | optional | single OR multi-author |
| `category` | optional | one per post |
| `tags[]` | default `[]` | lowercase-hyphenated |
| `featuredImage` + `featuredImageAlt` | **required** when `heroes.policy=required` | doctor-enforced |
| `featuredImageWidth` / `Height` | auto-detected | engine probes SVG / PNG / JPEG; frontmatter override wins |
| `featuredImageAvif` / `Webp` / `Srcset` | optional | enables `<picture>` responsive markup |
| `ogTitle` / `ogDescription` / `ogImage` | optional | per-post OG overrides |
| `articleType` | default `BlogPosting` | `Article` / `BlogPosting` / `NewsArticle` / `TechArticle` |
| `faqItems[]` | optional | emits `FAQPage` JSON-LD |
| `relatedPosts[]` | optional | manual override of related-post ranking |
| `ctaBlock` | optional | per-post CTA registry key |
| `featured` / `sticky` | default false | discovery flags |
| `speakable` | optional | `{ cssSelectors[], xpath[] }` — emits `SpeakableSpecification` |
| `howTo` | optional | `{ name, steps[], totalTime, ... }` — emits `HowTo` JSON-LD |
| `abstract` | optional | one-sentence GEO summary |
| `about[]` / `mentions[]` | optional | Schema.org entity disambiguation |
| `license` | optional | content license URL |
| `copyrightHolder` | optional | defaults to siteConfig brand |
| `isAccessibleForFree` | default true | paywall signal for AI crawlers |

**Author fields** ([packages/blog-core/src/schemas/author.ts](packages/blog-core/src/schemas/author.ts))

| Field | Notes |
|---|---|
| `name` | required |
| `bio` / `description` | short / long |
| `avatar` | image URL |
| `url` | primary URL |
| `twitter` / `linkedin` / `github` / `mastodon` / `website` / `email` | auto-built into Schema.org `sameAs[]` |
| `jobTitle` | E-E-A-T signal |
| `worksFor` | emitted as nested `Organization` |
| `knowsAbout[]` | topical-expertise signal |
| `alumniOf` | nested `EducationalOrganization` |
| `contributorSince` | ISO date, Experience signal |

Helper: [`buildPersonSchema(author)`](packages/blog-core/src/schemas/author.ts) produces a full Schema.org `Person` from any author record.

**Site config** ([packages/blog-core/src/schemas/site-config.ts](packages/blog-core/src/schemas/site-config.ts)) — full list in §13.

---

## 2. Page renderers + layouts

The engine ships **page renderers** (Astro components) that consumer sites use as 10-line wrappers. Engine fixes flow through `npm update`.

| Renderer | Used by | Path |
|---|---|---|
| `PostPage.astro` | `[...slug].astro` per-site | [packages/blog-core/src/pages/PostPage.astro](packages/blog-core/src/pages/PostPage.astro) |
| `ListingPage.astro` | index, paginated, tag, category, author archives | [packages/blog-core/src/pages/ListingPage.astro](packages/blog-core/src/pages/ListingPage.astro) |

**Data prep helpers** (async builders consumed by the page renderers):

| Helper | Purpose |
|---|---|
| `preparePostPageData()` | resolves authors, ranks related posts, builds JSON-LD + meta, picks popular posts |
| `prepareIndexPage()` | un-paginated `/blog/`, includes filter manifest + facets |
| `prepareTagPage()` / `prepareCategoryPage()` / `prepareAuthorPage()` | archive variants |

**Article layout** ([packages/blog-core/src/components/ArticleLayout.astro](packages/blog-core/src/components/ArticleLayout.astro)) — three-column responsive grid `[ToC] [main] [aside]` with graceful collapse when any slot is empty.

---

## 3. Rendering components

All under [packages/blog-core/src/components/](packages/blog-core/src/components/).

| Component | Purpose |
|---|---|
| `PostCard` | Single source of truth for blog cards. `variant="card"` (16:9 hero on top) or `"list"` (text-only). Used by every listing surface. |
| `ResponsivePicture` | Drop-in for `<img>`. Emits `<picture>` with `<source>` entries when AVIF/WebP/srcset variants are declared in frontmatter; falls back to plain `<img>`. |
| `Breadcrumbs` | Visible breadcrumb trail (matches the JSON-LD `BreadcrumbList`). |
| `TableOfContents` | Sticky desktop / collapsible mobile ToC built from H2/H3 in the body. |
| `RelatedPosts` | "More articles" grid on post pages. Renders via `<PostCard>` (no duplicate card markup). Accepts `fallbackImage` to match listing card visuals. |
| `PopularPosts` | Sticky right-column mini-card list on post pages. Powered by `.shipwreck/popularity.json` with recency fallback. |
| `FeaturedPosts` | Older list-style sidebar widget. |
| `BlogFilters` | Live search + sort + tag/category chips + featured-only toggle on `/blog/`. Pure progressive enhancement. |
| `CTABlock` | Per-site CTA registry — sticky right-column on post pages. |
| `AuthorBio` | Bottom-of-post bio block with avatar. |
| `AuthorAvatar` | Reusable avatar with initials fallback. |
| `TagList` | Pill-style tag chips. |
| `Pagination` | Numeric pagination with prev/next + page numbers. Always emitted as fallback even when JS load-more / filters are active. |

---

## 4. Technical SEO

**Meta tags** ([packages/blog-core/src/seo/meta.ts](packages/blog-core/src/seo/meta.ts)) — every blog page emits:

- `<title>`, `<meta name="description">`, `<link rel="canonical">`, `<meta name="robots">`
- OG: `type`, `title`, `description`, `image`, `image:width`, `image:height`, `image:alt`, `url`, `site_name`, `locale`
- Twitter: `card`, `title`, `description`, `image`, `image:alt`, `site`, `creator` (per-author)
- Article: `published_time`, `modified_time`, `author`, `section`, `tag[]`
- `<link rel="alternate" type="application/rss+xml">` — RSS discovery on every page
- `<link rel="prev">` / `<link rel="next">` — paginated listings (Bing/Yandex)
- `<link rel="preload" as="image" fetchpriority="high">` — LCP hero hint on post pages
- `<link rel="preconnect">` / `<link rel="dns-prefetch">` — per-site config

**Sitemaps + feeds**

| File | Generated by | Notes |
|---|---|---|
| `/blog/sitemap-index.xml` + `/blog/sitemap-0.xml` | `@astrojs/sitemap` | All static blog routes |
| `/blog/image-sitemap.xml` | [`buildImageSitemap()`](packages/blog-core/src/api/image-sitemap.ts) | Per-post `<image:image>` entries with title + caption |
| `/blog/rss.xml` | per-site `rss.xml.ts` | Standard Atom-via-RSS |
| `/blog/robots.txt` | per-site `robots.txt.ts` | References both sitemaps |
| `/blog/posts.json` | [`buildPostsManifest()`](packages/blog-core/src/api/posts-manifest.ts) | Public machine-readable manifest of every published post |

**URL hygiene**

- Canonical stays `/blog/` regardless of query strings (filters use `history.replaceState`)
- Posts URL = `/blog/<slug>/` (trailing slash, no extension)
- Paginated: `/blog/page/N/`
- Archives: `/blog/tags/<tag>/`, `/blog/categories/<cat>/`, `/blog/authors/<id>/`
- 404 emitted at `/blog/404/`

**Crawl + indexability**

- Per-post `noindex` toggle (frontmatter `noindex: true`)
- Optional thin-archive `noindex` policy: tag/category/author pages below threshold get `noindex,follow` (`siteConfig.listing.thinArchive`)
- `hreflang` not auto-emitted (multi-region is per-site concern)

---

## 5. Schema.org / structured data

All emitted as `<script type="application/ld+json">` blocks in `<head>` via the consumer BaseLayout.

| Schema | Where | Builder |
|---|---|---|
| `BlogPosting` / `Article` / `NewsArticle` / `TechArticle` | every post | [`articleSchema()`](packages/blog-core/src/seo/schema-org.ts) |
| `BreadcrumbList` | every blog page | `breadcrumbSchema()` |
| `Organization` | listing pages (toggleable via `seo.emitOrganizationSchema`) | `organizationSchema()` |
| `WebSite` | listing pages, off by default (opt-in via `seo.emitWebsiteSchema` for standalone deployments) | `websiteSchema()` |
| `CollectionPage` + nested `ItemList` | `/blog/`, tag/category/author archives | `collectionPageSchema()` |
| `FAQPage` | when `post.faqItems[]` set | `faqSchema()` |
| `SpeakableSpecification` | when `post.speakable` set | `speakableSchema()` |
| `HowTo` + `HowToStep[]` | when `post.howTo` set | `howToSchema()` |
| `Person` (auto-built `sameAs[]` from social fields, plus `knowsAbout`, `jobTitle`, `worksFor`, `alumniOf`, `description`) | inside `Article.author` | `buildPersonSchema()` |
| `ImageObject` with `width` + `height` | `Article.image`, `Organization.logo` | inlined |

**Article schema rich fields** (auto-emitted when source data is available):

- `wordCount` — from remark-reading-time
- `inLanguage` — from `siteConfig.seo.locale`
- `dateCreated` / `datePublished` / `dateModified`
- `image` as typed `ImageObject` with intrinsic width + height (auto-probed)
- `publisher` as `Organization` with `logo` as `ImageObject` (with dimensions when configured)
- `mainEntityOfPage`
- `abstract`, `about[]`, `mentions[]`, `license`, `copyrightHolder`, `isAccessibleForFree` (GEO — see §6)

---

## 6. GEO (Generative Engine Optimization)

Fields that signal to AI answer engines (ChatGPT search, Perplexity, Claude search, Google AI Overviews, Bing Copilot) whether to cite a post — and what to quote.

| Frontmatter | Emits as | Purpose |
|---|---|---|
| `abstract` | `Article.abstract` | One-sentence quotable summary, distinct from meta description |
| `about[]` | `Article.about[]` as bare `Thing` entities | Primary subjects (entity disambiguation) |
| `mentions[]` | `Article.mentions[]` as bare `Thing` entities | Secondary references |
| `license` | `Article.license` | Content license URL (AI-training opt-in/opt-out) |
| `copyrightHolder` | `Article.copyrightHolder` `Organization` | Defaults to brand |
| `isAccessibleForFree` | `Article.isAccessibleForFree` | Default true; false for paywall posts |
| `speakable` | `SpeakableSpecification` | Voice search + Google Assistant signal |
| `howTo` | `HowTo` + `HowToStep[]` | Step-by-step rich result + voice procedural answers |
| `faqItems[]` | `FAQPage` | Most cited schema by AI answer engines |
| Author `knowsAbout[]` + `sameAs[]` | `Person.knowsAbout` + `Person.sameAs` | E-E-A-T author authority |

---

## 7. Performance + Core Web Vitals

**LCP**

- Hero `<img>` carries explicit `width` + `height` (auto-probed from disk), `fetchpriority="high"`, `decoding="async"`
- `<link rel="preload" as="image" fetchpriority="high">` for hero emitted in `<head>`
- Inline-stylesheets enabled by default (`shipwreckBlog({ inlineStylesheets: "auto" })` — Astro inlines small CSS chunks)

**CLS**

- Every engine-rendered `<img>` has intrinsic `width` + `height` attributes (cards, hero, avatars, mini-cards)
- `aspect-[16/9]` enforced on hero + card image slots
- Sentinel CSS class checked at build time by doctor

**INP**

- Filter sidebar JS is event-driven, no polling
- Load-more uses pre-rendered paginated HTML (no client compute)
- View Transitions API used over JS animation libraries

**Resource hints**

- `<link rel="preconnect">` for `siteConfig.seo.preconnects[]`
- `<link rel="dns-prefetch">` for `siteConfig.seo.dnsPrefetches[]`
- `<link rel="alternate" type="application/rss+xml">` on every page

**Modern image formats** (opt-in via frontmatter)

- `featuredImageAvif` / `featuredImageWebp` / `featuredImageSrcset` → `<picture>` markup via `<ResponsivePicture>`
- Site pre-generates variants; engine wires markup (no sharp runtime dep)

---

## 8. Accessibility

- Skip-to-content link emitted as first focusable element on every blog page (`href="#shipwreck-main"`)
- `<main id="shipwreck-main">` wrapper on PostPage + ListingPage
- ARIA: `role="radiogroup"` on filter sort, `aria-pressed` on chips, `aria-controls`/`aria-expanded` on tag see-more toggle, `aria-live="polite"` on filter count badge
- Focus rings: stable visible focus outline on every filter control, links use `:focus-visible` browser default
- `prefers-reduced-motion` honoured: view transitions, FLIP animation, see-more slide all disable
- `<details>` element for mobile filter accordion — works without JS, keyboard accessible by default
- `aria-hidden="true"` + empty `alt` on decorative fallback images

---

## 9. Listing UX

**3-column responsive card grid** (`sm:grid-cols-2 lg:grid-cols-3`)

- Each card: 16:9 hero on top, title (line-clamp behaviour via `font-heading`), excerpt, date + category footer
- Hover state: accent border, title goes accent-blue, hero zoom (`group-hover:scale-[1.02]`)
- Fallback image when post lacks `featuredImage` (configurable via `siteConfig.cards.fallbackImage`)

**Live filter sidebar** ([`BlogFilters.astro`](packages/blog-core/src/components/BlogFilters.astro))

- Search input — debounced, fires after `minSearchChars` (default 3), searches title + excerpt + category + tags + author
- Sort toggle — Newest / Oldest (`aria-pressed` chip pair)
- Category chips — multi-select, post counts visible
- Tag chips — multi-select, post counts, top 6 visible + "See N more →" slide-out
- Featured-only toggle — only renders when site has any `featured: true` posts
- Active filter chip strip under search — click × to remove individual filter
- Clear filters button — visible only when ≥1 filter active
- RSS link footer

**No-reload mechanics**

- Inline `<script id="shipwreck-posts-manifest" type="application/json">` — no extra fetch
- URL state synced via `history.replaceState` — sharable filtered views, refresh-safe
- View Transitions API on grid swap — native FLIP cross-fade per card (`view-transition-name: post-<slug>`)
- `prefers-reduced-motion` disables transitions

**Load-more button** — appends next paginated page's cards (when filters not active). Sits ABOVE the static `<Pagination>` component so JS-off users still navigate.

**View transitions everywhere** — `<ClientRouter />` on both PostPage and ListingPage; smooth navigation across every page type.

---

## 10. Authoring + CMS

**Sveltia CMS** pre-wired at `/blog/admin/` — Git-backed, browser-based, no database, no separate server.

- Mirrors the Zod schema 1:1 (post fields, author fields)
- Authors are a folder collection (one JSON per author)
- Images upload to `public/uploads/`
- Commits as `content(blog): publish "..."` patterns

**MDX content support** — full Markdown + embedded components via `@astrojs/mdx`.

**Remark plugins** (auto-wired via `shipwreckBlog()` integration):

- `remarkStripDuplicateH1` — strips body H1s that fuzzy-match the title; downgrades unrelated body H1s to H2; emits build-log warnings ([packages/blog-core/src/remark/strip-duplicate-h1.mjs](packages/blog-core/src/remark/strip-duplicate-h1.mjs))
- Consumer can append more plugins via `shipwreckBlog({ extraRemarkPlugins: [...] })`

**Seed content** — `npx shipwreck-blog-doctor seed-posts` writes 3 site-themed placeholder posts (Welcome / Three things / Getting started) with FAQ items + a bundled seed-hero SVG. Each post explicitly self-identifies as seed content so real visitors aren't confused.

**Agent skill for adding posts** — [.claude/skills/add-shipwreck-blog-post.md](.claude/skills/add-shipwreck-blog-post.md) walks any agent (NyXi, Claude, etc.) through the full add-post flow including the mandatory hero-image generation in Phase 7.5.

---

## 11. Integration + ops

**Astro integration** ([packages/blog-core/src/integration.ts](packages/blog-core/src/integration.ts))

```ts
import shipwreckBlog from "@shipwreck/blog-core/integration"
integrations: [shipwreckBlog()]
```

Auto-registers the engine's remark plugins + sets `build.inlineStylesheets` (default `"auto"`).

**Site registry** — [.shipwreck/sites.json](.shipwreck/sites.json) tracks every site running the engine. Entries include name, domain, engine version, deploy mechanism, owner.

**Per-site metadata** — `.shipwreck-site.json` at the site repo root (engine version, last deployed, etc.).

**Per-site analytics data** — `.shipwreck/popularity.json` (rolling 30-day pageviews) drives the Popular articles widget. Reference Cloudflare Web Analytics producer at [scripts/refresh-popularity.mjs](scripts/refresh-popularity.mjs).

**Per-site art direction** — `.shipwreck/art-direction.json` (style, palette, aspect ratio, subject hint, avoid list) drives the hero-image generation flow in the add-post skill. Schema at [packages/blog-core/src/schemas/art-direction.ts](packages/blog-core/src/schemas/art-direction.ts).

**Update path** — `npm update @shipwreck/blog-core @shipwreck/blog-theme-default` in any consumer site picks up the latest engine. No per-site code changes for additive releases.

**Deploy** — engine doesn't own deploy. Static `dist/` from `npm run build` is what ends up on the host. Use whatever the host already does (Cloudflare Pages, rsync, SFTP, manual upload). [ROLLOUT.md](ROLLOUT.md) covers patterns.

---

## 12. Doctor / validation gates

`npx shipwreck-blog-doctor` ([packages/blog-core/bin/doctor.mjs](packages/blog-core/bin/doctor.mjs)) — preflight + post-install + closeout gate.

**Modes**

| Mode | Purpose |
|---|---|
| Default (no flag) | Full closeout gate — required to declare an integration done |
| `--preflight` | Install-level only (engine resolves, file: deps work) |
| `--lite` | Technical only — skips procedural gates (Phase 9 attestations etc.) |
| `--skip-build` | Skip the build step (faster) |
| `--json` | Machine-readable output |
| `--contract-version` | Prints completion contract version |

**Subcommands**

| Subcommand | Purpose |
|---|---|
| `seed-posts` | Generate 3 site-themed seed posts + bundled hero SVG |
| `heroes` (+ `--json`) | List posts missing `featuredImage` + dump art direction |
| `attest-start` | Record integration start time |
| `attest-phase9 <json>` | Attest Phase 9 questions were asked |
| `attest-feedback provided <file>` / `none-needed <reason>` | Attest feedback decision |
| `attest-nav-link approved` / `declined` | Attest nav-link decision |
| `print-completion` | Emit canonical audit-trail block (agent's reply uses this verbatim) |

**Checks** (all green for closeout)

- Engine packages resolve (file: deps not broken)
- `site.config.ts` exists + non-placeholder
- `tokens.css` exists (Phase 2 done)
- SiteShell `Header.astro` + `Footer.astro` customised (Phase 3 done)
- `global.css` doesn't import engine tokens (cascade-order bug)
- No demo posts in `src/content/posts/` (Phase 1.5 done)
- Hero policy: every published post has `featuredImage` (when `heroes.policy=required`)
- `npm run build` succeeds
- Built CSS contains every engine sentinel utility class (catches Tailwind-content-path bugs)
- Every built post page has exactly **1** `<h1>` (defence-in-depth on duplicate-H1 bug)
- Source-vs-deploy layout guard (don't overwrite the host with `dist/`)
- popularity.json freshness (warn if >30 days old)
- Phase 7a footer-link present in host site (≥50% of footer-bearing files)
- Phase 7b nav-link state matches host markup
- Phase 9 attestations recorded
- Feedback file referenced OR explicitly declared none-needed

**Completion contract** — `COMPLETION_CONTRACT_VERSION` (currently `1`) at the top of `doctor.mjs`. Bumped only when the runtime-side skill needs to be updated. Runtime layer (Nyxi-side AGENTS.md + final-gate skill) keys off this.

---

## 13. Configuration knobs (`siteConfig`)

Top-level `siteConfig` in per-site `site.config.ts`. Full Zod schema at [packages/blog-core/src/schemas/site-config.ts](packages/blog-core/src/schemas/site-config.ts).

```ts
{
  siteName: string,
  baseUrl: string,
  blogBasePath: string,  // default "/blog"

  brand: {
    organizationName: string,
    logoUrl?: string,
    logoWidth?: number,    // Schema.org publisher.logo dims
    logoHeight?: number,
    primaryColor?: string,
    accentColor?: string,
  },

  seo: {
    defaultOgImage?: string,
    defaultFeaturedImage?: string,
    defaultAuthorAvatar?: string,
    twitterHandle?: string,
    locale: string,                          // default "en_AU"
    preconnects?: string[],                  // emitted as <link rel="preconnect">
    dnsPrefetches?: string[],                // emitted as <link rel="dns-prefetch">
    emitOrganizationSchema: boolean,         // default true; false on Keel-hosted sites
    emitWebsiteSchema: boolean,              // default false; true for standalone blog
  },

  layout: {
    postsPerPage: number,                    // default 10
    showReadingTime: boolean,
    showAuthor: boolean,
    showTableOfContents: boolean,
    showRelatedPosts: boolean,
    relatedPostsCount: number,               // default 3
  },

  ctaBlocks?: {
    default?: string,
    categoryOverrides?: Record<string, string>,
  },

  cards: {
    fallbackImage?: string,                  // 16:9 placeholder when post lacks featuredImage
    loadMore: boolean,                       // default true
  },

  heroes: {
    policy: "required" | "optional",         // default required
  },

  sidebar: {
    popular: {
      enabled: boolean,
      limit: number,                         // default 5
      heading: string,                       // default "Popular articles"
    },
  },

  featuredPostsForSidebar?: string[],        // pin override > popularity.json > recency

  listing: {
    filters: {
      enabled: boolean,
      showCategories: boolean,
      showTags: boolean,
      showFeaturedToggle: "auto" | "always" | "never",
      minSearchChars: number,                // default 3
      searchDebounceMs: number,              // default 120
      tagsVisibleLimit: number,              // default 6
      heading: string,
    },
    sidebar: {
      showRss: boolean,
      showPopular: boolean,                  // reserved for future Popular-this-month sidebar item
      popularLimit: number,
    },
    thinArchive: {
      noindex: boolean,                      // default false
      threshold: number,                     // default 3
    },
  },
}
```

---

## 14. Public exports (`@shipwreck/blog-core`)

```ts
// Page renderers
import PostPage from "@shipwreck/blog-core/pages/PostPage.astro"
import ListingPage from "@shipwreck/blog-core/pages/ListingPage.astro"
import {
  preparePostPageData,
  prepareIndexPage,
  prepareTagPage,
  prepareCategoryPage,
  prepareAuthorPage,
} from "@shipwreck/blog-core"

// Components
import PostCard from "@shipwreck/blog-core/components/PostCard.astro"
import ResponsivePicture from "@shipwreck/blog-core/components/ResponsivePicture.astro"
import BlogFilters from "@shipwreck/blog-core/components/BlogFilters.astro"
import PopularPosts from "@shipwreck/blog-core/components/PopularPosts.astro"
import RelatedPosts from "@shipwreck/blog-core/components/RelatedPosts.astro"
import AuthorBio from "@shipwreck/blog-core/components/AuthorBio.astro"
import AuthorAvatar from "@shipwreck/blog-core/components/AuthorAvatar.astro"
import Breadcrumbs from "@shipwreck/blog-core/components/Breadcrumbs.astro"
import TableOfContents from "@shipwreck/blog-core/components/TableOfContents.astro"
import TagList from "@shipwreck/blog-core/components/TagList.astro"
import Pagination from "@shipwreck/blog-core/components/Pagination.astro"
import CTABlock from "@shipwreck/blog-core/components/CTABlock.astro"

// SEO builders
import {
  buildPostMeta,
  articleSchema,
  breadcrumbSchema,
  organizationSchema,
  websiteSchema,
  collectionPageSchema,
  faqSchema,
  speakableSchema,
  howToSchema,
  type MetaTags,
  type MetaLink,
  type ArticleAuthor,
} from "@shipwreck/blog-core"

// Schemas (Zod)
import {
  postSchema,
  authorSchema,
  siteConfigSchema,
  redirectsSchema,
  artDirectionSchema,
  popularitySchema,
  buildPersonSchema,
  type Post,
  type AuthorRecord,
  type SiteConfig,
  type ArtDirection,
  type Popularity,
} from "@shipwreck/blog-core"

// API helpers
import {
  buildPostsManifest,        // → /blog/posts.json
  buildFilterFacets,         // → BlogFilters chip counts
  buildImageSitemap,         // → /blog/image-sitemap.xml
  type PostsManifest,
  type PostManifestEntry,
  type FilterFacets,
} from "@shipwreck/blog-core"

// Utils
import {
  rankRelatedPosts,
  readingTimeLabel,
  slugify,
  suggestInternalLinks,
  getPostAuthorIds,
  loadPopularityFile,
  selectPopularPosts,
  probeFeaturedImageSize,
} from "@shipwreck/blog-core/utils"

// Astro integration
import shipwreckBlog from "@shipwreck/blog-core/integration"

// Remark plugin
import { remarkStripDuplicateH1 } from "@shipwreck/blog-core/remark/strip-duplicate-h1"
```

---

## What's intentionally NOT in the engine

For pointers / future references:

- **Auth + paywall** — out of scope. `isAccessibleForFree: false` is a signal, not an enforcer.
- **Comments** — bring your own (Disqus / Giscus / Cusdis embedded if you want them).
- **Search-as-you-type across all sites** — per-site only via the live filter sidebar; cross-site search is the host's job.
- **Image processing (sharp/AVIF/WebP encoding)** — opt-in via frontmatter variants; engine doesn't encode.
- **Multi-language i18n** — single-language per site; multi-region uses per-site `hreflang` decisions.
- **Site identity schemas** (`LocalBusiness`, `Product`, `Service`) — owned by the parent site framework (Keel) when present. Engine emits `Organization` only when no parent owns it.

---

## See also

- [HOW-IT-WORKS.md](HOW-IT-WORKS.md) — human-language explainer (no API surface)
- [ARCHITECTURE.md](ARCHITECTURE.md) — package layout + design decisions
- [AGENTS.md](AGENTS.md) — agent runbook entrypoint
- [.claude/skills/integrate-shipwreck-blog.md](.claude/skills/integrate-shipwreck-blog.md) — install runbook
- [.claude/skills/add-shipwreck-blog-post.md](.claude/skills/add-shipwreck-blog-post.md) — add-post runbook
- [CHANGELOG.md](CHANGELOG.md) — version history with per-release migration notes
