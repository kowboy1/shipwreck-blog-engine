#!/usr/bin/env bash
# test-integration.sh — full end-to-end integration acceptance test.
#
# Simulates the canonical sibling-repo install path in a clean tmp dir:
#
#   <tmp>/sites/
#     shipwreck-blog-engine/   <- symlink to this repo
#     test-site-blog/          <- copy of demo-site, file: deps adjusted
#
# Then runs the actual integration sequence (install, build, doctor, dist
# inspection, key-page render checks) and asserts every result. Exits 0
# only if the entire flow works on a clean tree with no manual steps.
#
# This is what we run in CI to catch regressions before Nyxi or any other
# integration agent does. If this fails, the installation experience is
# broken — fix it before merging.
#
# Usage:
#   bash scripts/test-integration.sh           # run full test
#   bash scripts/test-integration.sh --keep    # keep tmp dir for inspection
#   bash scripts/test-integration.sh --verbose # show command output

set -euo pipefail

# ---------- args + setup ----------

KEEP_TMP=0
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --keep)    KEEP_TMP=1 ;;
    --verbose) VERBOSE=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

ENGINE_REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP_ROOT="$(mktemp -d -t shipwreck-integration-test-XXXXXXXX)"
SITES_DIR="$TMP_ROOT/sites"
TEST_SITE="$SITES_DIR/test-site-blog"

if [[ $KEEP_TMP -eq 0 ]]; then
  trap 'rm -rf "$TMP_ROOT"' EXIT
else
  trap 'echo "Tmp dir kept at: $TMP_ROOT"' EXIT
fi

run() {
  if [[ $VERBOSE -eq 1 ]]; then
    "$@"
  else
    "$@" >/dev/null 2>&1
  fi
}

PASS_COUNT=0
FAIL_COUNT=0
ok()   { echo "  ✓ $1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo "  ✗ $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }

# ---------- 1. Set up sibling layout ----------

echo
echo "=== shipwreck blog engine — integration acceptance test ==="
echo "Engine: $ENGINE_REPO"
echo "Tmp:    $TMP_ROOT"
echo

mkdir -p "$SITES_DIR"
ln -s "$ENGINE_REPO" "$SITES_DIR/shipwreck-blog-engine"

# Copy demo-site as the per-site source (the canonical install motion)
cp -r "$ENGINE_REPO/examples/demo-site/." "$TEST_SITE/"
ok "Sibling layout created: $TEST_SITE alongside engine"

# ---------- 2. Adjust file: dep paths for the sibling layout ----------

# Demo-site ships with file:../../packages/... (works in monorepo). For a
# sibling-of-engine layout, the path becomes ../shipwreck-blog-engine/packages/...
sed -i 's|file:../../packages/|file:../shipwreck-blog-engine/packages/|g' "$TEST_SITE/package.json"

if grep -q 'file:../shipwreck-blog-engine/packages/blog-core' "$TEST_SITE/package.json"; then
  ok "file: dep paths adjusted for sibling layout"
else
  fail "file: dep paths NOT updated correctly"
  exit 1
fi

# ---------- 3. npm install ----------

cd "$TEST_SITE"
if run npm install --no-audit --no-fund --silent; then
  ok "npm install succeeded"
else
  fail "npm install FAILED"
  exit 1
fi

# Symlinks resolve?
if [[ -e node_modules/@shipwreck/blog-core/package.json ]]; then
  ok "Engine package symlinks resolve (file: deps not broken)"
else
  fail "Engine package symlinks BROKEN — file: dep path is wrong (extra ../ probably)"
  ls -la node_modules/@shipwreck/ 2>&1 | head -5
  exit 1
fi

# ---------- 4. doctor preflight ----------

if run npm run doctor -- --preflight; then
  ok "Doctor preflight (engine packages resolve, scaffold structure correct)"
else
  fail "Doctor preflight FAILED — engine packages or scaffold structure broken"
  npm run doctor -- --preflight 2>&1 | tail -25
  exit 1
fi

# ---------- 5. build ----------

if run npm run build; then
  ok "npm run build succeeded"
else
  fail "npm run build FAILED — installation produces a broken build on clean tree"
  npm run build 2>&1 | tail -20
  exit 1
fi

# ---------- 6. dist inspection ----------

