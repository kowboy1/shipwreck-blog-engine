> ⚠️ **STOP** — if you are an agent and havent read [AGENTS.md](AGENTS.md) yet, read that first.
> This file is referenced FROM the agent runbook in `AGENTS.md`, not a starting point.
> Continue here only if `AGENTS.md` routed you to this file.

# Changelog

All notable changes to the Shipwreck Blog Engine. Format: [Keep a Changelog](https://keepachangelog.com). Versioning: [SemVer](https://semver.org).

## [Unreleased]

## [0.3.6] - 2026-04-29

Closes the agent-procedural-drift gap that prose alone could not. Direct response to Nyxi's third integration attempt where she did the technical work but skipped Phase 7 (host wiring), Phase 9 (post-install questions), feedback writing, and the audit-trail status message — all of which the skill explicitly required. Her own diagnosis: "the missing enforcement is machine-level gating, not prose reminders." This release adds the machine-level gating.

### Doctor: state file + attest subcommands

New mechanism: `_blog/.shipwreck-integration-state.json` tracks user-confirmed attestations the agent makes via subcommands. Default doctor reads this and FAILS if required attestations aren't present.

```bash
# After asking the Phase 9 questions:
npx shipwreck-blog-doctor attest-phase9 '<json-of-answers>'

# After deciding nav link with the user (Phase 7b):
npx shipwreck-blog-doctor attest-nav-link approved   # or declined

# After deciding on feedback:
npx shipwreck-blog-doctor attest-feedback provided <FEEDBACK-FOR-CLAUDE-name.md>
# OR
npx shipwreck-blog-doctor attest-feedback none-needed "<honest reason — must be ≥10 chars>"
```

Each subcommand requires concrete proof: `attest-phase9` requires the answers JSON with all 5 expected keys; `attest-feedback provided` requires the file to exist; `attest-feedback none-needed` requires a non-trivial reason string. Agents cannot bypass these.

### Doctor: default mode is now the closeout gate

**Reversed**: previously `--final` was opt-in; now default mode IS `--final` equivalent. Reflexive `npm run doctor` runs the gate. Three new modes for intermediate use during development:

- `--preflight` — install-level only (engine resolves, file: deps OK)
- `--lite` — technical only (no procedural gates) — for development checks
- `--skip-build` — skip the build step (faster)

Default mode (no flags) = full closeout gate. Agents who want to "check status during development" use `--lite`.

### Doctor: `print-completion` subcommand

```bash
npx shipwreck-blog-doctor print-completion
```

Re-runs the full default doctor gate (must pass) AND emits a canonical audit-trail block on stdout. The skill now mandates: agent's reply to user must include this stdout VERBATIM as the completion section. Removes the "I'll compose my own status message" failure mode — there is no path to declaring done other than running this command and pasting its output.

### Doctor: Phase 7a host-side footer-link check

Default mode now walks up from `_blog/` to the site repo root and greps HTML/Astro/template files for a `<a href="/blog">` link. If absent, fatal — the blog is invisible from the host without the footer link.

### Skill rewrite

Final-checkpoint section completely replaced. New structure:

1. Step 1: attest Phase 9 (with subcommand)
2. Step 2: attest nav link decision (with subcommand)
3. Step 3: attest feedback status (with subcommand)
4. Step 4: run default doctor — verify it passes
5. Step 5: run `print-completion` — paste stdout VERBATIM into reply

The "Failure modes to watch for" list adds: "User said go ahead, so I'll do all phases at once and tell them" and "I'll write my own status message — print-completion is just for show."

### Integration test (acceptance CI)

Added 6 new assertions:
- Default doctor blocks completion without Phase 9 attestation
- Default doctor blocks completion without feedback attestation
- Default doctor blocks completion without nav-link attestation
- `--lite` mode correctly skips procedural gates
- `attest-*` subcommands write to state file
- State file contains all three attestations after running attest-* commands

42/42 checks passing on v0.3.6 tree.

### OpenClaw-side complement (for Nyxi specifically)

The engine-side gates above prevent declaring done without the work. To prevent Nyxi from forgetting the gates exist in the first place, the user is installing a hard-rule snippet in `~/.openclaw/workspace/AGENTS.md` plus a `~/.openclaw/skills/shipwreck-final-gate/SKILL.md` skill. These are runtime-sticky across `/new` resets and inject the completion contract into Nyxi's context before any project doc is read. Drafts provided in this session.

### Migration from 0.3.5

For agents continuing work on a 0.3.5 site:
- The old `--final --phase9-confirmed --feedback-status=...` invocation no longer works (those flags were removed). Use the new `attest-*` subcommands instead.
- Consumer sites need no template changes — only behavior changes are in the engine packages (`@shipwreck/blog-core` doctor binary).
- Run `npm update @shipwreck/blog-core` to pick up the new doctor.

## [0.3.5] - 2026-04-29

**Architectural simplification** — eliminates the per-site blog repo concept entirely. Blog source now lives inside the host site's repo at `_blog/`. Removes ~5 moving parts per integration. Per the project's patch-only versioning rule this stays 0.3.x; under strict SemVer it would be a minor or major bump (it's a breaking change to the integration model). Existing sites can migrate by moving `_blog/` into their host repo + redeploying via the host's existing pipeline.

### Removed (the old per-blog-repo machinery)

- `scripts/shipwreck-updater.php` — universal self-updater PHP script
- `scripts/install-updater.sh` — one-shot installer for the updater
- `.github/workflows/release-dispatch.yml` — engine-side fan-out workflow
- `templates/site-blog-build.yml` — per-blog-repo CI template
- `templates/` directory entirely

### Changed (architecture)

- **Blog source lives inside the host site's repo** at `_blog/` — there is NO separate per-site blog repo. If the host has no repo yet, the integration skill's new Phase 0 creates an entire-site repo with a recommended structure (the blog is just a subdir).
- **Updates propagate via the host site's existing deploy mechanism** — whatever the host already does for its own files (Cloudflare Pages auto-deploy, rsync to VPS, SFTP to cPanel, manual upload, etc.) carries the blog along. No central polling infrastructure needed.
- **Site repos double as backup snapshots** — `.gitignore` is intentionally minimal (only truly transient: `node_modules`, `.astro`, `_blog/dist`). Built `blog/` dist gets committed when host deploys via git push (Cloudflare Pages, Netlify, etc.); gitignored when deploy is rsync/SFTP. Either way the repo is a complete restorable site snapshot.

### Skill rewrite (`.claude/skills/integrate-shipwreck-blog.md`)

Massively simplified:
- Removed Mode A/B/C/D deploy modes — there's just one flow now
- New **Phase 0** — establish the site repo (skip if one exists, create a whole-site repo if not)
- Phase 1 explicitly says: blog goes in `<site-repo>/_blog/`. NEVER in a separate repo.
- Phase 6 (deploy) is now "use whatever the host site already uses to publish files"
- Phase 1.5 (demo content cleanup) folded into Phase 1
- Critical-model-concept callout updated: "one repo per site, blog included" replaces the old "two repos kept separate"
- Failure-modes list adds "Let me create a separate blog repo for this site → STOP. The blog goes inside the site repo."

### Site registry (`.shipwreck/sites.json`)

Schema simplified:
- Removed: `deploy.method`, `deploy.fallback`, `deploy.server`, `deploy.sshHost`, `deploy.sshUser`, `deploy.remotePath`, `source.repo`, `source.localPath`, `source.blogSourcePath`, `cloudflare.*`, `goldenScreenshots`
- Kept (minimal): `name`, `domain`, `blogPath`, `blogSourcePath`, `engineVersion`, `lastDeployed`, `owner`, `notes`
- Bootstrap entry removed — registry starts empty for v0.3.5; sites get added during integration Phase 8

### New: `.shipwreck-site.json` per site

Each integrated site gets a `.shipwreck-site.json` at the root of its own repo with minimal metadata:

```json
{
  "name": "<site-name>",
  "domain": "<domain>",
  "engineVersion": "0.3.5",
  "lastDeployed": "<ISO-8601>",
  "deployMechanism": "<git-push-cf-pages | rsync-to-vps | sftp-cpanel | etc.>",
  "notes": ""
}
```

This file lives in the site's own repo (not the engine's). Surfaces the integration state to anyone working in that repo.

### Migration from 0.3.4

For each existing site running v0.3.4 with the per-blog-repo pattern:

1. In the host site's repo, add `_blog/` (move from the old `<site>-blog` repo)
2. Build: `cd _blog && npm install && npm run build`
3. Copy `dist/` → `<host-docroot>/blog/` and commit it (or rsync, depending on host's deploy)
4. Deploy via host's existing mechanism
5. Update `<site-repo>/.shipwreck-site.json` with engine version
6. Delete the old `<site>-blog` GitHub repo (after confirming the new layout works)
7. Remove `shipwreck-updater.php` and the cron line from the host (no longer used)

For sites running `0.3.5` from a fresh integration, no migration step needed.

### Why this is the right call

The previous architecture solved "self-update on an unmanaged host" — a problem we don't actually have. Every site we deploy to already has an active maintenance/backup workflow. Reusing the host's existing deploy mechanism removes complexity without losing capability. The skill is simpler, the integration is faster, and there's one less GitHub repo per site to keep clean.

## [0.3.4] - 2026-04-29

Closes the gap between "skill says do X" and "agent actually does X." Triggered by Nyxi's third integration attempt — she did Phases 1–3 correctly but skipped Phase 1.5 (demo content cleanup), Phase 9 (post-install questions), and the feedback-protocol step despite the skill describing all three. Plus uncovered a critical cascade-order bug that silently overrode all her Phase 2 work.

### Critical fix: cascade-order bug

Demo-site `src/styles/global.css` had `@import "@shipwreck/blog-theme-default/tokens.css"` at the top. Result: in the bundled CSS, the engine's tokens.css ended up AFTER the consumer's `tokens.css` — engine's white/light defaults cascaded OVER the consumer's host-extracted values. Nyxi's Wollongong Weather integration had a perfectly correct dark-theme `tokens.css` but rendered light because of this bug.

Fixed by removing the engine `@import` from demo-site's `global.css`. The consumer's `tokens.css` is the canonical source; the Tailwind preset already supplies `var(--color-X, #fallback)` defaults for any token the consumer omits.

### Doctor: new gates

- **Cascade-order check** — flags `@import` of engine's tokens.css from consumer's `global.css`. Always-on (not skipped in `--preflight`) — this is a structural file bug regardless of integration phase.
- **Demo content detection** — fatal if `src/content/posts/` still contains `hello-world.mdx`, `seo-checklist.mdx`, or `why-not-wordpress.mdx`. Warns on demo `jane.json` author.
- **`--final` mode** — strictest gate. Requires:
  - All default checks pass
  - `--phase9-confirmed` flag (self-attestation that Phase 9 questions were actually asked)
  - `--feedback-status=provided` (with `FEEDBACK-FOR-CLAUDE-*.md` file present) OR `--feedback-status=none-needed` (explicit declaration)

### Skill: structural enforcement

- **New Phase 1.5 — Replace demo content (mandatory).** Two valid outcomes: empty `src/content/posts/` or replace with real site content. Doctor enforces.
- **Phase 9 strengthened** — heading changed from "ASK the user" to "MANDATORY — actually execute, not 'consider'". Body explicitly calls out the failure mode: "Do not rationalise it as 'optional' or 'for later' or 'the user can ask if they want.'" Done-check requires running `--final --phase9-confirmed --feedback-status=...` to declare done.
- **Final blocking checkpoint rewritten** — single command (`npx shipwreck-blog-doctor --final --phase9-confirmed --feedback-status=...`) is the ONLY gate for declaring done. Skill explicitly enumerates self-deception patterns ("doctor passed so I'm done", "it builds and serves so it's working", "I'll write feedback if I think of something") and blocks each.

### Integration test (acceptance CI): new assertions

- Asserts `global.css` does not contain `@import` of engine tokens.css (cascade-order regression check)
- Asserts compiled CSS has at most one `--color-bg` declaration (catches cascade leak)
- Asserts doctor's demo-content detection fires correctly
- Asserts doctor's cascade-order pass message fires
- Asserts `--final` blocks without `--phase9-confirmed`
- Asserts `--final` blocks without `--feedback-status`

38/38 checks pass on v0.3.4 tree.

### Migration from 0.3.3

Existing 0.3.3 sites:
1. Remove `@import "@shipwreck/blog-theme-default/tokens.css"` from `src/styles/global.css` if present
2. `npm update @shipwreck/blog-core @shipwreck/blog-theme-default`
3. `rm -rf node_modules/.cache _blog/dist _blog/.astro`
4. `npm run build`
5. Verify: dark/branded theme should now actually render (you'll see the immediate visual change if you'd been hit by the cascade bug)

## [0.3.3] - 2026-04-29

Patch release adding the integration acceptance CI test (Nyxi feedback #7) — closes the loop on "regressions hit Nyxi before they hit CI."

### Added

- **`scripts/test-integration.sh`** — full end-to-end integration acceptance test. Simulates a clean sibling-layout install in a tmp dir (engine + per-site repo as siblings), runs the canonical install sequence (copy demo-site, fix file: deps, npm install, build, doctor preflight, dist inspection), and asserts 32 outcomes including:
  - File: dep symlinks resolve correctly
  - npm install succeeds
  - Doctor `--preflight` reports clean (no install-level issues)
  - Build succeeds
  - All expected dist files exist (index, post pages, sitemap, RSS, robots, admin)
  - CSS contains every engine page-level utility class (catches the v0.3.0/v0.3.1-style preset-content bug)
  - CSS file size sanity (>15 KB — broken installs produce <10 KB)
  - Post pages have exactly one H1 (duplicate-H1 stripper works)
  - Post pages emit BlogPosting + BreadcrumbList JSON-LD schemas
  - Sitemap lists post URLs
  - Admin config has logo_url
  - Doctor's Phase 2/3 detection heuristics work correctly

- **`.github/workflows/integration-test.yml`** — runs `scripts/test-integration.sh` on every PR and push to main. Triggers on changes to `packages/**`, `examples/demo-site/**`, or the test script itself. **If this fails, don't merge.** The install experience is broken if it does.

- **`shipwreck-blog-doctor --preflight` mode** — install-level checks only (engine resolves, file: deps work). Skips Phase 2/3 checks (those are integration-time concerns, not install-time). Use this RIGHT AFTER `npm install` to catch install bugs before building. Default mode (no flag) still runs everything for end-of-job verification.

### Why

Nyxi's first two integration attempts both produced broken sites due to install-time issues that should have been caught in CI: broken file: dep symlinks (v0.3.0), Tailwind preset content path bug (v0.3.1), cross-package symlink resolution issues (v0.3.2). The acceptance test runs the same flow Nyxi would and catches all three classes of bug before they ship. Future regressions in this area get caught by CI, not by Nyxi.

### Migration

No consumer-side changes. The new `--preflight` flag is additive (existing `npm run doctor` calls still work as before).

## [0.3.2] - 2026-04-29

Patch release fixing the symlink/scan bug that v0.3.1 only partially fixed, plus the structural agent-doc problems Nyxi's second integration attempt revealed (skipped phases, no entrypoint discipline, no preflight verification).

### Engine bug fix (the actual root cause)

v0.3.1 added `pages/**` to the Tailwind preset's content path, but the path was `./node_modules/@shipwreck/blog-core/src/pages/**`. In real per-site installs with `file:` deps, npm creates a symlink at that location, and:

1. The symlink is fragile — wrong number of `../` in the `file:` spec breaks it silently. Nyxi's install had this exact bug (4 `../` instead of 3).
2. Even when the symlink resolves, Tailwind's content scanner sometimes can't enumerate files through cross-package symlinks reliably.
3. Astro's vite plugin chokes on cross-package `.astro` imports through symlinks unless `preserveSymlinks: true` is set.

Fix bundle (all required, all together):

- **Demo-site `tailwind.config.ts`** now uses `require.resolve("@shipwreck/blog-core/package.json")` to find the engine's actual on-disk location. Works in every layout (monorepo workspace-hoist, per-site sibling with `file:`, future npm-published) because it uses Node's standard resolution rather than a fragile relative path.
- **Demo-site `astro.config.ts`** sets `vite.resolve.preserveSymlinks: true` so Astro's vite plugin doesn't double-load .astro files via two different paths.
- **`@shipwreck/blog-core` `exports`** now includes `"./package.json"` so `require.resolve` can find it without `ERR_PACKAGE_PATH_NOT_EXPORTED`.

CSS output went from 7.7 KB (broken — missing every page-level class) to 30.9 KB (correct — all engine classes compiled).

### `npm run doctor` preflight

New: `@shipwreck/blog-core` ships a `bin/doctor.mjs` registered as `shipwreck-blog-doctor`. Demo-site has `npm run doctor` wired up. Doctor checks:

- Engine packages resolve (with parent-dir walk to handle workspace hoisting)
- `site.config.ts` exists; warns on demo-default placeholder values
- `src/styles/tokens.css` exists (Phase 2 done)
- `src/components/SiteShell/Header.astro` and `Footer.astro` are NOT still the engine placeholder (Phase 3 done)
- `npm run build` succeeds
- Built CSS contains all engine page-level utility classes (catches the v0.3.1-style bug)

Doctor is now the gate for declaring an integration done. Skill enforces this.

### Agent-doc structural overhaul

The previous integration runs missed phases despite the skill describing them, because the skill was descriptive (not gate-keeping) and the README was the canonical entrypoint (not respected by every agent). Fixes:

- **`AGENTS.md` is now the canonical agent entrypoint.** Industry-standard convention (agents.md spec — adopted by OpenAI Codex, Aider, Cursor). Contains imperative STOP language, machine-readable instruction comment at top, the routing table, the universal rules, and the end-of-job protocol.
- **`README.md` is now a human-first overview** that points agents to AGENTS.md.
- **`CLAUDE.md` is a thin pointer** to AGENTS.md (Claude Code auto-reads CLAUDE.md).
- **Every other root `.md` (`ARCHITECTURE`, `ROLLOUT`, `INTEGRATION`, `CONTRIBUTING`, `CHANGELOG`, `UPGRADE-GUIDE`, `PROJECT-BRIEF`)** now has a STOP header at the top: "if you're an agent and haven't read AGENTS.md, go there first." Even an agent that grep-picks lands here gets bounced back to the entrypoint.
- **Integration skill has hard phase gates.** Each of the 9 phases now starts with a **Precondition** (must be true to begin) and ends with a **Done-check** (must be true to proceed). An agent following the skill literally cannot skip a phase without lying about a precondition or done-check.
- **Done definition at the top** of the skill, not buried at the end. Lists the 9 conditions that must all be true to declare done — including running doctor, running visual-diff, asking Phase 9 questions, writing feedback, etc.
- **Final blocking checkpoint at end** of skill enumerates the audit-trail status message the agent must emit when reporting done. If they skip this, the user catches it.

### Migration from 0.3.1

Existing 0.3.1 sites need to:
1. `npm update @shipwreck/blog-core @shipwreck/blog-theme-default`
2. Replace `tailwind.config.ts` with the v0.3.2 demo-site version (uses `require.resolve`)
3. Add `vite: { resolve: { preserveSymlinks: true } }` to `astro.config.ts`
4. `rm -rf node_modules/.cache _blog/dist _blog/.astro`
5. `npm install && npm run build`
6. `npm run doctor` to verify

Or: re-copy the demo-site config files (these three are template, not site-specific):
- `tailwind.config.ts`
- `astro.config.ts`

## [0.3.1] - 2026-04-29

Patch release fixing every gap Nyxi found during the first end-to-end clean integration of v0.3.0 into wollongong-weather. The visual regression alone (page renderers stripped of utility classes) made v0.3.0 unusable for new sites — this release is the actual usable v0.3.0.

### Fixed

- **Critical visual regression: Tailwind preset wasn't scanning the engine's `pages/**` directory.** The v0.3.0 page-renderer move added `PostPage.astro` and `ListingPage.astro` to `@shipwreck/blog-core/src/pages/`, but the shared Tailwind preset only had a content path for `src/components/**`. Result: every utility class used at the page level (`max-w-7xl`, `max-w-3xl`, `text-4xl`, `font-heading`, `not-prose`, `mt-5`, `prose-lg`, etc.) got tree-shaken out, leaving freshly-integrated sites with completely unstyled blog pages. Fixed by adding `pages/**` to the preset's content array.

- **`preparePostPageData()` had over-strict types for `getEntry`/`render`** — consumer site `[...slug].astro` files needed `as any` casts to compile. Loosened to accept Astro's actual `astro:content` runtime types directly.

- **`@shipwreck/blog-theme-default/tailwind-preset` had no `.d.ts`** — consumer sites needed a hand-rolled `env.d.ts` module declaration. Added `tailwind-preset.d.ts` and proper `types` exports in package.json.

- **JSON-LD `<script>` tag in BaseLayout missing `is:inline`** — generated Astro check hints. Added.

- **Demo-site `package.json` used `*` version specifiers** that resolve to npm 404s because the engine isn't published. Switched to `file:../../packages/...` (works in monorepo) with skill instructions to adjust the path for per-site repos until npm publish.

### Added

- **Local-dev integration mode** documented in the integration skill. Three deploy modes now: A (full production), B (local-dev only), C (hand-off to external host). Skill picks the path early so phases align with the user's actual situation.

- Skill Phase 1 now explicitly walks through fixing engine dep paths when copying demo-site into a sibling per-site repo (was implicit before; Nyxi had to figure it out).

### Migration from 0.3.0

Existing 0.3.0 sites need to:
1. `npm update @shipwreck/blog-core @shipwreck/blog-theme-default` (or pull latest local file dep)
2. `rm -rf _blog/dist _blog/.astro` (force a clean Tailwind rebuild)
3. `npm run build`

That's it. No template changes required.

## [0.3.0] - 2026-04-29

### Page renderers moved into the package

The biggest single fix to the rollout problem: per-site `[...slug].astro`, `index.astro`, `tags/[tag].astro`, `categories/[category].astro`, `authors/[author].astro`, and `page/[page].astro` no longer contain the rendering logic. They're now ~10-line wrappers that load data from a content collection and pass it into engine-provided page components:

- `@shipwreck/blog-core/pages/PostPage.astro` — renders the article (header + ToC + body + tags + AuthorBio + sidebar CTA + RelatedPosts)
- `@shipwreck/blog-core/pages/ListingPage.astro` — renders index, tag, category, author, paginated listings
- `preparePostPageData()`, `prepareIndexPage()`, `prepareTagPage()`, `prepareCategoryPage()`, `prepareAuthorPage()` — async helpers that compose meta tags, JSON-LD, related-post ranking, breadcrumbs, etc.

Why this matters: most v0.2.0 fixes touched per-site `[...slug].astro` files, which meant every existing site needed manual patching. After 0.3.0, future fixes to the page rendering ship through `npm update` alone. ~95% of engine code now lives in the package.

### Astro integration

New `@shipwreck/blog-core/integration` default export. Replaces hand-wired `markdown.remarkPlugins` arrays in consumer `astro.config.ts`:

```ts
import shipwreckBlog from "@shipwreck/blog-core/integration"
integrations: [
  shipwreckBlog({ extraRemarkPlugins: [remarkReadingTime] }),
  // ...
]
```

The integration auto-registers `remarkStripDuplicateH1`. Future engine remark plugins will be added there once and propagate to every site automatically.

### Theme tokens — full contract

`packages/blog-theme-default/TOKEN-CONTRACT.md` documents every theming token. `tokens.css` expanded from 7 tokens to 38, covering colors (incl. `--color-bg-elevated`, `--color-link-hover`, `--color-focus-ring`), typography (`--font-mono`, `--line-height-base`, `--tracking-heading`), surface (`--radius-button`, `--radius-chip`, `--shadow-card`), buttons (`--button-bg`, `--button-text`, `--button-hover-bg`, `--button-padding-*`, `--button-font-weight`), and header (`--header-bg`, `--header-height`, `--header-border`). Tailwind preset exposes them as utility classes (`bg-bg-elevated`, `ring-focus`, `shadow-card`, `rounded-button`, `font-mono`, etc.).

### Universal self-update system (Path A)

For any host (cheap shared cPanel, Plesk, DirectAdmin — anywhere with PHP + cron):

- `scripts/shipwreck-updater.php` — single-file self-updater the host runs daily via cron. Polls a per-site GitHub repo's releases, atomically swaps installed `dist/` when a newer build is available, keeps last 3 versions for rollback, optionally purges Cloudflare cache.
- `scripts/install-updater.sh` — one-shot installer. Drops the PHP, generates a 32-char token, picks a random cron minute (0–59) and random hour from {23, 0, 1, 2} so 100+ sites don't all hit GitHub at the same minute, prints next steps.
- `.github/workflows/release-dispatch.yml` — engine-side: on tag push, fires `repository_dispatch` to every registered consumer-site repo (read from `.shipwreck/sites.json`).
- `templates/site-blog-build.yml` — copy into a consumer-site repo at `.github/workflows/blog-build.yml`. Triggers on push, repository_dispatch (engine update), or manual. Builds the static blog with latest engine, publishes `blog-dist.tar.gz` as a GitHub Release asset (with SHA256 in the release notes).

### Push-style deploy (Path B)

For our own servers where we have SSH:

- `scripts/deploy-blog.mjs` — `node scripts/deploy-blog.mjs --site <name>` builds locally, optionally runs visual-diff against the live host, pushes `dist/` via rsync (or lftp for SFTP), purges Cloudflare cache, updates the registry.

### Site registry schema

`.shipwreck/sites.json` schema extended:
- `deploy.method` — `"pull"` (default) | `"rsync"` | `"sftp"` | `"manual"`
- `deploy.fallback` — secondary method (e.g. `"pull"` default + `"rsync"` for urgent fixes on Prem3/4)
- `deploy.server`, `deploy.sshHost`, `deploy.sshUser`, `deploy.remotePath` — for push methods
- `source.repo` — per-site GitHub repo (required for `pull`)
- `source.localPath`, `source.blogSourcePath` — for push methods
- `cloudflare.zoneId`, `cloudflare.purgeOnDeploy` — for cache purge
- `engineVersion`, `lastDeployed` — auto-updated by deploy-blog.mjs (or by the per-site build workflow's release tag)
- `goldenScreenshots` — path to pinned visual-diff baselines

### Documentation

- `ROLLOUT.md` rewritten — explains both pull and push paths, hosting reality (Prem3/Prem4 + cheap cPanel), Apache/Cloudflare hygiene, sequencing, and how the pattern repeats for future engines
- `.claude/skills/integrate-shipwreck-blog.md` rewritten as 8-phase agent runbook: per-site repo creation → token extraction → SiteShell port → CTAs → build & visual-verify → deploy via universal updater → Apache/CF hygiene → register & monitor

### Migration (consumers upgrading from 0.2.x)

The shape of per-site files changed. Existing sites need their `_blog/src/pages/*.astro` and `astro.config.ts` updated. Easiest path: re-copy the demo-site page wrappers and astro config, then bump the engine packages. The per-site files in `examples/demo-site/` are now ~10 lines each — diff against your existing files to migrate.

```ts
// astro.config.ts becomes:
import shipwreckBlog from "@shipwreck/blog-core/integration"
// ...
integrations: [
  shipwreckBlog({ extraRemarkPlugins: [remarkReadingTime] }),
  // ...your other integrations
]
```

## [0.2.0] - 2026-04-29

### Fixed (out-of-the-box presentation)

Three root-cause bugs were making fresh integrations look broken. All fixed in the engine so consumer sites get a usable result without per-site patches:

- **Tailwind preset now self-registers engine component sources.** Previously each consumer site had to add `"../../packages/blog-core/src/components/*.astro"` to their `tailwind.config.ts` content array — a monorepo-relative path that silently failed on installed packages. As a result, every utility class used inside engine components (including `lg:hidden`, `hidden lg:block`, sticky / max-h, ring, rounded-full, etc.) was tree-shaken out, breaking the ToC at desktop width and many other components. The shared preset (`@shipwreck/blog-theme-default/tailwind-preset`) now includes `./node_modules/@shipwreck/blog-core/src/components/**/*.{astro,...}` in its `content` array, so consumer sites only need their own `./src/**/*` path.
- **OG image is no longer used as an in-page hero fallback.** `[...slug].astro` and `PostCard` previously fell back to `siteConfig.seo.defaultFeaturedImage` for the article hero and card thumbnails — which on most sites is the OG/brand banner. The result was a giant brand banner above every article and inside every "More articles" card. Hero now only renders when the post explicitly sets `featuredImage`. PostCard / RelatedPosts no longer accept a `defaultImage` prop.
- **Duplicate H1 stripped automatically.** Authors who started MDX bodies with `# Same Title As Frontmatter` produced two H1s on the rendered page (layout renders one from frontmatter; content adds another). New `remarkStripDuplicateH1` plugin in `@shipwreck/blog-core/remark/strip-duplicate-h1.mjs` removes the leading H1 from MDX when its text matches the frontmatter `title`. Wired into the demo-site `astro.config.ts`.

### Added
- `@shipwreck/blog-core/remark/strip-duplicate-h1` — remark plugin (see Fixed above)
- `./remark/*` export entry in `@shipwreck/blog-core` package.json

### Changed
- `PostCard` no longer accepts `defaultImage` prop — text-only card when post has no `featuredImage`
- `RelatedPosts` no longer accepts `defaultImage` prop
- `TagList` chips redesigned: pill shape, uppercase tracking, no `#` prefix, accent hover
- `AuthorBio` tightened: smaller avatar (64 → 72 retained at 64), tighter padding, `mt-10` (was `mt-12`)
- All demo-site listing pages (`index.astro`, `tags/[tag].astro`, `categories/[category].astro`, `authors/[author].astro`, `page/[page].astro`) no longer pass `defaultImage` to `PostCard`
- Demo-site `tailwind.config.ts` simplified — engine component path now in shared preset

### Migration (consumers upgrading from 0.1.x)

1. Bump `@shipwreck/blog-core` and `@shipwreck/blog-theme-default` to `0.2.0`
2. Remove the engine-components content path from your `tailwind.config.ts`:
   ```diff
     content: [
       "./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}",
   -   "./node_modules/@shipwreck/blog-core/src/components/*.astro",
     ],
   ```
   The shared preset adds it now.
3. Remove `defaultImage={siteConfig.seo.defaultFeaturedImage}` props from any `<PostCard>` / `<RelatedPosts>` usages
4. Remove the `?? siteConfig.seo.defaultFeaturedImage` fallback on `heroImage` in your `[...slug].astro`
5. Add the H1-stripper to your `astro.config.ts`:
   ```ts
   import { remarkStripDuplicateH1 } from "@shipwreck/blog-core/remark/strip-duplicate-h1.mjs"
   // ...
   markdown: { remarkPlugins: [remarkReadingTime, remarkStripDuplicateH1] }
   ```
6. Rebuild

## [0.1.2] - 2026-04-28

### Fixed
- Article layout was unusable: `BaseLayout` constrained everything to `max-w-3xl` (768px), so the 3-column ArticleLayout grid never had room and stacked into one tiny column with broken text wrapping. `BaseLayout` no longer applies a width constraint; pages set their own `max-w-3xl` (index/archives) or `max-w-7xl` (post page) wrapper.

### Added
- `<AuthorAvatar>` component — avatar with initials fallback when author has no `avatar` set. Used in byline + AuthorBio.
- `siteConfig.seo.defaultAuthorAvatar` — site-wide fallback avatar image
- AuthorBio `href` prop — avatar + name link to the author's archive page
- AuthorBio `fallbackImage` prop — passed through to AuthorAvatar
- RelatedPosts `layout` prop — `"grid"` (3-up horizontal at md+, default) or `"stack"` (vertical)
- Post page now shows author avatar + name in the byline, linked to `/blog/authors/<id>/`. Multi-author posts show stacked avatars.

### Changed
- Article page restructured to match SydneyPI reference layout:
  - Wide container (`max-w-7xl`)
  - **Left:** sticky ToC
  - **Middle:** title, byline (with avatar), excerpt, hero image, body, tags, multi-author bios
  - **Right:** sticky CTA only (FeaturedPosts removed from sidebar)
  - **Below:** "More articles" horizontal 3-column grid (uses `RelatedPosts layout="grid"`)
- Index/archive pages now wrap content in `max-w-3xl` (was implicit via BaseLayout)
- All listing pages now pass `defaultImage={siteConfig.seo.defaultFeaturedImage}` to PostCard

### Notes
- FeaturedPosts component still exists and can be used in custom layouts (it's just not used in the default post page anymore)

## [0.1.1] - 2026-04-28

### Added
- `<ArticleLayout>` component — three-column grid (ToC sidebar / main / featured sidebar) with mobile collapse
- `<FeaturedPosts>` component — sticky sidebar list of featured (or recent) posts with thumbnails, falls back to `siteConfig.seo.defaultFeaturedImage` when a post has no featured image
- `authors: string[]` field on `postSchema` for multi-author posts. Legacy `author: string` still supported via `getPostAuthorIds()` helper
- `getPostAuthorIds()` exported from `@shipwreck/blog-core/utils` — normalizes single/multi author into a flat list
- `seo.defaultFeaturedImage` on `siteConfigSchema` — used as fallback for PostCard, FeaturedPosts, and the post hero image
- `defaultImage` prop on `<PostCard>` and `<FeaturedPosts>` for fallback images
- `articleSchema()` now accepts an `authors[]` array (also keeps legacy `authorName`/`authorUrl` for backward compat) and emits an array of Person entities for multi-author posts
- Hero featured image rendered above the article body when `featuredImage` (or site default) is set
- Sveltia CMS config updated: `author` field is now an `authors` relation widget with `multiple: true`

### Changed
- `<TableOfContents>` default `maxDepth` is now 4 (was 3); added `sticky` prop for desktop sticky positioning
- Post page (`[...slug].astro`) restructured to use `<ArticleLayout>` with sidebar ToC + featured posts
- Author archive page (`/authors/<id>/`) now lists posts where author appears in either the legacy `author` field or the new `authors[]` array
- Multi-author posts render byline as "Author A & Author B" with each name linking to their URL

### Fixed
- (none)

## [0.1.0] - 2026-04-28

### Added
- Phase 1 engine MVP
- `@shipwreck/blog-core`: Zod schemas (post, site config, author, redirects), SEO helpers (Article/Organization/BreadcrumbList/FAQPage schema.org, OG + Twitter + meta builder), utilities (reading time, slug, related-post ranker), reusable Astro components (Breadcrumbs, TableOfContents, RelatedPosts, AuthorBio, PostCard, Pagination, TagList, CTABlock)
- `@shipwreck/blog-theme-default`: Tailwind preset + CSS-var-driven design tokens
- `examples/demo-site`: full reference integration — paginated index, dynamic post page with ToC/related/author/CTA, tag/category/author archives, 404, robots.txt, redirects generator, RSS, sitemap
- `create-shipwreck-blog`: scaffolder CLI for adding the blog to an existing site
- Docs: `ARCHITECTURE.md`, `INTEGRATION.md`, `CONTRIBUTING.md`, `UPGRADE-GUIDE.md`, `HANDOVER-NYXI.md`

### Added — Phase 1.5 (CMS layer)
- Sveltia CMS pre-wired at `/blog/admin/` (Git-backed, browser-based, free)
- `public/admin/index.html` + `public/admin/config.yml` with form fields mirroring the Zod schema 1:1
- Authors converted from single-file JSON to folder collection (one JSON file per author) so they can be created/edited via the CMS
- `/blog/posts.json` manifest endpoint — JSON list of every published post (id, title, url, tags, category, dates) for AI agents and external tools
- `suggestInternalLinks()` exported from `@shipwreck/blog-core/utils` — heuristic ranker for "what should this post link to"
- INTEGRATION.md updated with "Enable the CMS" section

### Notes
- Distribution: git+ssh URLs, no npm registry yet
- Renderer: Astro 5
- Content format: MDX in git (Sveltia commits MDX back to git)
- Admin: Sveltia CMS dropped in (was Phase 4 — pulled forward as the lightweight option)

