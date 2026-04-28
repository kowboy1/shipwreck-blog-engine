# Architecture deep-dive

This is the "how does it actually work" doc. Read [README.md](./README.md) first for the layer overview.

## Data flow at build time

```
.mdx files in src/content/posts/    site.config.ts
        │                                  │
        │                                  │
        ▼                                  ▼
   ┌─────────────────┐              ┌──────────────────┐
   │ Astro Content   │              │ SiteConfig       │
   │ Collection      │              │ (Zod-validated)  │
   │ + Zod schema    │              └─────────┬────────┘
   └─────────┬───────┘                        │
             │                                │
             │  validated Post objects        │
             ▼                                │
   ┌─────────────────────────────────────────┴──────┐
   │  Page route: src/pages/[...slug].astro         │
   │  - reads post                                  │
   │  - calls buildPostMeta() → meta tags           │
   │  - calls articleSchema() → Article JSON-LD     │
   │  - calls breadcrumbSchema() → Breadcrumb JSON  │
   │  - calls rankRelatedPosts() → related list     │
   │  - renders BaseLayout + Content + components   │
   └────────────────────┬───────────────────────────┘
                        │
                        ▼
                 static HTML in dist/
```

## Package boundaries

### `@shipwreck/blog-core`

**What it owns:**
- The Zod schemas (Post, Author, SiteConfig, Redirects). These are the contract between sites and the engine.
- SEO helpers: `buildPostMeta`, `articleSchema`, `organizationSchema`, `breadcrumbSchema`, `faqSchema`
- Utilities: `slugify`, `readingTimeLabel`, `rankRelatedPosts`, `suggestInternalLinks`, `buildPostManifest`
- Reusable Astro components: Breadcrumbs, TableOfContents, RelatedPosts, AuthorBio, PostCard, Pagination, TagList, CTABlock

