> ⚠️ **STOP** — if you are an agent and havent read [AGENTS.md](AGENTS.md) yet, read that first.
> This file is referenced FROM the agent runbook in `AGENTS.md`, not a starting point.
> Continue here only if `AGENTS.md` routed you to this file.

# Integration Guide — Adding the Blog to a Site

This guide is written for both humans and agents. It covers two phases:

1. **Install** the blog into a site
2. **Theme** the blog to match the host site's existing header, footer, and visual style

---

## Part 1 — Install

### Prerequisites
- Host site repo cloned locally
- Node 20+ available
- Decide where the blog lives. Two patterns:
  - **Subpath build** (recommended): blog builds to static HTML, mounts at `/blog/` on the host site
  - **Subdomain**: blog deploys independently to `blog.example.com`

### Steps

```bash
cd <host-site-repo>
cp -r <path-to>/shipwreck-blog-engine/examples/demo-site ./blog
cd blog
npm install
```

Then edit `blog/site.config.ts`:

```ts
export default {
  siteName: "Review Removals",
  baseUrl: "https://reviewremovals.com",
  blogBasePath: "/blog",
  brand: {
    organizationName: "Review Removals",
    logoUrl: "/logo.svg",
  },
  seo: {
    defaultOgImage: "/og-default.jpg",
    twitterHandle: "@reviewremovals",
  },
  ctaBlocks: {
    default: "book-consult",
    categoryOverrides: {
      "case-studies": "request-audit",
    },
  },
}
```

### Verify install

```bash
npm run dev
# open http://localhost:4321/blog
```

You should see the unstyled (default-themed) demo posts. If yes — install succeeded. Now theme it.

---

## Part 2 — Theme the blog to match the host site

**This is the recipe an agent (or you) follows to make the blog look native inside an existing site.**

### Inputs the agent needs
1. The host site's repo path (or live URL)
2. Where the host site's **header** and **footer** markup live
3. The host site's **Tailwind config / CSS variables / color palette**

### Step 1 — Port the site shell

Copy the host site's header and footer markup into:

- `blog/src/components/SiteShell/Header.astro`
- `blog/src/components/SiteShell/Footer.astro`

**Rules:**
- Convert the markup to Astro syntax (`class` not `className`, no JSX expressions)
- Replace any framework-specific link components (`<Link>`, `<NuxtLink>`) with plain `<a href="...">`
- Keep the menu items intact — the blog must appear inside the same nav
- Add a `Blog` link to the nav if the host site doesn't already have one
- Preserve the host site's Tailwind classes verbatim — assume the same Tailwind config will be applied next

### Step 2 — Port the design tokens

Find the host site's color palette, fonts, and spacing. Sources to check, in order:
1. `tailwind.config.{js,ts,cjs}` → `theme.extend.colors`, `fontFamily`
2. `:root` CSS custom properties in any global stylesheet
3. Brand guideline doc if one exists

Copy the relevant values into `blog/tailwind.config.ts`:

```ts
import sharedPreset from "@shipwreck/blog-theme-default/tailwind-preset"

export default {
  presets: [sharedPreset],
  content: ["./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#YOUR_PRIMARY",
        accent: "#YOUR_ACCENT",
        // ...port the host site's palette here
      },
      fontFamily: {
        sans: ['"Host Site Sans"', "system-ui", "sans-serif"],
        heading: ['"Host Site Display"', "serif"],
      },
    },
  },
}
```

And if the host site uses CSS custom properties for theming, mirror them in `blog/src/styles/theme.css`:

```css
:root {
  --color-primary: #...;
  --color-bg: #...;
  --color-text: #...;
  --font-heading: ...;
  --radius-card: ...;
}
```

### Step 3 — Load the host site's fonts

If the host site loads fonts via Google Fonts, a self-hosted file, or a `<link>` tag in `<head>`, add the same loader to `blog/src/layouts/BaseLayout.astro` (or the equivalent in `blog-core`).

### Step 4 — Visual diff

```bash
npm run dev
```

