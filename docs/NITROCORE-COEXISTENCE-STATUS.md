# NitroCore coexistence — current status

**Last updated:** 2026-05-19
**NitroBlog AI version at this snapshot:** 0.5.0
**NitroCore AI version at this snapshot:** 1.1.30

> This doc tells the engine-side agent what NitroCore AI (the host-site framework on the other side of this integration) currently knows about and ships, so NitroBlog AI doesn't redo work or assume stale state. **It is not a roadmap; it is a snapshot.** Update it whenever NitroCore ships a release that affects the integration contract, or whenever NitroBlog AI ships a release that affects the partition.

## The two engines

- **NitroBlog AI** (this repo, version 0.5.0) — drop-in static blog engine. Mounts at `/blog/*` on any host. Standalone-capable; doesn't know whether it's running under NitroCore or a bespoke host.
- **NitroCore AI** (`~/projects/NitroCoreAI`, version 1.1.30) — full-site framework. Owns everything outside `/blog/*` when both are deployed together. Detects its own routes and auto-skips schema/meta emission on `/blog/*`.

**Naming history:**
- NitroCore was renamed from "Keel" at NitroCore v1.1.21 (2026-05-16).
- NitroBlog AI was renamed from "Shipwreck Blog Engine" at NitroBlog 0.5.0 (2026-05-19), full break — no backward-compat shims. The pre-0.5 archive is in NitroCore's `docs/archive/HANDOVER-SHIPWRECK-BLOG-ENGINE-2026-05-13.md` (filename retained for historical accuracy).

## Coexistence partition — NitroCore side is COMPLETE as of v1.1.30

The 8-patch coexistence plan authored 2026-05-13 (originally targeting "Keel 1.1.4" while NitroBlog was still "Shipwreck Blog Engine 0.4.1") was executed across NitroCore v1.1.4 → v1.1.30. All 8 patches are live in NitroCore master:

| Patch | What | Where in NitroCore |
|---|---|---|
| A | `<Schema>` auto-skip on `/blog/*` | `nitrocore/src/components/seo/Schema.astro` — `isBlogRoute` check, `skip` prop |
| B | `<SEO>` auto-skip on `/blog/*` | `nitrocore/src/components/seo/SEO.astro` — same pattern |
| C | Scaffold patches NitroBlog's `_blog/site.config.ts` | `nitrocore/scripts/sites-new.mjs` — writes `emitOrganizationSchema: false` + `emitWebsiteSchema: false`, idempotent on existing flags |
| D | Audit asserts single-Organization on `/blog/*` | `nitrocore/scripts/audit.mjs` — spot-checks 3 built `/blog/**/index.html` files for exactly-1 `"@type":"Organization"` |
| E | GEO field surface on `<SEO>` + every `*Schema` component | `abstract`, `about[]`, `mentions[]`, `license`, `isAccessibleForFree` props plumbed through |
| F | Organization graph `sameAs` / `knowsAbout` / `WebSite.hasPart` | `site.config.ts` template has `business.knowsAbout`, `business.areaServed`, `socials`, `hasBlog` |
| G | STANDARDS.md §8.3 codifies the partition | `STANDARDS.md:349-382` |
| H | CONTENT-PLAYBOOK GEO content rules | `CONTENT-PLAYBOOK.md:11+` — 12-point section |

## What NitroBlog AI 0.5.0 added

1. **Full rebrand from Shipwreck Blog Engine.** Breaking change to npm package names, binary, integration function, config dir, state files, and DOM IDs. No backward-compat shims. See [CHANGELOG.md](../CHANGELOG.md) §0.5.0 for the full identifier-mapping table.
2. **GEO field contract** ([FEATURES.md §6.1](../FEATURES.md)) — canonical reference for `abstract`, `about[]`, `mentions[]`, `license`, `isAccessibleForFree` shapes. Both engines must produce identical JSON-LD for these primitives. If Schema.org adds a new GEO-relevant field, update the contract first, then both engines.

No partition-contract changes. NitroCore v1.1.30 + NitroBlog 0.5.0 is the current stable pair.

## What the engine should know operationally

1. **Floor:** the partition assumes NitroBlog **0.5.0+**. There are no production sites running the old "Shipwreck Blog Engine 0.4.x" name — the rebrand happened before any production deployment of the pre-rename engine could persist. Wollongong Weather's existing blog will be deleted and reinstalled fresh under the new identifiers.
2. **NitroBlog AI is unchanged behaviourally.** No engine-side patches were required to make the coexistence partition work — the engine's existing `seo.emitOrganizationSchema` / `seo.emitWebsiteSchema` flags do all the work. NitroCore drives them.
3. **NitroCore-detection in NitroBlog AI is explicitly forbidden.** The blog engine must continue to behave identically whether the host is NitroCore, Wollongong Weather (bespoke), or anything else. NitroCore detects its own routes and steps aside on `/blog/*`. NitroBlog never detects NitroCore.

## What's NOT done

Nothing outstanding on the cross-engine partition.

The "shared `@shipwreck/schema` package" extraction that was proposed in the original 2026-05-13 handover doc has been **explicitly deferred**. Reasoning:

- The drift surface that motivated the package is small — only the 5 GEO primitives in FEATURES.md §6.1 are emitted by both engines on different pages.
- The partition (NitroCore owns site-wide schemas, NitroBlog owns `/blog/*`) prevents same-page overlap, so duplicate-emission drift is structurally impossible.
- Versioning a third repo for ~5 shared primitives is overhead without payoff while the consumer count is 2.
- The documented contract in FEATURES.md §6.1 is the lighter-weight equivalent and accomplishes the anti-drift goal.

**When to re-open the decision:** if a third consumer of these schema builders appears (e.g. a future NitroCommerce, NitroDirectory, or any non-blog publishing surface that also emits `Article`-like JSON-LD), extract `@nitroblog/schema` at that point.

## Update protocol for this doc

Bump the "Last updated" + version snapshot fields whenever:
- NitroCore ships a release that changes the partition contract (anything in §8.3 of NitroCore STANDARDS.md)
- NitroBlog ships a release that changes GEO field shapes (FEATURES.md §6.1)
- New shared-engine obligations are added
- The "What's NOT done" list changes

Releases that don't change cross-project obligations don't require a bump here.
