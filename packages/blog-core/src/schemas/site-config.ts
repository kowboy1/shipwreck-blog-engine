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
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
