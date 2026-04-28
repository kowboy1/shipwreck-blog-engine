# Reference: SiteConfig

The shape of `_blog/site.config.ts` in a host site. Validated by `siteConfigSchema` in `@shipwreck/blog-core`.

```ts
import type { SiteConfig } from "@shipwreck/blog-core"

const config: SiteConfig = { /* ... */ }
export default config
```

## Top-level fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `siteName` | `string` | yes | — | Shown in nav, used in OG `og:site_name` |
| `baseUrl` | `string` (URL) | yes | — | Production URL, no trailing slash. Used for canonical, OG, sitemap |
| `blogBasePath` | `string` | no | `"/blog"` | Where the blog mounts on the host. Use `"/"` for subdomain deploys |
| `brand` | `object` | yes | — | See "brand" below |
| `seo` | `object` | yes | — | See "seo" below |
| `layout` | `object` | no | (all defaults) | See "layout" below |
| `ctaBlocks` | `object` | no | — | See "ctaBlocks" below |

## `brand`

| Field | Type | Required | Notes |
|---|---|---|---|
| `organizationName` | `string` | yes | Used in Organization schema.org |
| `logoUrl` | `string` | no | Path or absolute URL. Used in Organization schema |
| `primaryColor` | `string` | no | Hex/RGB. For reference; tokens override CSS |
| `accentColor` | `string` | no | Same |

## `seo`

| Field | Type | Required | Notes |
|---|---|---|---|
| `defaultOgImage` | `string` | no | Fallback OG image when post doesn't set one |
| `defaultFeaturedImage` | `string` | no | Fallback hero/card image when post doesn't set `featuredImage`. Used by `<PostCard>`, `<FeaturedPosts>`, and the post hero |
| `defaultAuthorAvatar` | `string` | no | Fallback avatar when an author entry has no `avatar` field. Used by `<AuthorAvatar>` and `<AuthorBio>` (added v0.1.2) |
| `twitterHandle` | `string` | no | Format: `"@handle"`. Used in Twitter Card |
| `locale` | `string` | no | Default `"en_AU"`. Used in OG `og:locale` |

## `layout`

All fields optional with defaults shown:

| Field | Type | Default | Effect |
|---|---|---|---|
| `postsPerPage` | `number` | `10` | Pagination size on index + archives |
| `showReadingTime` | `boolean` | `true` | Show "X min read" on post pages |
| `showAuthor` | `boolean` | `true` | Show author byline on post pages |
| `showTableOfContents` | `boolean` | `true` | Render `<TableOfContents>` on post pages |
| `showRelatedPosts` | `boolean` | `true` | Render `<RelatedPosts>` on post pages |
| `relatedPostsCount` | `number` | `3` | How many related posts to show |

## `ctaBlocks`

| Field | Type | Required | Notes |
|---|---|---|---|
| `default` | `string` | no | Key from site's CTA registry. Used when post doesn't override |
| `categoryOverrides` | `Record<string, string>` | no | Map of `category → ctaKey`. Wins over `default`, loses to per-post `ctaBlock` |

Resolution order, highest priority first:

1. Post's `ctaBlock` frontmatter field (per-post override)
2. `categoryOverrides[post.category]`
3. `default`
4. (none — no CTA renders)

## Full example

```ts
import type { SiteConfig } from "@shipwreck/blog-core"

const config: SiteConfig = {
  siteName: "Wollongong Weather",
  baseUrl: "https://wollongongweather.com",
  blogBasePath: "/blog",
  brand: {
    organizationName: "Wollongong Weather",
    logoUrl: "/assets/favicon.svg",
    primaryColor: "#7dd3fc",
    accentColor: "#67e8f9",
  },
  seo: {
    defaultOgImage: "https://wollongongweather.com/assets/og-image.svg",
    locale: "en_AU",
    twitterHandle: "@wollongongwx",
  },
  layout: {
    postsPerPage: 10,
    showReadingTime: true,
    showAuthor: true,
    showTableOfContents: true,
    showRelatedPosts: true,
    relatedPostsCount: 3,
  },
  ctaBlocks: {
    default: "explore-forecast",
    categoryOverrides: {
      surf: "explore-forecast",
      severe: "explore-forecast",
    },
  },
}

export default config
```

## Validation errors

If `site.config.ts` is malformed, the build fails. Common errors:

- `baseUrl` not a URL → `Expected URL, received "example.com"` (needs scheme)
- `siteName` empty → `String must contain at least 1 character(s)`
- Missing `brand.organizationName` → `Required`

Fix the config and rebuild.
