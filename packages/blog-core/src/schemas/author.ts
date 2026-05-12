import { z } from "zod"

export const authorSchema = z.object({
  name: z.string().min(1),
  /** Short bio shown in the byline + AuthorBio component (1-2 sentences). */
  bio: z.string().optional(),
  /** Longer-form bio emitted into Schema.org Person.description (full paragraph
   *  to a couple of paragraphs). When omitted, `bio` is used as the fallback. */
  description: z.string().optional(),
  avatar: z.string().optional(),
  url: z.string().url().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  /** Full GitHub URL or handle. Emitted into Schema.org Person.sameAs. */
  github: z.string().optional(),
  /** Mastodon profile URL (full URL — Mastodon handles are server-specific). */
  mastodon: z.string().url().optional(),
  /** Personal/professional website distinct from `url` if needed. */
  website: z.string().url().optional(),
  email: z.string().email().optional(),

  // ---- E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) ----
  // Optional metadata that flows into Schema.org Person properties to signal
  // author authority. Empty values are omitted from the generated JSON-LD.

  /** Author's role / title (Schema.org Person.jobTitle).
   *  Example: "Senior coastal forecaster", "SEO consultant", "Staff writer". */
  jobTitle: z.string().optional(),
  /** Organisation the author works for (Schema.org Person.worksFor.name).
   *  When set, emitted as a nested Organization schema. */
  worksFor: z.string().optional(),
  /** Topics the author has demonstrable expertise in
   *  (Schema.org Person.knowsAbout). Used as an E-E-A-T signal — Google
   *  matches these against the article subject to assess author authority.
   *  Example: ["coastal meteorology", "BOM radar interpretation", "marine forecasting"]. */
  knowsAbout: z.array(z.string()).optional(),
  /** Alma mater / qualifying institution (Schema.org Person.alumniOf.name).
   *  Optional E-E-A-T signal — use for authors with formal credentials. */
  alumniOf: z.string().optional(),
  /** Date the author joined the publication / started contributing.
   *  ISO-8601 date (YYYY-MM-DD). Helps Google evaluate Experience signal. */
  contributorSince: z.string().optional(),
})

export type AuthorRecord = z.infer<typeof authorSchema>

/**
 * Build a Schema.org Person object from an author record, including:
 *   - name, url, image, description
 *   - jobTitle, knowsAbout, worksFor (Organization), alumniOf (EducationalOrganization)
 *   - sameAs[] auto-built from twitter / linkedin / github / mastodon / website / url
 *
 * Used inside articleSchema's `author` field. Emits ONLY the fields that
 * are set on the author record — never invents data.
 */
export function buildPersonSchema(author: AuthorRecord): Record<string, unknown> {
  const sameAs: string[] = []
  if (author.twitter) {
    const handle = author.twitter.replace(/^@/, "")
    sameAs.push(`https://twitter.com/${handle}`)
  }
  if (author.linkedin) {
    const handle = author.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/(in\/)?/, "")
    sameAs.push(author.linkedin.startsWith("http") ? author.linkedin : `https://linkedin.com/in/${handle}`)
  }
  if (author.github) {
    const handle = author.github.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/^@/, "")
    sameAs.push(author.github.startsWith("http") ? author.github : `https://github.com/${handle}`)
  }
  if (author.mastodon) sameAs.push(author.mastodon)
  if (author.website) sameAs.push(author.website)
  if (author.url && !sameAs.includes(author.url)) sameAs.push(author.url)

  const description = author.description ?? author.bio

  const out: Record<string, unknown> = {
    "@type": "Person",
    name: author.name,
  }
  if (author.url) out.url = author.url
  if (author.avatar) out.image = author.avatar
  if (description) out.description = description
  if (author.jobTitle) out.jobTitle = author.jobTitle
  if (author.knowsAbout && author.knowsAbout.length > 0) out.knowsAbout = author.knowsAbout
  if (author.worksFor) {
    out.worksFor = { "@type": "Organization", name: author.worksFor }
  }
  if (author.alumniOf) {
    out.alumniOf = { "@type": "EducationalOrganization", name: author.alumniOf }
  }
  if (sameAs.length > 0) out.sameAs = sameAs
  return out
}
