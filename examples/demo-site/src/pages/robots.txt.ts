import type { APIContext } from "astro"
import siteConfig from "../../site.config"

export async function GET(_context: APIContext) {
  const sitemapUrl = new URL(`${siteConfig.blogBasePath}/sitemap-index.xml`, siteConfig.baseUrl).toString()
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n")
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
