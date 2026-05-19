import type { Post } from "../schemas/post.js"

interface PostRef {
  id: string
  data: Post
}

interface RelatedOptions {
  limit?: number
  current: PostRef
  candidates: PostRef[]
}

export function rankRelatedPosts({ current, candidates, limit = 3 }: RelatedOptions): PostRef[] {
  if (current.data.relatedPosts && current.data.relatedPosts.length > 0) {
    const manual = current.data.relatedPosts
      .map((id) => candidates.find((c) => c.id === id))
      .filter((c): c is PostRef => Boolean(c))
    if (manual.length >= limit) return manual.slice(0, limit)
  }

  const currentTags = new Set(current.data.tags ?? [])
  const currentCategory = current.data.category

  const scored = candidates
    .filter((c) => c.id !== current.id && c.data.status === "published")
    .map((c) => {
      let score = 0
      if (c.data.category && c.data.category === currentCategory) score += 3
      const sharedTags = (c.data.tags ?? []).filter((t) => currentTags.has(t)).length
      score += sharedTags * 2
      const ageDays = (Date.now() - c.data.publishDate.valueOf()) / 86400000
      if (ageDays < 365) score += 0.5
      return { post: c, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post)

  return scored
}
