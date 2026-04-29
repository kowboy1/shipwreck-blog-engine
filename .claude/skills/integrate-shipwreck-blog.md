---
description: Integrate the Shipwreck Blog Engine into a host site. Triggers when the user says "add the blog", "install shipwreck blog", "drop the blog into <site>", or sets up `@shipwreck/blog-core` for a new property. Produces a themed, building blog at /blog/ that visually matches the host. Blog source goes inside the host site's repo — there is NO separate per-blog repo.
---

# Skill — Integrate Shipwreck Blog into a Host Site

> ⚠️ **STOP** — if you opened this directly without reading [AGENTS.md](../../AGENTS.md), go read AGENTS.md first.
> AGENTS.md contains the universal rules every agent must follow before starting any job. This file is the runbook AGENTS.md routes you to for the install job.

> 🔒 **Completion contract** — completion output to the user must be exactly the stdout of `npx shipwreck-blog-doctor print-completion`. Any other completion format is invalid. (See [final blocking checkpoint](#-completion-contract--only-one-valid-path-to-done) for the full procedure.)

You are integrating `@shipwreck/blog-engine` into a host site. **This skill is hosting-, DNS-, and CDN-agnostic.** It works for any host that can serve static files (every cPanel tier, Plesk, DirectAdmin, OpenLiteSpeed, raw nginx/Apache, S3+CloudFront, Cloudflare Pages, Netlify, Vercel, GitHub Pages, a self-hosted VPS, an old-school FTP-only shared host — anything).

The end state:

1. The host site has a git repo (created here if it doesn't already have one — Phase 0).
2. The blog source lives **inside that repo** at `_blog/` — NOT in a separate per-blog repo. There is one repo per site, blog included.
3. The built blog dist is served at `<host-docroot>/blog/` via the host's existing deploy mechanism (whatever that is — git push to Cloudflare Pages, rsync to a VPS, FTP to cheap cPanel, etc.).
4. The blog is **themed to look native** to the host site.

---

## 🔥 Critical model concept — only ONE repo per site

There is **never** a separate "blog repo." There is **only ever** the host site's repo, with `_blog/` inside it. If the host doesn't have a repo yet, **Phase 0 creates an entire-site repo** with a recommended structure (the blog is just a subdirectory of that).

The previous version of this engine had a per-blog repo pattern. It was over-engineered. Reverted in v0.3.5. **Do not re-introduce it.** If you find yourself running `gh repo create <site>-blog` you are doing the wrong thing — `gh repo create <site>` (singular, the whole site) is the correct command.

---

## 🚦 Done definition (read this BEFORE starting)

The integration is **NOT done** until ALL of the following are true:

- [ ] Every phase below has its precondition AND its done-check satisfied
- [ ] `_blog/src/styles/tokens.css` has every TOKEN-CONTRACT.md token filled with a host-derived value
- [ ] `_blog/src/components/SiteShell/Header.astro` shows the host's actual nav (not the placeholder)
- [ ] `_blog/src/components/SiteShell/Footer.astro` shows the host's actual footer (not the placeholder)
- [ ] `_blog/src/content/posts/` does NOT contain demo posts (`hello-world.mdx`, `seo-checklist.mdx`, `why-not-wordpress.mdx`)
- [ ] `npx shipwreck-blog-doctor --final --phase9-confirmed --feedback-status=<provided|none-needed>` returns 0 fatal
- [ ] Live blog at `https://<domain>/blog/` visually matches the host
- [ ] `.shipwreck/sites.json` in the engine repo has this site's entry
- [ ] You have asked the user the **Phase 9 questions** in this session and acted on the answers
- [ ] Either `FEEDBACK-FOR-CLAUDE-<job>.md` exists in the engine repo OR you have explicitly declared "no engine feedback this run"

If you can't tick every box, the integration isn't done.

---

## ⛔ Phase gates (every phase has them — do not skip)

Each phase has:
- **Precondition** — must be true to *start*. If false, return to the previous phase.
- **Done-check** — must be true to *finish*. If false, the phase is not done.

Treat these as hard gates. Skipping phases produces broken integrations that look superficially OK at first.

---

## Inputs you need before starting

Get from the user OR look up in Harbour Control / vault. Don't guess.

1. **Host site name and domain** — the live URL the blog will be added to
2. **Existing repo?** — does the host site already have a git repo? Where? (If no: Phase 0 creates one.)
3. **Hosting environment + deploy mechanism** — how does the host site currently get from source to live? (Cloudflare Pages auto-deploy, Netlify, rsync to VPS, push to cPanel via SFTP, manual upload, etc.) The blog will use the same mechanism.
4. **Where the blog mounts** — usually `/blog/`. Locked in for the life of the site.
5. **Where the host's nav lives** (file/component) — for Phase 7 link
6. **Where the host's footer lives** — for Phase 7 link

Don't ask the user about deploy methods to the blog separately — there is no separate blog deploy. Whatever publishes the host site publishes the blog along with it.

---

## Phase -1 — Mark integration start (5 seconds)

Before any other work, once you've confirmed the inputs and you're about to begin Phase 0, run this from anywhere:

```bash
cd <site-repo>/_blog 2>/dev/null || cd <site-repo>   # whichever exists
npx shipwreck-blog-doctor attest-start
```

This records the integration start time in `.shipwreck-integration-state.json`. `print-completion` at the end will include the total elapsed time in the audit-trail block. Idempotent — running twice doesn't reset the timer.

If this step is skipped, the duration line just won't appear in print-completion (everything else still works). But it's free, captures useful data, and gives the user a per-install timing benchmark — do it.

---

## Phase 0 — Establish the site repo (skip if one already exists)

> **Precondition:** All inputs collected.
>
> **Done-check:** Either: the host site already has a git repo (note its location, you'll add `_blog/` to it in Phase 1), OR a new repo exists with the recommended structure (described below) and the host's existing files committed to it.

If the host site is already in a git repo (most common — Cloudflare Pages, Netlify, GitHub Pages all require it), use that repo. Note its location and skip to Phase 1.

If the host site has NO repo yet (rare — e.g. files-on-a-VPS without source control), **create one for the entire site** using this structure. The repo doubles as a backup snapshot of the site (per commit), so be conservative with `.gitignore`.

### Recommended site repo structure

```
<site-name>/                       ← repo root
├── README.md                      ← what the site is, deploy notes, engine version
├── .gitignore                     ← only truly transient (see below)
├── .shipwreck-site.json           ← site metadata
│
├── public/  (or wherever)         ← host site's existing files
│   ├── index.html
│   ├── about/, etc.
│   ├── assets/
│   ├── robots.txt
│   └── ...
│
├── _blog/                         ← blog source (Phase 1+ adds this)
│   ├── site.config.ts
│   ├── astro.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── src/...
│
└── blog/                          ← built blog dist (served at /blog/)
    └── (generated; commit if deploy is git-based, gitignore if rsync/sftp)
```

### `.gitignore` (minimal — repo doubles as backup)

```gitignore
# Build cache + deps (re-installable from package.json)
node_modules/
_blog/.astro/
_blog/dist/

# Local secrets (never commit; use .env.example for documentation)
.env
.env.local
```

That's it. Commit everything else — including the built `blog/` dist if the host deploys via git. The repo is a complete site snapshot; restoring is a `git clone` away.

### `.shipwreck-site.json` template

```json
{
  "name": "<site-name>",
  "domain": "<domain>",
  "engineVersion": null,
  "lastDeployed": null,
  "deployMechanism": "<git-push-cf-pages | rsync-to-vps | sftp-cpanel | netlify | etc.>",
  "notes": ""
}
```

### Creating the repo (if greenfield)

```bash
mkdir <site-name> && cd <site-name>
git init -b main
# Move/copy host site files into ./public/ (or whatever layout exists)
# Create README.md, .gitignore, .shipwreck-site.json from templates above
git add -A
git commit -m "chore: initial site repo"
gh repo create <user-or-org>/<site-name> --private --source=. --remote=origin --push
```

If the user has no preference, default `--private` (the repo doubles as a backup; private is conservative). Confirm with the user.

---

## Phase 1 — Install the blog scaffold into the site repo

> **Precondition:** Phase 0 done — site repo exists with the host's existing files committed.
>
> **Done-check:** `<site-repo>/_blog/` exists with the demo-site contents copied. file: dep paths in `_blog/package.json` updated to point at the local engine checkout. `cd _blog && npm install` succeeded. `npx shipwreck-blog-doctor --preflight` reports `✓ Engine package '@shipwreck/blog-core' resolves`. Demo content (`hello-world.mdx`, `seo-checklist.mdx`, `why-not-wordpress.mdx`) is REMOVED from `_blog/src/content/posts/`. Demo author `jane.json` is REMOVED.

```bash
cd <site-repo>

# Copy the demo-site contents into _blog/ (the canonical source layout)
mkdir -p _blog
cp -r <path-to-engine>/examples/demo-site/. _blog/

# Engine deps: file: paths from _blog/ resolving to the engine checkout.
# Adjust the relative path to match your actual layout. For most cases:
sed -i 's|file:../../packages/|file:<adjust-path>/shipwreck-blog-engine/packages/|g' _blog/package.json
# Verify by inspecting the output paths.

cd _blog
npm install
```

**Verify symlinks resolve before continuing:**

```bash
ls node_modules/@shipwreck/blog-core/package.json    # must show a real file
npx shipwreck-blog-doctor --preflight                 # must pass
```

If either fails, the `file:` path is wrong (typically too many or too few `../`). Fix the path in `_blog/package.json` and re-run `npm install`.

**Then strip demo content (mandatory):**

```bash
# Remove demo posts — they're engine boilerplate, not real content for this site
rm -f src/content/posts/hello-world.mdx \
      src/content/posts/seo-checklist.mdx \
      src/content/posts/why-not-wordpress.mdx

# Remove demo author
rm -f src/content/authors/jane.json
```

The blog can launch with zero posts (empty `posts/` dir is valid). Real content gets added later via the [add-shipwreck-blog-post skill](add-shipwreck-blog-post.md).

**Edit `_blog/site.config.ts`** with the host's real values:

```ts
import type { SiteConfig } from "@shipwreck/blog-core"

const config: SiteConfig = {
  siteName: "<HOST_NAME>",
  baseUrl: "<HOST_DOMAIN>",
  blogBasePath: "/blog",
  brand: {
    organizationName: "<HOST_NAME>",
    logoUrl: "<path-to-host-logo>",
  },
  seo: {
    defaultOgImage: "<host-og-image-url>",
    locale: "<en_AU | en_US | etc.>",
  },
  // ...
}
export default config
```

Commit at this point: `git add -A && git commit -m "feat: scaffold blog at _blog/"`.

---

## Phase 1.5 — Replace demo content with seed posts (mandatory)

> **Precondition:** Phase 1 done.
>
> **Done-check:** `_blog/src/content/posts/` does NOT contain `hello-world.mdx`, `seo-checklist.mdx`, or `why-not-wordpress.mdx`. AND it contains at least 1 valid post (seed or real). Demo `jane.json` author removed. Doctor returns no "Demo posts still in src/content/posts/" finding.

The engine demo ships with three example posts and a demo author. They must NOT ship to production. AND the blog can't be visually verified empty — Phase 5 needs at least 1 post to render meaningfully.

### Recommended: replace with site-themed seed content via `seed-posts`

```bash
cd _blog
rm -f src/content/posts/hello-world.mdx \
      src/content/posts/seo-checklist.mdx \
      src/content/posts/why-not-wordpress.mdx \
      src/content/authors/jane.json
npx shipwreck-blog-doctor seed-posts
```

The `seed-posts` subcommand generates 3 site-themed seed posts (welcome / three-things / getting-started) with:
- FAQ items (so FAQ schema can be tested)
- Varied lengths — short / medium / long (typography + ToC behavior)
- Internal links between them (related-posts, link rendering)
- A seed author file
- Each post explicitly self-identifies as seed content in its body, so a real visitor isn't confused if they land on one before replacement

These let the user visually verify the integration. The user keeps, edits, or deletes them when real content lands. Doctor's demo-content check passes because the slugs/content are different from engine boilerplate.

### Alternative: write real posts immediately

If the user has prepared real content, use the [add-shipwreck-blog-post skill](add-shipwreck-blog-post.md). At least 1 published post is required before Phase 5.

### NOT valid: leave the posts dir empty

A blog with zero posts shows "No posts here yet." Acceptable as a transient state but not as a closeout state — Phase 5 visual verification can't validate post rendering, FAQ schema, or related-posts widgets without posts. Always seed or write at least 1 post before Phase 5.

---

## Phase 2 — Extract host design tokens

> **Precondition:** Phase 1 done.
>
> **Done-check:** `_blog/src/styles/tokens.css` exists. Every token from [TOKEN-CONTRACT.md](../../packages/blog-theme-default/TOKEN-CONTRACT.md) has a host-derived value. The file is imported in `_blog/src/layouts/BaseLayout.astro`. `_blog/src/styles/global.css` does **NOT** contain `@import "@shipwreck/blog-theme-default/tokens.css"` (that line silently overrides your work — see CHANGELOG 0.3.4).

Extract the host's actual visual tokens. Order of preference:

1. **Host repo's CSS** — grep the host's stylesheets for `:root` / CSS custom properties / Tailwind config. Best signal.
2. **Host repo's Tailwind config** — `theme.extend.colors`, `fontFamily`, `borderRadius`.
3. **Live host computed styles** via [scripts/extract-theme.mjs](../../scripts/extract-theme.mjs):
   ```bash
   node <engine>/scripts/extract-theme.mjs https://<domain> > _blog/src/styles/tokens.draft.css
   ```
   Heuristics are best-effort; review every value before committing.

Fill `_blog/src/styles/tokens.css` using [TOKEN-CONTRACT.md](../../packages/blog-theme-default/TOKEN-CONTRACT.md) as the schema. Every token from the contract.

---

## Phase 3 — Port the SiteShell (header + footer) — PORT VERBATIM

> **Precondition:** Phase 2 done.
>
> **Done-check:** `_blog/src/components/SiteShell/Header.astro` shows the host's actual nav. `_blog/src/components/SiteShell/Footer.astro` shows the host's actual footer. Neither contains the placeholder. Doctor's SiteShell fidelity check (blog footer's `<a>` count + content length within ~60% of host's largest footer) passes — i.e. doctor does NOT flag "SiteShell Footer.astro looks simplified vs host footer."

### ⚠️ The single biggest historical failure of this phase

Agents copy the structure but strip out the content. They keep `<header>` and `<footer>` and the major elements, but drop sub-sections, secondary links, attribution lines, brand-block content. The result looks "right-shaped" but is dramatically less than the host's actual footer/header — and the user notices immediately.

**The rule:** copy the host's header and footer markup **verbatim** (every section, every link, every text block), then convert framework-specific syntax to Astro. The blog's SiteShell should match the host's SiteShell line-for-line in content, only differing where Astro syntax requires it.

If the host's footer has 12 links, your `Footer.astro` should have 12 links. If it has 4 sub-sections (brand block, sitemap-style nav, social, copyright/legal), yours should have all 4. If it has a fine-print attribution line at the bottom, keep it.

### Process

1. Open the host's actual footer file (typically `<host-repo>/index.html` or a layout/template file). Read every line.
2. Copy the entire `<footer>...</footer>` block (or equivalent component) into `_blog/src/components/SiteShell/Footer.astro`.
3. Convert syntax: `className` → `class`, drop JSX expressions, replace framework `<Link>` with `<a href="...">`, remove client-only state if the blog won't use it.
4. Keep ALL utility classes verbatim — they'll resolve correctly because Phase 2 tokens are now in place.
5. Repeat for the header.

### Strict rules for nav links

- Do NOT add a `/blog/` link to the host's main nav at this stage. That decision is Phase 7b — it requires user approval first. If you add a nav link here, doctor's nav-link cross-check will fail in default mode.
- DO copy any existing nav links from the host's nav verbatim.

### What NOT to do

- Do NOT consolidate footer sub-sections to "simplify" the layout. The user wants the host's footer, not a "cleaner" version.
- Do NOT drop attribution lines (e.g. "Site by X", data-source credits). They're part of the host's identity.
- Do NOT replace logos/brand blocks with placeholders. If the host has a complex logo SVG, port it.

If the host loads Google Fonts via `<link>`, port the same `<link>` into `_blog/src/layouts/BaseLayout.astro` `<head>`.

### Verification

```bash
# Eye-check: open both the host homepage and the blog index in your browser.
# The footers should be visually indistinguishable.

# Doctor check (lite mode, skip build for speed):
npx shipwreck-blog-doctor --lite --skip-build
# Should report: "SiteShell Footer.astro has comparable content density to host footer"
# If it warns "looks simplified vs host footer" — re-port verbatim before proceeding.
```

---

## Phase 4 — Custom CTAs (optional)

> **Precondition:** Phase 3 done.
>
> **Done-check:** Either: the user wanted custom CTAs and they're wired into `_blog/src/components/cta/registry.ts` and referenced from `site.config.ts`; OR the user declined and `site.config.ts` `ctaBlocks.default` is set to a host-appropriate default (NOT the demo's `"book-consult"`).

If the host site has a primary CTA the blog should reuse, create `_blog/src/components/cta/<CtaName>.astro` and register it. Buttons read `--button-*` tokens, so they should match host styling automatically once Phase 2 is done.

---

## Phase 5 — Build & visual verification

> **Precondition:** Phases 1–4 done.
>
> **Done-check:** `cd _blog && npm run build` succeeds. `_blog/dist/` exists with HTML pages and CSS. Visual diff against host returns <5% per region. `npx shipwreck-blog-doctor` reports zero fatal issues.

```bash
cd _blog
npm run build

# Preview locally
npx astro preview --host 0.0.0.0 --port 4322 &

# Visual diff against the live host
node <engine>/scripts/visual-diff.mjs https://<domain>/ http://localhost:4322/blog/
```

Manual sanity check:
- [ ] Header looks identical to host
- [ ] Footer looks identical
- [ ] Inline link in a blog post matches host link color + hover
- [ ] H1 font matches host H1
- [ ] Body text matches host body
- [ ] Primary CTA button matches host's most prominent CTA
- [ ] No engine-default colors leaking through

If any check fails: fix tokens, rebuild, re-verify. Do not proceed to Phase 6 with a half-themed blog.

---

## Phase 6 — Deploy via the host's existing mechanism

> **Precondition:** Phase 5 done — doctor green, visual diff passed, `_blog/dist/` ready.
>
> **Done-check:** Built blog dist is at `<host-docroot>/blog/`. `https://<domain>/blog/` returns 200 and renders the themed blog. The host site's normal deploy mechanism was used.

The blog is just static files. How they get to the host is whatever the host already does:

| Host setup | Blog deploy step |
|---|---|
| Repo auto-deploys to Cloudflare Pages / Netlify / Vercel / GitHub Pages | Copy `_blog/dist/` → `<repo-root>/blog/`, commit, push. Auto-deploy publishes both. |
| VPS with SSH (Prem3/Prem4 etc.) | `rsync -avz --delete _blog/dist/ user@host:/home/<domain>/public_html/blog/` (or use `scripts/deploy-blog.mjs`) |
| Cheap shared cPanel without SSH | SFTP `_blog/dist/` to `/public_html/blog/`, or zip + cPanel File Manager upload |
| Custom Docker / CI pipeline | Add a step that copies `_blog/dist/` to the same place the host's static files go |

**Pre-deploy checks (when the host has a webserver layer):**

1. **`.htaccess` doesn't intercept `/blog/*`.** If the host serves WordPress (or any framework) at the apex, add **above** any framework rules:
   ```apacheconf
   RewriteRule ^blog/ - [L]
   ```
   Test with `curl -I https://<domain>/blog/` — should return 200.

2. **CDN cache rule for `/blog/*`** (if there's a CDN). Aggressive edge-caching is safe; the next deploy will overwrite. Configure in CDN dashboard.

After deploy, browse `https://<domain>/blog/` and `https://<domain>/blog/<a-post-slug>/` to confirm rendering matches local preview.

---

## Phase 7 — Wire the blog into the host site

> **Precondition:** Phase 6 done — blog reachable and rendering.
>
> **Done-check:** Footer link to `/blog/` added to the host's footer. Nav link decision applied. `robots.txt` lists `/blog/sitemap-index.xml`. The blog is **discoverable** from the host homepage.

This is the step that makes the blog visible. Without it, the blog is technically live but invisible.

### 7a — Footer link (required)

Add a "Blog" link to the host's footer in the host's existing footer styling. Test by loading host homepage, scroll to footer, click → `/blog/` loads.

### 7b — Main nav link (ASK the user — they decide)

> "Want to add 'Blog' to the main nav as well, or footer-only?"

If yes: add to host's nav file/component in the existing nav-item style. Verify in browser.

### 7c — `robots.txt` reference

Add to host's `robots.txt`:
```
Sitemap: https://<domain>/blog/sitemap-index.xml
```

---

## Phase 8 — Register & track

> **Precondition:** Phase 7 done.
>
> **Done-check:** `.shipwreck/sites.json` in the engine repo has this site's entry. `.shipwreck-site.json` in the site repo (created Phase 0) has `engineVersion` and `lastDeployed` filled in.

Append to `<engine-repo>/.shipwreck/sites.json`:
```json
{
  "name": "<site-name>",
  "domain": "<domain>",
  "blogPath": "/blog",
  "blogSourcePath": "<absolute-path-to-_blog>",
  "engineVersion": "0.3.5",
  "lastDeployed": "<ISO-8601-timestamp>",
  "owner": "<who-maintains>",
  "notes": "<integration date, deploy mechanism, quirks>"
}
```

Update `<site-repo>/.shipwreck-site.json` with `engineVersion` and `lastDeployed`.

Optional: add an uptime monitor for `/blog/` (HTTP 200 keyword check) on whatever monitoring system you use.

---

## Phase 9 — Post-install integration questions (MANDATORY — actually execute)

> **Precondition:** Phase 8 done.
>
> **Done-check:** Every question below has been **asked of the user in this session** (interactive output — not listed in a status report). Then `npx shipwreck-blog-doctor --final --phase9-confirmed --feedback-status=<provided|none-needed>` returns 0 fatal.
>
> **⚠️ Most-skipped phase by agents.** Do not rationalise as "optional" or "for later" or "the user can ask if they want." Present each as a question. Get answers. Act on each.

Ask the user:

1. **"Want a 'Latest 3 posts' callout on the homepage?"** — fetches `/blog/posts.json` at host build time. If yes, where on the homepage?
2. **"Want an RSS feed link in the footer pointing to `/blog/rss.xml`?"** — helps RSS readers + AI crawlers find it.
3. **"Should I submit `https://<domain>/blog/sitemap-index.xml` to Google Search Console?"** — and Bing Webmaster?
4. **"Are there specific host pages that should cross-link to specific blog posts?"** — get a list, edit the host's pages or note for later.
5. **"Want to enable Sveltia CMS at `/blog/admin/` for non-dev editing?"** — already pre-wired; needs `_blog/public/admin/config.yml` filled with the site repo + GitHub OAuth setup. See `INTEGRATION.md` Part 4.

For each yes: do the work and verify. For each no/later: log it in `<site-repo>/.shipwreck-site.json` `notes` field as a deferred follow-up.

---

## 🛑 Completion contract — only one valid path to "done"

> 🔒 **Reminder:** completion output to the user must be exactly the stdout of `npx shipwreck-blog-doctor print-completion`. Any other completion format is invalid.

Default `npx shipwreck-blog-doctor` (no flags) is the closeout gate as of v0.3.6. It runs all install + Phase 2/3/5 checks AND requires three attestations from a state file. **You cannot reach 0 fatal without those attestations**, and writing them requires running specific subcommands that themselves require concrete proof.

### Step 1 — Attest Phase 9 (after asking the user every question)

```bash
cd <site-repo>/_blog
npx shipwreck-blog-doctor attest-phase9 '{
  "latest3Callout": "<user-answer>",
  "rssFooterLink": "<user-answer>",
  "gscSubmission": "<user-answer>",
  "crossLinks": "<user-answer>",
  "sveltiaCMS": "<user-answer>"
}'
```

Run this AFTER you have asked every Phase 9 question and recorded the user's answers. The JSON gets written to `_blog/.shipwreck-integration-state.json` as the audit trail. If you didn't ask the questions, do not run this — fix Phase 9 first.

### Step 2 — Attest the nav link decision (Phase 7b)

```bash
npx shipwreck-blog-doctor attest-nav-link approved   # if user said yes AND you added it to host nav
# OR
npx shipwreck-blog-doctor attest-nav-link declined   # if user said no — do NOT add nav link
```

Do NOT attest `approved` if you didn't actually ask the user, or if you added a nav link without their approval.

### Step 3 — Attest feedback status

```bash
# If you wrote a FEEDBACK-FOR-CLAUDE-<job>.md at the engine repo root:
npx shipwreck-blog-doctor attest-feedback provided FEEDBACK-FOR-CLAUDE-<job>.md

# If you genuinely have nothing to feed back (rare — most real integrations have something):
npx shipwreck-blog-doctor attest-feedback none-needed "<at-least-10-char honest reason>"
```

Doctor refuses lazy `none-needed` reasons (<10 chars). The reason field is your audit trail.

### Step 4 — Verify the gate passes

```bash
npx shipwreck-blog-doctor   # default mode = full closeout gate
```

Must exit 0. If any fatal issue, it is not done.

### Step 5 — Emit the completion message

```bash
npx shipwreck-blog-doctor print-completion
```

This re-runs the gate AND outputs the canonical audit-trail block on stdout. **Your reply to the user MUST include this stdout VERBATIM.** Do not paraphrase, summarise, or compose your own status message — that is a protocol violation. The completion message is the literal output of the tool.

Example: your final reply to the user should look like

> [your narrative wrap-up — what you did, any context]
>
> ```
> [paste the print-completion stdout VERBATIM here]
> ```

If `print-completion` exits non-zero, doctor is failing — you are not done. Fix what's broken before trying again.

### Failure modes to watch for in your own behaviour

These are what previous agents (Nyxi included) have done that produced broken integrations. If you catch yourself doing any of these, stop:

- **"I'll just use the demo posts — they look fine"** — they're labelled as engine boilerplate. Real sites have real content (or empty posts dir).
- **"Optional questions I'll mention but not ask"** — Phase 9 is not optional. Ask in this session, as actual prompts.
- **"Doctor passed so I'm done"** — that's only true for `npx shipwreck-blog-doctor` (default mode). If you ran `--lite` or `--preflight`, those are intermediate checks, not the gate.
- **"It builds and serves so it's working"** — see CHANGELOG 0.3.4: previous integration built and served but the cascade-order bug meant the dark theme was overridden. Working ≠ integrated.
- **"I'll write feedback if I think of something"** — write feedback now or attest `none-needed` with an honest reason. The "I'll think later" path leads to the engine never improving.
- **"Let me create a separate blog repo for this site"** — STOP. The blog goes inside the site repo (Phase 0 + 1).
- **"User said go ahead, so I'll do all phases at once and tell them"** — if a phase requires interactive input from the user (Phase 7b nav, Phase 9 questions), STOP and ask. "Go ahead" means continue the sequence, not jump to closeout.
- **"I'll write my own status message — print-completion is just for show"** — the print-completion stdout IS your status message. Composing your own narrative instead is a protocol violation that the user WILL notice.

### Failure modes to watch for in your own behaviour

If you catch yourself doing any of these, stop:

- **"I'll just use the demo posts — they look fine"** — they're labelled as engine boilerplate. Real sites have real content (or empty posts dir).
- **"Optional questions I'll mention but not ask"** — Phase 9 is not optional. Ask them in this session, as actual prompts.
- **"Doctor passed so I'm done"** — doctor's default is the gate for Phases 1-8; `--final` is the gate for "done." Use `--final`.
- **"It builds and serves so it's working"** — see CHANGELOG 0.3.4: previous integration built and served but the cascade-order bug meant the dark theme was overridden by engine defaults. Working ≠ integrated.
- **"I'll write feedback if I think of something"** — write feedback now or pass `--feedback-status=none-needed` with an honest reason.
- **"Let me create a separate blog repo for this site"** — STOP. The blog goes inside the site repo. Re-read the "Critical model concept" at the top of this skill.

---

## Common failure modes (reference table)

| Symptom | Cause | Fix |
| --- | --- | --- |
| Engine package symlinks broken | Wrong number of `../` in `file:` dep spec | Fix `file:` path in `_blog/package.json`, `npm install` again |
| Tailwind classes missing in built CSS | Tailwind preset not finding engine `pages/` | v0.3.2+ should handle this. If not, check `tailwind.config.ts` uses `require.resolve` to find the engine path |
| Dark theme renders light (or any cascade weirdness) | `_blog/src/styles/global.css` `@import`s engine tokens.css | Remove that `@import` line — consumer's `tokens.css` is the only source |
| Two H1s on every post | MDX starts with same H1 as frontmatter title | `shipwreckBlog()` integration auto-strips. Confirm `astro.config.ts` registers it |
| Doctor flags demo content | Phase 1 cleanup skipped | Remove `hello-world.mdx`, `seo-checklist.mdx`, `why-not-wordpress.mdx` from `_blog/src/content/posts/` |
| `--final` blocks completion | Missing `--phase9-confirmed` and/or `--feedback-status=...` | Complete Phase 9, write feedback OR declare none-needed, pass the flags |
| First `/blog/` request returns 404 or WordPress page | Host `.htaccess` rewrites `/blog/*` to framework | Add `RewriteRule ^blog/ - [L]` above framework rules |

---

## After integration succeeds

The site is on the engine. Future engine releases propagate by:

1. Engine ships a new version (CHANGELOG entry)
2. Per site: bump `@shipwreck/blog-core` and `@shipwreck/blog-theme-default` versions in `_blog/package.json`
3. `cd _blog && npm install && npm run build`
4. Deploy via the same mechanism Phase 6 used (commit + push, rsync, SFTP, etc.)
5. `npx shipwreck-blog-doctor --final --phase9-confirmed --feedback-status=none-needed` to verify

No central infrastructure. No daily polling. No tokens. No cron. The host site's existing deploy pipeline does the work.
