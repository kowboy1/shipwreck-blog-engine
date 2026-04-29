> ⚠️ **STOP** — if you are an agent and havent read [AGENTS.md](AGENTS.md) yet, read that first.
> This file is referenced FROM the agent runbook in `AGENTS.md`, not a starting point.
> Continue here only if `AGENTS.md` routed you to this file.

# Shipwreck Blog Engine — Project Brief

## Purpose
Build a fast, lightweight, SEO-first standalone blogging platform that can be dropped into existing and future Shipwreck/ Rick web projects instead of using WordPress.

This document captures the relevant conversation and decisions so another agent (including Claude Code / designer agents) can pick up the work cold.

---

## Source Conversation Summary

### 1) Local stack audit findings
A local audit of projects under `/home/rick/projects` found:

- Not all local web projects use one identical frontend stack.
- The **dominant modern app frontend pattern** is:
  - **React 19**
  - **Vite**
  - **Tailwind CSS 4**
- Static brochure/microsites are mostly plain **HTML/CSS/JS**.
- Internal dashboards use a **Node HTTP server + shared Shipwreck dashboard shell** pattern.

### 2) Standard stack recommendation for future builds
Recommended house stack for future web app/page builds:

- **React + Vite + TypeScript + Tailwind**
- **React Router**
- **React Hook Form + Zod**
- **TanStack Query**
- **Lucide icons**
- **Recharts** when needed
- **Framer Motion** only when needed
- **Vitest + Testing Library**
- **Node + Express** for backend/internal tools
- Use the **Shipwreck dashboard shell** for internal admin/dashboard surfaces

Blunt recommendation:

> Default house stack: **React + Vite + TypeScript + Tailwind + React Router + TanStack Query + RHF/Zod**

### 3) SEO concern raised
Rick noted that most of these sites will need a **blog** for SEO reasons, with a common feature set across sites.

Question raised:

> Instead of using WordPress, can we build **one fast/light blogging platform** as a standalone system that can be dropped into any existing build?

### 4) Strategic recommendation given
Recommendation was **not** to build a giant CMS replacement.

Instead, build a:

> **portable blog engine**

Meaning:
- one **content admin/backend**
- one **SEO-aware frontend renderer**
- one **integration contract**
- many sites consuming it

---

## Recommended Product Direction

### Core concept
Create a **multi-tenant standalone blog engine** that can power blog sections for multiple sites/brands.

Each site should be able to mount/use the same engine with site-specific config for:
- branding
- domain/canonical behavior
- CTA blocks
- OG defaults
- site metadata

### Recommended architecture
**Headless content backend + reusable renderer + per-site adapter/config layer**

#### Main pieces
1. **Content admin**
   - create/edit posts
   - manage categories, tags, authors
   - featured images
   - SEO fields
   - redirects
   - publish scheduling

2. **Content API**
   - REST/JSON endpoints
   - fetch by slug, category, tag, author, site
   - sitemap/feed/search endpoints

3. **Reusable frontend/blog renderer**
   - blog index
   - single post page
   - category/tag archives
   - author archives
   - related posts
   - breadcrumbs
   - pagination
   - schema markup
   - internal-link modules / CTA slots

4. **Site adapter/config layer**
   - mount under `/blog`
   - apply theme tokens/branding
   - define canonical/base URL
   - wire CTA defaults and overrides

---

## Important SEO Requirement
For SEO, the blog should **not** rely on client-side-only rendering.

Recommendation:
- **SSR** or
- **static prerendered output**

Preferred practical model:

> **Central content backend + static generation/export per site**

This gives:
- SEO-friendly HTML output
- low runtime complexity
- portability across projects
- no WordPress dependency

---

## Recommended Tech Stack
To align with the existing house stack, use:

### Core stack
- **Node + Express** backend
- **SQLite or Postgres**
- **TypeScript**
- **React + Vite** for admin and/or renderer tooling
- **Tailwind CSS**
- **Zod** for schema validation
- **Markdown or MDX** for post bodies/content structure

