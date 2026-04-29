import { defineConfig } from "astro/config"
import mdx from "@astrojs/mdx"
import sitemap from "@astrojs/sitemap"
import tailwind from "@astrojs/tailwind"
import siteConfig from "./site.config"
import { remarkReadingTime } from "./src/lib/remark-reading-time.mjs"
import { remarkStripDuplicateH1 } from "@shipwreck/blog-core/remark/strip-duplicate-h1.mjs"

export default defineConfig({
  site: siteConfig.baseUrl,
  base: siteConfig.blogBasePath,
  trailingSlash: "always",
  integrations: [mdx(), sitemap(), tailwind({ applyBaseStyles: false })],
  markdown: {
    remarkPlugins: [remarkReadingTime, remarkStripDuplicateH1],
  },
  build: {
    format: "directory",
  },
})
