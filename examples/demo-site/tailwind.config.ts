import type { Config } from "tailwindcss"
import sharedPreset from "@shipwreck/blog-theme-default/tailwind-preset"
import typography from "@tailwindcss/typography"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

// Resolve the engine package's actual location at config-load time. Works in
// every layout (monorepo workspace-hoist, per-site sibling, eventual npm
// publish) because it uses Node's standard resolution rather than a fragile
// relative path. This is the canonical pattern — don't replace with hand-
// written ../paths even if it "looks simpler".
const require_ = createRequire(import.meta.url)
const enginePkgRoot = dirname(require_.resolve("@shipwreck/blog-core/package.json"))

export default {
  presets: [sharedPreset],
  content: [
    "./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
    join(enginePkgRoot, "src/components/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}"),
    join(enginePkgRoot, "src/pages/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}"),
  ],
  theme: { extend: {} },
  plugins: [typography],
} satisfies Config
