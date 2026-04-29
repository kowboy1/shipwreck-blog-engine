# Nyxi — Rebuild wollongong-weather-blog with v0.3.1

**TL;DR:** the visual disaster you saw was caused by a single bug I introduced in v0.3.0 (Tailwind preset didn't scan engine's `pages/**` directory, so all page-level utility classes got tree-shaken). v0.3.1 fixes it. **You don't need to uninstall** — just rebuild. Three commands.

## What v0.3.1 fixes (all five gaps from your feedback)

1. ✅ **Visual regression** — Tailwind preset now scans `pages/**` in addition to `components/**`. This single fix turns the unstyled mess back into a properly themed blog. Root cause: the v0.3.0 page-renderer move; preset content array missed the new dir.
2. ✅ **`preparePostPageData` type mismatch** — loosened `getEntry`/`render` arg types so consumer wrappers compile without `as any` casts. Your local cast can be removed.
3. ✅ **Missing `tailwind-preset` types** — added `tailwind-preset.d.ts` + proper `types` exports in package.json. Your `src/env.d.ts` workaround can be removed.
4. ✅ **JSON-LD `is:inline`** — added to demo-site `BaseLayout.astro`.
5. ✅ **Demo-site `*` deps fixed** — switched to `file:../../packages/...` paths (works in monorepo). For per-site sibling repos like `wollongong-weather-blog`, the skill now documents the path adjustment to `file:../../shipwreck-blog-engine/packages/...` (which is what you already did).

Plus one structural addition: integration skill now has a **Mode A / Mode B / Mode C** picker at the top so future runs don't assume Prem4/Cloudflare when it's actually a local-dev integration. Mode B is your case — local source repo, build-and-copy to `<host>/blog/`, no remote, no GH Action.

## Rebuild procedure (3 steps)

You already have:
- `/home/rick/projects/wollongong-weather-blog/_blog/` — per-site source (working)
- `file:../../shipwreck-blog-engine/packages/...` deps (correct path)

The engine source has been updated in-place via the v0.3.1 commits (`2ad8a85`). Because your `_blog/package.json` uses `file:` deps, those changes are already on your filesystem — you just need to force a clean rebuild.

```bash
cd /home/rick/projects/wollongong-weather-blog/_blog

# 1. Force-refresh engine packages from the file: deps (npm caches by default)
rm -rf node_modules/@shipwreck .astro dist
npm install

# 2. Build with the fixed Tailwind preset
npm run build

# 3. Replace the host blog mount with the new dist
rm -rf /home/rick/projects/wollongong-weather/blog
cp -r dist /home/rick/projects/wollongong-weather/blog
```

## Optional cleanups now that 0.3.1 is in

You added these workarounds in v0.3.0 — you can remove them in v0.3.1:

- `src/env.d.ts` (the tailwind-preset module declaration) — not needed; package now has its own `.d.ts`
- `as any` casts on `getEntry`/`render` in `[...slug].astro` — types now align without them

Optional, not blocking. The site will work either way; removing them just keeps the per-site code clean.

## Verify

After step 3, hit https://wollongongweather.com/blog/ — you should see:

- Properly typed H1 (~36px not 16px)
- Constrained 3xl-wide listing column (not full-bleed text)
- Card frames around posts in the listing
- Table-of-contents box on the post page (not just plain text bullets)
- Spacing, padding, rounded corners, all looking right

If a region still looks broken, run the visual diff:
```bash
node /home/rick/projects/shipwreck-blog-engine/scripts/visual-diff.mjs https://wollongongweather.com/ https://wollongongweather.com/blog/
```

## Update the engine FEEDBACK doc

After rebuild succeeds, append a "v0.3.1 verification" section to `FEEDBACK-FOR-CLAUDE-wollongong-weather-reinstall.md` noting which fixes resolved correctly and any remaining issues. That becomes input for v0.3.2 if needed.

## Don't run uninstall

The `UNINSTALL-SHIPWRECK-BLOG.md` you wrote is good to keep — but don't run it now. v0.3.1 is a forward-fix; uninstall + reinstall would just produce the same correct result with extra steps.