### Strategic note
Even if the admin UI uses React/Vite, the **published blog output** should be SSR or statically generated.

---

## Required SEO / Publishing Features

### Content model fields
- title
- slug
- excerpt
- body
- featured image
- author
- category
- tags
- publish date
- updated date
- canonical URL
- meta title
- meta description
- OG title / description / image
- noindex toggle
- custom schema fields
- related posts
- CTA block assignment

### SEO output/features
- clean URLs
- XML sitemap
- RSS feed
- robots directives
- breadcrumbs
- Article schema
- Organization schema
- FAQ schema (optional)
- internal linking controls
- table of contents
- image alt/caption support
- pagination
- redirect manager
- canonical control
- auto `lastmod`
- search page
- category/tag archive pages

### Editorial features
- draft / published / scheduled states
- revision history
- reusable content blocks
- author bios
- featured posts
- sticky posts
- content templates

---

## Drop-In / Multi-Site Design Goal
The system should be reusable through a site config layer like this:

```ts
export default {
  siteName: "Example Site",
  baseUrl: "https://example.com",
  blogBasePath: "/blog",
  brand: {
    primaryColor: "#...",
    logo: "/logo.png"
  },
  seo: {
    defaultOgImage: "/og-default.jpg",
    organizationName: "Example Brand"
  },
  ctaBlocks: {
    default: "book-consult",
    categoryOverrides: {
      seo: "audit-offer"
    }
  }
}
```

Goal:
- same engine
- different site configs
- different themes/brand wrappers
- shared content model and SEO logic

---

## Suggested Delivery Phases

### Phase 1 — MVP
Build:
- post model
- markdown/MDX content support
- blog index
- post page
- category/tag pages
- meta tags
- sitemap
- RSS
- schema
- static generation/export

### Phase 2
Add:
- admin UI
- scheduled publishing
- redirects
- related posts
- reusable CTAs
- multi-site tenancy

### Phase 3
Add:
- internal linking suggestions
- content scoring
- topic cluster support
- programmatic SEO pages
- AI-assisted briefs/drafts

---

## Key Recommendation / Final Direction
The strongest recommendation from the conversation was:

> Build **a multi-tenant headless blog platform that stores content centrally and exports SEO-friendly static blog sections into each site**.

That was identified as the best balance of:
- speed
- portability
- low bloat
- strong SEO
- compatibility with the current React/Vite direction
- avoiding WordPress

---

## Suggested Project Intent
This project directory should become the home for:
- architecture
- UX planning
- content model design
- integration spec
- renderer decisions
- admin UI design
- site adapter strategy
- SEO feature checklist
- implementation roadmap

---

## Suggested Next Design Questions for Claude / designer agents

1. What is the best product architecture for:
   - central admin
   - content storage
   - site-specific publishing/export
   - static vs SSR rendering?

2. What should the admin UI information architecture look like?

3. What is the cleanest content model for:
   - posts
   - categories
   - authors
   - reusable CTA blocks
   - redirects
   - multi-site assignment?

4. What should the export/integration contract be for plugging this into:
   - React/Vite sites
   - static sites
   - Node-rendered sites?

5. How should site theming/branding be abstracted so the same engine feels native in multiple projects?

6. What is the minimum feature set required to beat WordPress for Rick’s actual use case without turning into an overbuilt CMS?

---

## Suggested Working Name
- **Shipwreck Blog Engine**

Alternatives that may be worth exploring later:
- Shipwreck Content Engine
- Shipwreck SEO Publisher
- Shipwreck Blog Core
- Shipwreck Headless Blog

---

## Operator Note
This is intended to be:
- fast
- lightweight
- reusable
- SEO-first
- multi-site capable
- non-WordPress
- easy to integrate into existing projects

Do **not** drift into building a generic bloated CMS unless there is a concrete reason.

Keep it sharp.
