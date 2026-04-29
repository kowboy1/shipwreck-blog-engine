# Engine Rollout — How Updates Reach Every Site

**Question:** when we fix a bug or ship a feature in `@shipwreck/blog-core`, how does it reach every site we've ever deployed the engine to?

**Status:** today, partially. This doc explains what works automatically, what doesn't, and the plan to close the gap.

---

## What ships through the integration

When you integrate the engine into a site, two kinds of code end up there:

| Layer | Lives in | Updates via |
| --- | --- | --- |
| **Package code** — schemas, SEO helpers, components (`PostCard`, `ArticleLayout`, `TableOfContents`, etc.), remark plugins, Tailwind preset | `node_modules/@shipwreck/blog-core/`, `node_modules/@shipwreck/blog-theme-default/` | `npm update` |
| **Template code** — `_blog/src/pages/*.astro`, `astro.config.ts`, `tailwind.config.ts`, `BaseLayout.astro` | The consumer site's repo (copied from `examples/demo-site/` at integration time) | Manual edit per site, OR codemod-PR |
| **Site code** — `site.config.ts`, `tokens.css`, `SiteShell/Header.astro`, `SiteShell/Footer.astro`, custom CTAs | The consumer site's repo, intentionally bespoke | Never. By design — these are per-site values. |

