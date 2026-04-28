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

We follow [SemVer](https://semver.org):

- **Patch** (`0.1.0` → `0.1.1`): bug fixes, no API change. Safe to update without thinking.
- **Minor** (`0.1.0` → `0.2.0`): new features, additive changes. Safe to update; new features are opt-in.
- **Major** (`0.x` → `1.0`, `1.x` → `2.0`): breaking changes. Read the relevant section below before upgrading.

Pre-1.0: minor versions may include small breaking changes. Always read the changelog.

## Migration sections

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
