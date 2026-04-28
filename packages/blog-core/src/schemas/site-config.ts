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
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
