import type { Config } from "tailwindcss"
import sharedPreset from "@shipwreck/blog-theme-default/tailwind-preset"
import typography from "@tailwindcss/typography"

export default {
  presets: [sharedPreset],
  content: [
    "./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
    "../../packages/blog-core/src/components/*.astro",
  ],
  theme: {
    extend: {},
  },
  plugins: [typography],
} satisfies Config
