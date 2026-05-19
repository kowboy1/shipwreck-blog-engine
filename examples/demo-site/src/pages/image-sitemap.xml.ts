import { getCollection } from "astro:content"
import { buildImageSitemap } from "@nitroblog/core"
import siteConfig from "../../site.config"
import type { APIContext } from "astro"

export async function GET(_context: APIContext) {
  const posts = await getCollection("posts", ({ data }) => data.status === "published")
  return new Response(buildImageSitemap({ posts, siteConfig }), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  })
}
