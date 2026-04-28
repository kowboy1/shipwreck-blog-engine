# Theming

The engine's theming model is intentionally minimal: CSS custom properties for tokens + per-site `SiteShell` components for chrome. No JSS, no styled-components, no theme provider.

## Two layers

### Layer 1 — Design tokens (CSS custom properties)

Defined in `@shipwreck/blog-theme-default/tokens.css`:

```css
:root {
  --color-bg: #ffffff;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-primary: #0f172a;
  --color-accent: #2563eb;
  --color-border: #e2e8f0;

  --font-sans: system-ui, sans-serif;
  --font-heading: var(--font-sans);

  --radius-card: 0.75rem;
}
```

The engine's Tailwind preset references these via `var(--color-bg)` etc., so Tailwind classes like `bg-bg`, `text-primary`, `border-border` automatically pick up the current values.

### Layer 2 — SiteShell components

Per-site `Header.astro` and `Footer.astro` in `_blog/src/components/SiteShell/`. Engine doesn't ship default ones (well, the demo site does, but they're not exported from blog-core).

This split is important: tokens cover *colors and fonts*. SiteShell covers *markup and layout*. Most theming happens in tokens; the harder work happens in SiteShell when porting a host site's chrome.

## How a site overrides tokens

In `_blog/src/styles/global.css`:

```css
@import "@shipwreck/blog-theme-default/tokens.css";

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Override after the import */
:root {
  --color-bg: #081120;        /* dark mode */
  --color-text: #eff6ff;
  --color-accent: #7dd3fc;
  --font-sans: Inter, system-ui, sans-serif;
}
```

The override pattern (re-declaring `:root`) works because CSS custom properties cascade. Later `:root` declarations win.

## How an agent themes a host site (the recipe)

This is the deterministic procedure for "match this blog to host site X". It works because:
- Host sites publish their CSS at predictable paths
- The token names are documented
- The SiteShell pattern centralizes chrome porting in 2 files

### Step 1 — Extract tokens from the host

Look at the host site's CSS for these things, in order:

1. `:root { --color-...: ... }` — most modern sites use CSS custom properties
2. Tailwind config `theme.extend.colors`
3. SCSS variables
4. Hex colors used in 5+ places (the de facto palette)
5. Font stacks in `body { font-family: ... }`

Map them to engine tokens:

| Host concept | Engine token |
|---|---|
| Body background | `--color-bg` |
| Body text | `--color-text` |
| Subdued text (timestamps, captions) | `--color-muted` |
| Primary brand color | `--color-primary` |
| Action / link / accent | `--color-accent` |
| Border / divider | `--color-border` |
| Body font | `--font-sans` |
| Heading font (if different) | `--font-heading` |

### Step 2 — Port SiteShell

Open the host site's home page HTML. Find the `<header>` and `<footer>`. Copy the markup into `_blog/src/components/SiteShell/Header.astro` and `_blog/src/components/SiteShell/Footer.astro`, converting:

- `class=` stays `class=` (Astro syntax, not React's `className`)
- Framework-specific link components (`<Link>`, `<NuxtLink>`) → plain `<a href="...">`
- Use `siteConfig.baseUrl` for any absolute links back to the host

Decide how prominent the blog should be in the host's nav. Two patterns:

- **Featured nav item:** add a "Blog" link to the main nav. Good when the blog is a primary content area.
- **Footer-only link:** keep the host's nav clean, drop a small "Blog" link in the footer credits. Good for marketing sites with a secondary blog.

### Step 3 — Verify

Run `npm run dev`, open the host site and the blog `/blog/` side by side. Compare:

- [ ] Logo + brand wordmark match
- [ ] Nav items + spacing match
- [ ] Body fonts match (zoom in if unsure — system fonts vs custom fonts have different metrics)
- [ ] Heading fonts match
- [ ] Link color
- [ ] Background (color, gradient, texture if any)
- [ ] Card style / radius / shadow
- [ ] Button style

## How the Tailwind preset works

`packages/blog-theme-default/tailwind-preset.js`:

```js
export default {
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary, #0f172a)",
        accent: "var(--color-accent, #2563eb)",
        bg: "var(--color-bg, #ffffff)",
        // ...
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
```

Each Tailwind utility (`bg-bg`, `text-primary`, `font-sans`) compiles to a CSS rule that references the custom property. Sites override the property → all classes update automatically. No rebuild required for token changes during dev.

## Component-level styling

Engine components use Tailwind classes that reference tokens:

```astro
<header class="border-b border-border bg-bg">
  <div class="text-primary">...</div>
</header>
```

Do NOT use raw hex values in components. Always use tokens. If you find yourself needing a color that's not in the token set, either:

1. Add it to the token set (and document) — preferred for anything generally useful
2. Use a Tailwind value (`bg-blue-500`) — only for one-off, semantically specific things

## Dark mode

Two paths:

### A — Site-level dark mode (forced)

The host site decides "the site is always dark". Override tokens to dark values in `:root`. Wollongong Weather uses this.

### B — Toggleable dark mode

Use Tailwind's `dark:` variant + a `dark` class on `<html>`. Tokens get duplicated:

```css
:root {
  --color-bg: #ffffff;
}
.dark :root, html.dark {
  --color-bg: #081120;
}
```

The engine doesn't ship a toggle component because it'd rarely be the same UX across sites. Sites add their own.

## Custom fonts

Self-hosted fonts: add `@font-face` rules in `_blog/src/styles/global.css` and reference the family in `--font-sans`.

Google Fonts: add `<link rel="preconnect">` and `<link rel="stylesheet">` to BaseLayout. (Or shadow BaseLayout to add them in a site-specific way.)

Bunny Fonts / OS-provided: just set `--font-sans` to the family name, no loader needed.

## Theming shadowed components

If a site has shadowed a component (e.g. its own `_blog/src/components/PostCard.astro`), it can use ANY styling approach — Tailwind, scoped CSS, inline styles. The engine doesn't dictate.

But: if you find yourself shadowing 3+ components for theming reasons, you've drifted from the intended model. Reconsider whether your tokens are right, or whether the change should land in `blog-core`.

## What the engine does NOT do

- Theme switcher / theme provider component
- Multiple theme presets (just default for now; could ship more later)
- CSS-in-JS
- Material/Chakra/MUI integration
- Mandatory dark mode

## Future themes

We could ship `@shipwreck/blog-theme-magazine`, `@shipwreck/blog-theme-minimal`, etc. Each would:

- Extend the same `--color-*` token contract
- Provide its own Tailwind preset with different defaults
- Possibly ship its own component overrides via the shadow pattern

Sites would `npm install @shipwreck/blog-theme-magazine` and import its preset instead. Out of scope until we have 5+ sites and theming becomes a copy-paste burden.