# Critical pages exist
for path in \
  dist/index.html \
  dist/hello-world/index.html \
  dist/seo-checklist/index.html \
  dist/why-not-wordpress/index.html \
  dist/sitemap-index.xml \
  dist/rss.xml \
  dist/robots.txt \
  dist/admin/index.html \
  dist/admin/config.yml \
  dist/admin/shipwreck-blog-engine-logo.png
do
  if [[ -e "$path" ]]; then
    ok "dist contains: $path"
  else
    fail "dist MISSING: $path"
  fi
done

# Built CSS contains every engine page-level utility class (catches the v0.3.0
# / v0.3.1-style preset-content bug that left fresh installs unstyled)
CSS_FILE="$(ls dist/_astro/*.css 2>/dev/null | head -1)"
if [[ -z "$CSS_FILE" ]]; then
  fail "No CSS file in dist/_astro/"
  exit 1
fi
ok "Built CSS file: $CSS_FILE ($(du -h "$CSS_FILE" | awk '{print $1}'))"

CSS_SIZE_BYTES=$(stat -c%s "$CSS_FILE" 2>/dev/null || stat -f%z "$CSS_FILE")
if [[ $CSS_SIZE_BYTES -lt 15000 ]]; then
  fail "Built CSS is suspiciously small (${CSS_SIZE_BYTES} bytes) — engine classes probably weren't scanned"
  exit 1
fi
ok "Built CSS size sanity (${CSS_SIZE_BYTES} bytes — engine classes appear scanned)"

REQUIRED_CLASSES=(max-w-7xl 'lg\\:grid-cols-3' rounded-card line-clamp-2 max-h-48 text-4xl font-heading not-prose 'lg\\:hidden')
for class in "${REQUIRED_CLASSES[@]}"; do
  if grep -q "$class" "$CSS_FILE"; then
    ok "CSS contains engine class: $class"
  else
    fail "CSS MISSING engine class: $class"
  fi
done

# Post page sanity
POST_HTML="$TEST_SITE/dist/hello-world/index.html"
if [[ ! -f "$POST_HTML" ]]; then
  fail "Post page HTML not generated"
  exit 1
fi

# Exactly one H1 (catches the duplicate-H1 regression — should have been
# stripped by remarkStripDuplicateH1 since the demo post starts with the
# title as H1)
H1_COUNT=$(grep -c '<h1' "$POST_HTML" || echo 0)
if [[ $H1_COUNT -eq 1 ]]; then
  ok "Post page has exactly one H1 (duplicate-H1 stripper works)"
else
  fail "Post page has $H1_COUNT H1 elements (expected 1)"
fi

# v0.3.16: negative test for the fuzzy-match plugin. Write a post whose body
# H1 doesn't exactly match the frontmatter title (the common "title + suffix"
# case that bit Wollongong Weather), build, and assert only one H1 survives.
H1_TEST_MDX="$TEST_SITE/src/content/posts/h1-fuzzy-test.mdx"
cat > "$H1_TEST_MDX" <<'MDX'
---
title: "Reading rain radar properly (without overreacting)"
publishDate: 2026-05-12
status: "published"
author: "rick"
category: "guides"
tags: ["test"]
featuredImage: "/uploads/seed-hero.svg"
featuredImageAlt: "test"
---

# Reading rain radar properly

Body H1 above is a fuzzy match (prefix) of the frontmatter title — plugin
must strip it.

## Real section

Body content.

# Another body H1 that doesn't match the title at all

That second H1 should be downgraded to H2 (kept, not removed, since it's
genuine content rather than a title duplicate).
MDX
npm run build > /dev/null 2>&1 || true
H1_TEST_HTML="$TEST_SITE/dist/h1-fuzzy-test/index.html"
if [[ -f "$H1_TEST_HTML" ]]; then
  FUZZY_H1_COUNT=$(grep -c '<h1' "$H1_TEST_HTML" || echo 0)
  if [[ $FUZZY_H1_COUNT -eq 1 ]]; then
    ok "Plugin fuzzy-matches title prefix + downgrades non-matching body H1 (exactly one H1 survives)"
  else
    fail "Plugin failed on fuzzy-match post: $FUZZY_H1_COUNT H1 elements (expected 1)"
  fi
  # And the unrelated body H1 should have become an H2 (still present as text)
  if grep -q "Another body H1 that doesn" "$H1_TEST_HTML"; then
    ok "Non-matching body H1 preserved as H2 (content not lost)"
  else
    fail "Non-matching body H1 content lost during downgrade"
  fi
