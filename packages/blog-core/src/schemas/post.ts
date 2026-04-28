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
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),

  featuredImage: z.string().optional(),
  featuredImageAlt: z.string().optional(),

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
