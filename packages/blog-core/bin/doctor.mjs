#!/usr/bin/env node
/**
 * shipwreck-blog-doctor — preflight + post-install integration checker.
 *
 * Runs from the consumer per-site repo's `_blog/` (or root if no `_blog/` subdir).
 * Fails fast with clear, actionable messages if anything that would break a real
 * integration is wrong. Designed to be the FIRST and LAST thing an agent runs:
 *
 *   - Right after `npm install` to catch broken file: deps before building
 *   - Right before declaring "done" to catch skipped phases of the integration skill
 *
 * Exit code 0 = all checks passed. Non-zero = at least one fatal issue.
 *
 * Usage:
 *   npx shipwreck-blog-doctor                  # all checks (install + integration), fatal on fail
 *   npx shipwreck-blog-doctor --preflight      # install-level only (engine resolves, file: deps OK)
 *   npx shipwreck-blog-doctor --skip-build     # skip the build check (faster)
 *   npx shipwreck-blog-doctor --json           # machine-readable output
 *   npx shipwreck-blog-doctor --final \        # strictest mode: declare integration done
 *     --phase9-confirmed \                     #   require Phase 9 questions asked
 *     --feedback-status=provided               #   require feedback file OR
 *     # OR --feedback-status=none-needed       #   explicit no-feedback declaration
 *
 * Mode summary:
 *   --preflight   = run RIGHT AFTER npm install. Skips Phase 2/3/build checks.
 *                   Catches install-time bugs (broken symlinks, scaffold corruption).
 *   (default)     = run BEFORE the final completion check. Includes install +
 *                   Phase 2/3 checks (tokens.css present, SiteShell ported,
 *                   global.css cascade order, no demo content) + build + CSS sanity.
 *   --final       = the gate for declaring integration DONE. Default checks PLUS
 *                   requires --phase9-confirmed and --feedback-status=<provided|none-needed>.
 *                   You cannot reach 0 fatal in --final mode without explicitly
 *                   confirming you completed the end-of-job protocol.
 */
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { execSync } from "node:child_process"
import process from "node:process"

const argv = process.argv.slice(2)
const args = new Set(argv)
const PREFLIGHT = args.has("--preflight")
const SKIP_BUILD = args.has("--skip-build") || PREFLIGHT
const JSON_OUT = args.has("--json")
const FINAL = args.has("--final") // strictest mode: requires Phase 9 + feedback flags
const PHASE9_CONFIRMED = args.has("--phase9-confirmed")
// --feedback-status=<provided|none-needed>
const feedbackArg = argv.find((a) => a.startsWith("--feedback-status="))
const FEEDBACK_STATUS = feedbackArg ? feedbackArg.split("=")[1] : null
const CWD = process.cwd()

const checks = []
const fatal = []
const warn = []

function pass(name, detail = "") { checks.push({ name, status: "pass", detail }) }
function fail(name, detail) { checks.push({ name, status: "fail", detail }); fatal.push(name) }
function warning(name, detail) { checks.push({ name, status: "warn", detail }); warn.push(name) }

// Resolve a package.json by walking up parent dirs (matches Node's algorithm).
// Returns { path, hoisted } or null if not found.
function resolvePackageJson(pkg, fromDir) {
  let dir = fromDir
  while (true) {
    const candidate = join(dir, "node_modules", pkg, "package.json")
    if (existsSync(candidate)) {
      return { path: candidate, hoisted: dir !== fromDir }
    }
    const parent = resolve(dir, "..")
    if (parent === dir) return null
    dir = parent
  }
}

// 1. Engine packages resolve (file: deps not broken — walking up parent
// dirs to handle npm workspace hoisting)
for (const pkg of ["@shipwreck/blog-core", "@shipwreck/blog-theme-default"]) {
  const found = resolvePackageJson(pkg, CWD)
  if (!found) {
    fail(
      `Engine package '${pkg}' is unreachable`,
      `Searched all parent dirs from ${CWD} for node_modules/${pkg}/package.json — none found.\n` +
        `Cause: file: dep symlink is probably broken (wrong number of '../' in package.json file: spec).\n` +
        `Fix: open package.json, find the '${pkg}' line, adjust the relative path until 'ls node_modules/${pkg}/package.json' (or any parent dir's) shows a real file, then re-run 'npm install'.`,
    )
  } else {
    try {
      const v = JSON.parse(readFileSync(found.path, "utf8")).version
      const note = found.hoisted ? " (hoisted to a parent node_modules — fine in monorepo)" : ""
      pass(`Engine package '${pkg}' resolves`, `version ${v}${note}`)
    } catch (e) {
      fail(`Engine package '${pkg}' has unreadable package.json`, e.message)
    }
  }
}

