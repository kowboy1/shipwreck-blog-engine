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
  type MetaTags,
} from "../seo/index.js"

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
}): MetaTags {
  const meta = buildPostMeta({
    post: virtualPost(input.title, input.description),
    siteConfig: input.siteConfig,
    url: input.url,
  })
  // Listing pages are "website" not "article"
  return { ...meta, og: { ...meta.og, type: "website" } }
}

export function prepareIndexPage(input: {
  posts: PostEntry[]
  siteConfig: SiteConfig
  page?: number
  total?: number
}): ListingPageData {
  const { posts, siteConfig, page, total } = input
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

  return {
    title,
    crumbs: [],
    posts,
    pagination: total !== undefined ? { current: page ?? 1, total } : undefined,
    meta: buildListingMeta({
      title: `${siteConfig.siteName} — ${title}`,
      description,
      url,
      siteConfig,
    }),
    jsonLd: organizationSchema(siteConfig),
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
    }),
    jsonLd: breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.url ?? url }))),
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
    }),
    jsonLd: breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.url ?? url }))),
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
    }),
    jsonLd: breadcrumbSchema(crumbs.map((c) => ({ name: c.name, url: c.url ?? url }))),
  }
}
