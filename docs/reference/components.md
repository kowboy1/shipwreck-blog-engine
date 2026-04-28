# Reference: Components

Every Astro component exported from `@shipwreck/blog-core/components/`. Import paths follow the pattern:

```astro
---
import Breadcrumbs from "@shipwreck/blog-core/components/Breadcrumbs.astro"
---
```

## Breadcrumbs

Renders a breadcrumb trail with structured nav semantics.

**Props:**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `items` | `Array<{ name: string, url?: string }>` | yes | Last item is treated as current page, no link |

**Usage:**

```astro
<Breadcrumbs items={[
  { name: "Home", url: "https://example.com" },
  { name: "Blog", url: "https://example.com/blog" },
  { name: post.data.title }, // current
]} />
```

**Output:** `<nav aria-label="Breadcrumb">` with an `<ol>` of items separated by `/`.

---

## TableOfContents

Auto-generated from MDX headings.

**Props:**

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `headings` | `MarkdownHeading[]` | yes | — | From Astro's `render()` return value |
| `minDepth` | `number` | no | `2` | Inclusive lower bound (h2) |
| `maxDepth` | `number` | no | `4` | Inclusive upper bound (h4). Bumped from `3` in v0.1.1 |
| `title` | `string` | no | `"On this page"` | Heading shown above the list |
| `sticky` | `boolean` | no | `false` | Sticky positioning on `lg:` breakpoint (added v0.1.1) |

**Usage:**

```astro
---
const { Content, headings } = await render(post)
---
<TableOfContents headings={headings} sticky />
```

**Output:** `<nav>` with title + ordered list of links to heading anchors. Indents h3/h4 progressively.

---

## ArticleLayout

Three-column responsive grid for article pages. Added in v0.1.1.

**Slots:**

| Slot | Purpose |
|---|---|
| `toc` | Left column. Typically `<TableOfContents sticky />` |
| (default) | Main column. Article header + body + tags + CTA + related |
| `aside` | Right column. Typically `<FeaturedPosts sticky />` |

Grid collapses to fewer columns when `toc` or `aside` is empty. On mobile (<1024px) it stacks vertically; the ToC becomes a `<details>` accordion.

```astro
<ArticleLayout>
  <TableOfContents slot="toc" headings={headings} sticky />
  <FeaturedPosts slot="aside" posts={featured} basePath={base} sticky />
  <article class="prose"><Content /></article>
</ArticleLayout>
```

---

## FeaturedPosts

Sidebar list of featured (or recent) posts with thumbnails. Added in v0.1.1.

**Props:**

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `posts` | `Array<{id, data: Post}>` | yes | — | Caller controls ordering and selection |
| `basePath` | `string` | yes | — | Blog base path |
| `title` | `string` | no | `"Featured articles"` | Section heading |
| `defaultImage` | `string` | no | — | Fallback when a post has no `featuredImage` |
| `sticky` | `boolean` | no | `false` | Sticky positioning on `lg:` breakpoint |
| `limit` | `number` | no | `5` | Max items to render |

Renders nothing if `posts` is empty.

---

## RelatedPosts

Renders a list of related posts using `<PostCard>` for each.

**Props:**

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `posts` | `Array<{ id, data: Post }>` | yes | — | Sorted by relevance, usually from `rankRelatedPosts()` |
| `basePath` | `string` | yes | — | Blog base path for URL construction |
| `title` | `string` | no | `"Related posts"` | Section heading |

**Usage:**

```astro
---
const related = rankRelatedPosts({ current: post, candidates: all, limit: 3 })
---
<RelatedPosts posts={related} basePath={siteConfig.blogBasePath} />
```

---

## AuthorBio

Renders an author card with avatar, bio, and social links.

**Props:**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `author` | `AuthorRecord` | yes | The Zod-validated author entry |

**Usage:**

```astro
---
const authorEntry = await getEntry("authors", post.data.author)
---
{authorEntry && <AuthorBio author={authorEntry.data} />}
```

**Output:** Card with avatar (if set), name, bio (if set), and links to website/Twitter/LinkedIn (if set).

---

## PostCard

Single-post preview card for use in lists.

**Props:**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `post` | `{ id: string, data: Post }` | yes | Astro content collection entry |
| `basePath` | `string` | yes | Blog base path |
| `defaultImage` | `string` | no | Fallback image when post has no `featuredImage` (added v0.1.1) |

**Usage:**

```astro
{posts.map((p) => (
  <PostCard
    post={p}
    basePath={siteConfig.blogBasePath}
    defaultImage={siteConfig.seo.defaultFeaturedImage}
  />
))}
```

**Output:** Optional featured image + title + excerpt + date/category line. Linked to the post page.

---

## Pagination

Page-number pagination for index/archive routes.

**Props:**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `current` | `number` | yes | Current page (1-indexed) |
| `total` | `number` | yes | Total pages |
| `basePath` | `string` | yes | Blog base path |

**Usage:**

```astro
<Pagination current={2} total={5} basePath="/blog" />
```

**Output:** Renders nothing if `total <= 1`. Otherwise: prev / page numbers / next.

URLs follow `<basePath>/` for page 1, `<basePath>/page/N/` for page > 1.

---

## TagList

List of tag chips, each linked to its archive page.

**Props:**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `tags` | `string[]` | yes | Tag slugs |
| `basePath` | `string` | yes | Blog base path |

**Usage:**

```astro
<TagList tags={post.data.tags} basePath={siteConfig.blogBasePath} />
```

URLs: `<basePath>/tags/<encoded-tag>/`. Tags are lowercased for URL.

---

## CTABlock

Renders a CTA component looked up from a per-site registry.

**Props:**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `siteConfig` | `SiteConfig` | yes | Used to read CTA defaults + category overrides |
| `category` | `string` | no | Post's category. Used for category-override resolution |
| `postOverride` | `string` | no | Per-post `ctaBlock` value. Wins over everything |
| `registry` | `Record<string, AstroComponent>` | yes | Per-site registry mapping keys to components |

**Usage:**

```astro
---
import { ctaRegistry } from "../components/cta/registry"
---
<CTABlock
  siteConfig={siteConfig}
  category={post.data.category}
  postOverride={post.data.ctaBlock}
  registry={ctaRegistry}
/>
```

Resolution order: `postOverride` → `categoryOverrides[category]` → `default`. Renders nothing if no key matches.

---

## Component conventions

- All components are pure and side-effect-free
- All components take `basePath` rather than reading siteConfig directly (lets them work in non-blog contexts)
- All component props are typed; types are inferred from prop destructuring
- All components have `.astro` extension; no `.tsx`
- Imports: components don't import from `astro:content`; that's the consuming page's job

## Adding a new component

1. Create `packages/blog-core/src/components/MyComponent.astro`
2. Add it to `examples/demo-site/` to prove it works end-to-end
3. Add an entry here in `docs/reference/components.md`
4. Add an entry in `CHANGELOG.md` `[Unreleased]` → `Added`
5. Bump version + commit