else
  fail "Build of h1-fuzzy-test.mdx did not produce dist/h1-fuzzy-test/index.html"
fi
rm -f "$H1_TEST_MDX" "$H1_TEST_HTML"

# JSON-LD article schema present
if grep -q '"@type":"BlogPosting"' "$POST_HTML"; then
  ok "Post page emits BlogPosting JSON-LD schema"
else
  fail "Post page MISSING BlogPosting schema"
fi

# Breadcrumb schema present
if grep -q '"@type":"BreadcrumbList"' "$POST_HTML"; then
  ok "Post page emits BreadcrumbList JSON-LD schema"
else
  fail "Post page MISSING BreadcrumbList schema"
fi

# v0.3.17: "More articles" cards on post page must receive the same
# fallbackImage as the cards on /blog/. Regression test for the PostCard
# duplication-of-cards principle — RelatedPosts uses PostCard, must get the
# same fallback prop. The demo posts all have featuredImage set, so this
# checks the prop wiring by counting <img> tags inside the More-articles
# section — every card should have an image.
MORE_BLOCK=$(awk '/More articles/,/<\/section>/' "$POST_HTML" 2>/dev/null || true)
if [[ -n "$MORE_BLOCK" ]]; then
  MORE_IMG_COUNT=$(echo "$MORE_BLOCK" | grep -c '<img' || echo 0)
  if [[ $MORE_IMG_COUNT -ge 1 ]]; then
    ok "'More articles' cards render images (RelatedPosts -> PostCard image prop wired)"
  else
    fail "'More articles' cards render NO images (RelatedPosts -> PostCard fallback prop lost)"
  fi
fi

# v0.3.12: PopularPosts sidebar widget rendered on post page
if grep -q 'class="popular-posts' "$POST_HTML"; then
  ok "Post page renders PopularPosts sidebar widget"
else
  fail "Post page MISSING PopularPosts sidebar widget"
fi
# And the widget includes at least one mini-card link to another post
if grep -qE '<aside[^>]*popular-posts[^>]*>[\s\S]*?<a[[:space:]]+href="/blog/' "$POST_HTML" \
  || (grep -A 40 'class="popular-posts' "$POST_HTML" | grep -q 'href="/blog/'); then
  ok "PopularPosts widget contains at least one mini-card link"
else
  fail "PopularPosts widget rendered but contains no card links"
fi

# Sitemap is non-empty + lists posts
SITEMAP="$TEST_SITE/dist/sitemap-0.xml"
if [[ -f "$SITEMAP" ]] && grep -q "hello-world" "$SITEMAP"; then
  ok "Sitemap lists post URLs"
else
  fail "Sitemap missing or doesn't list posts"
fi

# v0.3.18: image sitemap exists + lists posts with their featured images +
# robots.txt references it
IMG_SITEMAP="$TEST_SITE/dist/image-sitemap.xml"
if [[ -f "$IMG_SITEMAP" ]] && grep -q "image:image" "$IMG_SITEMAP" && grep -q "hello-world" "$IMG_SITEMAP"; then
  ok "Image sitemap exists with image:image entries"
else
  fail "Image sitemap missing or malformed"
fi
if grep -q "image-sitemap.xml" "$TEST_SITE/dist/robots.txt"; then
  ok "robots.txt references the image sitemap"
else
  fail "robots.txt missing image-sitemap reference"
fi

# v0.3.18: SEO meta enrichment on the built post page
SEO_CHECKS=(
  'og:image:width:og:image:width'
  'og:image:height:og:image:height'
  'og:image:alt:og:image:alt'
  'twitter:image:alt:twitter:image:alt'
  'rel=.preload.[^>]*as=.image':'LCP preload hint for hero'
  'rel=.alternate.[^>]*type=.application/rss\+xml':'RSS rel=alternate link'
  '"wordCount"':'wordCount in JSON-LD Article'
  '"inLanguage"':'inLanguage in JSON-LD'
  '"dateCreated"':'dateCreated in JSON-LD'
  '"@type":"ImageObject"':'Article image as ImageObject'
)
for spec in "${SEO_CHECKS[@]}"; do
  pattern="${spec%%:*}"
  label="${spec#*:}"
  if grep -qE "$pattern" "$POST_HTML"; then
    ok "$label present on post page"
  else
    fail "$label MISSING on post page"
  fi
