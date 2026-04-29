---
description: Add a blog post to a Shipwreck-blog-engine-powered site. Triggers when the user says "add a post", "publish this article", "Arc handed me a draft", "write a post about X for <site>", "draft a blog post on Y", or hands you Markdown/MDX with instructions to publish. Handles every SEO technicality (frontmatter, headings, internal links, FAQ schema, alt text, slug, meta lengths) so the agent can take a draft and ship a publication-ready post without follow-up.
---

# Skill — Add a Blog Post to a Shipwreck Blog

You are publishing a blog post to a site running `@shipwreck/blog-engine`. The end state: a new MDX file in the per-site repo's `_blog/src/content/posts/`, committed and pushed, with **every SEO technicality correct** — so the post is genuinely ready to perform, not just published.

This skill assumes the engine is already integrated into the site (use [integrate-shipwreck-blog.md](integrate-shipwreck-blog.md) for that). If `_blog/src/content/posts/` doesn't exist for the target site, stop and run the integration skill first.

---

## Inputs you need

1. **Target site** — name (e.g. "Wollongong Weather") + per-site repo (e.g. `1tronic/wollongong-weather-blog`)
2. **Post topic / draft** — either:
   - A finished draft (markdown) handed over by Arc / the user — your job is mostly to add SEO frontmatter, internal links, FAQ, and final polish
   - A topic the user wants you to write from scratch — your job is the writing AND all the SEO
3. **Author** — who's the byline? Must match an existing author ID in `_blog/src/content/authors/<id>.json`. If the author doesn't exist, ask the user for: name, bio (1-2 sentences), avatar URL, optional Twitter/LinkedIn/Website. Create the author file as part of this skill if needed.
4. **Category and tags** — usually inferable from the topic + existing site categories/tags. Read `_blog/src/content/posts/*.mdx` frontmatter to see what categories/tags this site already uses, prefer reusing them. Don't proliferate.

If any are missing, ask. Don't guess on author or category.

---

## Phase 1 — Survey the existing site

Before writing anything, **understand the site you're adding to**. Skipping this produces orphan posts with no internal linking and tags that don't match anything else.

```bash
cd ~/projects/<site-name>-blog/_blog
ls src/content/posts/        # see existing post slugs
ls src/content/authors/      # see existing authors
```

Read frontmatter of every existing post (or at least the most recent 10):

```bash
head -25 src/content/posts/*.mdx
```