Open the host site and the blog (`/blog`) side by side. Check:
- [ ] Header is identical (logo, nav items, spacing, colors)
- [ ] Footer is identical
- [ ] Body fonts match
- [ ] Heading fonts match
- [ ] Primary button color matches
- [ ] Link color matches
- [ ] Background color matches
- [ ] Card / list styles feel native

Iterate until the blog looks like a native page on the host site.

### Step 5 — Build & deploy

```bash
npm run build
# output: blog/dist/
```

Mount `blog/dist/` at `/blog/` on the host. Three common patterns:

- **Static host (Cloudflare Pages, Netlify):** copy `dist/` into the host site's `public/blog/` before host build, or deploy as a separate site at `blog.example.com`
- **Node host (Express, etc.):** serve `blog/dist/` as static under `/blog`
- **Reverse proxy:** nginx `location /blog { root /var/www/blog/dist; }`

---

## Part 3 — Updating the engine across sites

When `@shipwreck/blog-core` ships a fix or feature:

```bash
cd <host-site-repo>/blog
npm update @shipwreck/blog-core
npm run build
```

Breaking changes will be flagged via semver major bump and called out in `UPGRADE-GUIDE.md`.

---

## Part 4 — Enable the CMS (optional)

The engine ships with [Sveltia CMS](https://github.com/sveltia/sveltia-cms) — a free, Git-backed, browser-based content editor — pre-wired at `/blog/admin/`.

**You don't need this for AI authoring.** Nyxi writes MDX directly to the repo. The CMS is for human editing, internal-linking review, and on-the-go fixes from a phone.

### How it works
- The MDX/JSON files in the repo stay the source of truth
- Sveltia reads/writes those files via the GitHub API
- Saving a post = a commit to the site repo
- The site rebuilds via your normal CI/deploy

### Enable it for a site

**1. Edit `blog/public/admin/config.yml`** — replace the placeholders:

```yaml
backend:
  name: github
  repo: YOUR_ORG/YOUR_SITE_REPO   # ← change this
  branch: main                     # ← change this if not main

site_url: https://yoursite.com/blog
display_url: https://yoursite.com/blog
```

**2. Set up GitHub OAuth.** Two paths:

- **Easy (recommended):** use Sveltia's built-in PKCE flow. No backend needed. See [Sveltia docs — GitHub auth](https://github.com/sveltia/sveltia-cms/blob/main/docs/github-backend.md). You register one OAuth app on GitHub and reuse its client ID across all your sites.
- **Custom proxy:** if you want central control, host a Cloudflare Worker auth proxy. Defer until you actually have multiple editors.

**3. Deploy and visit `https://yoursite.com/blog/admin/`** — log in with GitHub, you're in.

### What's editable
- **Posts** — full SEO frontmatter + body. Form fields mirror the Zod schema 1:1.
- **Authors** — bio, avatar, social links. Each author = a JSON file in `content/authors/`.
- **Redirects** — edit `blog/src/redirects.json` directly via GitHub web UI (kept out of the CMS to preserve the flat array format).

### Internal linking
Two helpers ship with the engine:

- **`/blog/posts.json`** — every site exposes a JSON manifest of published posts (id, title, url, tags, category, dates). Hand this to Nyxi when asking it to add internal links to a post.
- **`suggestInternalLinks()`** — exported from `@shipwreck/blog-core`. Programmatic version of the same logic, used by build-time scripts or future admin tooling.

### Commits look like
```
content(blog): create posts "my-new-post"
content(blog): update authors "rick"
```
…attributed to whoever logged into the CMS. Configurable in `config.yml`.

---

## Part 5 — Common customizations

### Add a custom CTA block

Edit `blog/src/components/cta/` — add a new `.astro` component, register it in `site.config.ts` under `ctaBlocks`.

### Override a core component

Astro supports component shadowing. Create the same path under `blog/src/components/` and Astro uses your local version. Useful for one-off tweaks; if it generalizes, land the change in `blog-core` instead.

### Add a custom page (e.g., "About the blog")

Create `blog/src/pages/about.astro`. The blog's pages live alongside core re-exports in `src/pages/`.
