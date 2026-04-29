/**
 * Astro integration for `@shipwreck/blog-core`. Wires up the engine's
 * remark plugins so consumer sites don't have to maintain that list
 * themselves.
 *
 * Usage in `astro.config.ts`:
 *
 *   import shipwreckBlog from "@shipwreck/blog-core/integration"
 *   integrations: [shipwreckBlog(), tailwind({ applyBaseStyles: false })]
 *
 * The engine's mandatory remark plugins (currently `remarkStripDuplicateH1`)
 * are added automatically. If the consumer site has its own remark plugins,
 * pass them in as `extraRemarkPlugins` and they'll be appended.
 */
import type { AstroIntegration } from "astro"
import { remarkStripDuplicateH1 } from "./remark/strip-duplicate-h1.mjs"

export interface ShipwreckBlogOptions {
  /** Additional remark plugins to append after the engine's defaults */
  extraRemarkPlugins?: unknown[]
}

export default function shipwreckBlog(
  options: ShipwreckBlogOptions = {},
): AstroIntegration {
  const { extraRemarkPlugins = [] } = options

  return {
    name: "@shipwreck/blog-core",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          markdown: {
            remarkPlugins: [
              remarkStripDuplicateH1,
              ...extraRemarkPlugins,
            ],
          },
        })
      },
    },
  }
}
