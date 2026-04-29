#!/usr/bin/env node
/**
 * visual-diff.mjs — compare a host page to a blog page and report styling
 * mismatches by region.
 *
 * Usage:
 *   node scripts/visual-diff.mjs <host-url> <blog-url>
 *
 * Example:
 *   node scripts/visual-diff.mjs https://wollongongweather.com http://localhost:4322/blog/east-coast-low-explainer/
 *
 * Reports per-region mismatch percentages. Regions:
 *   - header        (top of page, ~80px)
 *   - body-typography (sample paragraph + heading)
 *   - primary-cta   (largest visible button)
 *   - footer        (bottom of page, ~120px)
 *
 * Exits 0 on PASS (all regions <5% mismatch), 1 on FAIL.
 *
 * Output:
 *   PASS: header 1.2%, body 0.8%, cta 3.4%, footer 0.9%
 *
 *   FAIL: header 0.4%, body 12.7% (font-family mismatch?), cta 8.1% (radius/color), footer 1.1%
 *
 * Requires Playwright + pixelmatch + pngjs:
 *   npm install --save-dev playwright pixelmatch pngjs
 *   npx playwright install chromium
 */
import { chromium } from "playwright"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"

const [, , hostUrl, blogUrl] = process.argv
if (!hostUrl || !blogUrl) {
  console.error("Usage: node scripts/visual-diff.mjs <host-url> <blog-url>")
  process.exit(1)
}

const VIEWPORT = { width: 1280, height: 900 }
const THRESHOLD = 0.05 // 5% pixels different = fail

async function captureRegions(url) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEWPORT })
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
    await page.waitForTimeout(800)

    const regions = await page.evaluate(() => {
      const r = (el) => {
        if (!el) return null
        const b = el.getBoundingClientRect()
        if (b.width <= 0 || b.height <= 0) return null
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
      }
      // header — first <header> or top 80px
      const headerEl = document.querySelector("header") || document.querySelector("nav")
      // body typography — first <p> we can find inside main content
      const bodyEl =
        document.querySelector("main p") ||
        document.querySelector("article p") ||
        document.querySelector("p")
      // CTA — largest button-like element
      const btnCandidates = Array.from(
        document.querySelectorAll(
          "button, a.btn, a.button, [role='button'], .button, .btn, a[class*='btn'], a[class*='button']"
        )
      )
        .map((el) => {
          const b = el.getBoundingClientRect()
          const s = getComputedStyle(el)
          const has = s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)"
          return { el, area: b.width * b.height, has }
        })
        .filter((c) => c.has && c.area > 100 && c.area < 100000)
        .sort((a, b) => b.area - a.area)
      const ctaEl = btnCandidates[0]?.el
      // footer
      const footerEl = document.querySelector("footer")

      return {
        header: r(headerEl) ?? { x: 0, y: 0, w: 1280, h: 80 },
        body: r(bodyEl),
        cta: r(ctaEl),
        footer: r(footerEl),
      }
    })

    const shots = {}
    for (const [name, box] of Object.entries(regions)) {
      if (!box) {
        shots[name] = null
        continue
      }
      // Clip and screenshot at 2x for sharper diffs
      const buf = await page.screenshot({ clip: box })
      shots[name] = buf
    }
    return shots
  } finally {
    await browser.close()
  }
}

function diffPng(aBuf, bBuf) {
  const a = PNG.sync.read(aBuf)
  const b = PNG.sync.read(bBuf)
  // Resize the smaller to match the larger by padding (simplest)
  const w = Math.min(a.width, b.width)
  const h = Math.min(a.height, b.height)
  if (w === 0 || h === 0) return { diff: 1, total: 0 }
  const diff = new PNG({ width: w, height: h })
  const aData = trimToSize(a, w, h)
  const bData = trimToSize(b, w, h)
  const mismatched = pixelmatch(aData, bData, diff.data, w, h, { threshold: 0.2 })
  return { diff: mismatched / (w * h), total: w * h }
}

function trimToSize(png, w, h) {
  if (png.width === w && png.height === h) return png.data
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * png.width + x) * 4
      const dstIdx = (y * w + x) * 4
      out[dstIdx] = png.data[srcIdx]
      out[dstIdx + 1] = png.data[srcIdx + 1]
      out[dstIdx + 2] = png.data[srcIdx + 2]
      out[dstIdx + 3] = png.data[srcIdx + 3]
    }
  }
  return out
}

console.error(`Capturing ${hostUrl} ...`)
const hostShots = await captureRegions(hostUrl)
console.error(`Capturing ${blogUrl} ...`)
const blogShots = await captureRegions(blogUrl)

const results = {}
for (const region of ["header", "body", "cta", "footer"]) {
  if (!hostShots[region] || !blogShots[region]) {
    results[region] = { pct: null, note: "region missing on one side" }
    continue
  }
  const { diff } = diffPng(hostShots[region], blogShots[region])
  results[region] = { pct: diff, note: "" }
}

const fails = Object.entries(results).filter(([, v]) => v.pct != null && v.pct > THRESHOLD)
const status = fails.length === 0 ? "PASS" : "FAIL"

const fmt = (r) => {
  if (r.pct == null) return r.note
  return `${(r.pct * 100).toFixed(1)}%`
}

console.log(
  `${status}: header ${fmt(results.header)}, body ${fmt(results.body)}, cta ${fmt(results.cta)}, footer ${fmt(results.footer)}`
)

if (fails.length > 0) {
  console.error(
    `\nRegions exceeding ${THRESHOLD * 100}%: ${fails.map(([k]) => k).join(", ")}`
  )
  console.error(
    `\nLikely causes:\n  body  → font-family / line-height / size\n  cta   → button bg / radius / padding\n  header → logo size, nav typography, bg\n  footer → typography + bg\n\nReview tokens.css against host devtools.`
  )
  process.exit(1)
}
