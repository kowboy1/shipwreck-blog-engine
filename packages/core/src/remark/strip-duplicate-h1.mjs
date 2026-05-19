/**
 * remark plugin: defends against body H1s anywhere in a post's MDX body.
 *
 * The layout renders the post title from frontmatter as the page's H1. ANY
 * H1 in the MDX body therefore produces a multi-H1 page — bad for SEO,
 * confusing for screen readers, breaks the ToC's heading hierarchy.
 *
 * Two strategies depending on what the body H1 contains:
 *
 *   1. **Loose-match against the frontmatter title → STRIP.**
 *      Handles the common "user pasted the title twice" case. The match
 *      tolerates:
 *        - case + whitespace differences
 *        - one being a prefix of the other (e.g. body has the title
 *          without a parenthetical, or vice versa) — this is what produced
 *          Wollongong Weather's "How to read Wollongong rain radar properly"
 *          (body) vs "...properly (without overreacting)" (frontmatter)
 *        - token-set overlap of ≥ 80% — handles minor word reorderings,
 *          em-dash vs colon, etc.
 *
 *   2. **No match → DOWNGRADE to H2.**
 *      The body H1 represented genuine content (not a title paste); keeping
 *      it at H2 preserves the section semantically without breaking the
 *      single-H1 rule.
 *
 * Defence in depth: also visits every H1 — not just the first tree node —
 * because authors sometimes write a TL;DR section then `# Title` afterwards.
 *
 * Emits a `file.message()` so the build log surfaces every transformation,
 * giving authors a clear signal that their MDX is being corrected on their
 * behalf rather than failing silently.
 *
 * Wire into Astro:
 *   import { remarkStripDuplicateH1 } from "@nitroblog/core/remark/strip-duplicate-h1"
 *   markdown: { remarkPlugins: [remarkStripDuplicateH1] }
 *
 * Auto-registered by the `@nitroblog/core/integration` default export.
 */
function nodeText(node) {
  if (!node) return ""
  if (typeof node.value === "string") return node.value
  if (Array.isArray(node.children)) return node.children.map(nodeText).join("")
  return ""
}

const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase()

function tokenSet(s) {
  return new Set(norm(s).split(/[^a-z0-9]+/).filter(Boolean))
}

/**
 * Loose-match: an H1's text is considered a duplicate of the frontmatter
 * title when ANY of these hold:
 *   - normalised strings are equal
 *   - one normalised string is a prefix of the other (handles parentheticals,
 *     suffixes, subtitle clauses that exist in one but not the other)
 *   - token-set overlap ratio is ≥ 80% against the smaller of the two sets
 */
function isLooseTitleMatch(headingText, title) {
  const a = norm(headingText)
  const b = norm(title)
  if (!a || !b) return false
  if (a === b) return true
  if (a.startsWith(b) || b.startsWith(a)) return true
  const ta = tokenSet(headingText)
  const tb = tokenSet(title)
  if (ta.size === 0 || tb.size === 0) return false
  const [small, large] = ta.size < tb.size ? [ta, tb] : [tb, ta]
  let hits = 0
  small.forEach((t) => { if (large.has(t)) hits++ })
  return hits / small.size >= 0.8
}

export function remarkStripDuplicateH1() {
  return (tree, file) => {
    if (!Array.isArray(tree.children)) return
    const title = file?.data?.astro?.frontmatter?.title

    let stripped = 0
    let downgraded = 0
    const nextChildren = []
    for (const node of tree.children) {
      if (node && node.type === "heading" && node.depth === 1) {
        const text = nodeText(node)
        if (title && isLooseTitleMatch(text, title)) {
          stripped++
          continue // drop the duplicate-title H1 entirely
        }
        // Genuine body H1 that doesn't echo the title — downgrade to H2 so
        // the page still has exactly one H1 (the layout's frontmatter render).
        node.depth = 2
        downgraded++
      }
      nextChildren.push(node)
    }
    tree.children = nextChildren

    if (file?.message && (stripped > 0 || downgraded > 0)) {
      const parts = []
      if (stripped > 0) parts.push(`${stripped} duplicate-title H1 stripped`)
      if (downgraded > 0) parts.push(`${downgraded} body H1 downgraded to H2`)
      file.message(
        `[nitroblog] ${parts.join(", ")} in MDX body. ` +
          `Body content must never use H1 — the post layout already renders one from frontmatter. ` +
          `Use H2 (##) for top-level sections.`,
        { source: "remark-strip-duplicate-h1" },
      )
    }
  }
}

export default remarkStripDuplicateH1
