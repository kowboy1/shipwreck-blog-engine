# Shipwreck Blog Engine — Documentation

This directory is the single source of truth for how the engine is built and operated. Every commit that changes behaviour also updates the relevant doc here. See [VERSIONING.md](./VERSIONING.md) for the discipline.

## For operators (Nyxi, ops humans)

Start here if you're administering sites that consume the engine, or onboarding it onto a new site.

- [ops/README.md](./ops/README.md) — operator overview & TL;DR
- [ops/deployment-model.md](./ops/deployment-model.md) — how this thing gets to production
- [ops/integration-checklist.md](./ops/integration-checklist.md) — adding the blog to a new site, end-to-end
- [ops/update-procedure.md](./ops/update-procedure.md) — rolling engine updates across N sites
- [ops/incident-runbook.md](./ops/incident-runbook.md) — what to do when something breaks

## For developers (humans, agents)

Start here if you're working on the engine itself.

- [dev/README.md](./dev/README.md) — developer overview
- [dev/architecture.md](./dev/architecture.md) — packages, data flow, layer boundaries
- [dev/content-model.md](./dev/content-model.md) — Zod schemas in depth
- [dev/theming.md](./dev/theming.md) — theme tokens + SiteShell pattern
- [dev/cms.md](./dev/cms.md) — Sveltia integration internals

## Reference

Field-level reference for the public surface.

- [reference/site-config.md](./reference/site-config.md) — every `SiteConfig` field
- [reference/post-frontmatter.md](./reference/post-frontmatter.md) — every Post frontmatter field
- [reference/components.md](./reference/components.md) — every component, props + examples

## Process

- [VERSIONING.md](./VERSIONING.md) — semver policy + per-commit bump discipline
