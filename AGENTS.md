<!--
AGENT_INSTRUCTION:
  PRIMARY_ENTRYPOINT: AGENTS.md
  FOLLOW_LINEAR: true
  DO_NOT_SKIP_SECTIONS: true
This file is the canonical entry point for any agent (Claude/Codex/Nyxi/OpenClaw/Aider/any other) entering this repository. Every other .md in this repo redirects here.
-->

# 🚨 AGENT ENTRYPOINT — READ THIS FIRST 🚨

**You are an agent.** This file is your single source of truth for working in this repository. The repo has many `.md` files but **this one is the only valid starting point.** Other files redirect back here.

## STOP — before doing anything else

1. **STOP.** Do not grep, search, or open other files yet.
2. **READ THIS FILE COMPLETELY** before opening any other file.
3. **Identify your job from the table below**, then follow ONLY the runbook it points to, phase-by-phase, in order.
4. **DO NOT skip phases** in the runbook. Each phase has a precondition (must be true to start) and a done-check (must be true to finish). If a precondition fails, return to the previous phase. If a done-check fails, the phase is not done.
5. **DO NOT declare "done" until** you have run `npx shipwreck-blog-doctor --final --phase9-confirmed --feedback-status=<provided|none-needed>` AND it reports zero fatal issues. Default `npm run doctor` is the gate for Phases 1-8; `--final` is the gate for "integration complete."

If you skip any of the above, you will produce a half-broken integration that we will have to throw away and redo. We've been there. Don't repeat it.

---

## Identify your job, then go to the runbook

| If you've been told to… | Read this next, follow it phase-by-phase |
|---|---|
| Install the blog engine on a site (any site, any host, any stack) | [.claude/skills/integrate-shipwreck-blog.md](.claude/skills/integrate-shipwreck-blog.md) |
| Add, write, or publish a blog post on a site that already has the engine | [.claude/skills/add-shipwreck-blog-post.md](.claude/skills/add-shipwreck-blog-post.md) |
| Theme an already-installed blog (change colours/fonts/buttons to match a host) | [packages/blog-theme-default/TOKEN-CONTRACT.md](packages/blog-theme-default/TOKEN-CONTRACT.md) — fill every token, then rebuild |
| Push a fresh build of an existing site's blog (when we have SSH) | [scripts/deploy-blog.mjs](scripts/deploy-blog.mjs) — convenience helper, not load-bearing |
| Diagnose why a recently-integrated site looks broken | Run `npx shipwreck-blog-doctor` first. Then [.claude/skills/integrate-shipwreck-blog.md](.claude/skills/integrate-shipwreck-blog.md) → "Common failure modes" table |
| Understand how the engine propagates updates to all sites | [ROLLOUT.md](ROLLOUT.md) |
| Fix a bug or ship a feature in the engine itself | [CONTRIBUTING.md](CONTRIBUTING.md) + [ARCHITECTURE.md](ARCHITECTURE.md) |
| Anything not on this list | STOP. Ask the user to clarify before improvising. |

---

## In practice, you are probably Nyxi

> Most installations of this engine are handled by Nyxi (OpenClaw). She has direct access to the user's server fleet (SSH credentials in her workspace, vault access for Cloudflare and other API tokens, Harbour Control dashboard with every site → server → access mapping, Tailscale into ops). When the universal docs say "look it up if not given to you", that's specifically a hint that Nyxi can read these things directly. Other agents may not have that access — they should ask the user.
>
> The docs themselves stay universal. Nyxi's shortcuts are conveniences, not assumptions baked into the runbook.

---

## ⚠️ Universal rules every agent MUST follow

These are not suggestions. Violating any of them produces broken integrations or wastes the user's time.

### 1. Hosting/DNS/CDN-agnostic by design

The engine installs onto **any** static-file-serving host. Don't bake site-specific, server-specific, or CDN-specific behaviour into the engine, the skills, or the universal docs. If the user gives you a specific stack, that's an INPUT to the runbook (it influences which deploy mode you pick), not a baked-in assumption. Stack-specific quirks discovered during real integrations go in [.claude/skills/stack-notes/](.claude/skills/stack-notes/) — don't pollute the universal skill.

