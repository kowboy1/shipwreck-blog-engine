/**
 * Image sitemap helper. Produces an XML sitemap that includes
 * `<image:image>` entries per post URL — separate index Google uses to
 * discover and crawl images. Helps with Google Images / Discover surfaces
 * and ensures featuredImage URLs are advertised independently of the
 * standard URL sitemap.
 *
 * Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 *
 * Consumer per-site usage:
 *
 *   // src/pages/image-sitemap.xml.ts
 *   import { getCollection } from "astro:content"
 *   import { buildImageSitemap } from "@nitroblog/core"
 *   import siteConfig from "../../site.config"
 *
 *   export async function GET() {
 *     const posts = await getCollection("posts", ({ data }) => data.status === "published")
 *     return new Response(buildImageSitemap({ posts, siteConfig }), {
 *       headers: { "Content-Type": "application/xml; charset=utf-8" },
 *     })
 *   }
 *
 * Then submit `https://<domain>/blog/image-sitemap.xml` to Google Search
 * Console (or reference it from your robots.txt / sitemap index).
 */
import type { Post } from "../schemas/post.js"
import type { SiteConfig } from "../schemas/site.js"

interface PostEntry {
  id: string
  data: Post
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function absoluteUrl(maybeRelative: string, siteBaseUrl: string): string {
  try {
    return new URL(maybeRelative, siteBaseUrl).toString()
  } catch {
    return maybeRelative
  }
}

export function buildImageSitemap(input: {
  posts: PostEntry[]
  siteConfig: SiteConfig
}): string {
  const { posts, siteConfig } = input
  const base = siteConfig.blogBasePath.replace(/\/$/, "")
  const urls: string[] = []

  for (const post of posts) {
    if (post.data.status !== "published") continue
    if (!post.data.featuredImage) continue

    const loc = new URL(`${base}/${post.id}/`, siteConfig.baseUrl).toString()
    const imageLoc = absoluteUrl(post.data.featuredImage, siteConfig.baseUrl)
    const title = post.data.title
    const caption = post.data.featuredImageAlt ?? post.data.excerpt

    urls.push(
      `  <url>\n` +
      `    <loc>${escapeXml(loc)}</loc>\n` +
      `    <image:image>\n` +
      `      <image:loc>${escapeXml(imageLoc)}</image:loc>\n` +
      `      <image:title>${escapeXml(title)}</image:title>\n` +
      (caption ? `      <image:caption>${escapeXml(caption)}</image:caption>\n` : "") +
      `    </image:image>\n` +
      `  </url>`,
    )
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls.join("\n") +
    (urls.length > 0 ? "\n" : "") +
    `</urlset>\n`
  )
}