done

# v0.3.18: CollectionPage JSON-LD on /blog/ index
INDEX_HTML="$TEST_SITE/dist/index.html"
if grep -q '"@type":"CollectionPage"' "$INDEX_HTML"; then
  ok "/blog/ index emits CollectionPage JSON-LD"
else
  fail "/blog/ index MISSING CollectionPage JSON-LD"
fi
if grep -qE 'rel=.alternate.[^>]*type=.application/rss\+xml' "$INDEX_HTML"; then
  ok "/blog/ index emits RSS rel=alternate"
else
  fail "/blog/ index MISSING RSS rel=alternate"
fi

# v0.3.19: image dimension autodetect — demo-hero.svg has viewBox="0 0 1600 900"
# so the probed width/height should be 1600/900, NOT the engine default 1200/675.
# Check the Article JSON-LD ImageObject and the og:image:width meta to confirm.
if grep -qE '"width":1600,"height":900' "$POST_HTML"; then
  ok "Image dimensions auto-probed from SVG viewBox (1600x900 not engine default)"
else
  fail "Image dimension autodetect failed (SVG viewBox not honoured)"
fi
if grep -q 'property="og:image:width" content="1600"' "$POST_HTML"; then
  ok "og:image:width reflects autodetected dimensions (1600)"
else
  fail "og:image:width does not reflect autodetected dimensions"
fi

# v0.3.19: E-E-A-T author Person schema in Article JSON-LD.
# hello-world.mdx is authored by `rick` whose JSON has knowsAbout/jobTitle/
# sameAs-buildable fields. Verify the rich Person fields make it into JSON-LD.
if grep -q '"knowsAbout"' "$POST_HTML"; then
  ok "Article author JSON-LD includes E-E-A-T knowsAbout array"
else
  fail "Article author JSON-LD MISSING knowsAbout (E-E-A-T not flowing)"
fi
if grep -q '"jobTitle"' "$POST_HTML"; then
  ok "Article author JSON-LD includes jobTitle"
else
  fail "Article author JSON-LD MISSING jobTitle"
fi
if grep -q '"sameAs"' "$POST_HTML"; then
  ok "Article author JSON-LD includes sameAs[] from twitter/github/website"
else
  fail "Article author JSON-LD MISSING sameAs"
fi
if grep -qE 'inlineStylesheets|<style>' "$POST_HTML"; then
  ok "Inline-stylesheets active (some CSS in <style> blocks)"
fi

# v0.4.0: ClientRouter on post pages (view transitions across all page types)
if grep -q 'astro-route-announcer' "$POST_HTML"; then
  ok "Post page emits ClientRouter (view transitions enabled)"
else
  fail "Post page MISSING ClientRouter — view transitions only on listings"
fi

# v0.4.1: GEO Schema.org fields on Article (abstract, about, mentions,
# copyrightHolder, isAccessibleForFree, license).
if grep -q '"abstract":' "$POST_HTML"; then
  ok "Article JSON-LD includes abstract (GEO quotable summary)"
else
  fail "Article JSON-LD MISSING abstract"
fi
if grep -q '"about":\[{"@type":"Thing"' "$POST_HTML"; then
  ok "Article JSON-LD includes about[] Thing entities"
else
  fail "Article JSON-LD MISSING about[] entities"
fi
if grep -q '"mentions":\[{"@type":"Thing"' "$POST_HTML"; then
  ok "Article JSON-LD includes mentions[] Thing entities"
else
  fail "Article JSON-LD MISSING mentions[] entities"
fi
if grep -q '"copyrightHolder":' "$POST_HTML"; then
  ok "Article JSON-LD includes copyrightHolder"
else
  fail "Article JSON-LD MISSING copyrightHolder"
fi
if grep -q '"isAccessibleForFree":true' "$POST_HTML"; then
  ok "Article JSON-LD includes isAccessibleForFree=true default"
else
  fail "Article JSON-LD MISSING isAccessibleForFree"
