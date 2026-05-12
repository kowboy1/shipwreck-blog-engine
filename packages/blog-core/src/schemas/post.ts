import { z } from "zod"

export const postStatus = z.enum(["draft", "published", "scheduled"])
export type PostStatus = z.infer<typeof postStatus>

export const articleType = z
  .enum(["Article", "BlogPosting", "NewsArticle", "TechArticle"])
  .default("BlogPosting")

export const faqItem = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
})

export const author = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  url: z.string().url().optional(),
})

export const postSchema = z.object({
  title: z.string().min(1).max(120),
  excerpt: z.string().max(320).optional(),
  body: z.string().optional(),

  publishDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  status: postStatus.default("published"),

  author: z.string().optional(),
  authors: z.array(z.string()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),

  featuredImage: z.string().optional(),
  featuredImageAlt: z.string().optional(),
  /** Intrinsic image width in pixels. Used for `<img width=...>` (CLS prevention)
   * and og:image:width / Schema.org ImageObject.width. Engine auto-detects
   * from local files (SVG viewBox / PNG IHDR / JPEG SOF) when omitted;
   * falls back to 1200 if detection fails. */
  featuredImageWidth: z.number().int().positive().optional(),
  /** Intrinsic image height in pixels. Default 675 (16:9 against width 1200). */
  featuredImageHeight: z.number().int().positive().optional(),
  /** Responsive image variants. When set, the engine renders the hero + cards
   *  as `<picture>` with `<source>` entries — letting modern browsers pick
   *  the smallest acceptable format (AVIF → WebP → JPEG/PNG fallback). Sites
   *  with an image pipeline pre-generate variants; engine just wires markup. */
  featuredImageAvif: z.string().optional(),
  featuredImageWebp: z.string().optional(),
  /** Explicit responsive `srcset` for the primary image. Accepts the same
   *  string format as the HTML attribute: "url 480w, url 960w, url 1920w".
   *  When set, engine emits a `<source srcset>` with `sizes` derived from
   *  the layout. Use when an image pipeline has produced multiple widths. */
  featuredImageSrcset: z.string().optional(),

  /** Speakable Schema.org markup — Google's voice-search signal. Specify
   *  CSS selectors that identify the spoken portion (intro paragraph, TL;DR,
   *  etc.). Engine emits a SpeakableSpecification JSON-LD block when set. */
  speakable: z
    .object({
      cssSelectors: z.array(z.string()).optional(),
      xpath: z.array(z.string()).optional(),
    })
    .optional(),

  /** HowTo schema for step-by-step guide posts. When set, engine emits
   *  HowTo JSON-LD alongside the Article schema. */
  howTo: z
    .object({
      name: z.string(),
      description: z.string().optional(),
      totalTime: z.string().optional(), // ISO 8601 duration, e.g. "PT30M"
      estimatedCost: z.string().optional(),
      steps: z.array(
        z.object({
          name: z.string(),
          text: z.string(),
          url: z.string().optional(),
          image: z.string().optional(),
        }),
      ),
    })
    .optional(),

  // -------- GEO (Generative Engine Optimization) fields --------
  // Optional Schema.org Article enrichments that signal to LLM answer
  // engines (ChatGPT search, Perplexity, Claude search, Google AI
  // Overviews, Bing Copilot) when this post is appropriate to quote /
  // cite. Empty values are omitted from the generated JSON-LD.

  /** One-sentence, self-contained summary distinct from metaDescription
   *  (which is for SERPs). AI answer engines often quote `abstract`
   *  verbatim — write it to be quotable on its own. Emitted as
   *  Schema.org Article.abstract. */
  abstract: z.string().max(320).optional(),
  /** Entities this post is ABOUT (primary subjects). Used by LLMs to
   *  disambiguate topical relevance. Emit as Schema.org Article.about[]. */
  about: z.array(z.string()).optional(),
  /** Entities this post MENTIONS but isn't primarily about (secondary
   *  references). Helps entity linking. Emit as Schema.org Article.mentions[]. */
  mentions: z.array(z.string()).optional(),
  /** Copyright holder. Defaults to site organization. Set to override per-post
   *  (e.g. syndicated content from another publisher). */
  copyrightHolder: z.string().optional(),
  /** License URL (Creative Commons, custom). Emitted as Schema.org Article.license.
   *  Increasingly important for AI training-data opt-in/opt-out signaling. */
  license: z.string().url().optional(),
  /** Explicit AI-crawler signal. Default true (content is freely accessible).
   *  Set false for paywalled / member-only posts. Emit as Article.isAccessibleForFree. */
  isAccessibleForFree: z.boolean().default(true),

  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(170).optional(),
  canonical: z.string().url().optional(),
  noindex: z.boolean().default(false),

  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),

  articleType: articleType,
  faqItems: z.array(faqItem).optional(),

  relatedPosts: z.array(z.string()).optional(),
  ctaBlock: z.string().optional(),

  featured: z.boolean().default(false),
  sticky: z.boolean().default(false),
})

export type Post = z.infer<typeof postSchema>
export type Author = z.infer<typeof author>
export type FaqItem = z.infer<typeof faqItem>
