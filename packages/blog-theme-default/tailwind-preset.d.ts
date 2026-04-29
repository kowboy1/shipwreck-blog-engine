import type { Config } from "tailwindcss"

/**
 * Shared Tailwind preset for Shipwreck Blog.
 *
 * Use in your consumer site's tailwind.config.ts:
 *
 *   import sharedPreset from "@shipwreck/blog-theme-default/tailwind-preset"
 *   export default { presets: [sharedPreset], content: [...], plugins: [...] }
 *
 * The preset already declares `content` paths for the engine's components
 * and page renderers; consumer sites only need to add their own source paths.
 */
declare const preset: Partial<Config>
export default preset
