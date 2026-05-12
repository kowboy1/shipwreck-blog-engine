/**
 * Prepares the data each archive/listing page needs (index, tag, category,
 * author, paginated index). Per-site files become thin wrappers that
 * await this and pass the result into <ListingPage>.
 *
 * Each helper returns the same shape so the renderer stays generic:
 *   { meta, jsonLd, crumbs, title, subtitle, posts, pagination?, author? }
 */
import type { Post } from "../schemas/post.js"
import type { SiteConfig } from "../schemas/site.js"
import type { AuthorRecord } from "../schemas/author.js"
import {
  buildPostMeta,
  breadcrumbSchema,
  organizationSchema,
  collectionPageSchema,
  type MetaTags,
} from "../seo/index.js"
import { buildPostsManifest, buildFilterFacets, type PostsManifest, type FilterFacets } from "../api/posts-manifest.js"

interface PostEntry {
  id: string
  data: Post
}

export interface ListingPageData {
  /** Page title (rendered as <h1>) */
  title: string
  /** Optional subtitle below the title (e.g. "12 posts") */
  subtitle?: string
  /** Breadcrumb trail. Last entry has no url. Empty for the index. */
  crumbs: Array<{ name: string; url?: string }>
  /** Posts to render in the listing */
  posts: PostEntry[]
  /** Pagination info (only set when paginated) */
  pagination?: { current: number; total: number }
  /** Author block to render between heading and posts (only on author pages) */
  author?: AuthorRecord
  /** Compiled <head> meta */
  meta: MetaTags
  /** JSON-LD graph */
  jsonLd: object | object[]
  /**
   * Inline manifest of every published post — embedded as a script tag on
   * the page so client-side filtering can run without an HTTP fetch.
   * Only set on the un-paginated index (`/blog/`) since that's where the
   * filter sidebar lives. Tag/category pages don't get this.
   */
  filterManifest?: PostsManifest
  /**
   * Filter facets (tag/category counts + featured count) for rendering
   * filter chips with usage frequencies ("Surf (2)"). Only set on the
   * un-paginated index.
   */
  filterFacets?: FilterFacets
  /** When true, the page should render the filter sidebar + embedded manifest. */
  showFilters?: boolean
}

function virtualPost(title: string, description: string): Post {
  return {
    title,
    metaDescription: description,
    publishDate: new Date(),
    status: "published",
    tags: [],
    noindex: false,
    featured: false,
    sticky: false,
    articleType: "BlogPosting",
  } as Post
}

function buildListingMeta(input: {
  title: string
  description: string
  url: string
  siteConfig: SiteConfig
  pagination?: { current: number; total: number; baseUrl: string }
  /** When true (thin-archive policy hit), emit robots="noindex,follow". */
  noindex?: boolean
}): MetaTags {
  const meta = buildPostMeta({
    post: virtualPost(input.title, input.description),
    siteConfig: input.siteConfig,
    url: input.url,
  })
  // buildPostMeta already populates links with the RSS rel=alternate.
  // Append rel=prev/next for paginated listings (Bing/Yandex still use these).
  const links = [...(meta.links ?? [])]
  if (input.pagination) {
    const { current, total, baseUrl } = input.pagination
    const base = baseUrl.replace(/\/$/, "")
    if (current > 1) {
      const prevHref = current === 2 ? `${base}/` : `${base}/page/${current - 1}/`
      links.push({ rel: "prev", href: new URL(prevHref, input.siteConfig.baseUrl).toString() })
    }
    if (current < total) {
      const nextHref = `${base}/page/${current + 1}/`
      links.push({ rel: "next", href: new URL(nextHref, input.siteConfig.baseUrl).toString() })
    }
  }

  return {
    ...meta,
    og: { ...meta.og, type: "website" },
    ...(input.noindex ? { robots: "noindex,follow" } : {}),
    links,
  }
}

/** Apply thin-archive noindex policy: returns true if this archive should be
 *  de-indexed (post count below the configured threshold AND policy enabled). */
function shouldNoindexArchive(siteConfig: SiteConfig, postCount: number): boolean {
  const thin = siteConfig.listing?.thinArchive
  if (!thin || thin.noindex !== true) return false
  const threshold = thin.threshold ?? 3
  return postCount < threshold
}

