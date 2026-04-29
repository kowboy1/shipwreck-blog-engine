---
description: Integrate the Shipwreck Blog Engine into a host site. Triggers when the user says "add the blog", "install shipwreck blog", "drop the blog into <site>", or sets up `@shipwreck/blog-core` for a new property. Produces a themed, building blog at /blog/ that visually matches the host.
---

# Skill — Integrate Shipwreck Blog into a Host Site

You are integrating `@shipwreck/blog-engine` into a host site. The end state: the host site has a `_blog/` source dir that builds to `/blog/` static output, themed to look native to the host.

**Don't improvise.** Follow the procedure. Every step has an output you can verify. If a verification fails, fix that step before moving on.

---

## Inputs you need from the user

Before starting, confirm:

1. **Host site repo path** (local) or live URL — required
2. **Where blog mounts** — usually `/blog/` (default). Confirm if different.
3. **Site name** for branding (e.g. "Wollongong Weather")
4. **Primary domain** (e.g. `https://wollongongweather.com`)

If any are missing, ask. Don't guess.

---

## Phase 1 — Install (mechanical)

```bash
# from inside the host site repo:
cp -r <path-to>/shipwreck-blog-engine/examples/demo-site ./_blog
cd _blog
npm install
```

**Edit `_blog/site.config.ts`** with the user's inputs:

```ts
import type { SiteConfig } from "@shipwreck/blog-core"

const config: SiteConfig = {
  siteName: "<SITE_NAME>",
  baseUrl: "<BASE_URL>",
  blogBasePath: "/blog",
  brand: {
    organizationName: "<SITE_NAME>",
    logoUrl: "/assets/logo.svg",  // confirm path on host
  },
  seo: {
    defaultOgImage: "<BASE_URL>/assets/og-image.png",  // 1200x630 PNG; confirm path
    locale: "en_AU",  // adjust per site
  },
  layout: {
    postsPerPage: 10,
    showReadingTime: true,
    showAuthor: true,
    showTableOfContents: true,
    showRelatedPosts: true,
    relatedPostsCount: 3,
  },
  ctaBlocks: { default: "default" },  // see Phase 4 for custom CTAs
}

export default config
```

**Verify:**
```bash
npm run dev
# open http://localhost:4321/blog/
```
Should render unstyled blog with the demo MDX post. If yes → Phase 2.

---

## Phase 2 — Extract host design tokens

You're filling out [TOKEN-CONTRACT.md](../../packages/blog-theme-default/TOKEN-CONTRACT.md). The contract enumerates every theming token the engine exposes — your job is to fill each one with a host-site-correct value.

### 2a — Source the values

**Pick the highest-fidelity source available, in this order:**

1. **Host repo Tailwind config** (`tailwind.config.{js,ts,cjs}`) — read `theme.extend.colors`, `fontFamily`, `borderRadius`. Best signal.
2. **Host CSS custom properties** — grep for `:root` and `--color-*` / `--font-*` in any global CSS.
3. **Host computed styles via browser** — if no repo access (or for verification), use the [extract-theme script](../../scripts/extract-theme.mjs):
   ```bash
   node scripts/extract-theme.mjs https://<host-domain> > _blog/tokens.draft.css
   ```
   Or use Chrome MCP if available — navigate to the host, run a `getComputedStyle` snapshot on `body`, `a`, `button.primary`, `h1`, etc.

### 2b — Write `_blog/src/styles/tokens.css`