// 2. site.config.ts exists and has been edited beyond the demo defaults
const siteConfigPath = ["site.config.ts", "_blog/site.config.ts", "../site.config.ts"]
  .map((p) => resolve(CWD, p))
  .find((p) => existsSync(p))
if (!siteConfigPath) {
  fail(
    "site.config.ts missing",
    `Looked in: site.config.ts, _blog/site.config.ts, ../site.config.ts (relative to ${CWD}). ` +
      `Phase 1 of the integration skill produces this file by copying the demo-site.`,
  )
} else {
  pass("site.config.ts found", siteConfigPath.replace(CWD, "."))
  const content = readFileSync(siteConfigPath, "utf8")
  // Heuristic — placeholder values that mean Phase 1 wasn't actually customised
  const placeholders = [
    [/siteName:\s*"My Site"/, "siteName is still 'My Site' (demo default)"],
    [/baseUrl:\s*"https:\/\/example\.com"/, "baseUrl is still 'https://example.com' (demo default)"],
    [/logoUrl:\s*"\/logo\.svg"/, "brand.logoUrl is still '/logo.svg' (demo placeholder — host probably has a different logo)"],
    [/defaultOgImage:\s*"\/og-default\.jpg"/, "seo.defaultOgImage is still '/og-default.jpg' (demo placeholder)"],
    [/defaultAuthorAvatar:\s*"\/og-default\.jpg"/, "seo.defaultAuthorAvatar is set to og-default.jpg — that's wrong (it's the OG image, not an avatar)"],
    [/default:\s*"book-consult"/, "ctaBlocks.default is still 'book-consult' (demo CTA — irrelevant if the host site isn't a consulting business)"],
  ]
  for (const [pattern, msg] of placeholders) {
    if (pattern.test(content)) warning("site.config.ts placeholder still present", msg)
  }
}

// Skip Phase 2/3 checks in preflight mode (those are integration-time concerns,
// not install-time concerns)
if (!PREFLIGHT) {

// 3. tokens.css exists and has been customised (Phase 2)
const tokensPath = ["src/styles/tokens.css", "_blog/src/styles/tokens.css"]
  .map((p) => resolve(CWD, p))
  .find((p) => existsSync(p))
if (!tokensPath) {
  fail(
    "src/styles/tokens.css is MISSING",
    "Phase 2 of the integration skill produces this file. Without it, the blog uses engine defaults (system-ui font, neutral colours) " +
      "and won't visually match the host. Run Phase 2 before declaring done. See packages/blog-theme-default/TOKEN-CONTRACT.md.",
  )
} else {
  pass("tokens.css found", tokensPath.replace(CWD, "."))
}

// 4. SiteShell Header has been ported (not the demo placeholder)
const headerPath = ["src/components/SiteShell/Header.astro", "_blog/src/components/SiteShell/Header.astro"]
  .map((p) => resolve(CWD, p))
  .find((p) => existsSync(p))
if (!headerPath) {
  warning(
    "SiteShell/Header.astro missing",
    "Most integrations need a custom header that matches the host. If the host has no header (rare), you can skip this.",
  )
} else {
  const headerContent = readFileSync(headerPath, "utf8")
  if (headerContent.includes("Replace this with the host site's header markup")) {
    fail(
      "SiteShell/Header.astro is still the engine placeholder",
      `Phase 3 of the integration skill ports the host's actual header into ${headerPath.replace(CWD, ".")}. ` +
        `The placeholder shows generic 'Home / Blog' nav and won't match the host site. Port the host's header before declaring done.`,
    )
  } else {
    pass("SiteShell/Header.astro has been customised")
  }
}

// 5. Same for Footer
const footerPath = ["src/components/SiteShell/Footer.astro", "_blog/src/components/SiteShell/Footer.astro"]
  .map((p) => resolve(CWD, p))
  .find((p) => existsSync(p))
if (footerPath) {
  const footerContent = readFileSync(footerPath, "utf8")
  if (footerContent.includes("Replace this with the host site's footer")) {
    fail(
      "SiteShell/Footer.astro is still the engine placeholder",
      `Phase 3: port the host's actual footer.`,
    )
  } else {
    pass("SiteShell/Footer.astro has been customised")
  }
}

} // end !PREFLIGHT block (Phase 2/3 checks)

