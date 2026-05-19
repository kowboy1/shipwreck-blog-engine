import { getCollection } from "astro:content"
import { buildPostsManifest } from "@nitroblog/core"
import siteConfig from "../../site.config"
import type { APIContext } from "astro"

export async function GET(_context: APIContext) {
  const posts = await getCollection("posts", ({ data }) => data.status === "published")
  const manifest = buildPostsManifest({ posts, siteConfig })

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