Use the [TOKEN-CONTRACT skeleton](../../packages/blog-theme-default/TOKEN-CONTRACT.md#where-to-write-the-values) as the template. Fill **every** token. Don't skip any — leaving a token at the engine default when the host has a different value produces visible mismatch.

Then ensure the consumer's `BaseLayout.astro` imports it:

```astro
---
import "../styles/tokens.css"
import "@shipwreck/blog-theme-default/tokens.css"  // engine fallback (only fills tokens you didn't override)
---
```

Order matters: load engine fallbacks first, then site overrides — actually the opposite. Load **site tokens.css after** the engine fallback so site values win. Or: skip the engine fallback entirely if your tokens.css is complete (recommended).

### 2c — Validate every token

Run through the [Validation checklist](../../packages/blog-theme-default/TOKEN-CONTRACT.md#validation-checklist). Each item must be ✓ before moving on.

---

## Phase 3 — Port the SiteShell (header + footer)

The blog renders inside the host's chrome. Copy the host's existing header/footer markup verbatim into:

- `_blog/src/components/SiteShell/Header.astro`
- `_blog/src/components/SiteShell/Footer.astro`

**Conversion rules:**
- React/Vue/Nuxt → Astro: `className` → `class`, no JSX expressions, no framework `<Link>` — use plain `<a>`
- Drop client-only state (search bars, login buttons) unless explicitly needed in the blog context
- Keep all nav menu items, even ones the blog doesn't link to. Users click through from the blog header back to the host.
- Add a "Blog" link to the nav if the host doesn't already have one
- Preserve all utility classes verbatim — they'll resolve correctly because Phase 2 tokens are now in place

**Then load any host fonts.** If the host loads Google Fonts via `<link>` in `<head>`, port the same `<link>` into `_blog/src/layouts/BaseLayout.astro` `<head>`.

---

## Phase 4 — Custom CTAs (optional)

If the host site has a primary CTA the blog should reuse (e.g. "Get a quote", "Book a consult"), create:

`_blog/src/components/cta/<CtaName>.astro`

Match the host's button visually — but since the button now reads `--button-bg` / `--button-radius` / etc. from your tokens, the styling should "just work". Verify after build.

Register in `site.config.ts`:

```ts
ctaBlocks: {
  default: "<cta-name>",
  categoryOverrides: {
    "category-slug": "<other-cta-name>",
  },
}
```

---

## Phase 5 — Build & visual verification

```bash
cd _blog
npm run build
```

Output goes to `dist/`. The build script copies it to `../blog/` for static serving.

**Run visual verification** — this is non-negotiable, even if you think it looks fine:

```bash
node scripts/visual-diff.mjs <host-homepage-url> http://localhost:4322/blog/
```

(Start `npx astro preview --host 0.0.0.0 --port 4322` first.)

The script compares header, footer, body typography, and primary CTA between host and blog. Any region with >5% pixel diff fails. Fix tokens, rebuild, re-verify.

**Manual sanity check** at a minimum:
- [ ] Header looks identical to host (logo, nav items, spacing, colors)
- [ ] Footer looks identical
- [ ] An inline link in a blog post matches host link color + hover
- [ ] H1 font matches host H1 (family, weight, tracking)
- [ ] Body text matches host body (family, size, line-height, color)
- [ ] Primary CTA button matches host's most prominent CTA
- [ ] Card border-radius matches host card style
- [ ] No engine-default colors visible (no royal-blue links if host uses teal, etc.)

---

## Phase 6 — Deploy & register

Two things ship with deploy:

1. **`/blog/` static output** — ensure it's served at the right path. Check the host's deploy pipeline copies `_blog/dist/` to wherever `/blog/` is served from.
2. **Site registration** — add this site to the central rollout registry (see [ROLLOUT.md](../../ROLLOUT.md)) so future engine updates can fan out automatically.

After deploy, sanity-check the live page with:
```bash
node scripts/visual-diff.mjs <host-homepage-url> <host-domain>/blog/
```

---

## Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| ToC duplicated at desktop width | Tailwind not scanning engine components | Verify `@shipwreck/blog-theme-default >= 0.2.0` and that the preset's `content` array is actually loaded (dump resolved config: `node -e "import('./tailwind.config.ts').then(c => console.log(c.default))"`) |
| Giant brand banner above article | Old `defaultFeaturedImage` hero fallback | Upgrade `@shipwreck/blog-core` to `>= 0.2.0`; remove `?? siteConfig.seo.defaultFeaturedImage` from `[...slug].astro` |
| Two H1s on every post | MDX starts with same H1 as frontmatter title | Wire `remarkStripDuplicateH1` from `@shipwreck/blog-core/remark/strip-duplicate-h1.mjs` into `astro.config.ts` |
| Buttons don't match host | `--button-*` tokens not set | Sample host's primary CTA in browser devtools, copy values into tokens.css |
| Blog body looks "almost" right but slightly off | One or more tokens left at engine default | Re-run validation checklist from TOKEN-CONTRACT.md — find the missing override |

---

## After integration succeeds

Update `D:/NyXi's Vault/Topics/<SiteName>.md` with:
- Engine version installed
- Theme integration date
- Any custom CTAs added
- Any quirks (host-specific fonts, dark-mode handling, etc.)

This becomes the reference for the next agent who maintains the site.