### 2. Two repos per integration. Don't conflate them

- **Host site repo** — the existing live website. Blog is NOT installed here. Only edits: footer link, optional nav link, optional `robots.txt` sitemap reference.
- **Per-site blog repo** (`<site-name>-blog`) — a SEPARATE git repo containing only the blog source.

If you find yourself committing blog source to the host repo, **STOP** — you're in the wrong place.

### 3. Versioning rule

Bump the patch component (last decimal) only. `0.3.1 → 0.3.2 → 0.3.3 → ... → 0.3.99 → 0.3.100`. Don't auto-bump minor or major even if changes feel semver-justifying. **Asking for a minor or major bump is the user's call, not yours.**

### 4. Where to find site/server/access info if not given to you in the prompt

- **Site domain, server, document root, deploy method:** look up in the user's agent dashboard (Harbour Control, or whatever the user maintains for site→server mapping); ask the user if no dashboard access.
- **CDN zone IDs / API tokens:** check the user's secret store; never guess credentials.
- **GitHub org / repo names:** ask the user, or read existing entries in `.shipwreck/sites.json`.

### 5. The site registry is the source of truth

Every site running the engine is recorded in [.shipwreck/sites.json](.shipwreck/sites.json) with its domain, deploy method, server, source repo, CDN config, engine version. After integrating a new site, append it there. Before working on an existing site, read its entry there for context.

### 6. `npm run doctor` is the gate

Every consumer site has `npm run doctor` available (provided by `@shipwreck/blog-core`'s bin). It runs preflight + post-install checks: file: deps resolve, tokens.css exists, SiteShell is customised, build succeeds, CSS contains all engine classes, source/deploy paths are separate.

**Run it after `npm install` (catches install bugs early). Run it again before declaring done (catches skipped phases).** A run with any "fatal" finding means you cannot declare done.

---

## End-of-job protocol (mandatory)

After you believe the job is complete, before reporting completion:

1. **Run `npm run doctor`** in the consumer site dir. All checks must pass (no `✗` items). If any fail, the job isn't done — go back and finish.
2. **Update [.shipwreck/sites.json](.shipwreck/sites.json)** with the relevant entry (engine version, last deployed, etc.)
3. **Engine feedback:** if you discovered something the dev agent should fix in the engine itself, write a `FEEDBACK-FOR-CLAUDE-<job>.md` at the engine repo root AND tell the user. If you have no engine feedback, tell the user explicitly: "no engine feedback this run."
4. **Stack-specific quirks:** if you saw stack-specific quirks worth recording (anything different from a "vanilla" install on this stack), write a session log following the template in [.claude/skills/stack-notes/README.md](.claude/skills/stack-notes/README.md) AND tell the user.
5. **Phase 9 questions** (only on integration jobs): ask the user the post-install integration questions before declaring done — see the integration skill's Phase 9.
6. **Session log** per the user's session-log convention (varies per agent runtime).

**Reporting "done" without items 1–5 is a protocol violation.** The user will catch it and ask you to redo. Save them the round-trip.

---

## Things you MUST NOT do without asking

- Bump engine versions beyond patch (rule 3 above)
- Tag GitHub releases on the engine repo (the user does this manually after verification)
- Push to the host site repo for anything other than the footer/nav/robots integration
- Modify the universal skill or universal docs to add hosting-specific assumptions (rule 1 above)
- Skip the validation checklist in TOKEN-CONTRACT.md when theming
- Ship a half-working integration "for now" — Phase 5 visual verification AND `npm run doctor` must both pass before Phase 6 deploy
- Declare a job done without running `npm run doctor` and completing the end-of-job protocol

---

## ⚠️ If you opened any other .md file in this repo before this one

You skipped step 1 above. The other file likely has a STOP header redirecting you here — go read this file fully first. Every other `.md` in this repo is *referenced from* this entrypoint, not a starting point.