export function prepareIndexPage(input: {
  /** Posts to RENDER on this page (the slice for the current pagination cursor) */
  posts: PostEntry[]
  /** ALL published posts — used to build the filter manifest + facets. Falls back to `posts` if omitted (legacy callers). */
  allPosts?: PostEntry[]
  siteConfig: SiteConfig
  page?: number
  total?: number
}): ListingPageData {
  const { posts, allPosts, siteConfig, page, total } = input
  const fullList = allPosts ?? posts
  const isPaged = page !== undefined && page > 1
  const url = new URL(
    isPaged
      ? `${siteConfig.blogBasePath}/page/${page}/`
      : siteConfig.blogBasePath,
    siteConfig.baseUrl,
  ).toString()

  const title = isPaged ? `Blog — page ${page}` : "Blog"
  const description = isPaged
    ? `Latest posts from ${siteConfig.siteName}, page ${page}`
    : `Latest posts from ${siteConfig.siteName}`

  const pagination = total !== undefined ? { current: page ?? 1, total } : undefined

  // Filter manifest + facets — only on the un-paginated index. Pagination
  // pages skip these because the sidebar lives at /blog/ only.
  const showFilters = !isPaged && siteConfig.listing?.filters?.enabled !== false
  const filterManifest = showFilters ? buildPostsManifest({ posts: fullList, siteConfig }) : undefined
  const filterFacets = showFilters ? buildFilterFacets({ posts: fullList }) : undefined

  return {
    title,
    crumbs: [],
    posts,
    pagination,
    meta: buildListingMeta({
      title: `${siteConfig.siteName} — ${title}`,
      description,
      url,
      siteConfig,
      pagination: pagination
        ? { ...pagination, baseUrl: siteConfig.blogBasePath }
        : undefined,
    }),
    jsonLd: [
      organizationSchema(siteConfig),
      collectionPageSchema({
        name: `${siteConfig.siteName} — ${title}`,
        description,
        url,
        siteConfig,
        posts: fullList,
      }),
    ],
    ...(filterManifest ? { filterManifest } : {}),
    ...(filterFacets ? { filterFacets } : {}),
    showFilters,
  }
}

export function prepareTagPage(input: {
  tag: string
  posts: PostEntry[]
  siteConfig: SiteConfig
}): ListingPageData {
  const { tag, posts, siteConfig } = input
  const url = new URL(
    `${siteConfig.blogBasePath}/tags/${tag}/`,
    siteConfig.baseUrl,
  ).toString()
  const blogUrl = new URL(siteConfig.blogBasePath, siteConfig.baseUrl).toString()

  const crumbs = [
    { name: "Home", url: siteConfig.baseUrl },
    { name: "Blog", url: blogUrl },
    { name: `#${tag}` },
  ]

  const noindex = shouldNoindexArchive(siteConfig, posts.length)
  return {
    title: `#${tag}`,
    subtitle: `${posts.length} ${posts.length === 1 ? "post" : "posts"}`,
    crumbs,
    posts,
    meta: buildListingMeta({
      title: `Posts tagged "${tag}" — ${siteConfig.siteName}`,
      description: `All posts tagged "${tag}" on ${siteConfig.siteName}`,
      url,
      siteConfig,
      noindex,
    }),
    jsonLd: [
      breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.url ?? url }))),
      collectionPageSchema({
        name: `Posts tagged "${tag}" — ${siteConfig.siteName}`,
        description: `All posts tagged "${tag}" on ${siteConfig.siteName}`,
        url,
        siteConfig,
        posts,
      }),
    ],
  }
}

export function prepareCategoryPage(input: {
  category: string
  posts: PostEntry[]
  siteConfig: SiteConfig
}): ListingPageData {
  const { category, posts, siteConfig } = input
  const url = new URL(
    `${siteConfig.blogBasePath}/categories/${category}/`,
    siteConfig.baseUrl,
  ).toString()
  const blogUrl = new URL(siteConfig.blogBasePath, siteConfig.baseUrl).toString()

  const crumbs = [
    { name: "Home", url: siteConfig.baseUrl },
    { name: "Blog", url: blogUrl },
    { name: category },
  ]

  const noindex = shouldNoindexArchive(siteConfig, posts.length)
  return {
    title: category,
    subtitle: `${posts.length} ${posts.length === 1 ? "post" : "posts"}`,
    crumbs,
    posts,
    meta: buildListingMeta({
      title: `${category} — ${siteConfig.siteName}`,
      description: `All posts in the "${category}" category on ${siteConfig.siteName}`,
      url,
      siteConfig,
      noindex,
    }),
    jsonLd: [
      breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.url ?? url }))),
      collectionPageSchema({
        name: `${category} — ${siteConfig.siteName}`,
        description: `All posts in the "${category}" category on ${siteConfig.siteName}`,
        url,
        siteConfig,
        posts,
      }),
    ],
  }
}

export function prepareAuthorPage(input: {
  authorId: string
  author?: AuthorRecord
  posts: PostEntry[]
  siteConfig: SiteConfig
}): ListingPageData {
  const { authorId, author, posts, siteConfig } = input
  const displayName = author?.name ?? authorId
  const url = new URL(
    `${siteConfig.blogBasePath}/authors/${authorId}/`,
    siteConfig.baseUrl,
  ).toString()
  const blogUrl = new URL(siteConfig.blogBasePath, siteConfig.baseUrl).toString()

  const crumbs = [
    { name: "Home", url: siteConfig.baseUrl },
    { name: "Blog", url: blogUrl },
    { name: displayName },
  ]

  const noindex = shouldNoindexArchive(siteConfig, posts.length)
  return {
    title: displayName,
    crumbs,
    posts,
    author,
    meta: buildListingMeta({
      title: `${displayName} — ${siteConfig.siteName}`,
      description: `Posts by ${displayName} on ${siteConfig.siteName}`,
      url,
      siteConfig,
      noindex,
    }),
    jsonLd: [
      breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.url ?? url }))),
      collectionPageSchema({
        name: `${displayName} — ${siteConfig.siteName}`,
        description: `Posts by ${displayName} on ${siteConfig.siteName}`,
        url,
        siteConfig,
        posts,
      }),
    ],
  }
}
