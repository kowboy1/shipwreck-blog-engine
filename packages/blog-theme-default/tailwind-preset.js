/**
 * Shared Tailwind preset for Shipwreck Blog.
 *
 * Includes the engine's component sources in `content` so consumer sites
 * automatically pick up utility classes used inside `@shipwreck/blog-core`
 * components — without having to remember to add the path themselves.
 *
 * The path resolves relative to the consumer's tailwind.config working
 * directory; npm (workspaces or normal installs) places the package at
 * `./node_modules/@shipwreck/blog-core/` in both cases.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    "./node_modules/@shipwreck/blog-core/src/components/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary, #0f172a)",
        accent: "var(--color-accent, #2563eb)",
        bg: "var(--color-bg, #ffffff)",
        text: "var(--color-text, #0f172a)",
        muted: "var(--color-muted, #64748b)",
        border: "var(--color-border, #e2e8f0)",
      },
      fontFamily: {
        sans: ["var(--font-sans, system-ui)", "sans-serif"],
        heading: ["var(--font-heading, var(--font-sans, system-ui))", "serif"],
      },
      borderRadius: {
        card: "var(--radius-card, 0.75rem)",
      },
    },
  },
}
