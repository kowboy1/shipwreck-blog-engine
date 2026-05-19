import type { Post } from "../schemas/post.js"

/**
 * Returns the post's authors as a flat string[] regardless of whether the
 * frontmatter used `author: "rick"` (legacy) or `authors: ["rick", "jane"]`.
 *
 * Pass to getEntry("authors", id) for each id to fetch full author records.
 */
export function getPostAuthorIds(post: Post): string[] {
  if (post.authors && post.authors.length > 0) return post.authors
  if (post.author) return [post.author]
  return []
}
