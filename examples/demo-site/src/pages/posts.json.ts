import { getCollection } from "astro:content"
import siteConfig from "../../site.config"
import type { APIContext } from "astro"

export async function GET(_context: APIContext) {
  const posts = await getCollection("posts", ({ data }) => data.status === "published")
  const sorted = posts.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())

  const manifest = {
    site: siteConfig.siteName,
    baseUrl: siteConfig.baseUrl,
    blogBasePath: siteConfig.blogBasePath,
    generatedAt: new Date().toISOString(),
    count: sorted.length,
    posts: sorted.map((post) => ({
      id: post.id,
      title: post.data.title,
      url: new URL(`${siteConfig.blogBasePath}/${post.id}/`, siteConfig.baseUrl).toString(),
      excerpt: post.data.excerpt,
      publishDate: post.data.publishDate.toISOString().slice(0, 10),
      updatedDate: post.data.updatedDate?.toISOString().slice(0, 10),
      author: post.data.author,
      category: post.data.category,
      tags: post.data.tags ?? [],
      featured: post.data.featured,
      sticky: post.data.sticky,
    })),
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