fi
if grep -q '"license":' "$POST_HTML"; then
  ok "Article JSON-LD includes license URL"
else
  fail "Article JSON-LD MISSING license"
fi

# v0.4.1: site-level schema opt-out flags work — default behaviour emits
# Organization on listings; engine-only flag emits WebSite when set.
if grep -q '"@type":"Organization"' "$INDEX_HTML"; then
  ok "Default emitOrganizationSchema=true: Organization on /blog/ index"
else
  fail "Organization schema missing from /blog/ index"
fi

# v0.4.0: skip-to-content link emitted from engine pages
if grep -q 'href="#shipwreck-main"' "$POST_HTML"; then
  ok "Post page renders skip-to-content link (accessibility)"
else
  fail "Post page MISSING skip-to-content link"
fi
if grep -q 'href="#shipwreck-main"' "$INDEX_HTML"; then
  ok "Index page renders skip-to-content link"
else
  fail "Index page MISSING skip-to-content link"
fi

# v0.3.18: every <img> in built post page has width + height + decoding="async"
TOTAL_IMGS=$(grep -oE '<img\b[^>]*>' "$POST_HTML" | wc -l)
IMGS_WITH_W=$(grep -oE '<img\b[^>]*width=' "$POST_HTML" | wc -l)
IMGS_WITH_H=$(grep -oE '<img\b[^>]*height=' "$POST_HTML" | wc -l)
IMGS_WITH_DEC=$(grep -oE '<img\b[^>]*decoding=' "$POST_HTML" | wc -l)
if [[ $TOTAL_IMGS -gt 0 && $IMGS_WITH_W -eq $TOTAL_IMGS && $IMGS_WITH_H -eq $TOTAL_IMGS ]]; then
  ok "Every <img> on post page has width + height (CLS prevention)"
else
  fail "Post page has $TOTAL_IMGS images; $IMGS_WITH_W with width, $IMGS_WITH_H with height (expected all)"
fi
if [[ $TOTAL_IMGS -gt 0 && $IMGS_WITH_DEC -eq $TOTAL_IMGS ]]; then
  ok "Every <img> on post page has decoding=\"async\""
else
  fail "Only $IMGS_WITH_DEC of $TOTAL_IMGS post-page images have decoding attr"
fi

# v0.3.13: /blog/ index has the filter sidebar + embedded manifest
INDEX_HTML="$TEST_SITE/dist/index.html"
if grep -q 'id="shipwreck-blog-filters"' "$INDEX_HTML"; then
  ok "/blog/ index renders BlogFilters sidebar"
else
  fail "/blog/ index MISSING BlogFilters sidebar"
fi
if grep -q 'id="shipwreck-posts-manifest"' "$INDEX_HTML" && grep -q '"hello-world"' "$INDEX_HTML"; then
  ok "/blog/ index embeds the posts manifest script tag"
else
  fail "/blog/ index MISSING embedded posts manifest"
fi
if grep -q 'id="shipwreck-search"' "$INDEX_HTML"; then
  ok "BlogFilters renders the search input"
else
  fail "BlogFilters MISSING search input"
fi
if grep -q 'data-fallback-image' "$INDEX_HTML"; then
  ok "Grid exposes data-fallback-image for client filter rendering"
else
  fail "Grid MISSING data-fallback-image attribute"
fi
# Paginated index (page/2/) should NOT show the filter sidebar — filters live
# only on /blog/ to keep the static SSR path clean. Only meaningful if pagination
# generated more than 1 page; with 3 demo posts + postsPerPage=10 it's a single
# page, so this assertion is skipped when page/2/ doesn't exist.
if [[ -f "$TEST_SITE/dist/page/2/index.html" ]]; then
  if grep -q 'id="shipwreck-blog-filters"' "$TEST_SITE/dist/page/2/index.html"; then
    fail "Paginated /blog/page/2/ should NOT render BlogFilters sidebar"
  else
    ok "Paginated index correctly omits BlogFilters sidebar"
  fi
fi

# Admin page references the logo
if grep -q "logo_url:" "$TEST_SITE/dist/admin/config.yml"; then
  ok "Admin config has logo_url"
else
  fail "Admin config missing logo_url"
fi

