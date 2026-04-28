import type { SiteConfig } from "@shipwreck/blog-core"

const config: SiteConfig = {
  siteName: "Demo Site",
  baseUrl: "https://demo.example.com",
  blogBasePath: "/blog",
  brand: {
    organizationName: "Demo Site",
    logoUrl: "/logo.svg",
  },
  seo: {
    defaultOgImage: "/og-default.jpg",
    locale: "en_AU",
  },
  layout: {
    postsPerPage: 10,
    showReadingTime: true,
    showAuthor: true,
    showTableOfContents: true,
    showRelatedPosts: true,
    relatedPostsCount: 3,
  },
  ctaBlocks: {
    default: "book-consult",
    categoryOverrides: {
      seo: "request-audit",
    },
  },
}

export default config
