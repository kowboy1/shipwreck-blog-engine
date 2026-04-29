/**
 * Prepares all the data a PostPage.astro needs in one async call. Per-site
 * `[...slug].astro` becomes a thin wrapper that awaits this and passes
 * the result into <PostPage>.
 *
 * Why this lives in the package: the boilerplate (meta tags, JSON-LD graph,
 * author resolution, reading time, related-post ranking, breadcrumbs) is
 * identical across every site. Centralising it means engine fixes don't
 * require per-site edits.
 *
 * `getEntry` and `render` are passed in (rather than imported from
 * `astro:content`) so this module stays portable — `astro:content` is a
 * per-project virtual module and can't be reliably imported from a package.
 */
import type { Post } from "../schemas/post.js"
import type { SiteConfig } from "../schemas/site.js"
import type { AuthorRecord } from "../schemas/author.js"
import {
  buildPostMeta,
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  type ArticleAuthor,
  type MetaTags,
} from "../seo/index.js"
import { rankRelatedPosts } from "../utils/related.js"
import { readingTimeLabel } from "../utils/reading-time.js"
import { getPostAuthorIds } from "../utils/authors.js"

interface PostEntry {
  id: string
  data: Post
}

interface AuthorEntry {
  id: string
  data: AuthorRecord
}

export interface PreparePostPageDataInput {
  post: PostEntry
  all: PostEntry[]
  siteConfig: SiteConfig
  /**
   * Astro's `getEntry` from `astro:content`. Pass it in as a function.
   * Used to resolve author records.
   */
  getEntry: (collection: string, id: string) => Promise<AuthorEntry | undefined>
  /**
   * Astro's `render` from `astro:content`. Pass it in as a function.
   * Used to compile the post body and extract headings + frontmatter.
   */
  render: (entry: PostEntry) => Promise<{
    Content: unknown
    headings: Array<{ depth: number; slug: string; text: string }>
    remarkPluginFrontmatter: Record<string, unknown> | undefined
  }>
}

export interface PostPageData {
  /** Original post entry (passed through for the renderer) */
  post: PostEntry
  /** Compiled MDX content component (renderable) */
  Content: unknown
  /** Headings extracted from the body (for ToC) */
  headings: Array<{ depth: number; slug: string; text: string }>
  /** Resolved author entries (filtered to only the ones that exist) */
  authors: AuthorEntry[]
  /** Human-readable reading time, e.g. "3 min read" — undefined if word count unknown */
  readingLabel: string | undefined
  /** Posts shown in the bottom "More articles" grid */
  bottomGridPosts: PostEntry[]
  /** Breadcrumbs for the page (final crumb has no url) */
  crumbs: Array<{ name: string; url?: string }>
  /** Canonical URL for the post */
  url: string
  /** Compiled <head> meta tags */
  meta: MetaTags
  /** JSON-LD graph (Article + Breadcrumb + optional FAQ) */
  jsonLd: object[]
}

export async function preparePostPageData(
  input: PreparePostPageDataInput,
): Promise<PostPageData> {
  const { post, all, siteConfig, getEntry, render } = input

  const url = new URL(
    `${siteConfig.blogBasePath}/${post.id}/`,
    siteConfig.baseUrl,
  ).toString()
  const blogUrl = new URL(siteConfig.blogBasePath, siteConfig.baseUrl).toString()

  const { Content, headings, remarkPluginFrontmatter } = await render(post)

  const authorIds = getPostAuthorIds(post.data)
  const resolved = await Promise.all(authorIds.map((id) => getEntry("authors", id)))
  const authors = resolved.filter((e): e is AuthorEntry => Boolean(e))

  const articleAuthors: ArticleAuthor[] = authors.map(({ data }) => ({
    name: data.name,
    ...(data.url ? { url: data.url } : {}),
  }))

  const meta = buildPostMeta({ post: post.data, siteConfig, url })

  const jsonLd: object[] = [
    articleSchema({ post: post.data, siteConfig, url, authors: articleAuthors }),
    breadcrumbSchema([
      { name: "Home", url: siteConfig.baseUrl },
      { name: "Blog", url: blogUrl },
      { name: post.data.title, url },
    ]),
  ]
  if (post.data.faqItems && post.data.faqItems.length > 0) {
    jsonLd.push(faqSchema(post.data.faqItems))
  }

  // Bottom "More articles" grid: prefer related (topic-similar) posts, fall back
  // to featured posts, fall back to most recent — never show an empty grid.
  const candidates = all
    .filter((p) => p.id !== post.id && p.data.status === "published")
    .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())

  const related = siteConfig.layout?.showRelatedPosts
    ? rankRelatedPosts({
        current: post,
        candidates: all,
        limit: siteConfig.layout?.relatedPostsCount ?? 3,
      })
    : []

  const featured = candidates.filter((p) => p.data.featured)
  const bottomGridPosts = (
    related.length > 0 ? related : featured.length > 0 ? featured : candidates
  ).slice(0, siteConfig.layout?.relatedPostsCount ?? 3)

  // Reading time
  const wordCount = (
    remarkPluginFrontmatter as { wordCount?: number } | undefined
  )?.wordCount
  const readingLabel = wordCount
    ? readingTimeLabel("x ".repeat(wordCount))
    : undefined

  const crumbs: Array<{ name: string; url?: string }> = [
    { name: "Home", url: siteConfig.baseUrl },
    { name: "Blog", url: blogUrl },
    { name: post.data.title },
  ]

  return {
    post,
    Content,
    headings,
    authors,
    readingLabel,
    bottomGridPosts,
    crumbs,
    url,
    meta,
    jsonLd,
  }
}
