/**
 * buildPostsManifest — produces the canonical JSON payload that powers:
 *   1. `/blog/posts.json` (public manifest, useful for external tools / agents)
 *   2. The inline filter manifest embedded in `/blog/` (drives client-side
 *      filtering without a fetch)
 *
 * Centralised here so future field additions (e.g. featuredImage on cards)
 * ship through `npm update` instead of requiring every site to patch their
 * own posts.json.ts. Consumer per-site posts.json.ts becomes a 5-line
 * wrapper around this helper.
 */
import type { Post } from "../schemas/post.js"
import type { SiteConfig } from "../schemas/site.js"

interface PostEntry {
  id: string
  data: Post
}

export interface PostManifestEntry {
  id: string
  title: string
  url: string
  excerpt?: string
  publishDate: string
  updatedDate?: string
  author?: string
  authors?: string[]
  category?: string
  tags: string[]
  featured: boolean
  sticky: boolean
  featuredImage?: string
  featuredImageAlt?: string
}

export interface PostsManifest {
  site: string
  baseUrl: string
  blogBasePath: string
  generatedAt: string
  count: number
  posts: PostManifestEntry[]
}

export function buildPostsManifest(input: {
  posts: PostEntry[]
  siteConfig: SiteConfig
}): PostsManifest {
  const { posts, siteConfig } = input
  const sorted = [...posts].sort(
    (a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf(),
  )
  return {
    site: siteConfig.siteName,
    baseUrl: siteConfig.baseUrl,
    blogBasePath: siteConfig.blogBasePath,
    generatedAt: new Date().toISOString(),
    count: sorted.length,
    posts: sorted.map((post) => ({
      id: post.id,
      title: post.data.title,
      url: new URL(`${siteConfig.blogBasePath}/${post.id}/`, siteConfig.baseUrl).toString(),
      ...(post.data.excerpt ? { excerpt: post.data.excerpt } : {}),
      publishDate: post.data.publishDate.toISOString().slice(0, 10),
      ...(post.data.updatedDate
        ? { updatedDate: post.data.updatedDate.toISOString().slice(0, 10) }
        : {}),
      ...(post.data.author ? { author: post.data.author } : {}),
      ...(post.data.authors ? { authors: post.data.authors } : {}),
      ...(post.data.category ? { category: post.data.category } : {}),
      tags: post.data.tags ?? [],
      featured: post.data.featured ?? false,
      sticky: post.data.sticky ?? false,
      ...(post.data.featuredImage ? { featuredImage: post.data.featuredImage } : {}),
      ...(post.data.featuredImageAlt ? { featuredImageAlt: post.data.featuredImageAlt } : {}),
    })),
  }
}

/**
 * Compute filter facet counts (tag/category occurrence frequencies) from a
 * post list. Used to render the filter chips with counts ("Surf (2)").
 */
export function buildFilterFacets(input: { posts: PostEntry[] }) {
  const tagCounts = new Map<string, number>()
  const categoryCounts = new Map<string, number>()
  let featuredCount = 0
  for (const p of input.posts) {
    if (p.data.status !== "published") continue
    if (p.data.featured) featuredCount++
    if (p.data.category) {
      categoryCounts.set(p.data.category, (categoryCounts.get(p.data.category) ?? 0) + 1)
    }
    for (const t of p.data.tags ?? []) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const byCountDesc = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0])
  return {
    tags: Array.from(tagCounts.entries()).sort(byCountDesc).map(([slug, count]) => ({ slug, count })),
    categories: Array.from(categoryCounts.entries()).sort(byCountDesc).map(([slug, count]) => ({ slug, count })),
    featuredCount,
  }
}

export type FilterFacets = ReturnType<typeof buildFilterFacets>
