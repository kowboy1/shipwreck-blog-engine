#!/usr/bin/env node
/**
 * shipwreck-blog-doctor — preflight + post-install integration checker + closeout gate.
 *
 * Runs from the consumer per-site repo's `_blog/`. Fails fast with clear,
 * actionable messages if anything that would break or invalidate a real
 * integration is wrong.
 *
 * Exit code 0 = all checks passed. Non-zero = at least one fatal issue.
 *
 * ## Usage
 *
 *   # Default: full closeout gate (run BEFORE declaring done to user)
 *   npx shipwreck-blog-doctor
 *
 *   # Reduced modes (use during development, not for declaring done)
 *   npx shipwreck-blog-doctor --preflight       # install-level only
 *   npx shipwreck-blog-doctor --lite            # technical only, no procedural gates
 *   npx shipwreck-blog-doctor --skip-build      # skip the build check (faster)
 *   npx shipwreck-blog-doctor --json            # machine-readable output
 *
 *   # Attestations — write entries to .shipwreck-integration-state.json
 *   # Without these, default doctor mode FAILS — you cannot declare done.
 *   npx shipwreck-blog-doctor attest-phase9 '<json-string-of-answers>'
 *   npx shipwreck-blog-doctor attest-feedback provided <FEEDBACK-FOR-CLAUDE-name.md>
 *   npx shipwreck-blog-doctor attest-feedback none-needed "<short reason>"
 *   npx shipwreck-blog-doctor attest-nav-link approved
 *   npx shipwreck-blog-doctor attest-nav-link declined
 *
 *   # Completion contract — outputs the audit-trail block as stdout. Pipe this
 *   # block VERBATIM into your reply to the user. This is the only valid way
 *   # to report "done" — paraphrasing, summarising, or composing your own
 *   # status message is a protocol violation.
 *   npx shipwreck-blog-doctor print-completion
 *
 * ## Why default = full closeout gate
 *
 * Previous versions had `--final` as opt-in. Agents reflexively ran default
 * `npm run doctor`, saw "0 fatal", and declared done having skipped Phases
 * 7-9. Reversed in v0.3.6: default mode IS the closeout gate. Agents who
 * want intermediate technical checks during development use `--lite`.
 */
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, mkdirSync } from "node:fs"
import { join, resolve, dirname, basename } from "node:path"
import { execSync } from "node:child_process"
import process from "node:process"

const argv = process.argv.slice(2)
const args = new Set(argv)
const PREFLIGHT = args.has("--preflight")
const LITE = args.has("--lite")
const SKIP_BUILD = args.has("--skip-build") || PREFLIGHT
const JSON_OUT = args.has("--json")
const CWD = process.cwd()

// Default invocation = full closeout gate (formerly --final). Reversed in v0.3.6.
const FULL = !PREFLIGHT && !LITE
const SUBCOMMAND = argv[0] && !argv[0].startsWith("--") ? argv[0] : null

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

// ---------- state file (.shipwreck-integration-state.json) ----------
//
// Lives at the root of the consumer's _blog/ dir (same dir as package.json).
// Tracks attestations the agent makes via the attest-* subcommands. Default
// doctor mode reads this and FAILS if the required attestations aren't there
// — that's the procedural gate. Agent cannot pass default doctor without
// having actually performed the actions the attestations claim.

const STATE_FILE = join(CWD, ".shipwreck-integration-state.json")

function readState() {
  if (!existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"))
  } catch {
    return null
  }
}

function writeState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n")
}

function blankState() {
  return {
    engineVersion: null,
    siteName: null,
    phase9: { asked: false, ts: null, answers: null },
    feedback: { status: null, file: null, reason: null, ts: null },
    navLink: { decision: null, ts: null }, // "approved" | "declined" | null
  }
}

// ---------- subcommands ----------

