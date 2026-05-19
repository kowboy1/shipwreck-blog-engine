/**
 * Popularity selection — picks the N most popular posts for the sidebar widget
 * on post pages. Selection priority (highest wins):
 *
 *   1. siteConfig.featuredPostsForSidebar (manual pin override)
 *   2. .nitroblog/popularity.json (analytics-derived ranking, if present)
 *   3. Most-recent-published fallback (always works, never empty)
 *
 * The current post is excluded from every source. The fallback ensures the
 * sidebar widget always renders something — never a blank column.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Post } from "../schemas/post.js"
import type { Popularity } from "../schemas/popularity.js"
import { popularitySchema } from "../schemas/popularity.js"

interface PostEntry {
  id: string
  data: Post
}

export interface PopularityLoadResult {
  data: Popularity | null
  path: string | null
  /** Age in days since generatedAt; null when no data loaded. */
  ageDays: number | null
}

/**
 * Walk up from cwd looking for `.nitroblog/popularity.json`. Mirrors the
 * art-direction lookup convention used by doctor: checks `./.nitroblog/...`
 * and `../.nitroblog/...` to handle both "run from site root" and "run from
 * _blog/" layouts.
 */
export function loadPopularityFile(cwd: string = process.cwd()): PopularityLoadResult {
  const candidates = [".", ".."].map((p) => resolve(cwd, p, ".nitroblog/popularity.json"))
  const path = candidates.find((p) => existsSync(p))
  if (!path) return { data: null, path: null, ageDays: null }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return { data: null, path, ageDays: null }
  }

  const parsed = popularitySchema.safeParse(raw)
  if (!parsed.success) return { data: null, path, ageDays: null }

  const ageMs = Date.now() - new Date(parsed.data.generatedAt).getTime()
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
  return { data: parsed.data, path, ageDays }
}

export interface SelectPopularInput {
  /** The post currently being rendered — excluded from results. */
  current: PostEntry
  /** All posts in the collection (any status). Already-published filter applied here. */
  all: PostEntry[]
  /** Popularity data (typically from loadPopularityFile). Null = use fallback. */
  popularity: Popularity | null
  /** Manual override slugs from siteConfig.featuredPostsForSidebar. Highest priority. */
  override?: string[]
  /** Number of posts to return. */
  limit: number
}

export interface SelectPopularResult {
  posts: PostEntry[]
  /** Identifier of the source actually used — for debugging / doctor reports. */
  source: "manual-override" | "popularity-file" | "recency-fallback"
}

export function selectPopularPosts(input: SelectPopularInput): SelectPopularResult {
  const { current, all, popularity, override, limit } = input

  const eligible = all.filter(
    (p) => p.id !== current.id && p.data.status === "published",
  )
  const bySlug = new Map(eligible.map((p) => [p.id, p]))

  // 1. Manual override always wins when set. Preserves the listed order.
  if (override && override.length > 0) {
    const picked = override
      .map((slug) => bySlug.get(slug))
      .filter((p): p is PostEntry => Boolean(p))
      .slice(0, limit)
    if (picked.length > 0) return { posts: picked, source: "manual-override" }
  }

  // 2. Popularity file — ranked by views, then padded with recency if short.
  if (popularity && popularity.posts.length > 0) {
    const picked: PostEntry[] = []
    const seen = new Set<string>()
    for (const entry of popularity.posts) {
      const p = bySlug.get(entry.slug)
      if (p && !seen.has(p.id)) {
        picked.push(p)
        seen.add(p.id)
        if (picked.length >= limit) break
      }
    }
    if (picked.length < limit) {
      // Pad with most-recent — keeps the widget full if popularity.json
      // doesn't cover enough posts (e.g. brand new site, only a few posts indexed)
      const recent = eligible
        .filter((p) => !seen.has(p.id))
        .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
      for (const p of recent) {
        picked.push(p)
        if (picked.length >= limit) break
      }
    }
    if (picked.length > 0) return { posts: picked, source: "popularity-file" }
  }

  // 3. Recency fallback — always produces something if there are >0 other posts.
  const recent = [...eligible]
    .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
    .slice(0, limit)
  return { posts: recent, source: "recency-fallback" }
}
