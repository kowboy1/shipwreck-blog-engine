/**
 * remark plugin: removes the leading H1 from MDX/Markdown when its text matches
 * the frontmatter `title` (case- and whitespace-insensitive).
 *
 * Reason: layouts render the post title from frontmatter in the article header.
 * When authors also start the body with `# Title`, two H1s end up on the page —
 * bad for SEO and visually duplicated. This plugin makes that mistake impossible.
 *
 * Wire into Astro:
 *   import { remarkStripDuplicateH1 } from "@shipwreck/blog-core/remark/strip-duplicate-h1"
 *   markdown: { remarkPlugins: [remarkStripDuplicateH1] }
 */
function nodeText(node) {
  if (!node) return ""
  if (typeof node.value === "string") return node.value
  if (Array.isArray(node.children)) return node.children.map(nodeText).join("")
  return ""
}

const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase()

export function remarkStripDuplicateH1() {
  return (tree, file) => {
    const title = file?.data?.astro?.frontmatter?.title
    if (!title || !Array.isArray(tree.children) || tree.children.length === 0) return
    const first = tree.children[0]
    if (!first || first.type !== "heading" || first.depth !== 1) return
    if (norm(nodeText(first)) === norm(String(title))) {
      tree.children.shift()
    }
  }
}

export default remarkStripDuplicateH1
