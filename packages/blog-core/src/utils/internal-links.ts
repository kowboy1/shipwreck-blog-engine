import type { Post } from "../schemas/post.js"
import type { SiteConfig } from "../schemas/site-config.js"

interface PostRef {
  id: string
  data: Post
}

export interface InternalLinkSuggestion {
  id: string
  title: string
  url: string
  reason: string
  score: number
}

interface SuggestOptions {
  current: PostRef
  candidates: PostRef[]
  siteConfig: SiteConfig
  limit?: number
}

/**
 * Suggest posts on the same site that the current post could link to.
 * Useful for editorial review and for AI agents (Nyxi) deciding where to add
 * internal links when writing or revising a post.
 *
 * Heuristic: same category > shared tags > recency. Skips drafts and self.
 */
export function suggestInternalLinks({
  current,
  candidates,
  siteConfig,
  limit = 8,
}: SuggestOptions): InternalLinkSuggestion[] {
  const currentTags = new Set(current.data.tags ?? [])
  const currentCategory = current.data.category

  return candidates
    .filter((c) => c.id !== current.id && c.data.status === "published")
    .map((c) => {
      const sharedTags = (c.data.tags ?? []).filter((t) => currentTags.has(t))
      let score = 0
      const reasons: string[] = []
      if (c.data.category && c.data.category === currentCategory) {
        score += 3
        reasons.push(`same category: ${currentCategory}`)
      }
      if (sharedTags.length > 0) {
        score += sharedTags.length * 2
        reasons.push(`shared tags: ${sharedTags.join(", ")}`)
      }
      const ageDays = (Date.now() - c.data.publishDate.valueOf()) / 86400000
      if (ageDays < 365) score += 0.5
      return {
        id: c.id,
        title: c.data.title,
        url: new URL(`${siteConfig.blogBasePath}/${c.id}/`, siteConfig.baseUrl).toString(),
        reason: reasons.join(" · ") || "recency",
        score,
      }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Build a flat manifest of every published post — handy for handing to an LLM
 * agent so it can decide which posts to link to without scanning the whole site.
 */
export function buildPostManifest(posts: PostRef[], siteConfig: SiteConfig) {
  return posts
    .filter((p) => p.data.status === "published")
    .map((p) => ({
      id: p.id,
      title: p.data.title,
      url: new URL(`${siteConfig.blogBasePath}/${p.id}/`, siteConfig.baseUrl).toString(),
      excerpt: p.data.excerpt,
      category: p.data.category,
      tags: p.data.tags ?? [],
      publishDate: p.data.publishDate.toISOString().slice(0, 10),
    }))
}
