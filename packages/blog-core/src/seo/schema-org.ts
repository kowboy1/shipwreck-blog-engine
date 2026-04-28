import type { Post, SiteConfig, FaqItem } from "../schemas/index.js"

export interface ArticleAuthor {
  name: string
  url?: string
}

export function articleSchema(args: {
  post: Post
  siteConfig: SiteConfig
  url: string
  authors?: ArticleAuthor[]
  /** @deprecated use `authors` */
  authorName?: string
  /** @deprecated use `authors` */
  authorUrl?: string
}) {
  const { post, siteConfig, url, authors, authorName, authorUrl } = args

  const authorList: ArticleAuthor[] =
    authors && authors.length > 0
      ? authors
      : authorName
        ? [{ name: authorName, ...(authorUrl ? { url: authorUrl } : {}) }]
        : []

  const authorJsonLd =
    authorList.length === 0
      ? { "@type": "Organization", name: siteConfig.brand.organizationName }
      : authorList.length === 1
        ? { "@type": "Person", name: authorList[0].name, ...(authorList[0].url ? { url: authorList[0].url } : {}) }
        : authorList.map((a) => ({
            "@type": "Person",
            name: a.name,
            ...(a.url ? { url: a.url } : {}),
          }))

  return {
    "@context": "https://schema.org",
    "@type": post.articleType ?? "BlogPosting",
    headline: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt,
    image: post.ogImage ?? post.featuredImage ?? siteConfig.seo.defaultOgImage,
    datePublished: post.publishDate.toISOString(),
    dateModified: (post.updatedDate ?? post.publishDate).toISOString(),
    author: authorJsonLd,
    publisher: {
      "@type": "Organization",
      name: siteConfig.brand.organizationName,
      ...(siteConfig.brand.logoUrl
        ? { logo: { "@type": "ImageObject", url: siteConfig.brand.logoUrl } }
        : {}),
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  }
}

export function organizationSchema(siteConfig: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.brand.organizationName,
    url: siteConfig.baseUrl,
    ...(siteConfig.brand.logoUrl ? { logo: siteConfig.brand.logoUrl } : {}),
  }
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }
}