# Cascade-order regression check: consumer's global.css must NOT @import the
# engine's tokens.css. Importing it cascades engine defaults over consumer
# values and breaks Phase 2 work silently. This bit wollongong-weather's
# first integration — never let it back in.
GLOBAL_CSS="$TEST_SITE/src/styles/global.css"
if grep -q '@import.*@shipwreck/blog-theme-default/tokens\.css' "$GLOBAL_CSS"; then
  fail "global.css imports engine tokens.css (cascade-order bug — would override consumer values)"
else
  ok "global.css does not import engine tokens.css (cascade order correct)"
fi

# In the compiled CSS, there should be exactly ONE :root declaration with
# --color-bg (the consumer's value wins). Two :root declarations means the
# engine's tokens.css ALSO leaked into the output and the cascade is wrong.
COLOR_BG_COUNT=$( { grep -oE -- '--color-bg: *[^;]+' "$CSS_FILE" 2>/dev/null || true; } | wc -l)
if [[ "$COLOR_BG_COUNT" -le 1 ]]; then
  ok "Compiled CSS has at most one --color-bg declaration (no cascade-order leak)"
else
  fail "Compiled CSS has $COLOR_BG_COUNT --color-bg declarations — engine defaults are cascading over consumer values"
  grep -oE -- '--color-bg: *[^;]+' "$CSS_FILE"
fi

# ---------- 7. final doctor (full, with build check) ----------

# Re-run doctor with build enabled. Scaffold's site.config still has
# placeholder values + tokens.css + SiteShell are still demo-defaults
# (those are Phase 2/3 of integration, not part of an install test). So we
# expect non-zero fatals here — this run is informational only, to confirm
# doctor's reporting is correct.

DOCTOR_OUT=$(npm run doctor 2>&1 || true)
if echo "$DOCTOR_OUT" | grep -q "site.config.ts placeholder still present"; then
  ok "Doctor correctly flags un-customised site.config.ts (Phase 1 marker)"
else
  fail "Doctor failed to flag placeholder site.config.ts — heuristics may be broken"
fi

if echo "$DOCTOR_OUT" | grep -q "src/styles/tokens.css is MISSING"; then
  ok "Doctor correctly flags missing tokens.css (Phase 2 marker)"
else
  fail "Doctor failed to flag missing tokens.css — Phase 2 detection broken"
fi

if echo "$DOCTOR_OUT" | grep -q "SiteShell/Header.astro is still the engine placeholder"; then
  ok "Doctor correctly flags placeholder SiteShell (Phase 3 marker)"
else
  fail "Doctor failed to flag placeholder SiteShell — Phase 3 detection broken"
fi

if echo "$DOCTOR_OUT" | grep -q "Demo posts still in src/content/posts/"; then
  ok "Doctor correctly flags demo content (Phase 1.5 marker)"
else
  fail "Doctor failed to flag demo content — Phase 1.5 detection broken"
fi

if echo "$DOCTOR_OUT" | grep -q "global.css cascade order is correct"; then
  ok "Doctor confirms global.css cascade order (no engine tokens override)"
else
  fail "Doctor failed to confirm cascade order — check the heuristic"
fi

# Default doctor mode (the closeout gate as of v0.3.6) must require attestations
DEFAULT_OUT=$(npm run doctor -- --skip-build 2>&1 || true)
if echo "$DEFAULT_OUT" | grep -q "Phase 9 not attested"; then
  ok "Default doctor blocks completion without Phase 9 attestation"
else
  fail "Default doctor did NOT enforce Phase 9 attestation"
fi
if echo "$DEFAULT_OUT" | grep -q "Feedback status not attested"; then
  ok "Default doctor blocks completion without feedback attestation"
else
  fail "Default doctor did NOT enforce feedback attestation"
fi
if echo "$DEFAULT_OUT" | grep -q "Phase 7b nav link decision not attested"; then
  ok "Default doctor blocks completion without nav-link attestation"
else
  fail "Default doctor did NOT enforce nav-link attestation"
fi

# --lite mode skips procedural gates (technical only — for development use)
LITE_OUT=$(npm run doctor -- --lite --skip-build 2>&1 || true)
if echo "$LITE_OUT" | grep -q "Phase 9 not attested"; then
  fail "--lite mode incorrectly enforced Phase 9 (should skip procedural gates)"
else
  ok "--lite mode correctly skips procedural gates (technical-only)"
fi

