import type { Post, SiteConfig } from "../schemas/index.js"

export interface MetaTags {
  title: string
  description?: string
  canonical: string
  robots: string
  /**
   * Additional `<link>` tags to emit in <head>. Used for rel="prev"/rel="next"
   * on paginated listings (Bing/Yandex still use these signals — Google
   * deprecated them in 2019 but emitting them is cheap and harmless).
   * Consumer BaseLayout should render: meta.links?.map((l) => <link rel={l.rel} href={l.href} />)
   */
  links?: Array<{ rel: string; href: string }>
  og: {
    title: string
    description?: string
    image?: string
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
}): MetaTags {
  const { post, siteConfig, url } = args
  const title = post.metaTitle ?? post.title
  const description = post.metaDescription ?? post.excerpt
  const ogImage = post.ogImage ?? post.featuredImage ?? siteConfig.seo.defaultOgImage
  const canonical = post.canonical ?? url

  return {
    title,
    description,
    canonical,
    robots: post.noindex ? "noindex,nofollow" : "index,follow",
    og: {
      title: post.ogTitle ?? title,
      description: post.ogDescription ?? description,
      image: ogImage,
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
