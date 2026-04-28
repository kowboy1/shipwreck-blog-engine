/** @type {import('tailwindcss').Config} */
export default {
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
