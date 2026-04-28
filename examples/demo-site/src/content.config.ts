import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { postSchema, authorSchema } from "@shipwreck/blog-core"

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: postSchema,
})

const authors = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/authors" }),
  schema: authorSchema,
})

export const collections = { posts, authors }