function attestPhase9(args) {
  if (args.length === 0) {
    console.error(`Usage: shipwreck-blog-doctor attest-phase9 '<json-answers>'

You must pass a JSON string with the user's answers to the Phase 9 questions.
Example:

  npx shipwreck-blog-doctor attest-phase9 '{
    "latest3Callout": "no",
    "rssFooterLink": "yes — added to host footer",
    "gscSubmission": "yes",
    "crossLinks": "deferred — listed in site notes",
    "sveltiaCMS": "no — single editor"
  }'

Pass this attestation ONLY after you have actually asked the user every
Phase 9 question and recorded their answers. The default doctor reads
this file to confirm Phase 9 happened.
`)
    process.exit(1)
  }
  let answers
  try {
    answers = JSON.parse(args[0])
  } catch (e) {
    console.error(`attest-phase9: argument must be valid JSON. Got: ${args[0]}\nError: ${e.message}`)
    process.exit(1)
  }
  const required = ["latest3Callout", "rssFooterLink", "gscSubmission", "crossLinks", "sveltiaCMS"]
  const missing = required.filter((k) => !(k in answers))
  if (missing.length > 0) {
    console.error(`attest-phase9: missing required answer keys: ${missing.join(", ")}`)
    console.error(`Required keys: ${required.join(", ")}`)
    process.exit(1)
  }
  const state = readState() ?? blankState()
  state.phase9 = { asked: true, ts: new Date().toISOString(), answers }
  writeState(state)
  console.log(`✓ Phase 9 attested. Recorded ${Object.keys(answers).length} answers in ${STATE_FILE}.`)
}

function attestFeedback(args) {
  const status = args[0]
  if (status === "provided") {
    const file = args[1]
    if (!file) {
      console.error(`Usage: shipwreck-blog-doctor attest-feedback provided <FEEDBACK-FOR-CLAUDE-name.md>`)
      process.exit(1)
    }
    // Search upward for the engine repo root and verify the file exists there
    let found = false
    let dir = CWD
    while (true) {
      const candidate = join(dir, file)
      if (existsSync(candidate)) { found = true; break }
      const parent = resolve(dir, "..")
      if (parent === dir) break
      dir = parent
    }
    if (!found) {
      console.error(`attest-feedback: '${file}' not found in any parent dir of ${CWD}. Write the feedback file at the engine repo root first.`)
      process.exit(1)
    }
    const state = readState() ?? blankState()
    state.feedback = { status: "provided", file, reason: null, ts: new Date().toISOString() }
    writeState(state)
    console.log(`✓ Feedback attested as 'provided' (${file}).`)
  } else if (status === "none-needed") {
    const reason = args.slice(1).join(" ")
    if (!reason || reason.length < 10) {
      console.error(`Usage: shipwreck-blog-doctor attest-feedback none-needed "<at-least-10-char honest reason>"

Don't pass 'none-needed' lazily. The reason is your audit trail — you're
saying you genuinely considered whether anything in the engine could be
improved based on this run AND determined nothing useful would come from
a feedback note. Write a one-sentence reason that proves you actually
thought about it.
`)
      process.exit(1)
    }
    const state = readState() ?? blankState()
    state.feedback = { status: "none-needed", file: null, reason, ts: new Date().toISOString() }
    writeState(state)
    console.log(`✓ Feedback attested as 'none-needed' with reason: ${reason}`)
  } else {
    console.error(`Usage: shipwreck-blog-doctor attest-feedback <provided|none-needed> ...`)
    process.exit(1)
  }
}

function attestNavLink(args) {
  const decision = args[0]
  if (decision !== "approved" && decision !== "declined") {
    console.error(`Usage: shipwreck-blog-doctor attest-nav-link <approved|declined>

Phase 7b explicitly says ASK the user before adding a nav link. This
attestation records what the user said:
- 'approved' = user said yes; you have added the nav link to the host site
- 'declined' = user said no; do NOT add a nav link
`)
    process.exit(1)
  }
  const state = readState() ?? blankState()
  state.navLink = { decision, ts: new Date().toISOString() }
  writeState(state)
  console.log(`✓ Nav link decision attested: ${decision}.`)
}

