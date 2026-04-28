# Developer overview — Shipwreck Blog Engine

**Audience:** anyone working on the engine itself (humans or AI agents).

This is the entry point for contributors. Read [VERSIONING.md](../VERSIONING.md) before your first commit — the per-commit bump rule is non-negotiable.

## What this engine is

A monorepo containing:

- An npm package (`@shipwreck/blog-core`) with all reusable schemas, SEO helpers, components, and utilities
- An npm package (`@shipwreck/blog-theme-default`) with default Tailwind preset + tokens
- A scaffolder CLI (`create-shipwreck-blog`)
- A reference Astro app (`examples/demo-site`) that exists for two reasons: (1) end-to-end testing, (2) the source-of-truth template that gets copied into host sites

## Repo layout

```
shipwreck-blog-engine/
├── packages/
│   ├── blog-core/                    # main library
│   │   └── src/
│   │       ├── schemas/              # Zod content schemas
│   │       ├── seo/                  # schema.org + meta tag builders
│   │       ├── utils/                # reading-time, slug, related, internal-links
│   │       ├── components/           # Astro components (consumed by sites)
│   │       └── index.ts              # public API
│   ├── blog-theme-default/           # Tailwind preset + tokens
│   └── create-shipwreck-blog/        # scaffolder CLI
├── examples/
│   └── demo-site/                    # reference Astro app
├── docs/                             # YOU ARE HERE
├── scripts/
│   └── bump-version.sh               # version bump tooling
├── CHANGELOG.md                      # release notes
├── ARCHITECTURE.md                   # high-level design (locked decisions)
├── INTEGRATION.md                    # how to integrate into a host site
├── UPGRADE-GUIDE.md                  # breaking-change migration notes
└── README.md
```

## How the layers fit together

```
┌──────────────────────────────────────┐
│   Host site (e.g. wollongong-weather)│
│   _blog/site.config.ts               │
│   _blog/src/content/posts/*.mdx      │
│   _blog/src/components/SiteShell/    │   ← per-site
│   _blog/src/components/cta/          │
└──────┬───────────────────────────────┘
       │ depends on
       ▼
┌──────────────────────────────────────┐
│   @shipwreck/blog-theme-default      │   ← style layer
│   - Tailwind preset                  │
│   - tokens.css                       │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│   @shipwreck/blog-core               │   ← logic layer (the engine)
│   - schemas (Post, SiteConfig, ...)  │
│   - seo (schema.org, meta tags)      │
│   - utils (related, slug, ToC...)    │
│   - components (Astro)               │
└──────────────────────────────────────┘
```

The split matters: schemas and utils are the *contract*. Components are the *defaults*. Sites can shadow components locally without forking the engine.

## Local development

```bash
git clone <engine-repo>
cd shipwreck-blog-engine
npm install
npm run dev
# opens http://localhost:4321/blog/
```

`npm run dev` starts Astro pointing at `examples/demo-site/`. Editing any file in `packages/blog-core/src/` hot-reloads in the demo site (workspace symlinks).

### Common scripts

- `npm run dev` — demo site dev server with hot reload
- `npm run build` — build all workspace packages including demo site
- `npm run typecheck` — TypeScript check across workspaces
- `./scripts/bump-version.sh <patch|minor|major>` — bump version + insert CHANGELOG section

## Conventions

### Code style

- TypeScript strict mode everywhere
- Use `import type` for types-only imports (the `verbatimModuleSyntax` setting enforces this)
- File extensions in imports: `.js` (TypeScript's NodeNext rule, even for `.ts` files)
- No default exports unless an Astro component requires it

### Component conventions

Astro components in `packages/blog-core/src/components/`:

- One concern per file
- Take props for everything that varies; no internal hardcoded paths
- Always accept `basePath` prop for any route generation (so sites with non-`/blog/` paths work)
- Don't import from `astro:content` directly — that's the host site's job. Take posts as props.
- Tailwind classes only; no scoped CSS unless absolutely needed

### Schema conventions

Zod schemas in `packages/blog-core/src/schemas/`:

- Required fields are first, optional second
- Optional fields with sensible defaults use `.default(...)` rather than just `.optional()`
- Constrained string fields have `.max(...)` to fail fast on overflow
- `z.coerce.date()` for date fields (lets MDX frontmatter pass strings)

### Adding a new feature

1. Decide which layer it belongs in (see "How the layers fit together")
2. If it's a new schema field: add to schema with default/optional, update Sveltia config in demo, update reference docs
3. If it's a new component: add to `packages/blog-core/src/components/`, export from `index.ts`, add to `docs/reference/components.md`
4. If it's a new utility: add to `packages/blog-core/src/utils/`, export, document
5. Update `examples/demo-site/` to use the new feature (proves it works end-to-end)
6. Update CHANGELOG `[Unreleased]`
7. Bump version + commit (see [VERSIONING.md](../VERSIONING.md))

### What NOT to add

- A backend / database / admin server
- Per-site logic in `blog-core` (that's the host site's job)
- Mandatory dependencies. Optional integrations OK; required ones need a strong case.
- Comments explaining the obvious. Prefer self-documenting code.

## Testing

No automated tests yet (Phase 2 candidate). Manual verification:

```bash
npm run build
ls examples/demo-site/dist/
# Verify: index.html, post folders, tag/category/author archives, sitemap, RSS, robots, posts.json, admin/
```

Spot-check that key files contain expected content:

```bash
grep -c "application/ld+json" examples/demo-site/dist/seo-checklist/index.html
# Should be 2 or 3 (Article + BreadcrumbList + optional FAQPage)
```

## Where to read next

- [architecture.md](./architecture.md) — internal architecture deep-dive
- [content-model.md](./content-model.md) — Zod schemas explained
- [theming.md](./theming.md) — theme system
- [cms.md](./cms.md) — Sveltia integration
- [../VERSIONING.md](../VERSIONING.md) — versioning rules
