import type { Config } from "tailwindcss"
import sharedPreset from "@shipwreck/blog-theme-default/tailwind-preset"
import typography from "@tailwindcss/typography"

// The shared preset already includes the engine's component sources in its
// `content` array (resolves to ./node_modules/@shipwreck/blog-core/...), so
// consumer sites only need to add their own source paths here.
export default {
  presets: [sharedPreset],
  content: [
    "./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [typography],
} satisfies Config