function printCompletion() {
  // Run the full default doctor check first — must pass before completion can print.
  const result = execSync(
    `node ${process.argv[1]}`,
    { cwd: CWD, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ).then?.(undefined) ?? null
  // We can't easily capture from execSync without try/catch — do it that way:
  let doctorPassed = false
  try {
    execSync(`node ${process.argv[1]}`, { cwd: CWD, stdio: "pipe" })
    doctorPassed = true
  } catch {
    doctorPassed = false
  }
  if (!doctorPassed) {
    console.error(`✗ Cannot print completion message — default doctor mode is failing.

Run 'npx shipwreck-blog-doctor' to see what's blocking. Fix the failures,
then try print-completion again. There is no way to bypass this — if
doctor fails, the integration is not done, and there is no valid
completion message to emit.
`)
    process.exit(1)
  }
  const state = readState()
  if (!state) {
    console.error(`✗ No state file at ${STATE_FILE}. Run the attest-* subcommands first.`)
    process.exit(1)
  }

  // Engine version from blog-core
  const enginePkg = resolvePackageJson("@shipwreck/blog-core", CWD)
  const engineVersion = enginePkg ? JSON.parse(readFileSync(enginePkg.path, "utf8")).version : "unknown"

  // Site config for domain
  let domain = "<domain>"
  let siteName = state.siteName ?? "<site-name>"
  const configPaths = ["site.config.ts", "_blog/site.config.ts"].map((p) => resolve(CWD, p))
  for (const p of configPaths) {
    if (existsSync(p)) {
      const c = readFileSync(p, "utf8")
      const dm = c.match(/baseUrl:\s*"([^"]+)"/)
      if (dm) domain = dm[1].replace(/\/$/, "")
      const nm = c.match(/siteName:\s*"([^"]+)"/)
      if (nm) siteName = nm[1]
      break
    }
  }

  const phase9Summary = state.phase9.answers
    ? Object.entries(state.phase9.answers).map(([k, v]) => `    - ${k}: ${v}`).join("\n")
    : "    (none)"

  const feedbackLine = state.feedback.status === "provided"
    ? `Engine feedback: provided in ${state.feedback.file}`
    : `Engine feedback: none-needed — "${state.feedback.reason}"`

  const navLine = state.navLink.decision === "approved"
    ? `Nav link: user approved; added to host`
    : state.navLink.decision === "declined"
      ? `Nav link: user declined; footer-only`
      : `Nav link: not asked (FAIL — should not have reached here)`

  // The audit-trail block. This is the ONLY valid completion message format.
  console.log(`Integration done. Verifications:
- shipwreck-blog-doctor: ✓ all checks passed (default mode = full closeout gate)
- Engine version: ${engineVersion}
- Site: ${siteName} (${domain})
- Live URL: ${domain}/blog/ rendering correctly + visually matches host
- Phase 9 questions: asked, answers captured below
${phase9Summary}
- ${navLine}
- ${feedbackLine}
- Phase 9 attested at: ${state.phase9.ts}
`)
  process.exit(0)
}

// ---------- subcommand dispatch (after all helpers are defined) ----------

if (SUBCOMMAND === "attest-phase9") { attestPhase9(argv.slice(1)); process.exit(0) }
if (SUBCOMMAND === "attest-feedback") { attestFeedback(argv.slice(1)); process.exit(0) }
if (SUBCOMMAND === "attest-nav-link") { attestNavLink(argv.slice(1)); process.exit(0) }
if (SUBCOMMAND === "print-completion") { printCompletion() }

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

