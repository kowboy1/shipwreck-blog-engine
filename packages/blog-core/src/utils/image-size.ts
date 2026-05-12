/**
 * Build-time image dimension probe. Reads the first few bytes of an image
 * file on disk and returns intrinsic { width, height } in pixels.
 *
 * Used by `preparePostPageData` to auto-populate the `<img width=/height=>`
 * attributes + Schema.org ImageObject dimensions + OG image dimensions
 * WITHOUT requiring the author to fill those numbers in post frontmatter.
 *
 * Supports SVG, PNG, JPEG without any runtime dependency — common cases on
 * SEO-first blogs. For AVIF/WebP/GIF and other formats, returns undefined
 * and the engine falls back to defaults (1200×675).
 *
 * URLs (http://… https://…) are not probed — only local filesystem paths.
 * Frontmatter `featuredImageWidth`/`Height` always takes precedence so
 * authors can override autodetected values when needed.
 */
import { existsSync, readFileSync, openSync, readSync, closeSync } from "node:fs"
import { resolve } from "node:path"

export interface ImageSize {
  width: number
  height: number
}

/**
 * Probe an image referenced by a post's `featuredImage`. Looks for the file
 * under common Astro `public/` roots: `<cwd>/public/<path>` and
 * `<cwd>/_blog/public/<path>`. Returns undefined if the file can't be
 * resolved or the format isn't supported.
 */
export function probeFeaturedImageSize(input: {
  featuredImage: string
  cwd?: string
}): ImageSize | undefined {
  const { featuredImage } = input
  const cwd = input.cwd ?? process.cwd()

  // Skip remote URLs — they'd require an HTTP request at build time.
  if (/^https?:\/\//i.test(featuredImage)) return undefined
  // Skip data URIs.
  if (featuredImage.startsWith("data:")) return undefined

  // Resolve against common public/ roots.
  const rel = featuredImage.replace(/^\//, "")
  const candidates = [
    resolve(cwd, "public", rel),
    resolve(cwd, "_blog", "public", rel),
    resolve(cwd, "..", "public", rel),
  ]
  const path = candidates.find((p) => existsSync(p))
  if (!path) return undefined

  try {
    return probeImageSizeFromFile(path)
  } catch {
    return undefined
  }
}

function probeImageSizeFromFile(path: string): ImageSize | undefined {
  const lower = path.toLowerCase()
  if (lower.endsWith(".svg")) return probeSvg(path)
  if (lower.endsWith(".png")) return probePng(path)
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return probeJpeg(path)
  return undefined
}

function probeSvg(path: string): ImageSize | undefined {
  // SVG is text. Read the first ~2KB (the root <svg> tag almost always fits).
  const fd = openSync(path, "r")
  try {
    const buf = Buffer.alloc(2048)
    const bytes = readSync(fd, buf, 0, 2048, 0)
    const head = buf.slice(0, bytes).toString("utf8")
    // Prefer viewBox over width/height attributes — viewBox is what determines
    // the intrinsic aspect ratio when the SVG renders.
    const vb = head.match(/viewBox\s*=\s*["']\s*([\d.\-eE+]+)\s+([\d.\-eE+]+)\s+([\d.\-eE+]+)\s+([\d.\-eE+]+)\s*["']/i)
    if (vb) {
      const w = Math.round(parseFloat(vb[3]))
      const h = Math.round(parseFloat(vb[4]))
      if (w > 0 && h > 0) return { width: w, height: h }
    }
    const wAttr = head.match(/<svg\b[^>]*\bwidth\s*=\s*["']\s*([\d.]+)/i)
    const hAttr = head.match(/<svg\b[^>]*\bheight\s*=\s*["']\s*([\d.]+)/i)
    if (wAttr && hAttr) {
      const w = Math.round(parseFloat(wAttr[1]))
      const h = Math.round(parseFloat(hAttr[1]))
      if (w > 0 && h > 0) return { width: w, height: h }
    }
  } finally {
    closeSync(fd)
  }
  return undefined
}

function probePng(path: string): ImageSize | undefined {
  // PNG header layout: 8-byte signature, then IHDR chunk:
  //   bytes 8..11   length (always 13)
  //   bytes 12..15  "IHDR"
  //   bytes 16..19  width  (big-endian uint32)
  //   bytes 20..23  height (big-endian uint32)
  const fd = openSync(path, "r")
  try {
    const buf = Buffer.alloc(24)
    const bytes = readSync(fd, buf, 0, 24, 0)
    if (bytes < 24) return undefined
    // Signature check.
    const sig = buf.slice(0, 8).toString("hex")
    if (sig !== "89504e470d0a1a0a") return undefined
    // IHDR check.
    if (buf.slice(12, 16).toString("ascii") !== "IHDR") return undefined
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    if (width > 0 && height > 0) return { width, height }
  } finally {
    closeSync(fd)
  }
  return undefined
}

function probeJpeg(path: string): ImageSize | undefined {
  // JPEG: walk markers from byte 2 onward, looking for a Start-Of-Frame (SOF)
  // marker. SOFs are 0xFFC0..0xFFCF EXCEPT 0xFFC4 (DHT), 0xFFC8 (JPG), 0xFFCC
  // (DAC). Frame layout after marker: 2 bytes length, 1 byte precision,
  // 2 bytes height, 2 bytes width (all big-endian).
  const data = readFileSync(path)
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return undefined // SOI
  let i = 2
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) return undefined
    const marker = data[i + 1]
    // Skip 0xFF padding bytes
    if (marker === 0xff) { i++; continue }
    // SOI/EOI have no length
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue }
    const isSof =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    const segLen = data.readUInt16BE(i + 2)
    if (isSof) {
      const height = data.readUInt16BE(i + 5)
      const width = data.readUInt16BE(i + 7)
      if (width > 0 && height > 0) return { width, height }
      return undefined
    }
    i += 2 + segLen
  }
  return undefined
}
