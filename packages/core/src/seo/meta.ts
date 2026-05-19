import type { Post, SiteConfig } from "../schemas/index.js"

/** Default intrinsic dimensions for hero / OG image when a post doesn't
 *  declare its own. 1200×630 is the standard OG card aspect (~1.91:1) and
 *  matches the recommended dimensions across LinkedIn, X, Facebook, Slack. */
export const DEFAULT_OG_IMAGE_WIDTH = 1200
export const DEFAULT_OG_IMAGE_HEIGHT = 630

export interface MetaLink {
  rel: string
  href: string
  /** MIME type. Required for rel="alternate" to RSS / Atom feeds. */
  type?: string
  /** Resource hint type for rel="preload": "image", "style", "font", "script", etc. */
  as?: string
  /** Resource priority hint: "high" / "low" — used with rel="preload". */
  fetchpriority?: "high" | "low" | "auto"
  /** Used with rel="icon" / rel="preload" for typed responsive images. */
  sizes?: string
  /** Used with rel="preload" image to match a specific media query. */
  media?: string
}

export interface MetaTags {
  title: string
  description?: string
  canonical: string
  robots: string
  /**
   * Additional `<link>` tags to emit in <head>. Used for:
   *   - rel="prev" / rel="next" on paginated listings (Bing/Yandex still use these)
   *   - rel="alternate" type="application/rss+xml" — feed discovery
   *   - rel="preload" as="image" fetchpriority="high" — LCP hero hint on post pages
   *
   * Consumer BaseLayout should spread every set attribute, e.g.:
   *
   *   {meta.links?.map((l) => (
   *     <link rel={l.rel} href={l.href} type={l.type} as={l.as}
   *           fetchpriority={l.fetchpriority} sizes={l.sizes} media={l.media} />
   *   ))}
   */
  links?: MetaLink[]
  og: {
    title: string
    description?: string
    image?: string
    /** og:image:width — emitted when image is set. Prevents preview platforms
     *  from guessing dimensions and helps SERP thumbnail rendering. */
    imageWidth?: number
    /** og:image:height — emitted when image is set. */
    imageHeight?: number
    /** og:image:alt — descriptive text for the OG image. */
    imageAlt?: string
    url: string
    type: "article" | "website"
    siteName: string
    locale: string
  }
  twitter: {
    card: "summary_large_image" | "summary"
    title: string
    description?: string
    image?: string
    site?: string
    /** twitter:creator — handle of the post's primary author. Separate from
     *  twitter:site (the org account). Helps Twitter attribute the byline. */
    creator?: string
  }
  article?: {
    publishedTime: string
    modifiedTime: string
    author?: string
    section?: string
    tags?: string[]
  }
}

export function buildPostMeta(args: {
  post: Post
  siteConfig: SiteConfig
  url: string
  /** Optional: primary author's twitter handle for twitter:creator. */
  authorTwitter?: string
}): MetaTags {
  const { post, siteConfig, url, authorTwitter } = args
  const title = post.metaTitle ?? post.title
  const description = post.metaDescription ?? post.excerpt
  const ogImage = post.ogImage ?? post.featuredImage ?? siteConfig.seo.defaultOgImage
  const canonical = post.canonical ?? url
  const imageWidth = ogImage ? (post.featuredImageWidth ?? DEFAULT_OG_IMAGE_WIDTH) : undefined
  const imageHeight = ogImage ? (post.featuredImageHeight ?? DEFAULT_OG_IMAGE_HEIGHT) : undefined
  const imageAlt = ogImage ? (post.featuredImageAlt ?? post.title) : undefined
  const creator = authorTwitter ? normaliseTwitterHandle(authorTwitter) : undefined

  // RSS feed discovery — emit rel="alternate" on every page so feed readers
  // and crawlers find the feed regardless of which post / archive they land on.
  const rssHref = new URL(
    `${siteConfig.blogBasePath.replace(/\/$/, "")}/rss.xml`,
    siteConfig.baseUrl,
  ).toString()
  const links: MetaLink[] = [
    { rel: "alternate", href: rssHref, type: "application/rss+xml" },
  ]
  // Preconnect / DNS-prefetch hints for external origins (siteConfig.seo).
  // Preconnect is more expensive but pays off when the site is likely to
  // request resources from the origin during this navigation; dns-prefetch
  // is the lighter cousin. Engine emits both when configured per-site.
  for (const origin of siteConfig.seo.preconnects ?? []) {
    links.push({ rel: "preconnect", href: origin })
  }
  for (const origin of siteConfig.seo.dnsPrefetches ?? []) {
    links.push({ rel: "dns-prefetch", href: origin })
  }

  return {
    title,
    description,
    canonical,
    robots: post.noindex ? "noindex,nofollow" : "index,follow",
    links,
    og: {
      title: post.ogTitle ?? title,
      description: post.ogDescription ?? description,
      image: ogImage,
      ...(imageWidth ? { imageWidth } : {}),
      ...(imageHeight ? { imageHeight } : {}),
      ...(imageAlt ? { imageAlt } : {}),
      url: canonical,
      type: "article",
      siteName: siteConfig.siteName,
      locale: siteConfig.seo.locale,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: post.ogTitle ?? title,
      description: post.ogDescription ?? description,
      image: ogImage,
      site: siteConfig.seo.twitterHandle,
      ...(creator ? { creator } : {}),
    },
    article: {
      publishedTime: post.publishDate.toISOString(),
      modifiedTime: (post.updatedDate ?? post.publishDate).toISOString(),
      author: post.author,
      section: post.category,
      tags: post.tags,
    },
  }
}

function normaliseTwitterHandle(handle: string): string {
  const trimmed = handle.trim()
  if (!trimmed) return trimmed
  return trimmed.startsWith("@") ? trimmed : "@" + trimmed
}
