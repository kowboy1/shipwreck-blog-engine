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

REQUIRED_CLASSES=(max-w-7xl max-w-3xl text-4xl font-heading not-prose 'lg\\:hidden')
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

# Sitemap is non-empty + lists posts
SITEMAP="$TEST_SITE/dist/sitemap-0.xml"
if [[ -f "$SITEMAP" ]] && grep -q "hello-world" "$SITEMAP"; then
  ok "Sitemap lists post URLs"
else
  fail "Sitemap missing or doesn't list posts"
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

# --final gate must require Phase 9 + feedback flags
FINAL_OUT=$(npm run doctor -- --final --skip-build 2>&1 || true)
if echo "$FINAL_OUT" | grep -q "Phase 9 questions not confirmed"; then
  ok "Doctor --final correctly blocks completion without --phase9-confirmed"
else
  fail "Doctor --final did NOT enforce --phase9-confirmed flag"
fi
if echo "$FINAL_OUT" | grep -q "Feedback status not declared"; then
  ok "Doctor --final correctly blocks completion without --feedback-status"
else
  fail "Doctor --final did NOT enforce --feedback-status flag"
fi

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
