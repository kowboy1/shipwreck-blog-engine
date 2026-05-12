import { z } from "zod"

export const siteConfigSchema = z.object({
  siteName: z.string().min(1),
  baseUrl: z.string().url(),
  blogBasePath: z.string().default("/blog"),

  brand: z.object({
    organizationName: z.string(),
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
  }),

  seo: z.object({
    defaultOgImage: z.string().optional(),
    defaultFeaturedImage: z.string().optional(),
    defaultAuthorAvatar: z.string().optional(),
    twitterHandle: z.string().optional(),
    locale: z.string().default("en_AU"),
  }),

  layout: z
    .object({
      postsPerPage: z.number().int().positive().default(10),
      showReadingTime: z.boolean().default(true),
      showAuthor: z.boolean().default(true),
      showTableOfContents: z.boolean().default(true),
      showRelatedPosts: z.boolean().default(true),
      relatedPostsCount: z.number().int().positive().default(3),
    })
    .default({}),

  ctaBlocks: z
    .object({
      default: z.string().optional(),
      categoryOverrides: z.record(z.string(), z.string()).optional(),
    })
    .optional(),

  cards: z
    .object({
      fallbackImage: z.string().optional(),
      loadMore: z.boolean().default(true),
    })
    .default({}),

  heroes: z
    .object({
      /**
       * "required" — every published post must declare `featuredImage`. Doctor fails the
       * gate if any published post lacks one. This is the default.
       * "optional" — legacy / migration window. Doctor warns but does not fail.
       */
      policy: z.enum(["required", "optional"]).default("required"),
    })
    .default({}),

  sidebar: z
    .object({
      /**
       * "Popular articles" widget on post pages.
       * Reads .shipwreck/popularity.json if present; falls back to most-recent
       * published posts (excluding current) when no popularity data exists.
       */
      popular: z
        .object({
          enabled: z.boolean().default(true),
          limit: z.number().int().positive().default(5),
          heading: z.string().default("Popular articles"),
        })
        .default({}),
    })
    .default({}),

  /**
   * Optional manual override for the sidebar's "Popular articles" widget.
   * When set, supersedes popularity.json and recency fallback. Use to pin
   * specific posts (e.g. promote a flagship piece for a month).
   * Entries are slugs (no .mdx) — same form as filenames in src/content/posts/.
   */
  featuredPostsForSidebar: z.array(z.string()).optional(),
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
