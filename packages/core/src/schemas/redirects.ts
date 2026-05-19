import { z } from "zod"

export const redirectEntry = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  status: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
})

export const redirectsSchema = z.array(redirectEntry)

export type RedirectEntry = z.infer<typeof redirectEntry>
