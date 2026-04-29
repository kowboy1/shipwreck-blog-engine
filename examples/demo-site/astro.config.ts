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
  // preserveSymlinks: required so Astro's build doesn't choke on cross-package
  // .astro imports when the engine is installed via file: deps (which create
  // symlinks). Without this, Astro's vite plugin tries to load the same .astro
  // file via two different paths (real + symlink) and errors out with
  // "No cached compile metadata found".
  vite: { resolve: { preserveSymlinks: true } },
  integrations: [
    shipwreckBlog({ extraRemarkPlugins: [remarkReadingTime] }),
    mdx(),
    sitemap(),
    tailwind({ applyBaseStyles: false }),
  ],
  build: { format: "directory" },
})