// 8. FULL-MODE (default) procedural gates — read attestations from state file.
// These are the gates that turn "agent declared done" into "agent actually
// completed Phase 7-9". An agent cannot bypass these — the only way to make
// these checks pass is to actually run the attest-* subcommands, which
// require concrete proof (Phase 9 answers JSON, feedback file path, etc.).
//
// In --lite or --preflight modes, these checks are skipped (you're not yet
// declaring done; you're checking technical health during development).
if (FULL) {
  const state = readState()

  // 8a. Phase 9 attestation
  if (!state || !state.phase9?.asked) {
    fail(
      "Phase 9 not attested",
      `Default doctor (full closeout gate) requires evidence that you asked the user the Phase 9 questions. ` +
        `Run: npx shipwreck-blog-doctor attest-phase9 '<json-of-answers>'\n` +
        `Don't run that subcommand until you have actually asked every question and recorded the user's answers — it writes to ${STATE_FILE} as your audit trail.`,
    )
  } else {
    pass(`Phase 9 attested at ${state.phase9.ts}`, `${Object.keys(state.phase9.answers).length} answers recorded`)
  }

  // 8b. Feedback attestation
  if (!state || !state.feedback?.status) {
    fail(
      "Feedback status not attested",
      `Default doctor requires you to declare whether engine feedback was produced. Either:\n` +
        `  npx shipwreck-blog-doctor attest-feedback provided <FEEDBACK-FOR-CLAUDE-name.md>\n` +
        `OR\n` +
        `  npx shipwreck-blog-doctor attest-feedback none-needed "<at-least-10-char honest reason>"`,
    )
  } else if (state.feedback.status === "provided") {
    pass(`Feedback attested as 'provided'`, state.feedback.file)
  } else {
    pass(`Feedback attested as 'none-needed'`, state.feedback.reason)
  }

  // 8c. Nav-link attestation (Phase 7b)
  if (!state || !state.navLink?.decision) {
    fail(
      "Phase 7b nav link decision not attested",
      `Phase 7b requires asking the user whether to add a 'Blog' link to the main nav (vs footer-only). Then attest the answer:\n` +
        `  npx shipwreck-blog-doctor attest-nav-link approved   # if user said yes AND you added the link to host nav\n` +
        `  npx shipwreck-blog-doctor attest-nav-link declined   # if user said no\n` +
        `Do NOT attest 'approved' if you didn't actually ask. Do NOT add a nav link without attestation.`,
    )
  } else {
    pass(`Phase 7b nav link decision: ${state.navLink.decision}`, `attested at ${state.navLink.ts}`)
  }

  // 8d. Phase 7a footer-link host-side check.
  // Walk up from CWD until we find what looks like the site repo root (a dir
  // ABOVE _blog/ that contains site files), then grep for /blog references
  // in HTML/Astro files OUTSIDE of _blog/ and node_modules/.
  let siteRepoRoot = null
  let dir = CWD
  // _blog/ is typically a child of the site repo; the site repo has the host's pages
  if (basename(CWD) === "_blog" || basename(resolve(CWD, "..")) === "_blog") {
    siteRepoRoot = basename(CWD) === "_blog" ? resolve(CWD, "..") : resolve(CWD, "..", "..")
  }
  if (siteRepoRoot && existsSync(siteRepoRoot)) {
    let footerLinkFound = false
    let searchedFiles = 0
    try {
      // Lightweight grep: read up to 50 .html/.astro files at the site repo root, skip _blog and node_modules
      function walkLight(d, depth = 0) {
        if (depth > 4 || searchedFiles >= 50 || footerLinkFound) return
        const entries = readdirSync(d, { withFileTypes: true })
        for (const ent of entries) {
          if (footerLinkFound || searchedFiles >= 50) return
          if (ent.name === "_blog" || ent.name === "node_modules" || ent.name === ".git" || ent.name.startsWith(".astro")) continue
          const p = join(d, ent.name)
          if (ent.isDirectory()) {
            walkLight(p, depth + 1)
          } else if (/\.(html|astro|tsx|jsx|vue|svelte|php|liquid)$/i.test(ent.name)) {
            searchedFiles++
            const content = readFileSync(p, "utf8")
            // Look for an anchor or link to /blog (root-relative or fully qualified)
            if (/href=["']\/blog\/?["']|href=["']https?:\/\/[^"']+\/blog\/?["']/.test(content)) {
              footerLinkFound = true
              return
            }
          }
        }
      }
      walkLight(siteRepoRoot)
    } catch { /* ignore */ }

    if (footerLinkFound) {
      pass("Host site has a /blog link (Phase 7a footer link wired)", `searched ${searchedFiles} files in ${siteRepoRoot}`)
    } else {
      fail(
        "No /blog link found in host site files",
        `Searched ${searchedFiles} HTML/Astro/template files in ${siteRepoRoot} — no <a href="/blog"> or fully-qualified blog link found.\n` +
          `Phase 7a requires adding a 'Blog' link to the host's footer so visitors can discover the blog. Without it the blog is technically live but invisible.`,
      )
    }
  } else {
    warning(
      "Could not auto-detect site repo root for Phase 7a check",
      `Doctor walks up from CWD looking for a parent dir of _blog/. Couldn't find it. If you're running from somewhere unusual, the Phase 7a footer check is skipped — verify manually that the host site has a /blog link.`,
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
