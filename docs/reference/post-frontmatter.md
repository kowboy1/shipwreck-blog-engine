# Reference: Post frontmatter

Every `.mdx` file in `_blog/src/content/posts/` has YAML frontmatter validated by `postSchema` in `@shipwreck/blog-core`. The `id` of a post is its filename without extension.

## Required fields

| Field | Type | Constraints |
|---|---|---|
| `title` | string | 1–120 chars |
| `publishDate` | date | YYYY-MM-DD or ISO. Coerced from string |

Everything else is optional.

## Editorial fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `excerpt` | string | — | Max 320 chars. Used on cards and as fallback meta description |
| `body` | string | — | Set automatically from MDX content. Don't set in frontmatter |
| `updatedDate` | date | — | When set, shown alongside publishDate. Used in `dateModified` schema |
| `status` | enum | `"published"` | One of `"draft" \| "published" \| "scheduled"`. Drafts don't appear in listings or sitemap |
| `author` | string | — | ID of an author file (filename of `_blog/src/content/authors/<id>.json`) |
| `category` | string | — | Single category slug. Drives the category archive page and CTA category overrides |
| `tags` | string[] | `[]` | List of tag slugs. Drives tag archive pages |

## Media

| Field | Type | Notes |
|---|---|---|
| `featuredImage` | string | Path or URL. Shown on PostCard and as fallback OG image |
| `featuredImageAlt` | string | Alt text. Should describe the image, not "featured image of …" |

## SEO basics

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `metaTitle` | string | Max 70 chars | Override `<title>`. Defaults to `title` |
| `metaDescription` | string | Max 170 chars | `<meta name="description">`. Defaults to excerpt |
| `canonical` | string (URL) | — | Override canonical URL. Defaults to the post's own URL |
| `noindex` | boolean | — | Default `false`. When true, emits `noindex,nofollow` |

## Open Graph

All optional. When unset, fall back to base meta values.

| Field | Type | Notes |
|---|---|---|
| `ogTitle` | string | Override OG title. Defaults to `metaTitle` then `title` |
| `ogDescription` | string | Override OG description |
| `ogImage` | string | Override OG image. Defaults to `featuredImage` then `siteConfig.seo.defaultOgImage` |

## Schema.org

| Field | Type | Default | Notes |
|---|---|---|---|
| `articleType` | enum | `"BlogPosting"` | One of `"Article" \| "BlogPosting" \| "NewsArticle" \| "TechArticle"` |
| `faqItems` | array | — | When set, emits `FAQPage` JSON-LD. Each item: `{ question: string, answer: string }` |

## Relations

| Field | Type | Notes |
|---|---|---|
| `relatedPosts` | string[] | Manual override of auto-suggested related posts. List of post IDs. If 3+ entries, auto-suggestion is skipped |
| `ctaBlock` | string | Override the CTA for this post. Wins over category override and default |

## Editorial flags

| Field | Type | Default | Notes |
|---|---|---|---|
| `featured` | boolean | `false` | Reserved for "featured posts" sidebar / homepage |
| `sticky` | boolean | `false` | Reserved for "sticky to top of listings" |

## Full example

```mdx
---
title: "What is an East Coast Low? A plain-English Wollongong guide"
excerpt: "ECLs are the storms that close the M1, flood the Princes, and shut Bulli Pass."
publishDate: 2026-04-26
updatedDate: 2026-04-28
status: published
author: "rick"
category: "severe"
tags: ["east-coast-low", "severe", "wollongong", "illawarra"]

featuredImage: "/blog/uploads/ecl-2016.jpg"
featuredImageAlt: "Storm clouds over Wollongong harbour during the June 2016 East Coast Low"

metaTitle: "East Coast Low: a plain-English guide for Wollongong & the Illawarra"
metaDescription: "What an East Coast Low is, when they hit Wollongong, what damage they cause, and the BOM warnings that matter most for the Illawarra."

ogImage: "/blog/uploads/ecl-2016-og.jpg"

articleType: BlogPosting

faqItems:
  - question: "When is East Coast Low season in Wollongong?"
    answer: "Most ECLs hit between April and September, with a clear peak in late autumn and winter."
  - question: "What's the difference between an ECL and a normal southerly?"
    answer: "An ECL is a closed cyclonic low that gets stuck off the coast for days. A southerly buster is a frontal change that moves through in hours."

relatedPosts:
  - "uv-index-illawarra"
  - "winter-storms-illawarra"

ctaBlock: "weather-warnings-signup"

featured: true
sticky: false
---

# Post title (often duplicates frontmatter title — Astro doesn't auto-render H1)

Body content in MDX...
```

## Defaults summary

If you set only `title` and `publishDate`, you get:

- Status: `published`
- Tags: `[]`
- noindex: `false`
- articleType: `BlogPosting`
- featured / sticky: `false`
- All optional SEO fields: derived from `title` / `excerpt` / site defaults
- No author shown
- No CTA shown
- No FAQ schema

That's a valid post that will build successfully.

## Validation errors

Common ones:

- `title: String must contain at least 1 character(s)` — empty title
- `metaTitle: String must contain at most 70 character(s)` — too long
- `metaDescription: String must contain at most 170 character(s)` — too long
- `publishDate: Expected date, received string` — usually means the date format is wrong
- `Invalid input` on `articleType` — value isn't in the enum

The error includes the file path so you can find the offending post fast.
