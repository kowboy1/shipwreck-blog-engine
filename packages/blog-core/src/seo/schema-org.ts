import type { Post, SiteConfig, FaqItem } from "../schemas/index.js"

export function articleSchema(args: {
  post: Post
  siteConfig: SiteConfig
  url: string
  authorName?: string
  authorUrl?: string
}) {
  const { post, siteConfig, url, authorName, authorUrl } = args
  return {
    "@context": "https://schema.org",
    "@type": post.articleType ?? "BlogPosting",
    headline: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt,
    image: post.ogImage ?? post.featuredImage ?? siteConfig.seo.defaultOgImage,
    datePublished: post.publishDate.toISOString(),
    dateModified: (post.updatedDate ?? post.publishDate).toISOString(),
    author: authorName
      ? { "@type": "Person", name: authorName, ...(authorUrl ? { url: authorUrl } : {}) }
      : { "@type": "Organization", name: siteConfig.brand.organizationName },
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
