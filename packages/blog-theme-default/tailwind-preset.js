/**
 * Shared Tailwind preset for Shipwreck Blog.
 *
 * Includes the engine's component AND page sources in `content` so consumer
 * sites automatically pick up utility classes used inside `@shipwreck/blog-core`
 * — without having to remember to add the path themselves.
 *
 * The two scan paths cover:
 *   - components/**  — atomic UI (PostCard, ArticleLayout, AuthorBio, etc.)
 *   - pages/**       — page renderers (PostPage, ListingPage) added in 0.3.0
 *
 * Token contract: ./TOKEN-CONTRACT.md
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    "./node_modules/@shipwreck/blog-core/src/components/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
    "./node_modules/@shipwreck/blog-core/src/pages/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary, #0f172a)",
        accent: "var(--color-accent, #2563eb)",
        bg: "var(--color-bg, #ffffff)",
        "bg-elevated": "var(--color-bg-elevated, #f8fafc)",
        text: "var(--color-text, #0f172a)",
        muted: "var(--color-muted, #64748b)",
        border: "var(--color-border, #e2e8f0)",
        link: "var(--color-link, var(--color-accent, #2563eb))",
        "link-hover": "var(--color-link-hover, var(--color-primary, #0f172a))",
      },
      fontFamily: {
        sans: ["var(--font-sans, system-ui)", "sans-serif"],
        heading: ["var(--font-heading, var(--font-sans, system-ui))", "serif"],
        mono: ["var(--font-mono, ui-monospace)", "monospace"],
      },
      borderRadius: {
        card: "var(--radius-card, 0.75rem)",
        button: "var(--radius-button, 9999px)",
        chip: "var(--radius-chip, 9999px)",
      },
      boxShadow: {
        card: "var(--shadow-card, 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06))",
      },
      ringColor: {
        focus: "var(--color-focus-ring, rgb(37 99 235 / 0.6))",
      },
    },
  },
}
