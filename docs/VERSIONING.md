# Versioning & commit discipline

This engine follows a **per-commit version bump** rule. Every commit that changes behaviour increments the version. This makes downstream sites' `npm update` predictable, the changelog a useful record, and the docs guaranteed to match the code.

## The rule

**One commit = one version bump = one CHANGELOG entry = one doc-update pass.**

If a commit:

- Changes any code, schema, component, or build behaviour → bump the version
- Touches docs only (typos, clarifications, no behaviour change) → still bump (docs are part of the contract)
- Bumps a dependency → bump the version
- Refactors with no behavioural change → bump the version (still affects consumers via npm)

The only commits that **don't** bump are:

- Commits that fix the version-bump itself (rare)
- Commits to non-published areas (`/examples/demo-site` content, `/.github/`, `/docs` after the bump but before the commit lands)

When in doubt: bump.

## Semver policy

We follow [SemVer 2.0](https://semver.org/) with the pre-1.0 caveat baked in:

| Bump | When | Examples |
|---|---|---|
| **Patch** (`0.1.0` → `0.1.1`) | Bug fix, copy change, doc update, dep bump, internal refactor, additive optional field | Default for almost everything |
| **Minor** (`0.1.0` → `0.2.0`) | New feature, new component, new optional schema field that consumers may want to adopt | "We added a `<SearchBox>` component" |
| **Major** (`0.x` → `1.0`, `1.x` → `2.0`) | Breaking change in schemas, component props, exports, or theme tokens | Renaming a frontmatter field; removing a component |

**Pre-1.0 caveat:** minor versions may include small breaking changes if they're necessary, but they MUST be flagged in `UPGRADE-GUIDE.md` and `CHANGELOG.md`. After 1.0, breaking changes are major-only.

## What gets bumped

The engine is a monorepo. Versions are kept in lockstep — every workspace package shares the same version number.

**Files updated on every bump:**

1. `package.json` (root)
2. `packages/blog-core/package.json`
3. `packages/blog-theme-default/package.json`
4. `packages/create-shipwreck-blog/package.json`
5. `examples/demo-site/package.json`
6. `CHANGELOG.md` — move `[Unreleased]` entries to `[X.Y.Z] - YYYY-MM-DD`
7. Any `docs/` page that describes the changed behaviour
8. `UPGRADE-GUIDE.md` — only if the bump introduces a breaking change

**Use the helper script:**

```bash
./scripts/bump-version.sh patch    # 0.1.0 → 0.1.1
./scripts/bump-version.sh minor    # 0.1.0 → 0.2.0
./scripts/bump-version.sh major    # 0.1.0 → 1.0.0
```

The script:
- Updates all five `package.json` files in lockstep
- Inserts a new `[X.Y.Z] - YYYY-MM-DD` section in `CHANGELOG.md` above the latest existing entry
- Leaves the `[Unreleased]` heading in place at the top (empty) for the next round
- Stages the version-related files

You then write the changelog entry, update any affected docs, stage them, and commit.

## Commit message format

```
<type>(<scope>): <subject>

[optional body]

Bumps to vX.Y.Z.
```

`<type>` is one of: `feat`, `fix`, `refactor`, `docs`, `chore`, `deps`, `breaking`.
`<scope>` is one of: `core`, `theme`, `scaffolder`, `demo`, `cms`, `docs`, `build`.

Examples:

```
fix(core): handle empty tags array in TagList without crashing

The component crashed when posts had no tags. Now renders nothing instead.

Bumps to v0.1.1.
```

```
feat(core): add SearchBox component with client-side filter

Adds <SearchBox> for client-side post filtering using the posts.json
manifest. Optional dependency, sites opt in by importing it.

Bumps to v0.2.0.
```

```
breaking(core): rename Post.canonical to Post.canonicalUrl

Aligns the field name with the rest of the URL fields.

Sites must rename `canonical:` to `canonicalUrl:` in their post frontmatter.
See UPGRADE-GUIDE.md.

Bumps to v1.0.0.
```

## CHANGELOG format

[Keep a Changelog](https://keepachangelog.com) format. Every release section has these subsections (omit empty ones):

```
## [X.Y.Z] - YYYY-MM-DD

### Added
- New things

### Changed
- Behaviour changes (non-breaking)

### Deprecated
- Things still working but slated for removal

### Removed
- Things deleted (breaking)

### Fixed
- Bugs

### Security
- CVEs, dep updates that close security issues
```

`[Unreleased]` lives at the top and accumulates entries until the next bump.

## Doc-update discipline

When you commit a behaviour change, update the relevant doc in the same commit. Keep these in sync:

| Change kind | Update doc |
|---|---|
| New schema field | `docs/dev/content-model.md` + `docs/reference/post-frontmatter.md` |
| New SEO output | `docs/dev/seo-pipeline.md` (or create) |
| New component | `docs/reference/components.md` |
| New site.config field | `docs/reference/site-config.md` |
| New CMS field | `docs/dev/cms.md` |
| Theming change | `docs/dev/theming.md` |
| Build process change | `docs/ops/deployment-model.md` |
| Integration step change | `docs/ops/integration-checklist.md` + top-level `INTEGRATION.md` |
| Breaking change | `UPGRADE-GUIDE.md` |

If you're not sure which doc — check `docs/README.md` for the index.

## Git tags

After committing the bump, tag it:

```bash
git tag v0.1.1
git push origin main --tags
```

Tags let downstream sites pin via git+ssh:

```json
{
  "@shipwreck/blog-core": "git+ssh://git@github.com:YOUR_ORG/shipwreck-blog-engine.git#v0.1.1&workspace=@shipwreck/blog-core"
}
```

## Why this is strict

The engine is consumed by N sites via `npm update`. If the version doesn't move, sites don't update. If the changelog is empty, operators don't know what's changed. If the docs don't match the code, integrators get burned.

The 30-second cost of running the bump script is cheaper than the hour of debugging a stale-doc-induced bug.