**What it does NOT own:**
- Anything site-specific (brand, copy, host chrome)
- Content storage (that's MDX in the host site repo)
- Auth (no admin)
- Routing (that's Astro's pages folder, owned by the demo-site / per-site templates)

### `@shipwreck/blog-theme-default`

**What it owns:**
- Tailwind preset (CSS-var-driven theme tokens)
- `tokens.css` with default values
- The token contract: variable names that components expect to exist

**Why it's separate from blog-core:**
- Lets sites swap the theme without forking blog-core
- Lets us ship multiple themes later without breaking the API
- Keeps the logic layer free of CSS

### `examples/demo-site`

**What it is:**
- A working Astro site that uses both packages
- The reference integration. If a site can't make their integration look right, comparing against the demo site is the diagnostic
- Doubles as the template that gets copied into host sites (manually or via the scaffolder)

**What it does NOT do:**
- Test the engine programmatically (no automated tests yet)
- Ship as an npm package (it's a workspace member, not a publishable artifact)

### `create-shipwreck-blog`

**What it is:**
- A small Node CLI that copies `examples/demo-site/` into a target directory
- Prompts for site name, URL, brand info
- Rewrites `site.config.ts` and `package.json` with the answers
- Doesn't run `npm install` — leaves that to the user (lets them inspect first)

## The component shadowing pattern

Astro lets host sites override engine components by placing a same-named file at the same path. Engine ships:

```
node_modules/@shipwreck/blog-core/src/components/Breadcrumbs.astro
```

Host site can shadow:

```
_blog/src/components/Breadcrumbs.astro
```

…and Astro picks the local version when imported. This is how host sites customize without forking the engine.

**When to shadow vs land in core:**

- One-off site-specific tweak → shadow locally
- Generally useful → land in core, document in CHANGELOG

## SiteShell pattern (for theming)

The blog index/post pages render through `BaseLayout.astro`, which wraps content in:

```
<body>
  <Header />     ← per-site SiteShell/Header.astro (NOT in blog-core)
  <main>...</main>
  <Footer />     ← per-site SiteShell/Footer.astro
</body>
```

`Header.astro` and `Footer.astro` are intentionally site-local, not engine-provided. Each integration ports the host site's chrome here. The engine never tries to provide a default header that "matches" — that's impossible without knowing the host. See [theming.md](./theming.md) for the porting recipe.

## CTA registry pattern

Site config declares what CTAs exist:

```ts
ctaBlocks: {
  default: "explore-forecast",
  categoryOverrides: { surf: "explore-forecast" }
}
```

Site code provides the components in `_blog/src/components/cta/registry.ts`:

```ts
import ExploreForecast from "./ExploreForecast.astro"
export const ctaRegistry = { "explore-forecast": ExploreForecast }
```

The post page passes `ctaRegistry`, `siteConfig`, and the post's category to `<CTABlock>`, which looks up which CTA component to render. This keeps the CTA logic in the engine (no per-site duplication of "which CTA goes where") while keeping the actual CTA components site-specific (no per-site cruft in the engine).

## Content collections + Zod

Astro's content collections do two things for us:

1. **Type-safe content access:** `getCollection("posts")` returns typed entries
2. **Build-time validation:** bad frontmatter fails the build with a precise error

The `glob` loader scans `src/content/posts/` for `.mdx`/`.md` files. The `id` is derived from the filename (`hello-world.mdx` → `id: "hello-world"`).

For authors, we use a folder-based glob loader so each author is its own JSON file. This makes them creatable from Sveltia (folder-based collections support "Create new").

## SEO output pipeline

For each post page render:

1. `buildPostMeta(post, siteConfig, url)` → returns a `MetaTags` object
2. `BaseLayout` reads `MetaTags` and emits `<title>`, `<meta name="description">`, OG tags, Twitter Card tags, canonical, robots, and `article:*` tags
3. `articleSchema(...)` → JSON-LD object
4. `breadcrumbSchema(...)` → JSON-LD object
5. `faqSchema(...)` if `faqItems` present → JSON-LD object
6. All JSON-LD blocks rendered as `<script type="application/ld+json">`

Sitemap is generated by `@astrojs/sitemap` from page routes. RSS is generated by `src/pages/rss.xml.ts` using `@astrojs/rss`.

## The redirects file

`_blog/src/redirects.json` is a plain array of `{ from, to, status }`. It's:

- Validated by Zod at build time (`redirectsSchema`)
- Read by `src/pages/_redirects.ts` which emits a Netlify-style `_redirects` text file

This format works for Netlify, Cloudflare Pages, and similar static hosts. Apache/Nginx hosts need a separate translation step (not yet shipped).

## Reading time

Implemented as a remark plugin (`src/lib/remark-reading-time.mjs`) wired into `astro.config.ts`. The plugin walks the AST, counts words, writes `wordCount` into the page frontmatter. The post page reads `wordCount` and passes it to `readingTimeLabel(...)` which divides by ~220 wpm.

Why a remark plugin? Because we want the count for the *rendered* MDX, after components are stripped — not just the raw frontmatter excerpt.

## Why Astro

Considered alternatives:

- **Next.js static export** — heavier, slower builds, more deps, opinionated about routing
- **Eleventy** — simpler but no component model, harder to ship reusable UI
- **Hugo** — fast but Go templating fights against the Tailwind/component ergonomics
- **Custom React+Vite SSG** — would have to build half of what Astro does for free (sitemap, content collections, MDX)

Astro wins on: built-in content collections with Zod, free sitemap/RSS integrations, MDX as a first-class feature, zero-JS by default, hybrid static/SSR if we ever need it.

Cost: Astro ecosystem is smaller than Next.js, so some niche integrations don't exist. So far this hasn't bitten us.

## Build performance

Current state (3 posts in demo, ~200 in real sites):

- Cold install: ~50s
- Cold build: ~1.5s
- Warm rebuild on file change: ~50ms

Should scale linearly with post count. If we hit 1000+ posts and builds get slow, we'd add incremental builds (Astro supports this via `--watch` or future `@astrojs/incremental`).
