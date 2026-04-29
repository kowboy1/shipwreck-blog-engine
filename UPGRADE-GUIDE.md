> ⚠️ **STOP** — if you are an agent and havent read [AGENTS.md](AGENTS.md) yet, read that first.
> This file is referenced FROM the agent runbook in `AGENTS.md`, not a starting point.
> Continue here only if `AGENTS.md` routed you to this file.

# Upgrade Guide

How to safely upgrade `@shipwreck/blog-core` and `@shipwreck/blog-theme-default` in a site that has the blog integrated.

## How updates flow

The engine is consumed by sites via git+ssh URLs in their `blog/package.json`. When a new version ships:

```bash
cd <site-repo>/blog
npm update @shipwreck/blog-core @shipwreck/blog-theme-default
npm run build
```

If anything breaks, this guide tells you what to do.

## Versioning

This project intentionally bumps **patch only** (last decimal place) until a 1.0 milestone — even when changes are minor- or major-justifying by strict SemVer. The bump is the user's call, not the engine's.

- **Patch** (`0.3.1` → `0.3.2` → `0.3.99` → `0.3.100`): everything goes here pre-1.0. Bug fixes, new features, breaking changes — all bumped patch with details in CHANGELOG. Safe-to-update status is documented per release.
- **Minor / Major bumps** are explicit decisions the maintainer makes when calling a milestone. Don't auto-derive from SemVer rules.

CHANGELOG entries note when a release would conventionally warrant minor or major under strict SemVer — that's how the maintainer decides when to actually bump milestones.

Always read the CHANGELOG for the version you're upgrading to. The "Migration" section at the bottom of each release tells you the consumer-side steps.

## Migration sections

For consumer-side migration steps between specific releases, see [CHANGELOG.md](CHANGELOG.md) — every release has a "Migration" subsection at the bottom. This file describes the rollback procedure (below) and the eventual `1.0` milestone plan.

### `0.x` → `1.0` (placeholder)

Will be filled when 1.0 ships. Expected breaking changes:

- Schema: lock all required fields and finalise default values
- Component prop signatures: stabilise `Breadcrumbs`, `Pagination`, `TableOfContents` props
- Theme tokens: rename / consolidate

## Rollback

If an upgrade breaks a site:

```bash
cd <site-repo>/blog
git restore package.json package-lock.json
npm install
```

Pin to a known-good version by editing the git URL to include a tag or commit SHA:

```json
{
  "dependencies": {
    "@shipwreck/blog-core": "git+ssh://git@github.com:YOUR_ORG/shipwreck-blog-engine.git#v0.1.3&workspace=@shipwreck/blog-core"
  }
}
```

## Reporting upgrade issues

File an issue in the engine repo with:

- Old and new version
- Site URL or repo
- Build error / runtime error / visual diff
- Whether the host site has any local component overrides
