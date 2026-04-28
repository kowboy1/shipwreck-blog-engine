# Content model

The Zod schemas in `packages/blog-core/src/schemas/` define the contract between the engine and consuming sites. This doc explains *why* each piece exists. For field-by-field reference, see [reference/post-frontmatter.md](../reference/post-frontmatter.md) and [reference/site-config.md](../reference/site-config.md).

## Three top-level schemas

| Schema | What it is | Where it lives in a host site |
|---|---|---|
| `postSchema` | Post frontmatter + body | `src/content/posts/*.mdx` (one file per post) |
| `authorSchema` | Author profile | `src/content/authors/*.json` (one file per author) |
| `siteConfigSchema` | Per-site brand/SEO/layout config | `site.config.ts` (one file, exports default) |
| `redirectsSchema` | Static redirect rules | `src/redirects.json` (one file, array) |

All four are exported from `@shipwreck/blog-core`.

## postSchema

The most important schema. Every MDX post in a host site is validated against this at build time.

### Design principles

- **Required fields are minimal:** `title` and `publishDate`. Everything else is optional with sensible defaults.
- **Optional > required + default:** if there's a meaningful "absence" state, the field is optional. If there's a behavioural default that should fire when unset, use `.default(...)`.
- **Constraints fail fast:** `title.max(120)`, `metaTitle.max(70)`, `metaDescription.max(170)`. Better to fail the build than silently truncate at render time.
- **Coerced dates:** `z.coerce.date()` accepts `2026-04-28`, `"2026-04-28"`, or a Date. MDX frontmatter passes strings; this normalizes.

### Categories of fields

The schema groups roughly into:

1. **Core editorial:** title, excerpt, body, publishDate, status
2. **Attribution:** author, category, tags
3. **Media:** featuredImage, featuredImageAlt
4. **SEO basics:** metaTitle, metaDescription, canonical, noindex
5. **Open Graph:** ogTitle, ogDescription, ogImage
6. **Schema.org:** articleType, faqItems
7. **Relations:** relatedPosts (manual override of auto-suggestions), ctaBlock (override)
8. **Editorial flags:** featured, sticky

Most posts will only set 5-10 of these. The rest fall through to defaults.

### How posts get loaded

In a host site's `src/content.config.ts`:

```ts
const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: postSchema,
})
```

The `glob` loader scans the directory and returns each file as an entry. The `id` is the filename without extension (`hello-world.mdx` → `id: "hello-world"`). Astro then enforces `schema` validation at build.

If a file fails validation, the build error includes the file path and the failing field, e.g.:

```
× Post `posts/broken.mdx` failed validation: 
  metaTitle: String must contain at most 70 character(s)
```

## authorSchema

Each author = one JSON file in `src/content/authors/`. The filename is the author's id, used as the `author:` value in posts and in URLs (`/authors/<id>/`).

```json
{
  "name": "Rick",
  "bio": "Builder of Wollongong Weather. ...",
  "url": "https://wollongongweather.com",
  "avatar": "/blog/uploads/rick.jpg"
}
```

Why a folder collection (one file per author) instead of a single `authors.json`?

- Sveltia CMS supports "Create new" only on folder collections
- Easier to track per-author edits in git history
- Avoids merge conflicts when multiple authors are edited simultaneously

## siteConfigSchema

The per-site config. Lives in `site.config.ts` because it's TypeScript (lets you import types and get autocomplete in your editor) but conceptually it's data.

```ts
const config: SiteConfig = {
  siteName: "Wollongong Weather",
  baseUrl: "https://wollongongweather.com",
  blogBasePath: "/blog",
  brand: { ... },
  seo: { ... },
  layout: { ... },     // optional, has defaults
  ctaBlocks: { ... },  // optional
}
export default config
```

### Why nested objects (brand, seo, layout)?

Two reasons:
1. Lets us add fields to a section without bloating the top level
2. Lets sections evolve independently (e.g. adding a `i18n` section later doesn't disturb anything else)

### `layout` defaults

The `layout` block is optional with all-defaults:

```ts
layout: {
  postsPerPage: 10,
  showReadingTime: true,
  showAuthor: true,
  showTableOfContents: true,
  showRelatedPosts: true,
  relatedPostsCount: 3,
}
```

Sites that don't care about these get sensible defaults. Sites that want to disable specific features (e.g. no ToC for a tutorial site that uses very short posts) can opt out per flag.

### `ctaBlocks` shape

```ts
ctaBlocks: {
  default: "book-consult",
  categoryOverrides: { 
    seo: "request-audit",      // posts in category "seo" get this CTA
    pricing: "free-trial",
  }
}
```

Per-post override: a post can set `ctaBlock: "custom-key"` in its frontmatter to win over the default and category override.

## redirectsSchema

```ts
[
  { from: "/old-url/", to: "/new-url/", status: 301 }
]
```

Read by `src/pages/_redirects.ts` at build time, validated, and emitted as a Netlify-style `_redirects` text file. The schema enforces that `status` is one of 301/302/307/308.

## Schema evolution

Pre-1.0: minor versions can add optional fields freely. Removing or renaming = breaking = major.

Post-1.0: any breaking schema change = major bump + UPGRADE-GUIDE entry + migration steps.

For consumers: if you've shadowed a component locally, schema changes might affect how you read post data. Run `astro check` after engine updates to catch these.

## Adding a schema field

1. Edit the relevant Zod schema (`packages/blog-core/src/schemas/<schema>.ts`)
2. Make it optional unless absolutely required
3. Update `examples/demo-site/` to use the new field somewhere
4. Update Sveltia config in `examples/demo-site/public/admin/config.yml` to mirror the new field
5. Update `docs/reference/<relevant>.md` with the field reference
6. Update `CHANGELOG.md` `[Unreleased]`
7. Bump version + commit

Required fields = breaking change. Avoid unless strictly necessary; prefer optional with default.

## Why Zod

- Runtime validation at build time (catches frontmatter errors as fast as TypeScript catches code errors)
- Types are inferred (`type Post = z.infer<typeof postSchema>`) — single source of truth
- Excellent error messages
- Astro's content collections natively integrate with Zod

Alternative considered: TypeBox. Faster runtime, but the Zod ecosystem (and Astro's first-class support) won.