**The asymmetry is the problem.** Engine fixes that live in package code propagate via `npm update`. Engine fixes that touch template code (most of v0.2.0's bug fixes did — they edited `[...slug].astro` and `astro.config.ts`) are **invisible to existing sites until someone manually patches them**.

---

## What we have today

| Capability | Status |
| --- | --- |
| Per-site static build (no central runtime) | ✅ Established |
| Engine consumed as npm package (`@shipwreck/blog-core`, `@shipwreck/blog-theme-default`) | ✅ Established |
| Tailwind preset auto-registers engine component scan path | ✅ Since v0.2.0 |
| Versioning + CHANGELOG with migration steps | ✅ Established |
| `npm update` propagates package-layer fixes | ✅ Works for things in `node_modules` |
| Template-layer fixes propagate to existing sites | ❌ Manual per site |
| Visibility into "which sites are on which engine version" | ❌ No registry |
| Visual regression catch on engine update | ❌ No automation |

---

## Why not a central blog server (multi-tenant SaaS)?

It's the obvious "one deploy = all sites updated" answer, and it's wrong for our case:

- Loses the static-output benefit (slower TTFB; harder for AI crawlers and traditional SEO)
- Single point of failure — one outage kills every blog
- Iframe / fetch / CORS complexity per host
- Throws away the existing per-site model — every integration would have to be re-done

The static, per-site model is one of the engine's actual selling points. Don't trade it.

---

## The plan: Hybrid (Package-first + Fan-out automation)

Two-layer strategy. **Most fixes ship through `npm update` alone**. The minority that touch templates ship through automated PRs.

### Layer 1 — Maximize the package boundary

**Goal:** shrink the per-site template to ONLY things that genuinely vary per site. Everything else moves into `@shipwreck/blog-core`.

Concrete next moves (each is a future engine PR):

1. **Page renderers move into the package.** Today every site has its own copy of `_blog/src/pages/[...slug].astro`, `index.astro`, `tags/[tag].astro`, etc. — ~200 lines per site that won't auto-update. Refactor each into a default-exported page renderer component in `@shipwreck/blog-core/pages/`. Per-site files shrink to:
   ```ts
   ---
   import PostPage from "@shipwreck/blog-core/pages/PostPage.astro"
   import siteConfig from "../../site.config"
   ---
   <PostPage siteConfig={siteConfig} />
   ```
   Now `[...slug].astro` updates through `npm update`.

2. **Astro integration wraps the remark plugins + sitemap config.** Today consumer `astro.config.ts` files manually wire up `remarkReadingTime`, `remarkStripDuplicateH1`, sitemap. Replace with a single integration:
   ```ts
   import shipwreckBlog from "@shipwreck/blog-core/integration"
   integrations: [shipwreckBlog(siteConfig), tailwind({ applyBaseStyles: false })]
   ```
   Now adding a new remark plugin to the engine = automatic for every site.

3. **`tailwind.config.ts` becomes a one-liner.** Already mostly there with the preset. Push remaining shared content paths and plugins into the preset.

After layers 1–3, the per-site template is just `site.config.ts` + `tokens.css` + `SiteShell/*` + `cta/*` + a handful of 3-line page wrappers. ~95% of engine code lives in the package and updates atomically.

### Layer 2 — Fan-out automation (Harbour Control v1)

For the residual template-layer changes that DO need to update existing sites:

1. **Site registry.** A file in the engine repo (`.shipwreck/sites.json`) lists every site running the engine:
   ```json
   [
     {
       "name": "wollongong-weather",
       "repo": "1tronic/wollongong-weather",
       "branch": "main",
       "blogPath": "_blog",
       "deployedAt": "https://wollongongweather.com/blog/",
       "engineVersion": "0.2.0"
     }
   ]
   ```
   Maintained as part of the integration phase (Phase 6 in [the integration skill](.claude/skills/integrate-shipwreck-blog.md)).

2. **Release fan-out workflow.** A GitHub Action triggers when the engine publishes a tag. For each registered site:
   - Clone the site repo, branch off main
   - Run `npm update @shipwreck/blog-core @shipwreck/blog-theme-default`
   - If the release ships a codemod (in `.shipwreck/codemods/<version>/`), apply it
   - Build the site
   - Run `scripts/visual-diff.mjs` against pinned golden screenshots for that site
   - If green, open a PR titled `chore(blog): bump engine to vX.Y.Z`
   - If red, open a PR with `[manual review]` flag and the diff details

3. **Per-site CI completes the loop.** Each consumer repo's CI:
   - Runs on PRs touching `_blog/`
   - Builds the blog
   - Runs the same `visual-diff.mjs`
   - Posts pass/fail back to the PR
   - Auto-merges when green and the PR was opened by the engine bot
   - Holds for human review otherwise

4. **Codemods for breaking template changes.** When an engine release requires editing per-site template code (e.g. v0.2.0's "remove `defaultImage` prop"), ship a codemod alongside it: `.shipwreck/codemods/0.2.0.mjs`. The fan-out workflow runs it as part of the bump PR. Codemods are simple AST-or-regex transforms — `jscodeshift` for `.astro` is awkward; in practice regex + small parsers covers most cases.

### What this gets us

- **For 95% of fixes (package code):** push engine release → every registered site gets an auto-PR within minutes → CI proves visual stability → auto-merge → site redeploys via its existing pipeline. End-to-end propagation in <1 hour with zero per-site manual work.
- **For 5% of fixes (template changes):** same flow, with the codemod doing the heavy lifting. Manual review only when visual-diff catches a regression.
- **For never-propagating concerns (per-site brand/content):** stay per-site. The boundary is intentional.

---

## Sequencing — what to build first

Don't try to do all of this in one go. Order:

### Now (blocks zero future work)
- ✅ Token contract + integration skill + extract-theme + visual-diff (this PR)
- ⏭ **Site registry** — dump current sites into `.shipwreck/sites.json` even if there's no automation reading it yet. Cheap to maintain, valuable as documentation.

### Next (1–2 weeks of work, unlocks 95% of the win)
- ⏭ Move page renderers (`[...slug].astro`, `index.astro`, listing pages) into `@shipwreck/blog-core/pages/`. Per-site templates shrink to 3-line wrappers. **This is the biggest single lever** — without it, every fix that touches `[...slug].astro` (which is most fixes) is a manual round of patches.
- ⏭ Astro integration wraps remark plugins + sitemap + Tailwind config defaults

### After that (only when site count > 3)
- ⏭ Fan-out GitHub Action against the registry
- ⏭ Per-site CI that builds + visual-diffs
- ⏭ Codemods directory + harness

The registry + page-renderer move are worth doing immediately because they pay back on every future fix. The full automation is only worth the build cost when you have ≥3 active sites — which is one Review Removals integration away.

---

## What this doesn't solve (be honest about it)

- **Branded one-offs.** A site that wants a custom hero layout still needs custom code. The boundary between engine and site is real.
- **Authentication-gated CMS state.** If two sites diverge on Sveltia config in incompatible ways, the engine can't reconcile them.
- **Site repos we don't control.** A registered site whose owner doesn't grant CI access to the engine bot has to upgrade manually. Document this in the registry entry.

---

## Registry: bootstrap entry

Today's known consumer:

```json
[
  {
    "name": "wollongong-weather",
    "repo": "1tronic/wollongong-weather",
    "branch": "main",
    "blogPath": "_blog",
    "engineVersion": "0.2.0",
    "deployedAt": "https://wollongongweather.com/blog/",
    "owner": "rick",
    "notes": "First proof-of-concept integration. Local file: dep during dev; will switch to git+ssh once first site is canonical."
  }
]
```

Track future integrations here as part of the integration skill's Phase 6.
