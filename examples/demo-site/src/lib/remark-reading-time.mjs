import { toString } from "mdast-util-to-string"

export function remarkReadingTime() {
  return (tree, { data }) => {
    const text = toString(tree)
    const words = text.trim().split(/\s+/).filter(Boolean).length
    data.astro.frontmatter.wordCount = words
  }
}
