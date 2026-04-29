import { defineConfig } from "astro/config"
import mdx from "@astrojs/mdx"
import sitemap from "@astrojs/sitemap"
import tailwind from "@astrojs/tailwind"
import shipwreckBlog from "@shipwreck/blog-core/integration"
import siteConfig from "./site.config"
import { remarkReadingTime } from "./src/lib/remark-reading-time.mjs"

export default defineConfig({
  site: siteConfig.baseUrl,
  base: siteConfig.blogBasePath,
  trailingSlash: "always",
  integrations: [
    shipwreckBlog({ extraRemarkPlugins: [remarkReadingTime] }),
    mdx(),
    sitemap(),
    tailwind({ applyBaseStyles: false }),
  ],
  build: { format: "directory" },
})
