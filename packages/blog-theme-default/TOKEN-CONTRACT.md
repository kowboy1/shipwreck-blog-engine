# Theme Token Contract — `@shipwreck/blog-theme-default`

**Audience:** agents and humans theming a blog into a host site.
**Purpose:** every visual decision the engine exposes is listed here. The agent's job is to fill each token with a value that matches the host site. Don't invent new tokens, don't skip any — fill all of them.

The engine reads these tokens via CSS custom properties on `:root`. The Tailwind preset maps them to utility classes (`bg-bg`, `text-primary`, `border-border`, etc.) so component code stays site-agnostic.

---

## Where to write the values

Put the resolved values in your site's `tokens.css` (or whatever stylesheet the blog loads first). Example skeleton:

```css
:root {
  /* Colors — see § Colors */
  --color-bg: #...;
  --color-bg-elevated: #...;
  --color-text: #...;
  --color-primary: #...;
  --color-accent: #...;
  --color-muted: #...;
  --color-border: #...;
  --color-link: #...;
  --color-link-hover: #...;
  --color-focus-ring: #...;

  /* Typography — see § Typography */
  --font-sans: ...;
  --font-heading: ...;
  --font-mono: ...;
  --font-size-base: 1rem;
  --line-height-base: 1.65;
  --tracking-heading: -0.01em;

  /* Surface — see § Surface */
  --radius-card: 0.75rem;
  --radius-button: 9999px;
  --radius-chip: 9999px;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06);

  /* Buttons — see § Buttons */
  --button-bg: var(--color-primary);
  --button-text: var(--color-bg);
  --button-hover-bg: var(--color-accent);
  --button-padding-y: 0.625rem;
  --button-padding-x: 1.25rem;
  --button-font-weight: 600;

  /* Header (if blog renders a Header inside SiteShell) */
  --header-bg: var(--color-bg);
  --header-height: 4rem;
  --header-border: var(--color-border);
}
```

---

## Colors

Every color is required. If the host site doesn't have an explicit value, derive one (e.g. `--color-muted` ≈ `--color-text` at 60% opacity).

| Token | Use | How to find it on the host |
| --- | --- | --- |
| `--color-bg` | Page background | `body { background }` computed style |
| `--color-bg-elevated` | Cards, modals, sidebar surfaces sitting on top of bg | A slightly lighter (light theme) or lighter-mixed (dark theme) variant of `--color-bg` |
| `--color-text` | Default body text | `body { color }` computed style |
| `--color-primary` | Headings, primary text emphasis, default button bg | Brand primary — Tailwind config `colors.primary` or the most-used heading color |
| `--color-accent` | Links, hover states, active CTAs | Brand accent — most-used link color, or button hover |
| `--color-muted` | Captions, metadata, dates, "by Author" lines | Computed color of dimmed text on the host (~50–65% opacity vs `--color-text`) |
| `--color-border` | Card borders, hairlines, dividers | `hr` color or `1px solid` borders on the host |
| `--color-link` | Inline link color in prose | `a { color }` computed |
| `--color-link-hover` | Inline link hover | `a:hover { color }` computed |
| `--color-focus-ring` | Keyboard focus outline | Often `--color-accent` with reduced opacity. Match host if it has one. |

**Optional semantic colors** (only if the host uses them visibly): `--color-success`, `--color-warning`, `--color-danger`. Skip if the host doesn't.

**Dark mode:** if the host site supports dark mode, define a `:root[data-theme="dark"] { ... }` block (or matching selector) overriding the same tokens. The engine doesn't ship its own dark-mode toggle — it follows the host's signal.

---

## Typography

