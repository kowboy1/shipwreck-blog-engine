import { z } from "zod"

export const siteConfigSchema = z.object({
  siteName: z.string().min(1),
  baseUrl: z.string().url(),
  blogBasePath: z.string().default("/blog"),

  brand: z.object({
    organizationName: z.string(),
    logoUrl: z.string().optional(),
    /** Logo intrinsic width in pixels — emitted into Schema.org publisher.logo.width.
     *  Google's structured-data validator flags missing dimensions on publisher logos. */
    logoWidth: z.number().int().positive().optional(),
    /** Logo intrinsic height in pixels — emitted into Schema.org publisher.logo.height. */
    logoHeight: z.number().int().positive().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
  }),

  seo: z.object({
    defaultOgImage: z.string().optional(),
    defaultFeaturedImage: z.string().optional(),
    defaultAuthorAvatar: z.string().optional(),
    twitterHandle: z.string().optional(),
    locale: z.string().default("en_AU"),
    /** External origins to preconnect to from every blog page. Speeds up
     *  third-party resource fetches (fonts, analytics, embeds, CDN). Each
     *  entry becomes `<link rel="preconnect" href="...">` in <head>. */
    preconnects: z.array(z.string().url()).optional(),
    /** External origins to DNS-prefetch (cheaper than preconnect — only
     *  resolves DNS, doesn't open the TCP+TLS connection). Use for low-
     *  priority third-party origins. */
    dnsPrefetches: z.array(z.string().url()).optional(),

    /**
     * Site-level schema emission opt-outs. Used when the host site is
     * already emitting these globally (e.g. a Keel-hosted site already
     * emits Organization sitewide — engine should NOT duplicate on its
     * listing pages or Google may parse conflicting entities).
     *
     * When `false`, engine omits the corresponding Schema.org block from
     * blog pages. Page-specific schemas (Article, CollectionPage, FAQ,
     * Breadcrumb, Speakable, HowTo) are unaffected — those stay engine-
     * owned regardless of these flags.
     */
    emitOrganizationSchema: z.boolean().default(true),
    /** When true (default false), the engine ALSO emits a WebSite schema
     *  on listing pages. Most hosts (Keel) emit this sitewide; the engine
     *  defaults to off to avoid duplicates. Turn on for standalone blog
     *  deployments where the engine is the only schema producer. */
    emitWebsiteSchema: z.boolean().default(false),
  }),

  layout: z
    .object({
      postsPerPage: z.number().int().positive().default(10),
      showReadingTime: z.boolean().default(true),
      showAuthor: z.boolean().default(true),
      showTableOfContents: z.boolean().default(true),
      showRelatedPosts: z.boolean().default(true),
      relatedPostsCount: z.number().int().positive().default(3),
    })
    .default({}),

  ctaBlocks: z
    .object({
      default: z.string().optional(),
      categoryOverrides: z.record(z.string(), z.string()).optional(),
    })
    .optional(),

  cards: z
    .object({
      fallbackImage: z.string().optional(),
      loadMore: z.boolean().default(true),
    })
    .default({}),

  heroes: z
    .object({
      /**
       * "required" — every published post must declare `featuredImage`. Doctor fails the
       * gate if any published post lacks one. This is the default.
       * "optional" — legacy / migration window. Doctor warns but does not fail.
       */
      policy: z.enum(["required", "optional"]).default("required"),
    })
    .default({}),

  sidebar: z
    .object({
      /**
       * "Popular articles" widget on post pages.
       * Reads .nitroblog/popularity.json if present; falls back to most-recent
       * published posts (excluding current) when no popularity data exists.
       */
      popular: z
        .object({
          enabled: z.boolean().default(true),
          limit: z.number().int().positive().default(5),
          heading: z.string().default("Popular articles"),
        })
        .default({}),
    })
    .default({}),

  /**
   * Optional manual override for the sidebar's "Popular articles" widget.
   * When set, supersedes popularity.json and recency fallback. Use to pin
   * specific posts (e.g. promote a flagship piece for a month).
   * Entries are slugs (no .mdx) — same form as filenames in src/content/posts/.
   */
  featuredPostsForSidebar: z.array(z.string()).optional(),

  /**
   * Per-site config for the /blog/ listing page (filter sidebar + extras).
   * All defaults are SEO-safe: static HTML still renders the paginated grid
   * for crawlers; filters are progressive-enhancement only.
   */
  listing: z
    .object({
      filters: z
        .object({
          enabled: z.boolean().default(true),
          showCategories: z.boolean().default(true),
          showTags: z.boolean().default(true),
          /** "auto" — only render the toggle if any post has featured:true. */
          showFeaturedToggle: z.enum(["auto", "always", "never"]).default("auto"),
          /** Minimum query length before the search input starts filtering. */
          minSearchChars: z.number().int().positive().default(3),
          /** Debounce milliseconds for the search input. */
          searchDebounceMs: z.number().int().nonnegative().default(120),
          /** Number of tag chips visible before the "See more" button hides the rest. */
          tagsVisibleLimit: z.number().int().positive().default(6),
          heading: z.string().default("Filter"),
        })
        .default({}),
      /**
       * Thin-archive de-indexing. When enabled, tag / category / author archive
       * pages with fewer than `threshold` published posts emit `noindex,follow`
       * meta robots — Google deprioritises thin pages and dilutes topical
       * authority across them, so removing them from the index can help.
       * Trade-off: loses long-tail "site:domain.com + tag" combo discoverability,
       * so default off — opt in deliberately when a site has lots of singleton
       * tag pages.
       */
      thinArchive: z
        .object({
          noindex: z.boolean().default(false),
          threshold: z.number().int().positive().default(3),
        })
        .default({}),
      sidebar: z
        .object({
          showRss: z.boolean().default(true),
          /** Show a "Popular this month" mini-list under the filters. */
          showPopular: z.boolean().default(false),
          popularLimit: z.number().int().positive().default(3),
        })
        .default({}),
    })
    .default({}),
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
