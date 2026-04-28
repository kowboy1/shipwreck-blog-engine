import type { APIContext } from "astro"
import { redirectsSchema } from "@shipwreck/blog-core"
import data from "../redirects.json"

export const prerender = true

export async function GET(_context: APIContext) {
  const parsed = redirectsSchema.safeParse(data)
  if (!parsed.success) {
    return new Response("invalid redirects.json: " + JSON.stringify(parsed.error.format()), { status: 500 })
  }
  const lines = parsed.data.map((r) => `${r.from} ${r.to} ${r.status}`).join("\n")
  return new Response(lines + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
