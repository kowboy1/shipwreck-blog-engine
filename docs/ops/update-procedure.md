# Update procedure — rolling engine updates across sites

When the engine ships a new version, each consuming site has to opt in. This doc covers how to do that safely.

## Before you update anything

- [ ] Read the engine's `CHANGELOG.md` for the new version. Identify breaking changes.
- [ ] If it's a major bump, read `UPGRADE-GUIDE.md` for the migration steps.
- [ ] Decide which sites should get this update. Not every site has to upgrade simultaneously.

## The standard update flow (per site)

```bash
cd <host-site-repo>/_blog

# 1. Update the engine packages
npm update @shipwreck/blog-core @shipwreck/blog-theme-default

# 2. Verify the lockfile changed
git diff package-lock.json | head

# 3. Rebuild
npm run build

# 4. Spot-check the built output
ls ../blog/
# Open a post page locally to confirm it renders

# 5. Commit
cd ..
git add _blog/package.json _blog/package-lock.json blog/
git commit -m "chore(blog): update engine to vX.Y.Z"
git push
```

The site's deploy pipeline picks up the push and rebuilds the live site. Done.

## What "verify" means

After updating, before pushing:

- [ ] Build completes without errors
- [ ] No new TypeScript errors (`npm run typecheck`)
- [ ] Visual check on at least: the blog index, one post, one tag archive
- [ ] No regression in existing SEO meta (right-click → View Source, search for `og:`, `application/ld+json` — should still be there)
- [ ] If the update touches theming: the blog still looks like the host site

## Rolling updates across N sites

We don't have automation yet, so this is a script-driven manual rollout. Recommended order:

1. **Stage on one site** — pick the smallest / least-trafficked site. Update, verify, ship. Watch for 24h.
2. **Cascade to remaining sites** — once confident, update each in sequence over 1-2 days. Don't batch them all in one push; if something breaks, you want isolation.
3. **Rollback path** — if a site breaks, pin its `_blog/package.json` to the previous tag (see Rollback below).

A future Harbour Control automation could do this:

```pseudo
for each site in active_blog_sites:
  open PR in site's repo
  branch: update-blog-engine-vX.Y.Z
  command: cd _blog && npm update && npm run build
  commit + push branch
  open PR for human review
```

## Rollback

If a site breaks after an update:

```bash
cd <host-site-repo>/_blog
# Pin to the previous engine version
# Edit package.json and change the git ref:
#   "git+ssh://...#v0.1.4"  →  "git+ssh://...#v0.1.3"
# Or restore from git:
git checkout HEAD~1 -- package.json package-lock.json
npm install
npm run build
git add ../blog package.json package-lock.json
git commit -m "revert(blog): roll back to engine v0.1.3 due to <issue>"
git push
```

Report the rollback to the engine maintainer with:
- Site URL
- Previous version (working) and new version (broken)
- Build error or runtime error
- Whether the site has any local component overrides

## Skip-update scenarios

A site does NOT need to update for every engine version:

- **Patch releases that fix bugs that don't affect this site** — fine to skip
- **Minor releases that add features the site doesn't use** — fine to skip
- **Major releases until a maintenance window is available** — pin to the previous major

It's fine for sites to be on different engine versions. The architecture supports it. Just track which is on what (could be a Harbour Control field).

## Major version updates (breaking changes)

When the engine bumps a major version:

1. Read `UPGRADE-GUIDE.md` carefully. There's a section per major bump.
2. Test on a non-production branch first.
3. Apply any required content/config migrations BEFORE updating the dep:
   - Frontmatter renames in MDX files
   - Site config shape changes
   - Component prop changes if you've shadowed components locally
4. Update the dep, build, verify.
5. Commit migrations + dep update together.

**Don't** update a major version without reading the upgrade guide. The engine's changelog will explicitly call out breaking changes, but the upgrade guide has the actual migration steps.

## Update batching

Recommendation: don't update for every patch release. Batch monthly or whenever a feature you actually want lands.

Exceptions where you DO want to update fast:

- Security advisories (CVE in a transitive dep)
- Bugs affecting your specific site
- A feature you actually need

## When sites disagree on what to do

Sometimes one site needs a feature on engine v0.5.0 and another site is fine on v0.3.0. That's OK — the engine's per-site model is exactly designed for this. Each site owns its update cadence.

The only pressure to keep all sites on a similar version is convenience for the maintainer (less version-skew to think about). It's not a hard requirement.

## Tracking what's on what

A future ops dashboard could surface:

```
Site                  Engine version    Last updated
--------------------- ----------------- -------------
wollongong-weather    v0.1.0            2026-04-28
review-removals       (not integrated)  -
```

For now: read each site's `_blog/package.json` to find out. Could be exposed via a future `/blog/version.json` endpoint that the engine exports.