# attest-* subcommands write to state file
TEST_STATE_DIR=$(mktemp -d -t shipwreck-attest-test-XXXX)
cp "$TEST_SITE/node_modules/.bin/shipwreck-blog-doctor" "$TEST_STATE_DIR/" 2>/dev/null || true
cd "$TEST_STATE_DIR"
node "$ENGINE_REPO/packages/blog-core/bin/doctor.mjs" attest-phase9 '{"latest3Callout":"no","rssFooterLink":"no","gscSubmission":"no","crossLinks":"none","sveltiaCMS":"no"}' > /dev/null 2>&1
node "$ENGINE_REPO/packages/blog-core/bin/doctor.mjs" attest-feedback none-needed "Integration test fixture; no real feedback" > /dev/null 2>&1
node "$ENGINE_REPO/packages/blog-core/bin/doctor.mjs" attest-nav-link declined > /dev/null 2>&1
if [[ -f "$TEST_STATE_DIR/.shipwreck-integration-state.json" ]]; then
  ok "attest-* subcommands write to .shipwreck-integration-state.json"
else
  fail "attest-* subcommands did NOT create state file"
fi
# Verify state file has all three attestations
STATE=$(cat "$TEST_STATE_DIR/.shipwreck-integration-state.json")
if echo "$STATE" | grep -q '"asked": true' && \
   echo "$STATE" | grep -q '"status": "none-needed"' && \
   echo "$STATE" | grep -q '"decision": "declined"'; then
  ok "State file contains all three attestations (phase9, feedback, navLink)"
else
  fail "State file missing expected attestations"
fi
rm -rf "$TEST_STATE_DIR"
cd "$TEST_SITE"

# ---------- v0.3.11: heroes.policy enforcement ----------
# Default policy is "required" — every published post must have featuredImage.
# Demo posts ship with featuredImage now, so --lite should NOT flag missing heroes.
LITE_HEROES_OUT=$(npm run doctor -- --lite --skip-build 2>&1 || true)
if echo "$LITE_HEROES_OUT" | grep -q "Every published post has a featuredImage"; then
  ok "Doctor passes heroes check when every published post has featuredImage"
else
  fail "Doctor did not confirm heroes present on demo posts (heroes check broken)"
fi

# Negative test: write a post with no featuredImage and assert doctor flags it.
TEST_NO_HERO="$TEST_SITE/src/content/posts/no-hero-test.mdx"
cat > "$TEST_NO_HERO" <<'MDX'
---
title: "Post without a hero"
publishDate: 2026-05-12
status: "published"
author: "rick"
category: "test"
tags: ["test"]
---

Body.
MDX
NEG_OUT=$(npm run doctor -- --lite --skip-build 2>&1 || true)
if echo "$NEG_OUT" | grep -q "Published posts missing featuredImage"; then
  ok "Doctor fails heroes check when a published post lacks featuredImage"
else
  fail "Doctor did NOT flag post lacking featuredImage (heroes policy not enforcing)"
fi
rm -f "$TEST_NO_HERO"

# heroes subcommand emits machine-readable JSON
# (write the no-hero post back briefly to verify the subcommand reports it)
cat > "$TEST_NO_HERO" <<'MDX'
---
title: "Post without a hero"
publishDate: 2026-05-12
status: "published"
author: "rick"
category: "test"
tags: ["test"]
---

Body.
MDX
HEROES_JSON=$(node "$ENGINE_REPO/packages/blog-core/bin/doctor.mjs" heroes --json 2>&1 || true)
if echo "$HEROES_JSON" | grep -q '"slug": "no-hero-test"'; then
  ok "Doctor heroes --json subcommand reports missing-hero posts"
else
  fail "Doctor heroes --json did not include missing-hero post"
fi
rm -f "$TEST_NO_HERO"

# ---------- summary ----------

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo
echo "=== summary ==="
echo "  $PASS_COUNT/$TOTAL checks passed"

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "  $FAIL_COUNT FAILED"
  echo
  echo "Installation flow has a regression. Fix before merging."
  exit 1
fi

echo
echo "✓ Integration acceptance test passed."
echo "  Clean tree → sibling install → build → doctor preflight → dist verification: all green."
echo "  Phase 2/3 markers correctly detected by doctor (these would be done during real integration)."
