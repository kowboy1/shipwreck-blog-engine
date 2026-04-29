#!/usr/bin/env node
/**
 * extract-theme.mjs — sample computed styles from a host site and emit a
 * draft tokens.css the agent can review and finalize.
 *
 * Usage:
 *   node scripts/extract-theme.mjs https://wollongongweather.com > tokens.draft.css
 *
 * Or with a local file (offline analysis of a built site):
 *   node scripts/extract-theme.mjs file:///path/to/index.html > tokens.draft.css
 *
 * Requires Playwright: `npx playwright install chromium` once per machine.
 *
 * What it samples:
 *   - body         → bg, text, font, line-height, font-size
 *   - h1           → heading font, weight, tracking
 *   - a            → link color (hover sampled best-effort)
 *   - .btn / button → primary button bg/text/radius/padding (heuristic)
 *   - hr / cards   → border color and radius
 *   - code         → mono font
 *
 * Heuristic mapping → token contract:
 *   --color-bg          ← body bg
 *   --color-text        ← body color
 *   --color-primary     ← h1 color (falls back to body color)
 *   --color-accent      ← link color (falls back to most-saturated CTA bg)
 *   --color-muted       ← derived: body color @ 60% mix to bg
 *   --color-border      ← hr color OR most-frequent 1px border color
 *   --color-link        ← a color
 *   --font-sans         ← body font-family
 *   --font-heading      ← h1 font-family (falls back to sans)
 *   --font-mono         ← code font-family
 *   --radius-card       ← median border-radius across cards/imgs
 *   --radius-button     ← button border-radius
 *   --button-bg         ← primary button bg
 *   --button-text       ← primary button text
 *   --button-padding-y  ← primary button padding-top
 *   --button-padding-x  ← primary button padding-left
 *
 * Tokens it CAN'T reliably extract are emitted with a `/* TODO: confirm *\/`
 * comment so the agent fills them manually.
 */
import { chromium } from "playwright"

