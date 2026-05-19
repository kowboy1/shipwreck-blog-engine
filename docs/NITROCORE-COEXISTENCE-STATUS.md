# NitroCore coexistence — current status

**Last updated:** 2026-05-19
**Engine version at this snapshot:** 0.4.1
**NitroCore version at this snapshot:** 1.1.30

> This doc tells the engine-side agent what NitroCore (the host-site framework on the other side of this integration) currently knows about and ships, so the engine doesn't redo work or assume stale state. **It is not a roadmap; it is a snapshot.** Update it whenever NitroCore ships a release that affects the integration contract.

## The host-side framework is now called NitroCore (was "Keel")

NitroCore was renamed from "Keel" at NitroCore v1.1.21 (2026-05-16). Wherever this engine repo still says "Keel" in living docs (FEATURES.md, README.md), prefer "NitroCore" or "NitroCore (formerly Keel)" if historical context matters. Historical CHANGELOG entries should be left verbatim — they're a record of what was true at the time.

**Files known to still reference "Keel" as the current name:**
- `README.md:82` — "active focus: shared-schema package extraction with the Keel framework"
- `FEATURES.md:421` — comment in a config example
- `FEATURES.md:584` — "owned by the parent site framework (Keel)"
- `CHANGELOG.md` 0.4.1 entry — keep verbatim as historical record (the release was authored when "Keel" was current)

## Coexistence partition — NitroCore side is COMPLETE as of v1.1.30

The 8-patch coexistence plan authored 2026-05-13 (originally targeting "Keel 1.1.4") was executed across NitroCore v1.1.4 → v1.1.30. All 8 patches are live in NitroCore master:

| Patch | What | Where in NitroCore |
|---|---|---|
| A | `<Schema>` auto-skip on `/blog/*` | `nitrocore/src/components/seo/Schema.astro` — `isBlogRoute` check, `skip` prop |
| B | `<SEO>` auto-skip on `/blog/*` | `nitrocore/src/components/seo/SEO.astro` — same pattern |
| C | Scaffold patches engine's `_blog/site.config.ts` | `nitrocore/scripts/sites-new.mjs` — writes `emitOrganizationSchema: false` + `emitWebsiteSchema: false`, idempotent on existing flags |
| D | Audit asserts single-Organization on `/blog/*` | `nitrocore/scripts/audit.mjs` — spot-checks 3 built `/blog/**/index.html` files for exactly-1 `"@type":"Organization"` |
| E | GEO field surface on `<SEO>` + every `*Schema` component | `abstract`, `about[]`, `mentions[]`, `license`, `isAccessibleForFree` props plumbed through |
| F | Organization graph `sameAs` / `knowsAbout` / `WebSite.hasPart` | `site.config.ts` template has `business.knowsAbout`, `business.areaServed`, `socials`, `hasBlog` |
| G | STANDARDS.md §8.3 codifies the partition | `STANDARDS.md:349-382` |
| H | CONTENT-PLAYBOOK GEO content rules | `CONTENT-PLAYBOOK.md:11+` — 12-point section |

NitroCore's archived planning doc: `docs/archive/HANDOVER-SHIPWRECK-BLOG-ENGINE-2026-05-13.md` in the NitroCore repo.

## What the engine should know operationally

1. **Floor:** the partition assumes engine **0.4.1+**. Sites still on 0.3.x with NitroCore will produce duplicate `Organization` JSON-LD — STANDARDS.md §8.3 documents this and treats it as upgrade-blocked, not engine bug.
2. **Engine is unchanged.** No engine-side patches were required to make this partition work — the engine's existing `seo.emitOrganizationSchema` / `seo.emitWebsiteSchema` flags do all the work. NitroCore drives them.
3. **NitroCore-detection in the engine is explicitly forbidden.** The engine must continue to behave identically whether the host site is NitroCore, Wollongong Weather (bespoke), or anything else. NitroCore detects its own routes and steps aside on `/blog/*`. Engine never detects NitroCore.

## What's NOT done — the next coordinated piece of work

The **`@shipwreck/schema` shared-package extraction** is the only outstanding item from the original planning doc. Target releases: **Engine 0.5.0 + NitroCore 1.2.0** (separate, coordinated). Scope:

- New repo (or monorepo package): `@shipwreck/schema`
- Move pure schema builders (`articleSchema`, `breadcrumbSchema`, `organizationSchema`, `websiteSchema`, `collectionPageSchema`, `faqSchema`, `speakableSchema`, `howToSchema`, `buildPersonSchema`) out of the engine and into the shared package
- Move NitroCore's `localBusinessSchema` / `productSchema` / `serviceSchema` builders out of the Astro components into the shared package
- Engine 0.5.0 imports from `@shipwreck/schema`, re-exports for backward compat (zero migration for engine consumers)
- NitroCore 1.2.0 imports from `@shipwreck/schema` internally (zero per-site code change)

**Why:** today GEO fields live in two places. When Schema.org adds a new field tomorrow, the version that ships first will drift. A shared package fixes drift permanently. Estimate ~1 day.

This work is best done by a single agent who can checkout both repos and release coordinated tags. NitroCore is at v1.1.30 master; engine is at v0.4.1 master. Both pushed to `github.com/kowboy1/`.

## Update protocol for this doc

Bump the "Last updated" + "NitroCore version at this snapshot" fields whenever:
- NitroCore ships a release that changes the partition contract (anything in §8.3 of NitroCore STANDARDS.md)
- New shared-schema obligations are added
- The "what's NOT done" list changes

Engine releases that don't change cross-project obligations don't require a bump here.