Note:
- Existing **categories** in use
- Existing **tags** in use (with frequency — common tags are good for clustering)
- Existing **authors**
- Posts that touch **topically related** subject matter (you'll link to these later)
- The site's **voice** — tone, paragraph length, level of formality, use of bold/italic, list-vs-prose ratio. Match it.

Also fetch the site's `posts.json` index if the site is live:

```bash
curl -s https://<domain>/blog/posts.json | jq '.[] | {id, title, tags, category, url}'
```

This is the canonical machine-readable list of every published post — use it for internal linking decisions.

If the host site has non-blog pages worth linking to (suburb pages, service pages, etc.), browse `https://<domain>/sitemap.xml` or grep the host repo to see what's available.

---

## Phase 2 — Frontmatter (every field matters)

Open `_blog/src/content/posts/<slug>.mdx`. The frontmatter Zod schema is in `@shipwreck/blog-core/schemas/post`. Fill **every applicable field**:

```mdx
---
# Required
title: "<Working title — 50-60 chars optimal, 70 max>"
publishDate: 2026-04-29
status: "published"  # or "draft" if not ready

# SEO basics — required for good rankings, technically optional in schema
metaTitle: "<SEO-optimized title for <title> tag — 50-60 chars optimal>"
metaDescription: "<150-160 chars, action-oriented, includes primary keyword naturally>"
excerpt: "<1-2 sentences summarising the post — shown in cards, RSS, social. Distinct from metaDescription.>"

# Author + taxonomy
author: "<author-id matching src/content/authors/<id>.json>"
# OR for multi-author:
# authors: ["author-1", "author-2"]
category: "<one of the site's existing categories>"
tags: ["<3-5 lowercase hyphenated tags>"]

# Discovery
featured: false                      # true if this should headline
sticky: false                        # true to pin to top of listings
articleType: "BlogPosting"           # or "NewsArticle" for time-sensitive

# Visual (optional but recommended)
featuredImage: "/blog/images/<slug>-hero.jpg"   # 1200×630 PNG/JPG, optional
featuredImageAlt: "<descriptive alt text>"

# Robots
noindex: false                       # true only for paywall/private posts

# FAQ block (optional but powerful — see Phase 5)
faqItems:
  - question: "<natural-language search query>"
    answer: "<1-3 sentence answer>"
  - question: "..."
    answer: "..."

# CTA override (optional — defaults to siteConfig)
# ctaBlock: "<cta-name-from-registry>"
---
```

### Field-by-field rules

| Field | Rule |
|---|---|
| `title` | 50-60 chars optimal. >70 truncates in SERP. Lead with the primary keyword. Avoid clickbait — Google penalizes. |
| `metaTitle` | If different from `title`, optimize for SERP. Same length rules. Often = `title` — only override when the natural article title is too long or not keyword-leading. |
| `metaDescription` | 150-160 chars optimal (155 is the sweet spot). Active voice. Include primary keyword naturally (don't stuff). End with implicit CTA ("Find out which conditions matter most"). |
| `excerpt` | Different from `metaDescription`. Shown to humans browsing the site. 1-2 sentences, conversational. |
| `publishDate` | Real date. Don't backdate to game freshness. |
| `author` | MUST match an existing `_blog/src/content/authors/<id>.json` file. Verify before committing. |
| `category` | One per post. Pick from existing categories unless the user explicitly wants a new one (and then ask first — proliferating categories dilutes them). |
| `tags` | 3-5. Lowercase. Hyphenated multi-word (`east-coast-low` not `East Coast Low`). Mix: 1 primary topic + 1-2 location/audience + 1-2 long-tail specifics. Reuse existing tags when relevant. |
| `featured` | Use sparingly — `true` only when this should headline. Engine uses it for the homepage featured grid. |
| `featuredImage` | 1200×630 (also serves as OG image). PNG or JPG. Save under `_blog/public/blog/images/<slug>-hero.<ext>`. If you don't have one, omit the field — the engine no longer falls back to the brand banner (v0.2.0+). |
| `featuredImageAlt` | Required if `featuredImage` is set. Describe the image meaningfully — don't repeat the title. |
| `noindex` | Default false. True only for thin pages, drafts, or anything that shouldn't be in search. |

### Slug rules

The slug is the filename minus `.mdx`. It becomes part of the URL: `https://<domain>/blog/<slug>/`.

- Lowercase
- Hyphenated, no underscores or spaces
- 3-6 words is ideal
- Lead with the primary keyword: `east-coast-low-explainer` (good), `what-is-an-east-coast-low` (acceptable but longer), `the-storm-that-shut-the-m1` (bad — keyword buried)
- Don't include stop words unless they aid readability: `guide-to-uv-protection` (good), `the-guide-to-uv-protection` (bad)
- Avoid years/dates in slugs unless the post is genuinely time-bound (event recap, annual report). Evergreen posts shouldn't bake dates in.
- Once published, **never change the slug**. If you must, ship a redirect via the engine's `_redirects` mechanism.

---

## Phase 3 — Heading hierarchy (one H1, no skips)

The engine renders the frontmatter `title` as the page's H1. The `remarkStripDuplicateH1` plugin (v0.3.0+) automatically removes a leading H1 from the MDX body if it duplicates the title — so you can safely write `# Title` at the top, but you don't need to.

**Rules for body headings:**

- **Body uses `##` (H2) for top-level sections.** Never `#` (H1) in the body.
- **`###` (H3) for subsections under an H2.** Never skip levels — don't go H2 → H4.
- **`####` (H4) sparingly** — usually a sign you're over-structuring; consider whether that subsection should just be a paragraph.
- **No empty headings**, no headings used purely for styling.
- **Front-load keywords in headings** when natural. "When East Coast Lows hit Wollongong" beats "Timing".
- **Don't write headings as questions unless they ARE questions** — H2s like "Should I be worried about flooding?" are fine; don't fake it.

The engine builds a Table of Contents from H2s and H3s. Good heading discipline = good ToC = good UX.

---

## Phase 4 — Body content

Match the site's voice. If the site is conversational, be conversational; if formal, be formal. Re-read 1-2 existing posts before writing.

### Structural template (proven shape — adapt, don't copy)

1. **Lead paragraph (the hook).** 1-3 sentences. Tells the reader what they get if they keep reading. Often answers the title's implicit question in 1 sentence ("Yes/no/sometimes — here's when").
2. **Optional TL;DR or "the short version" H2.** Useful for explainer posts. 50-100 word distillation. Some sites do this, some don't — match site convention.
3. **Body sections (H2s).** 3-7 H2 sections is the sweet spot. Each ~100-400 words. Use bullet lists where prose would become a brain-dump.
4. **Closing thought.** Not a "Conclusion" heading. A short final paragraph that lands the implication or the next-step thought.

### Word count

- 600-1200 words: short-form, fine for time-sensitive news or focused explainers
- 1200-2500 words: standard explainer / guide territory — best for SEO depth
- 2500+ words: pillar content / comprehensive guides
- <500 words: thin. Either expand or merge with a related post.

Don't pad. Length is correlated with rankings because depth-of-coverage is correlated with rankings — but padding is detected by both readers and Google.

### Writing rules

- **No generic openers.** "In today's fast-paced world", "Have you ever wondered", "It's no secret that" — kill on sight.
- **No keyword stuffing.** Use the primary keyword in the first paragraph, in 1-2 H2s naturally, and where it actually fits. Synonyms and related concepts matter more than repetition.
- **Specificity wins.** "200-500mm in 48 hours" beats "a lot of rain". Numbers, names, places, dates.
- **Short paragraphs.** 2-4 sentences. Long paragraphs read as walls.
- **Active voice** unless passive is genuinely better.
- **Cut hedges and qualifiers.** "It might be worth considering whether you should perhaps..." → "Consider..."
- **Bold for emphasis on KEY terms only.** Not for whole sentences. The engine renders MDX `**word**` as `<strong>`.
- **Lists** for genuinely listy content. Don't bullet-point prose.

---

## Phase 5 — FAQ block (use the engine's FAQ schema)

If the post has natural Q&A content, add `faqItems` to frontmatter. The engine emits a `FAQPage` JSON-LD schema automatically — Google may surface these as rich results, which is high-value SERP real estate.

```yaml
faqItems:
  - question: "When is East Coast Low season in Wollongong?"
    answer: "Most ECLs hit between April and September, with a peak in late autumn and winter. They can occur outside this window but it's rare."
  - question: "What's the difference between an ECL and a normal southerly?"
    answer: "An East Coast Low is a closed cyclonic low pressure system anchored just off the coast. A southerly buster is a frontal change. ECLs last days; busters move through in hours."
```

### FAQ rules

- **3-7 questions.** Fewer than 3 is barely worth the schema overhead; more than 7 dilutes.
- **Real questions people actually search.** Use Google "People Also Ask", site search analytics, or your own judgement. Avoid framed-as-questions that aren't ("What is this post about?" is not a real question).
- **Self-contained answers.** Each answer should make sense without the body. 1-3 sentences, complete.
- **Don't duplicate body content verbatim.** Paraphrase. Verbatim duplication risks "thin/duplicate content" flags from Google's crawl-time evaluation of structured data vs. body.
- **Don't fake-FAQ marketing copy.** Questions like "Why choose <brand>?" with promotional answers are deceptive structured data and risk a manual action.
- **Render decision:** the engine emits the schema regardless of whether you also render the FAQ in the body. If the post benefits from an in-body FAQ section, write the heading + Q/A in MDX too — but the schema works either way.

---

## Phase 6 — Internal linking (the highest-leverage SEO move)

This is where most agent-written posts fail. The engine has all the SEO scaffolding for you, but only humans/agents can decide which posts and pages to link FROM and TO.

### The internal linking goal

Every published post should:
1. Have **2-5 outbound internal links** (to other blog posts AND to non-blog host pages)
2. Be **linked TO from at least 1 other post** (after publishing — see "Phase 6c" below)
3. Have at least 1 link that establishes a **topic cluster** — connecting this post to a broader theme on the site

### 6a — Outbound links from this post

Read the existing post titles and host pages. Identify links that genuinely add value. Place them where a reader would naturally want more depth.

**Sources to consider:**
- **Blog posts** in `_blog/src/content/posts/*.mdx` (or via `https://<domain>/blog/posts.json`) — most important for SEO topic clustering
- **Host pages** — service pages, suburb/location pages, "about", category pages. Check `https://<domain>/sitemap.xml` or grep the host repo
- **Anchor links within the post itself** — sparingly, only if the post is long enough to warrant them
- **External authoritative sources** — only when adding a real citation. Use `rel="noopener"` if `target="_blank"`. Don't over-link externally; it leaks PageRank.

**Anchor text rules:**
- **Descriptive, not generic.** "See our [guide on East Coast Lows](...)" beats "Learn more [here](...)". "Click here" should never appear.
- **Vary the anchor text.** Don't always link to a target with the same exact phrase — looks unnatural.
- **First mention rule.** When an internal entity (another post, a place, a concept) is first mentioned, link it. Don't link the same target multiple times in close proximity.
- **Don't over-link the same paragraph.** 1-2 links per paragraph max.

**Example of good internal linking:**

```mdx
The escarpment is what makes [the Illawarra special](/illawarra/). It forces moist
easterly winds upward, dumping enormous rain totals. [Wollongong](/suburbs/north-wollongong/),
Thirroul, Stanwell Park and Helensburgh take the brunt — see our
[East Coast Low explainer](/blog/east-coast-low-explainer/) for what to watch.
```

Three internal links, all natural, all useful.

### 6b — `suggestInternalLinks()` helper (when available)

The engine exports a programmatic helper from `@shipwreck/blog-core`:

```ts
import { suggestInternalLinks } from "@shipwreck/blog-core"

const suggestions = suggestInternalLinks({
  current: post,
  candidates: allPosts,
  limit: 5,
})
// returns Array<{ id, title, score, matchedTags }>
```

Use it as a starting point — it ranks by tag overlap + title similarity. **Don't blindly accept** — its suggestions are candidates, not prescriptions. You're the editor.

### 6c — Reciprocal linking (after publishing)

When a new post is published, **scan recent existing posts for places where the new post should be linked from**. This is the step that turns a one-shot post into a connected site.

For each existing post written in the last ~6 months:
- Does this post mention a topic the new post covers in depth?
- If yes, is there already a link to a related post that's now superseded by the new one?
- Is there a sentence where adding "see our [guide on X](/blog/<new-slug>/)" would help the reader?

Edit the existing post's MDX to add the link. Commit as a separate commit (`docs: add internal links to <new-post>`).

**Don't over-do this.** 1-3 reciprocal links is plenty. If you find yourself editing 10 posts, the new post might be more of a hub piece than expected — note that for the user.

---

## Phase 7 — Images, alt text, OG

If the post has a featured image:

- **Save it under `_blog/public/blog/images/<slug>-hero.<ext>`** (or wherever the site convention is)
- **1200×630 PNG or JPG** — this dimension serves both the in-page hero AND the social/OG image
- **`featuredImageAlt`** is required in frontmatter — describe the image meaningfully, don't just repeat the title
- **Optimize file size.** Run through TinyPNG or similar. <200KB ideal, <500KB max.

If the post has body images:

- Save under `_blog/public/blog/images/<slug>-<descriptor>.<ext>`
- Reference in MDX with markdown image syntax: `![alt text](/blog/images/<slug>-<descriptor>.jpg)`
- **Every body image needs alt text.** Empty alt for purely decorative images (`![](...)`) — never just omit the brackets.
- Optimize file size

---

## Phase 8 — Validate before committing

```bash
cd ~/projects/<site-name>-blog/_blog
npm run typecheck  # or astro check — catches frontmatter schema mismatches
npm run build      # verify the post renders without error
```

Then preview locally:

```bash
npx astro preview --host 0.0.0.0 --port 4322 &
# open http://localhost:4322/blog/<slug>/
```

**Visual checks before commit:**

- [ ] Title renders as a single H1 (no duplicate)
- [ ] Body H2s/H3s are correct hierarchy
- [ ] Excerpt + author + date show in the article header
- [ ] Hero image (if set) renders with alt text
- [ ] Internal links resolve (click each one — broken links are a common slip)
- [ ] FAQ block (if set) renders OR is present in JSON-LD even if not in body — view-source the page, search for `"@type":"FAQPage"`
- [ ] OG/Twitter meta tags render correctly (view-source, check `og:title`, `og:description`, `og:image`)
- [ ] Tag chips render at the bottom of the post
- [ ] Author bio renders
- [ ] "More articles" section shows other relevant posts (not the current one)
- [ ] No layout shift / no engine default text leaking through ("Default site name", "TODO", etc.)

---

## Phase 9 — Commit, push, monitor

Commit message convention (matches engine + Sveltia commits):

```
content(blog): publish "<post-title>"
```

For the reciprocal-link edits in Phase 6c, separate commit:

```
content(blog): add internal links to <new-post-slug>
```

Push to the per-site repo:

```bash
git push origin main
```

The per-site GH Action (`blog-build.yml`) will:
1. Detect the change to `_blog/**`
2. Build with current engine version
3. Publish a new `blog-dist.tar.gz` GitHub Release

The host's `shipwreck-updater.php` cron will pull the new release within 24 hours (random time between 23:00–02:00 — see install). If you want it live faster:

```bash
# Force the host to update now:
curl "https://<domain>/shipwreck-updater.php?token=<TOKEN>"
```

(Token is in `~/.shipwreck-updater.config.php` on the host.)

After deploy:

- [ ] Visit `https://<domain>/blog/<slug>/` — verify it loads
- [ ] Right-click → view source → confirm JSON-LD schema for Article + Breadcrumb (+ FAQPage if set)
- [ ] Submit to Google Search Console as "Request indexing" if the user has GSC access (optional but speeds up first index)

---

## Anti-patterns (don't do these)

| Anti-pattern | Why it's bad |
|---|---|
| Generic intros ("In today's fast-paced world…") | Wastes the reader's time, hurts dwell-time signals |
| Keyword stuffing (primary keyword in every paragraph) | Detected by Google; reads as spam |
| Linking every mention of a keyword | Dilutes link signal; over-linking is detected |
| Stuffing FAQs with marketing copy | Risks structured-data manual action |
| Backdating publishDate to fake freshness | Detected by archive.org and search engines; ranks worse long-term |
| Writing 800 words then padding to 2000 | Detected by both readers and Google's quality models |
| Linking to non-existent slugs | Broken internal links, hurts crawl efficiency |
| Using the same alt text as the title | Wasted accessibility + SEO opportunity |
| Adding a `# Title` H1 in the body that duplicates frontmatter title | Engine strips it now (v0.3.0+), but don't rely on it; just don't write it |
| Slug with year/date for evergreen content | URL goes stale, signals datedness even when content is fresh |
| Creating a new tag for a single post | Tags should cluster; singletons are wasted taxonomy |

---

## Done definition

The post is "done" when ALL of the following are true:

- [ ] Frontmatter complete and valid (Phase 2)
- [ ] Heading hierarchy clean (Phase 3)
- [ ] Body content matches the site's voice (Phase 4)
- [ ] FAQ items added if natural for the topic (Phase 5)
- [ ] 2-5 outbound internal links present (Phase 6a)
- [ ] At least 1 reciprocal link added from a relevant existing post (Phase 6c) — separate commit
- [ ] Featured image saved + optimized + alt text set (Phase 7) — if image is appropriate
- [ ] `npm run build` passes (Phase 8)
- [ ] Local preview shows the post correctly (Phase 8)
- [ ] Committed + pushed to per-site repo (Phase 9)
- [ ] Live on `<domain>/blog/<slug>/` and verified
- [ ] JSON-LD schema verified in view-source

If any aren't done, the post isn't ready. Don't ship at 80%; the technicalities are the reason this skill exists.
