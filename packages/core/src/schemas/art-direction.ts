import { z } from "zod"

/**
 * Per-site art direction for hero image generation.
 *
 * Lives at `.nitroblog/art-direction.json` in the host site repo root (sibling
 * to `.nitroblog-site.json`). Read by the agent generating hero images for new
 * blog posts (NyXi via her GPT image-gen flow, or any other agent).
 *
 * Contract:
 *   - First post without a hero on a site: agent asks the user for art direction
 *     OR ("auto") screenshots the homepage and derives one. Then writes this file.
 *   - Subsequent posts: agent reads this file, uses `style` + `palette` + `subjectHint`
 *     as the consistent prompt seed, varying only the per-post topical specifics.
 *
 * This file is version-controlled with the site — once set, every agent that
 * generates a hero for that site gets a coherent visual identity.
 */
export const artDirectionSchema = z.object({
  /**
   * Freeform descriptor for the visual style.
   * Examples: "coastal photography, no text overlay", "minimalist line illustration with limited palette",
   *           "documentary-style street photography", "soft watercolour with grain".
   */
  style: z.string().min(1),

  /**
   * Optional palette anchors as hex colors. Image generator should bias toward these.
   * Example: ["#1e3a5f", "#f5e6c8", "#7ba9c4"]
   */
  palette: z.array(z.string()).optional(),

  /**
   * Aspect ratio for hero generation. Default 16:9 matches the card + hero render slots.
   */
  aspectRatio: z.enum(["16:9", "4:3", "1:1", "3:2"]).default("16:9"),

  /**
   * Optional content hint that should appear across heroes regardless of post topic.
   * Example: "Wollongong coastline, escarpment, or sky imagery" for a Wollongong weather blog.
   * Use to keep brand recognition consistent.
   */
  subjectHint: z.string().optional(),

  /**
   * Things the image generator should NEVER produce. Use to enforce brand rules.
   * Example: ["text overlays", "people's faces", "stock photo watermarks", "AI hand artifacts"]
   */
  avoid: z.array(z.string()).optional(),

  /**
   * Free-form additional notes for the prompt (e.g. composition hints, mood).
   */
  notes: z.string().optional(),

  /**
   * ISO-8601 timestamp the file was created. Set when the agent first writes it.
   */
  createdAt: z.string().datetime(),

  /**
   * Provenance of the art direction.
   * "user-provided" — user typed a description.
   * "derived-from-homepage" — agent looked at the live homepage and inferred a style.
   * "manual-edit" — someone hand-edited the file after initial creation.
   */
  source: z.enum(["user-provided", "derived-from-homepage", "manual-edit"]),
})

export type ArtDirection = z.infer<typeof artDirectionSchema>
