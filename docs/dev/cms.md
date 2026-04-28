# CMS integration (Sveltia)

The engine ships [Sveltia CMS](https://github.com/sveltia/sveltia-cms) pre-wired at `/blog/admin/`. Sveltia is a free, OSS, Git-backed content editor that runs entirely in the browser. No server, no database.

## Why Sveltia (not Decap, TinaCMS, Strapi)

- **Decap CMS** (formerly Netlify CMS) — works, but UI is dated and project momentum has slowed. Sveltia is a modern fork with the same config format.
- **TinaCMS** — nice UX but pulls toward their hosted Tina Cloud product; self-hosting requires a backend
- **Strapi / Sanity / Contentful** — full CMS with backend; overkill, expensive, lock-in
- **Sveltia** — zero backend, MIT license, modern UI, same config language as Decap (so we can switch back if needed)

## How it works

```
┌──────────────────────────────────────┐
│ User opens https://site.com/blog/admin/
└────────────────────┬─────────────────┘
                     │
                     ▼
        ┌───────────────────────────┐
        │ index.html loads          │
        │ sveltia-cms.js from CDN   │
        └────────┬──────────────────┘
                 │
                 │ fetches ./config.yml
                 ▼
        ┌───────────────────────────┐
        │ config.yml declares       │
        │ - GitHub repo             │
        │ - branch                  │
        │ - collections (posts,    │
        │   authors)                │
        │ - field schemas          │
        └────────┬──────────────────┘
                 │
                 │ user signs in to GitHub
                 ▼
        ┌───────────────────────────┐
        │ Sveltia uses GitHub API   │
        │ - List MDX/JSON files    │
        │ - Show form fields       │
        │ - On save: commit to repo │
        └────────┬──────────────────┘
                 │
                 │ commit triggers
                 ▼
        ┌───────────────────────────┐
        │ Site rebuilds & redeploys │
        │ Edited content goes live  │
        └───────────────────────────┘
```

## Files

In each consuming site:

- `_blog/src/pages/admin/index.astro` — the Astro page that loads Sveltia from CDN. Renders at `/blog/admin/`.
- `_blog/public/admin/config.yml` — Sveltia's config. Tells it which repo + branch + fields.

The `index.astro` (vs static `index.html` in `public/`) is deliberate: Astro's dev server doesn't auto-resolve `public/admin/` directory URLs to `index.html`. Making it a real page route fixes that.

## config.yml mapping

The Sveltia config mirrors the Zod schema 1:1. Every Post field has a corresponding Sveltia widget:

| Zod field | Sveltia widget |
|---|---|
| `title` (required string) | `string`, required |
| `excerpt` (optional, max 320) | `text`, not required |
| `publishDate` (date) | `datetime`, date-only format |
| `status` (enum) | `select` with options |
| `author` (string, refs author id) | `relation` to authors collection |
| `tags` (string array) | `list` |
| `featuredImage` (string url) | `image` |
| `metaTitle` (optional, max 70) | `string`, hint about length |
| `noindex` (boolean) | `boolean` |
| `faqItems` (object array) | `list` with sub-fields `question`/`answer` |
| `relatedPosts` (string array, refs post ids) | `relation` to posts, multiple |
| `body` (string, MDX) | `markdown` |

The Sveltia config groups related fields into collapsible sections (`object` widget with `collapsed: true`) so the editor isn't a wall of fields.

**When updating the Zod schema, ALSO update `config.yml`.** The two getting out of sync = silent bugs. CHANGELOG should call out both.

## Authentication options

Sveltia supports three auth flows for the GitHub backend:

### 1. PKCE OAuth (recommended for production)

Modern, secure, no backend needed. Requires registering a GitHub OAuth App once (org-level, reused across all sites):

1. Visit https://github.com/settings/developers → New OAuth App
2. Application name: "Shipwreck CMS"
3. Homepage URL: any (e.g. https://shipwreckstudio.com)
4. Authorization callback URL: `https://api.netlify.com/auth/done` (Sveltia's default; or self-host)
5. Save the Client ID; Sveltia uses PKCE so no client secret needed in the browser
6. Add the Client ID to each site's `config.yml` under `backend`:

```yaml
backend:
  name: github
  repo: org/repo
  branch: main
  client_id: "Iv1.xxxxxxxxx"
```

### 2. Personal Access Token

For dev / one-person teams. User clicks "Sign In Using Access Token", pastes a GitHub PAT with `repo` scope. Sveltia stores the token in localStorage.

Pros: zero setup. Cons: tokens don't auto-rotate, leak risk if devtools shared.

### 3. Local Repository (dev only)

Sveltia uses Chrome's File System Access API to read/write directly to a local folder. No GitHub at all.

Pros: works offline, no auth. Cons: only works in Chromium browsers, fights with WSL filesystem (Chrome can't open SMB-mounted `\\wsl$` paths).

## Image uploads

Configured in `config.yml`:

```yaml
media_folder: "_blog/public/uploads"   # where files are written in the repo
public_folder: "/blog/uploads"          # how URLs reference them at serve time
```

User uploads an image in Sveltia → it's added to a commit alongside the post → site rebuilds → image is served from `/blog/uploads/<filename>`.

Practical limits:
- Single file size capped by GitHub API (100MB hard limit, ~25MB practical)
- For large media (videos), store on a CDN and reference URLs

## Commit messages

`config.yml` customizes commit messages so Sveltia commits look like:

```
content(blog): create posts "my-new-post"
content(blog): update authors "rick"
content(blog): upload _blog/public/uploads/screenshot.png
```

These follow our `<type>(<scope>): <subject>` convention so they don't pollute the commit history.

## Multi-site, single CMS app?

Each site has its own `/blog/admin/`. There's no "one CMS dashboard for all sites". 

Pros: per-site isolation, no central server, simple ops.
Cons: editor has to log into each site separately.

If we ever need a unified dashboard, it'd be a separate project (`shipwreck-cms-dashboard`) that aggregates posts from each site's `/blog/posts.json` and links out to each site's admin for editing. Out of scope for now.

## What Sveltia can't do

- Visual page building (Sveltia is form-based, not WYSIWYG layout)
- Real-time collaboration (commits are atomic; two editors at once = merge conflict)
- Approval workflows (no draft → review → publish flow; just `status: draft|published`)
- Custom widgets requiring JS (Sveltia widgets are declarative)

If a site outgrows these limits, the migration target would be TinaCMS or a headless CMS like Sanity. Content would need to be migrated out of MDX into the new system's storage. Big lift, deferred until proven need.

## Debugging Sveltia

### Editor loads but shows no posts

- Check `folder:` paths in `config.yml` match the actual repo paths
- Check `branch:` matches where content lives
- Check user has read access to the repo

### Saves fail

- Check user has write access
- Check the GitHub token (PAT) has `repo` scope and isn't expired
- Check rate limits aren't being hit (unlikely for normal editing)

### Field validation errors

- The Sveltia config field has a constraint (required, max length) the user violated
- Or: the Zod schema has a constraint Sveltia's config doesn't know about, so the build fails after save

### Login flow gets stuck

- For PKCE: confirm OAuth app is registered correctly
- For PAT: confirm token is pasted correctly; try a fresh token
- For Local Repo: confirm Chrome (or Chromium-based browser); Firefox doesn't support File System Access API

## Future enhancements

- **Auto-generated changelog of CMS commits** — could be a small webhook → Slack/Discord
- **Per-author CMS access** — Sveltia inherits GitHub repo permissions, so this is partly free but not granular
- **Preview before publish** — set `status: draft`, build preview branch, link from CMS to staging URL
- **AI-assisted writing** — point Nyxi at a post, have her draft an outline. Out of scope for the engine; integrate via Nyxi's tooling
