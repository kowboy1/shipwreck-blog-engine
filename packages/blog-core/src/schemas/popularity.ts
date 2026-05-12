import { z } from "zod"

/**
 * Per-site popularity data — populated by an out-of-band producer (typically a
 * nightly cron / GitHub Action that hits the site's analytics API).
 *
 * Lives at `<site-repo>/.shipwreck/popularity.json`. The engine reads it at
 * build time during `preparePostPageData` to populate the "Popular articles"
 * sidebar widget on post pages. If the file is absent or stale, the engine
 * falls back to most-recent-published posts so the sidebar always renders.
 *
 * Producer is deliberately separate from the engine — keeps the engine
 * analytics-provider-agnostic. See `scripts/refresh-popularity.mjs` for the
 * reference Cloudflare Web Analytics producer; other producers (Plausible,
 * GA4, server-log aggregation, manual JSON edit) can write this same shape.
 */
export const popularityEntrySchema = z.object({
  /** Post slug — matches the filename (without .mdx) in src/content/posts/ */
  slug: z.string().min(1),
  /** Pageview count over the window. Larger = more popular. */
  views: z.number().int().nonnegative(),
})

export const popularitySchema = z.object({
  /** ISO-8601 timestamp the file was generated. Used for staleness checks. */
  generatedAt: z.string().datetime(),
  /** Rolling window the views cover, e.g. "30d", "7d", "all-time". */
  window: z.string().min(1),
  /**
   * Source identifier so anyone reading the file knows what produced it.
   * "cloudflare-web-analytics" | "plausible" | "ga4" | "manual" | "recency"
   * Free-form — the engine doesn't switch behaviour on this; it's metadata only.
   */
  source: z.string().min(1),
  /** Top posts by views. Producer should emit at least limit-needed entries; engine slices. */
  posts: z.array(popularityEntrySchema),
})

export type PopularityEntry = z.infer<typeof popularityEntrySchema>
export type Popularity = z.infer<typeof popularitySchema>
