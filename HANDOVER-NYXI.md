# Handover — Shipwreck Blog Engine v0.3.0 (for Nyxi)

**From:** Claude Code session, 2026-04-29
**For:** Nyxi (ops / agent)
**Status:** Engine v0.3.0 ready. **First end-to-end integration test pending — that's your job.**

---

## What you're being asked to do

Integrate the blog engine into **wollongong-weather** from scratch using the new agent skill.

The site currently has **no blog**. Earlier today I (Claude) ran an experimental integration that exposed a bunch of bugs and missing pieces, then fixed them in the engine and built a proper integration system. Then I deleted the experimental blog so you can run the new system end-to-end as the first real test.

You are essentially the **acceptance test for the new integration architecture**. If you can complete the integration following only the skill + docs (no questions back to Rick or Claude), the system is good. If you hit gaps, log them — that's exactly what we need to find.

---

## The skill to follow

Read this and follow it phase-by-phase:

```
.claude/skills/integrate-shipwreck-blog.md
```

It's an 8-phase runbook. Each phase has a verification step. **Do not skip any phase.** Don't improvise — if something isn't clear, that's feedback we want.

Supporting docs:
- `packages/blog-theme-default/TOKEN-CONTRACT.md` — the theming token contract (every theming knob, with how-to-find-it recipes)
- `ROLLOUT.md` — the deploy/update architecture
- `scripts/README.md` — what each helper script does

---

## Inputs (everything you need)

| Input | Value |
|---|---|
| Site name | Wollongong Weather |
| Domain | `wollongongweather.com` |
| Local site path | `/home/rick/projects/wollongong-weather` |
| Server | Prem4 (`157.173.210.110`, `nyxi` user with limited sudoers) |
| Document root | `/home/wollongongweather.com/public_html/` |
| Blog mounts at | `/blog/` |
| Cloudflare zone | Look up in Cloudflare dashboard — the API token in vault at `/mnt/d/NyXi's Vault/Secrets/cloudflare-api-token.txt` should already work for this zone |
| Per-site GitHub repo to create | `1tronic/wollongong-weather-blog` (Phase 1 of skill) |

---

## What's expected at the end

1. **A new GitHub repo** `1tronic/wollongong-weather-blog` containing the per-site `_blog/` source, a working `.github/workflows/blog-build.yml`, and a published `blog-dist.tar.gz` release.
2. **A working blog at `https://wollongongweather.com/blog/`** themed to look native to the host site (header/footer match, fonts match, link colors match, primary CTA matches).
3. **Self-update enabled**: `shipwreck-updater.php` running on Prem4, daily cron registered with random time, status endpoint reachable. Test it: `curl https://wollongongweather.com/shipwreck-updater.php?token=…&action=status` should return `{"is_current":true}`.
4. **Site registry updated**: append the wollongong-weather entry to `.shipwreck/sites.json` in the engine repo with `engineVersion: "0.3.0"`, `lastDeployed: <timestamp>`, and the real Cloudflare zone ID.
5. **Uptime Kuma monitor** added for the status endpoint.
6. **Topic note** at `D:/NyXi's Vault/Topics/Wollongong.life.md` (or a new `Wollongong Weather Blog.md`) updated with engine version, integration date, any quirks.

---

## Things to watch for / log as feedback

If you hit any of these, the system has a gap:

- A token in TOKEN-CONTRACT.md you can't determine for the host
- A step in the skill that requires information not in the inputs above
- An error from `shipwreck-updater.php` after install
- Visual-diff failure that you can't trace back to a specific token
- Apache or Cloudflare doing something unexpected to `/blog/*`
- The per-site GH Action failing to build or release
- The `repository_dispatch` from engine releases not firing on the new repo (test by tagging a v0.3.1 dummy on the engine after integration is done)

Log each in your session log under "Open Items" so we can patch the skill or the engine.

---

## Engine state at handoff time

- Engine version: **0.3.0** (committed, not yet tagged on GitHub. Tag it after wollongong-weather integration is verified — that triggers the first `release-dispatch` test)
- Page renderers live in the package: per-site files are now ~10-line wrappers
- `shipwreckBlog()` Astro integration auto-wires remark plugins
- `shipwreck-updater.php` ready
- `install-updater.sh` ready (generates token + random cron time 23:00–02:00)
- `deploy-blog.mjs` ready (push-style deploy for SSH-capable hosts; optional fast-path)
- `release-dispatch.yml` GH workflow ready (engine → consumer site dispatches)
- `templates/site-blog-build.yml` ready (per-site build workflow template)
- `.shipwreck/sites.json` has a forward-looking wollongong-weather entry that you'll complete

---

## Decision points likely to come up

- **Per-site GH repo vs subdir of wollongong-weather repo**: skill says separate repo. That's correct — the per-site build action publishes its own releases, which the host's updater polls.
- **Whether to use SSH push or pull updates**: use **pull** (`shipwreck-updater.php`). It's the universal default. Push is optional. We're testing the universal path first.
- **`SHIPWRECK_DISPATCH_PAT` GitHub secret**: needs to be set on the engine repo for `release-dispatch.yml` to work. You may need to create a GitHub PAT with `repo` scope and add it as a secret. Don't skip this — without it, future engine releases won't notify consumer sites.
- **Where to put the Cloudflare zone ID**: the registry entry, the install-updater.sh `--cloudflare-zone-id` flag, AND the consumer site's GH Action environment if the build step needs it. (It probably doesn't — the updater handles cache purge.)

---

## After integration succeeds

1. Tag engine `v0.3.0` on GitHub (`gh release create v0.3.0 ...`). Verify `release-dispatch.yml` fires and the wollongong-weather-blog repo's `blog-build.yml` runs on the dispatch event.
2. Wait for the daily cron OR manually trigger an updater run to verify end-to-end pull works:
   ```
   curl "https://wollongongweather.com/shipwreck-updater.php?token=...&action=status"
   ```
3. Write a session log at `D:/NyXi's Vault/Sessions/2026-04-29-NyXi-shipwreck-blog-engine-first-integration.md` with:
   - Phases that worked smoothly
   - Phases that needed improvisation (= skill bug)
   - Any errors and their resolution
   - Time taken per phase
   - Whether the resulting blog matches the host visually (1-10)

That session log becomes the input for v0.3.1 fixes.

---

## If something is too unclear or risky to proceed

Don't deploy a half-themed blog publicly. If Phase 5 visual verification fails badly, or Cloudflare cache rules are unclear, or the host's `.htaccess` is doing something weird — pause and message Rick. Better to debug carefully than to ship a broken integration that becomes the blueprint for every future site.

The whole point of running this from scratch is to find what's missing. Finding gaps is **success**, not failure.