| Token | Use | How to find it on the host |
| --- | --- | --- |
| `--font-sans` | Body text, UI | `body { font-family }` computed |
| `--font-heading` | H1–H6, byline names | Either same as `--font-sans` (one-font sites) or distinct display family. Sample `h1, h2 { font-family }` |
| `--font-mono` | Inline `<code>`, code blocks in MDX | `code { font-family }` if set; else default to `ui-monospace, ...` |
| `--font-size-base` | Body font-size | `body { font-size }` (usually `1rem` = 16px) |
| `--line-height-base` | Body line-height | `body { line-height }`. Most sites land 1.5–1.7 |
| `--tracking-heading` | Heading letter-spacing | `h1 { letter-spacing }`. Sites with display fonts often go negative (`-0.01em` to `-0.03em`) |

**Note on heading scale:** the engine uses Tailwind's default scale (`text-2xl`, `text-3xl`, etc.) so heading sizes don't need their own tokens. If the host uses a custom scale and the difference is jarring, override in the consumer's `tailwind.config.ts` `theme.extend.fontSize` — don't add tokens here.

---

## Surface

| Token | Use | Default | How to find it on the host |
| --- | --- | --- | --- |
| `--radius-card` | Cards, hero images, asides | `0.75rem` | `border-radius` on host cards / images |
| `--radius-button` | Buttons | `9999px` | Round (pill), `0.5rem` (rounded), or `0` (square) — pick whichever the host's primary CTAs use |
| `--radius-chip` | Tag chips, breadcrumb chevrons | `9999px` | Match `--radius-button` unless host has distinct chip style |
| `--shadow-card` | Card elevation when hovering or hero state | (subtle 2-layer) | Inspect host card hover. If host is flat (no shadows), set to `none` |

---

## Buttons

The engine ships a single button style derived from these tokens. Don't override per-component — change the tokens.

| Token | Use | Default |
| --- | --- | --- |
| `--button-bg` | Primary button background | `var(--color-primary)` |
| `--button-text` | Primary button text | `var(--color-bg)` |
| `--button-hover-bg` | Primary button hover bg | `var(--color-accent)` |
| `--button-padding-y` | Vertical padding | `0.625rem` |
| `--button-padding-x` | Horizontal padding | `1.25rem` |
| `--button-font-weight` | Font weight | `600` |

**To match the host:** find the most prominent CTA on the host's homepage. Sample its computed `background-color`, `color`, `padding`, `font-weight`, `border-radius`. Map those values into the tokens above.

---

## Header (optional, only if SiteShell/Header.astro uses tokens)

| Token | Use | Default |
| --- | --- | --- |
| `--header-bg` | Header background | `var(--color-bg)` |
| `--header-height` | Header total height | `4rem` |
| `--header-border` | Bottom border color | `var(--color-border)` — set to `transparent` if host header is borderless |

---

## What's NOT a token (don't try to abstract these)

- Logo (handled by `siteConfig.brand.logoUrl`)
- Nav menu items (lives in `SiteShell/Header.astro` markup, ported per-site)
- Specific page layouts (`max-w-3xl`, grid breakpoints) — these are intentional engine decisions, not theming
- Blog post hero images (per-post `featuredImage` frontmatter)

If you find yourself wanting to add a new token, ask: "is this *theming* (a value the host site already has) or *layout* (an engine decision)?" Only the former belongs here.

---

## Validation checklist

After writing `tokens.css`, the agent verifies all of the following before declaring integration complete:

- [ ] Every token in this contract has a value (none left at the engine default unless host genuinely matches)
- [ ] `--color-bg` matches host body bg (sample with browser devtools)
- [ ] `--color-text` matches host body text
- [ ] Primary button on the blog matches host's most prominent CTA — bg, text, padding, radius
- [ ] Inline links in a blog post match `a` color and hover behavior on a host page
- [ ] Heading font matches host's H1
- [ ] Body font matches host's body
- [ ] Card border-radius matches host's cards
- [ ] Tag chip styling reads as native (compare to any host chips/badges)

If a check fails, fix the token, rebuild, recheck. Don't paper over with one-off CSS overrides — that defeats the contract.
