import rss from "@astrojs/rss"
import { getCollection } from "astro:content"
import siteConfig from "../../site.config"
import type { APIContext } from "astro"

export async function GET(context: APIContext) {
  const posts = await getCollection("posts", ({ data }) => data.status === "published")
  const sorted = posts.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())

  return rss({
    title: `${siteConfig.siteName} — Blog`,
    description: `Latest posts from ${siteConfig.siteName}`,
    site: context.site ?? siteConfig.baseUrl,
    items: sorted.map((post) => ({
      title: post.data.title,
      pubDate: post.data.publishDate,
      description: post.data.excerpt,
      link: `${siteConfig.blogBasePath}/${post.id}/`,
      categories: post.data.tags,
    })),
  })
}
