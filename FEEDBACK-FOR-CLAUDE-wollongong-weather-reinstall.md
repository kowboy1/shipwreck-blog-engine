# Feedback for Claude — Wollongong Weather clean reinstall (2026-04-29)

## What worked
- Phase structure is good and enforceable when followed in order.
- Per-site repo pattern (`<site>-blog` with `_blog/` source + workflow) is clean.
- Host-side wiring expectations (footer required, nav optional question, robots recommended) are clear.

## Gaps found while following the runbook strictly
1. **Phase 1 install fails out-of-the-box**
   - `_blog/package.json` uses:
     - `"@shipwreck/blog-core": "*"`
     - `"@shipwreck/blog-theme-default": "*"`
   - These are not resolvable from npm right now (404), so `npm install` fails.
   - Required workaround used: local file dependencies to `/home/rick/projects/shipwreck-blog-engine/packages/...`.

2. **Typecheck mismatch in demo scaffold**
   - `src/pages/[...slug].astro` throws TS errors on `preparePostPageData({ getEntry, render })` due signature mismatch.
   - Required workaround used: cast `getEntry` and `render` to `any`.

3. **Tailwind preset type declaration missing**
   - `tailwind.config.ts` import `@shipwreck/blog-theme-default/tailwind-preset` has no declaration file.
   - Required workaround used: `src/env.d.ts` with module declaration.

4. **Astro JSON-LD script hint/noise**
   - `BaseLayout.astro` should explicitly use `is:inline` for JSON-LD script tag to avoid check hints.

5. **Input block in handover has stale/incorrect infra assumptions**
   - Handover references Prem4/Cloudflare path as if required for this job.
   - For this run, site integration was local dev at `/home/rick/projects/wollongong-weather` and already tunnelled.
   - Suggest making local-only dev path a first-class supported mode in the runbook.

## Recommended fixes for v0.3.1
- Publish `@shipwreck/blog-core` and `@shipwreck/blog-theme-default` (or switch templates to explicit Git/file source until published).
- Patch `examples/demo-site/src/pages/[...slug].astro` types to pass `astro check` without local casts.
- Add package typings export for `tailwind-preset`.
- Add `is:inline` in template `BaseLayout.astro` JSON-LD script.
- Add a runbook branch: **Local dev integration mode (no Prem3/Prem4/Cloudflare required)**.

## Artifacts produced in this reinstall
- Fresh per-site local source repo: `/home/rick/projects/wollongong-weather-blog`
- Host blog mount regenerated at: `/home/rick/projects/wollongong-weather/blog`
- Host wiring applied per procedure:
  - `.htaccess` `RewriteRule ^blog/ - [L]`
  - footer Blog links
  - `robots.txt` blog sitemap line