// 5b. Cascade-order check: consumer's `global.css` must NOT @import the engine's
// tokens.css. Importing it cascades engine defaults OVER the consumer's
// carefully-extracted host values, silently undoing Phase 2 work.
// (This is the bug that broke wollongong-weather's first integration.)
const globalCssCandidates = ["src/styles/global.css", "_blog/src/styles/global.css"]
  .map((p) => resolve(CWD, p))
  .filter((p) => existsSync(p))
for (const cssPath of globalCssCandidates) {
  const c = readFileSync(cssPath, "utf8")
  if (/@import\s+["'].*@shipwreck\/blog-theme-default\/tokens\.css/.test(c)) {
    fail(
      "global.css imports the engine's tokens.css",
      `${cssPath.replace(CWD, ".")} contains '@import "@shipwreck/blog-theme-default/tokens.css"'. ` +
        `This cascades the engine's default values OVER your consumer tokens.css and reverts the theme to engine defaults. ` +
        `Fix: remove that @import line. Your src/styles/tokens.css is the canonical source — fallbacks are handled by the Tailwind preset's var(--color-X, #default) syntax.`,
    )
  } else {
    pass("global.css cascade order is correct (no engine tokens override)")
  }
}

// 5c. Demo content detection: a real integration must NOT ship the demo posts.
// Skipped in preflight (preflight = install only; demo content cleanup is
// Phase 1.5 of integration, not part of installing the scaffold).
if (!PREFLIGHT) {
  const postsCandidates = ["src/content/posts", "_blog/src/content/posts"]
    .map((p) => resolve(CWD, p))
    .filter((p) => existsSync(p))
  const DEMO_POST_SLUGS = ["hello-world.mdx", "seo-checklist.mdx", "why-not-wordpress.mdx"]
  for (const postsDir of postsCandidates) {
    const present = readdirSync(postsDir).filter((f) => DEMO_POST_SLUGS.includes(f))
    if (present.length > 0) {
      fail(
        "Demo posts still in src/content/posts/",
        `Found: ${present.join(", ")}. These ship with the engine demo as boilerplate; a real integration must replace them with site-specific content (or empty the dir). Delete them, then add at least one real post for the host site OR explicitly mark the site as "no posts yet" by leaving content/posts/ empty (just the dir, no .mdx files).`,
      )
    } else {
      pass("No demo content in src/content/posts/")
    }
  }

  const authorsCandidates = ["src/content/authors", "_blog/src/content/authors"]
    .map((p) => resolve(CWD, p))
    .filter((p) => existsSync(p))
  for (const authorsDir of authorsCandidates) {
    for (const file of ["jane.json"]) {
      const path = join(authorsDir, file)
      if (existsSync(path)) {
        try {
          const a = JSON.parse(readFileSync(path, "utf8"))
          if (a.name === "Jane Doe" || a.name === "Demo Author") {
            warning(
              "Demo author 'jane.json' still has demo defaults",
              `${path.replace(CWD, ".")} — replace with a real author or remove the file.`,
            )
          }
        } catch { /* ignore */ }
      }
    }
  }
}

// 6. Source-vs-deploy layout guardrail (Nyxi feedback #6)
// The blog SOURCE repo should not be the same dir as the host's static MOUNT path.
// If you accidentally point your blog source at the host's docroot, you'll
// overwrite the host with the blog dist on next build.
const distPath = resolve(CWD, "dist")
const parentBlogPath = resolve(CWD, "..", "blog")
if (existsSync(distPath) && existsSync(parentBlogPath)) {
  try {
    const distFiles = readdirSync(distPath)
    const parentBlogFiles = readdirSync(parentBlogPath)
    if (
      distFiles.includes("index.html") &&
      parentBlogFiles.includes("index.html") &&
      readFileSync(join(distPath, "index.html"), "utf8") === readFileSync(join(parentBlogPath, "index.html"), "utf8")
    ) {
      pass("Source vs deploy layout looks separate", "dist/ and ../blog/ have matching index.html — typical sibling-mount pattern")
    }
  } catch {
    // ignore — non-blocking
  }
}

// 7. Build still works (skip with --skip-build)
if (!SKIP_BUILD) {
  try {
    execSync("npm run build", { stdio: "pipe", cwd: CWD })
    pass("npm run build succeeds")
  } catch (e) {
    fail("npm run build FAILS", e.stderr?.toString().slice(-500) ?? e.message)
  }

  // 8. Built CSS contains key utility classes (catches the v0.3.1-style preset-content bug)
  const distCssDir = resolve(CWD, "dist/_astro")
  if (existsSync(distCssDir)) {
    const cssFiles = readdirSync(distCssDir).filter((f) => f.endsWith(".css"))
    if (cssFiles.length === 0) {
      fail("Built dist has no CSS files", `Expected at least one .css under ${distCssDir}`)
    } else {
      const allCss = cssFiles.map((f) => readFileSync(join(distCssDir, f), "utf8")).join("\n")
      const expected = ["max-w-7xl", "max-w-3xl", "text-4xl", "font-heading", "lg\\:hidden", "hidden", "not-prose"]
      const missing = expected.filter((cls) => !allCss.includes(cls))
      if (missing.length > 0) {
        fail(
          "Built CSS is missing engine page-level utility classes",
          `Missing: ${missing.join(", ")}. ` +
            `Cause: the Tailwind preset's content path can't see the engine's pages/ dir — ` +
            `usually because file: deps are broken (check #1 above) so node_modules/@shipwreck/blog-core can't be scanned.`,
        )
      } else {
        pass("Built CSS contains all engine utility classes", `${cssFiles.length} CSS file(s)`)
      }
    }
  }
}

// 9. FINAL-MODE gates: Phase 9 confirmation + feedback declaration
// These flags are how the agent confirms they've completed the protocol.
// Without them, --final cannot pass.
if (FINAL) {
  if (!PHASE9_CONFIRMED) {
    fail(
      "Phase 9 questions not confirmed",
      "You ran --final without --phase9-confirmed. The integration skill's Phase 9 requires asking the user about: latest-3 callout, RSS link, GSC submission, cross-link plan, Sveltia CMS enablement. " +
        "Pass --phase9-confirmed only AFTER you have asked every question and acted on or logged the answer. Do not pass this flag if you skipped Phase 9.",
    )
  } else {
    pass("Phase 9 questions confirmed (--phase9-confirmed flag passed)")
  }

  if (FEEDBACK_STATUS === "provided") {
    // Find the FEEDBACK file
    const candidates = readdirSync(CWD).filter((f) => f.startsWith("FEEDBACK-FOR-CLAUDE-") && f.endsWith(".md"))
    // Also check engine repo root if we can find it
    const enginePkg = resolvePackageJson("@shipwreck/blog-core", CWD)
    let engineRoot = null
    if (enginePkg) {
      // walk up from package.json: .../packages/blog-core/package.json -> .../
      engineRoot = resolve(enginePkg.path, "..", "..", "..")
    }
    const engineCandidates = engineRoot && existsSync(engineRoot)
      ? readdirSync(engineRoot).filter((f) => f.startsWith("FEEDBACK-FOR-CLAUDE-") && f.endsWith(".md"))
      : []

    if (candidates.length === 0 && engineCandidates.length === 0) {
      fail(
        "Feedback status is 'provided' but no FEEDBACK-FOR-CLAUDE-*.md found",
        `Searched ${CWD} and ${engineRoot ?? "(engine root not located)"}. ` +
          `Either write the feedback file, OR pass --feedback-status=none-needed.`,
      )
    } else {
      pass(
        "Feedback file present",
        [...candidates.map((f) => `${CWD}/${f}`), ...engineCandidates.map((f) => `${engineRoot}/${f}`)].join(", "),
      )
    }
  } else if (FEEDBACK_STATUS === "none-needed") {
    pass("Feedback status: none needed (declared explicitly)")
  } else {
    fail(
      "Feedback status not declared",
      "You ran --final without --feedback-status=provided or --feedback-status=none-needed. The skill requires you to either write a FEEDBACK-FOR-CLAUDE-<job>.md OR explicitly declare 'no engine feedback this run'. Pick one.",
    )
  }
}

// Output
if (JSON_OUT) {
  console.log(JSON.stringify({ checks, fatal: fatal.length, warn: warn.length }, null, 2))
} else {
  console.log("\nshipwreck-blog-doctor results:\n")
  for (const c of checks) {
    const icon = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "⚠"
    console.log(`  ${icon} ${c.name}`)
    if (c.detail) console.log(`    ${c.detail.split("\n").join("\n    ")}`)
  }
  console.log("")
  if (fatal.length > 0) {
    console.log(`\n  ✗ ${fatal.length} fatal issue(s). Fix these before declaring the integration done.\n`)
  } else if (warn.length > 0) {
    console.log(`\n  ⚠ ${warn.length} warning(s). Review — may indicate skipped phases.\n`)
  } else {
    console.log("\n  ✓ All checks passed.\n")
  }
}

process.exit(fatal.length > 0 ? 1 : 0)
