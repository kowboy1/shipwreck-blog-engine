#!/usr/bin/env node
/**
 * refresh-popularity.mjs — fetch blog post pageviews from Cloudflare Web
 * Analytics and write <site-repo>/.nitroblog/popularity.json for the engine
 * sidebar widget to consume.
 *
 * Run from a per-site repo. Reads env vars (recommend a per-site .env file
 * loaded by your runner — never commit secrets):
 *
 *   CF_API_TOKEN       — Cloudflare API token with "Account.Analytics: Read"
 *                        on the account that owns the site
 *   CF_ACCOUNT_TAG     — account ID (32-char hex) shown in CF dashboard URL
 *   CF_WEB_ANALYTICS_SITE_TAG
 *                      — the Web Analytics "site tag" (a.k.a. site_token);
 *                        find in CF dashboard → Web Analytics → site → Settings
 *   BLOG_BASE_PATH     — defaults to "/blog/" — only URLs under this prefix
 *                        are counted
 *   WINDOW_DAYS        — defaults to 30
 *   OUTPUT_PATH        — defaults to ".nitroblog/popularity.json" (relative
 *                        to the script's CWD — i.e. the site repo root)
 *
 * Usage:
 *
 *   # one-off:
 *   CF_API_TOKEN=... CF_ACCOUNT_TAG=... CF_WEB_ANALYTICS_SITE_TAG=... \
 *     node scripts/refresh-popularity.mjs
 *
 *   # nightly via cron (host machine):
 *   0 2 * * * cd /path/to/site-repo && node scripts/refresh-popularity.mjs \
 *     >> /var/log/nitroblog-popularity.log 2>&1
 *
 *   # GitHub Actions: see docs section in README.
 *
 * Exit codes:
 *   0  — wrote popularity.json successfully (even if zero posts had views)
 *   1  — config error (missing env var, etc.)
 *   2  — API error (CF rejected token, returned no data, etc.)
 *
 * The engine NEVER calls this at build time. It runs out-of-band and the
 * resulting JSON is committed (or git-ignored — your choice; the file is
 * harmless to share since views are aggregated).
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import process from "node:process"

const REQUIRED = ["CF_API_TOKEN", "CF_ACCOUNT_TAG", "CF_WEB_ANALYTICS_SITE_TAG"]
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`refresh-popularity: missing required env var ${k}`)
    process.exit(1)
  }
}

const TOKEN = process.env.CF_API_TOKEN
const ACCOUNT_TAG = process.env.CF_ACCOUNT_TAG
const SITE_TAG = process.env.CF_WEB_ANALYTICS_SITE_TAG
const BLOG_BASE_PATH = (process.env.BLOG_BASE_PATH ?? "/blog/").replace(/\/?$/, "/")
const WINDOW_DAYS = parseInt(process.env.WINDOW_DAYS ?? "30", 10)
const OUTPUT_PATH = process.env.OUTPUT_PATH ?? ".nitroblog/popularity.json"
const LIMIT = parseInt(process.env.LIMIT ?? "50", 10)

const now = new Date()
const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

// Cloudflare GraphQL Analytics API — rumPageloadEventsAdaptiveGroups gives
// per-URL pageview counts for a Web Analytics site.
const query = `
query GetTopPages($accountTag: String!, $siteTag: String!, $since: Time!, $until: Time!, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(
        limit: $limit,
        filter: {
          siteTag: $siteTag,
          datetime_geq: $since,
          datetime_leq: $until
        },
        orderBy: [count_DESC]
      ) {
        count
        dimensions {
          requestPath
        }
      }
    }
  }
}
`

const body = JSON.stringify({
  query,
  variables: {
    accountTag: ACCOUNT_TAG,
    siteTag: SITE_TAG,
    since: since.toISOString(),
    until: now.toISOString(),
    limit: LIMIT,
  },
})

let res
try {
  res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body,
  })
} catch (err) {
  console.error("refresh-popularity: network error contacting Cloudflare:", err.message)
  process.exit(2)
}

if (!res.ok) {
  const text = await res.text().catch(() => "<no body>")
  console.error(`refresh-popularity: CF API HTTP ${res.status}: ${text.slice(0, 400)}`)
  process.exit(2)
}

const payload = await res.json()
if (payload.errors && payload.errors.length > 0) {
  console.error("refresh-popularity: GraphQL errors:", JSON.stringify(payload.errors, null, 2))
  process.exit(2)
}

const groups = payload?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? []

// Extract slugs under BLOG_BASE_PATH. CF returns paths like "/blog/some-slug/".
const posts = []
const seen = new Set()
for (const g of groups) {
  const path = g.dimensions?.requestPath ?? ""
  if (!path.startsWith(BLOG_BASE_PATH)) continue
  let slug = path.slice(BLOG_BASE_PATH.length).replace(/\/$/, "")
  // Skip listing pages (/blog/, /blog/page/2/, /blog/tags/x/, etc.)
  if (slug === "" || slug.startsWith("page/") || slug.startsWith("tags/") ||
      slug.startsWith("categories/") || slug.startsWith("authors/") ||
      slug === "rss.xml" || slug === "robots.txt" || slug === "posts.json") continue
  // Engine post URLs are /blog/<slug>/ (no nested paths) so reject anything
  // with a slash in the slug portion.
  if (slug.includes("/")) continue
  if (seen.has(slug)) continue
  seen.add(slug)
  posts.push({ slug, views: g.count })
}

const out = {
  generatedAt: now.toISOString(),
  window: `${WINDOW_DAYS}d`,
  source: "cloudflare-web-analytics",
  posts,
}

const outPath = resolve(process.cwd(), OUTPUT_PATH)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n")

console.log(
  `refresh-popularity: wrote ${outPath} (${posts.length} post(s), ${WINDOW_DAYS}d window).`,
)
