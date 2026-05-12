import type { Post, SiteConfig, FaqItem, AuthorRecord } from "../schemas/index.js"
import { buildPersonSchema } from "../schemas/author.js"
import { DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "./meta.js"

export interface ArticleAuthor {
  name: string
  url?: string
  /** Full author record — when provided, the engine emits a fully-populated
   *  Schema.org Person with E-E-A-T fields (sameAs, knowsAbout, jobTitle,
   *  worksFor, etc.) instead of a bare { @type: Person, name, url } stub.
   *  preparePostPageData passes this through when authors are resolved. */
  record?: AuthorRecord
}

export function articleSchema(args: {
  post: Post
  siteConfig: SiteConfig
  url: string
  authors?: ArticleAuthor[]
  /** Word count from the remark word-count plugin (preparePostPageData passes
   *  this through). Emitted into Schema.org `wordCount` — used by voice
   *  search and content-quality signals. */
  wordCount?: number
  /** @deprecated use `authors` */
  authorName?: string
  /** @deprecated use `authors` */
  authorUrl?: string
}) {
  const { post, siteConfig, url, authors, wordCount, authorName, authorUrl } = args

  const authorList: ArticleAuthor[] =
    authors && authors.length > 0
      ? authors
      : authorName
        ? [{ name: authorName, ...(authorUrl ? { url: authorUrl } : {}) }]
        : []

  // Build Schema.org author JSON-LD. When a full AuthorRecord is available
  // (passed in via `.record`), emit the rich E-E-A-T Person via
  // buildPersonSchema. Otherwise fall back to the minimal Person stub
  // (backward-compat for legacy callers).
  const personFromAuthor = (a: ArticleAuthor): Record<string, unknown> => {
    if (a.record) return buildPersonSchema(a.record)
    return {
      "@type": "Person",
      name: a.name,
      ...(a.url ? { url: a.url } : {}),
    }
  }
  const authorJsonLd =
    authorList.length === 0
      ? { "@type": "Organization", name: siteConfig.brand.organizationName }
      : authorList.length === 1
        ? personFromAuthor(authorList[0])
        : authorList.map(personFromAuthor)

  // image emitted as an ImageObject (with dimensions) when we have one —
  // Google's structured-data validator prefers this over a bare URL string.
  const imageUrl = post.ogImage ?? post.featuredImage ?? siteConfig.seo.defaultOgImage
  const imageW = post.featuredImageWidth ?? DEFAULT_OG_IMAGE_WIDTH
  const imageH = post.featuredImageHeight ?? DEFAULT_OG_IMAGE_HEIGHT
  const image = imageUrl
    ? { "@type": "ImageObject", url: imageUrl, width: imageW, height: imageH }
    : undefined

  // Publisher logo as a typed ImageObject. Dimensions emitted only when set
  // on siteConfig — Google's validator flags missing dims as a warning.
  const logoUrl = siteConfig.brand.logoUrl
  const logoW = siteConfig.brand.logoWidth
  const logoH = siteConfig.brand.logoHeight
  const publisherLogo = logoUrl
    ? {
        "@type": "ImageObject",
        url: logoUrl,
        ...(logoW ? { width: logoW } : {}),
        ...(logoH ? { height: logoH } : {}),
      }
    : undefined

  return {
    "@context": "https://schema.org",
    "@type": post.articleType ?? "BlogPosting",
    headline: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt,
    ...(image ? { image } : {}),
    /** dateCreated == datePublished for our model (we don't track creation
     *  separately from first publish). Still useful as a Schema.org signal. */
    dateCreated: post.publishDate.toISOString(),
    datePublished: post.publishDate.toISOString(),
    dateModified: (post.updatedDate ?? post.publishDate).toISOString(),
    inLanguage: siteConfig.seo.locale,
    ...(typeof wordCount === "number" && wordCount > 0 ? { wordCount } : {}),
    author: authorJsonLd,
    publisher: {
      "@type": "Organization",
      name: siteConfig.brand.organizationName,
      ...(publisherLogo ? { logo: publisherLogo } : {}),
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

/**
 * Speakable Schema.org markup — Google's signal for content that's
 * appropriate to read aloud via voice assistants. Mark up the intro,
 * TL;DR, or summary sections via CSS selectors or XPath. Increases
 * eligibility for Google Assistant audio surfaces.
 */
export function speakableSchema(input: {
  cssSelectors?: string[]
  xpath?: string[]
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SpeakableSpecification",
    ...(input.cssSelectors && input.cssSelectors.length > 0
      ? { cssSelector: input.cssSelectors }
      : {}),
    ...(input.xpath && input.xpath.length > 0 ? { xpath: input.xpath } : {}),
  }
}

/**
 * HowTo Schema.org markup — eligibility for step-by-step rich result
 * formats and voice-assistant procedural answers. Use for genuine
 * instructional content; faking it risks a structured-data manual action.
 */
export function howToSchema(input: {
  name: string
  description?: string
  totalTime?: string
  estimatedCost?: string
  steps: Array<{ name: string; text: string; url?: string; image?: string }>
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    ...(input.estimatedCost
      ? {
          estimatedCost: { "@type": "MonetaryAmount", value: input.estimatedCost, currency: "USD" },
        }
      : {}),
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: s.url } : {}),
      ...(s.image ? { image: s.image } : {}),
    })),
  }
}

/**
 * CollectionPage schema for blog index + tag / category / author archive
 * pages. Tells crawlers the page is a curated list of items (not a generic
 * web page or an article) — improves SERP-type classification.
 *
 * The `mainEntity` is an ItemList referencing every listed post by URL,
 * giving crawlers a structured representation of the archive's contents
 * separate from the visual card markup.
 */
export function collectionPageSchema(args: {
  name: string
  description?: string
  url: string
  siteConfig: SiteConfig
  posts: Array<{ id: string; data: Pick<Post, "title"> }>
}) {
  const { name, description, url, siteConfig, posts } = args
  const base = siteConfig.blogBasePath.replace(/\/$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    ...(description ? { description } : {}),
    url,
    inLanguage: siteConfig.seo.locale,
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.siteName,
      url: siteConfig.baseUrl,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: new URL(`${base}/${p.id}/`, siteConfig.baseUrl).toString(),
        name: p.data.title,
      })),
    },
  }
}
