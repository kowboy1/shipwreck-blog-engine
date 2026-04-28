# Contributing

How to work on the Shipwreck Blog Engine.

## Setup

```bash
git clone git@github.com:YOUR_ORG/shipwreck-blog-engine.git
cd shipwreck-blog-engine
npm install
npm run dev
# opens http://localhost:4321/blog/
```

Node 20+ required.

## Repo layout

```
packages/
  blog-core/             # @shipwreck/blog-core — schemas, components, SEO, utils
  blog-theme-default/    # @shipwreck/blog-theme-default — Tailwind preset, tokens
  create-shipwreck-blog/ # scaffolder CLI

examples/
  demo-site/             # reference Astro app (also serves as the per-site template)
```

## Where to add things

| Adding... | Goes in |
|---|---|
| A new SEO field on posts | `packages/blog-core/src/schemas/post.ts` |
| A new schema.org generator | `packages/blog-core/src/seo/schema-org.ts` |
| A reusable visual component | `packages/blog-core/src/components/` |
| A site-specific component | `examples/demo-site/src/components/` (and document the pattern) |
| A theme token | `packages/blog-theme-default/tokens.css` + the Tailwind preset |
| A new page route | `examples/demo-site/src/pages/` |
| A new CTA | `examples/demo-site/src/components/cta/` and register in `registry.ts` |
| A redirect | `examples/demo-site/src/redirects.json` |

## Versioning rules

- **Don't break the post schema** without a major bump and a migration note in `UPGRADE-GUIDE.md`.
- New schema fields must be optional or have defaults.
- New component props must be optional.
- Renaming a component or its export = major bump.

## Testing changes

Manual for now:

```bash
npm run build      # all packages + demo-site
npm run typecheck  # type errors
```

Browse the demo-site after `npm run build && npm run preview` and check:

- [ ] Index page renders, pagination works
- [ ] Post page renders ToC, related, author, CTA, tags
- [ ] Tag/category/author archives work
- [ ] `/blog/sitemap-index.xml` exists in `dist/`
- [ ] `/blog/rss.xml` exists in `dist/`
- [ ] `/blog/robots.txt` lists the sitemap
- [ ] 404 page exists at `/blog/404/`
- [ ] No console errors

## Pull request hygiene

- One concern per PR
- Update `CHANGELOG.md` under `[Unreleased]`
- If the change is breaking: also update `UPGRADE-GUIDE.md` with a migration section
- If the change is a new component: add an example usage in the demo site
