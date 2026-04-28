import { z } from "zod"

export const authorSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  url: z.string().url().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  email: z.string().email().optional(),
})

export type AuthorRecord = z.infer<typeof authorSchema>