const url = process.argv[2]
if (!url) {
  console.error("Usage: node scripts/extract-theme.mjs <url>")
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
  // Allow webfonts to settle
  await page.waitForTimeout(1500)

  const sample = await page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null)
    const pick = (style, prop) => (style ? style.getPropertyValue(prop).trim() : "")

    const body = cs(document.body)
    const h1 = cs(document.querySelector("h1") || document.querySelector("h2"))
    const link = cs(document.querySelector("a[href]"))
    const code = cs(document.querySelector("code"))

    // Heuristic: find the most prominent button — biggest area, contrasting bg.
    const btnCandidates = Array.from(
      document.querySelectorAll(
        "button, a.btn, a.button, [role='button'], .button, .btn, a[class*='btn'], a[class*='button']"
      )
    )
      .map((el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        const bg = s.backgroundColor
        const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent"
        return { el, area: r.width * r.height, bg, hasBg, s }
      })
      .filter((c) => c.hasBg && c.area > 100 && c.area < 100000)
      .sort((a, b) => b.area - a.area)
    const btn = btnCandidates[0]?.s ?? null

    // Borders: sample radii from <img>, .card, article, [class*='card']
    const radiiSamples = Array.from(
      document.querySelectorAll("img, .card, article, [class*='card'], [class*='Card']")
    )
      .map((el) => parseFloat(getComputedStyle(el).borderRadius))
      .filter((n) => Number.isFinite(n) && n > 0)
    const median = (arr) =>
      arr.length === 0 ? null : arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)]
    const cardRadius = median(radiiSamples)

    // Border color: sample 1px borders
    const borderSamples = Array.from(document.querySelectorAll("*"))
      .slice(0, 500)
      .map((el) => getComputedStyle(el))
      .filter((s) => s.borderTopWidth === "1px" || s.borderBottomWidth === "1px")
      .map((s) => s.borderTopColor)
      .filter((c) => c && c !== "rgba(0, 0, 0, 0)")
    const freq = {}
    for (const c of borderSamples) freq[c] = (freq[c] || 0) + 1
    const borderColor = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    return {
      bodyBg: pick(body, "background-color"),
      bodyText: pick(body, "color"),
      bodyFont: pick(body, "font-family"),
      bodySize: pick(body, "font-size"),
      bodyLh: pick(body, "line-height"),
      h1Font: pick(h1, "font-family"),
      h1Color: pick(h1, "color"),
      h1Tracking: pick(h1, "letter-spacing"),
      linkColor: pick(link, "color"),
      codeFont: pick(code, "font-family"),
      btnBg: pick(btn, "background-color"),
      btnText: pick(btn, "color"),
      btnRadius: pick(btn, "border-radius"),
      btnPy: pick(btn, "padding-top"),
      btnPx: pick(btn, "padding-left"),
      btnFw: pick(btn, "font-weight"),
      cardRadius: cardRadius != null ? `${cardRadius}px` : null,
      borderColor,
    }
  })

  // Format output
  const fb = (v, dflt) => (v && v !== "" ? v : dflt)
  const todo = (label) => `/* TODO: confirm ${label} */`

  const out = `:root {
  /* Extracted from ${url} on ${new Date().toISOString()} */
  /* Review every value. Heuristics are best-effort — confirm against host devtools. */

  /* Colors */
  --color-bg: ${fb(sample.bodyBg, "#ffffff")};
  --color-bg-elevated: ${fb(sample.bodyBg, "#f8fafc")};  ${todo("--color-bg-elevated (slightly off body)")}
  --color-text: ${fb(sample.bodyText, "#0f172a")};
  --color-primary: ${fb(sample.h1Color || sample.bodyText, "#0f172a")};
  --color-accent: ${fb(sample.linkColor, "#2563eb")};
  --color-muted: ${fb(sample.bodyText, "#64748b")};  ${todo("--color-muted (typically body @ 60% opacity vs bg)")}
  --color-border: ${fb(sample.borderColor, "#e2e8f0")};
  --color-link: ${fb(sample.linkColor, "var(--color-accent)")};
  --color-link-hover: var(--color-primary);  ${todo("--color-link-hover (sample with :hover state)")}
  --color-focus-ring: color-mix(in srgb, var(--color-accent) 60%, transparent);

  /* Typography */
  --font-sans: ${fb(sample.bodyFont, "system-ui, -apple-system, sans-serif")};
  --font-heading: ${fb(sample.h1Font, "var(--font-sans)")};
  --font-mono: ${fb(sample.codeFont, "ui-monospace, SFMono-Regular, Menlo, monospace")};
  --font-size-base: ${fb(sample.bodySize, "1rem")};
  --line-height-base: ${fb(sample.bodyLh, "1.65")};
  --tracking-heading: ${fb(sample.h1Tracking, "-0.01em")};

  /* Surface */
  --radius-card: ${fb(sample.cardRadius, "0.75rem")};
  --radius-button: ${fb(sample.btnRadius, "9999px")};
  --radius-chip: ${fb(sample.btnRadius, "9999px")};
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06);  ${todo("--shadow-card (inspect host card hover)")}

  /* Buttons */
  --button-bg: ${fb(sample.btnBg, "var(--color-primary)")};
  --button-text: ${fb(sample.btnText, "var(--color-bg)")};
  --button-hover-bg: var(--color-accent);  ${todo("--button-hover-bg (sample button:hover bg)")}
  --button-padding-y: ${fb(sample.btnPy, "0.625rem")};
  --button-padding-x: ${fb(sample.btnPx, "1.25rem")};
  --button-font-weight: ${fb(sample.btnFw, "600")};

  /* Header */
  --header-bg: var(--color-bg);  ${todo("--header-bg (sample header bg if distinct)")}
  --header-height: 4rem;  ${todo("--header-height (measure host header)")}
  --header-border: var(--color-border);
}
`

  process.stdout.write(out)
} catch (err) {
  console.error(`extract-theme: failed to load ${url}: ${err.message}`)
  process.exit(2)
} finally {
  await browser.close()
}
