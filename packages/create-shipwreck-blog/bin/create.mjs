#!/usr/bin/env node
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { cp, mkdir, readFile, writeFile, access } from "node:fs/promises"
import { existsSync } from "node:fs"
import prompts from "prompts"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Locate the demo-site to copy. Resolved relative to this package's location:
// packages/create-shipwreck-blog/bin/create.mjs -> ../../examples/demo-site
const TEMPLATE_DIR = resolve(__dirname, "..", "..", "..", "examples", "demo-site")

async function main() {
  const targetArg = process.argv[2]
  const target = resolve(process.cwd(), targetArg ?? "blog")

  if (existsSync(target)) {
    console.error(`✗ Target directory already exists: ${target}`)
    process.exit(1)
  }

  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`✗ Template not found at ${TEMPLATE_DIR}`)
    console.error("  This CLI must be run from inside the shipwreck-blog-engine repo,")
    console.error("  or installed where the template is co-located.")
    process.exit(1)
  }

  console.log(`\nShipwreck Blog — scaffolder\n`)

  const answers = await prompts([
    {
      type: "text",
      name: "siteName",
      message: "Site name (shown in nav, OG tags)",
      initial: "My Site",
    },
    {
      type: "text",
      name: "baseUrl",
      message: "Site base URL (production)",
      initial: "https://example.com",
      validate: (v) => /^https?:\/\//.test(v) || "must start with http:// or https://",
    },
    {
      type: "text",
      name: "blogBasePath",
      message: "Blog base path (where blog mounts on the site)",
      initial: "/blog",
    },
    {
      type: "text",
      name: "organizationName",
      message: "Organisation/brand name",
      initial: (prev, values) => values.siteName,
    },
    {
      type: "text",
      name: "twitter",
      message: "Twitter handle (optional, with @)",
      initial: "",
    },
  ])

  if (!answers.siteName || !answers.baseUrl) {
    console.log("Aborted.")
    process.exit(1)
  }

  await mkdir(target, { recursive: true })
  await cp(TEMPLATE_DIR, target, {
    recursive: true,
    filter: (src) => !src.includes("node_modules") && !src.includes("/dist") && !src.includes("/.astro"),
  })

  // Rewrite site.config.ts
  const configPath = join(target, "site.config.ts")
  const newConfig = `import type { SiteConfig } from "@shipwreck/blog-core"

const config: SiteConfig = {
  siteName: ${JSON.stringify(answers.siteName)},
  baseUrl: ${JSON.stringify(answers.baseUrl.replace(/\/$/, ""))},
  blogBasePath: ${JSON.stringify(answers.blogBasePath || "/blog")},
  brand: {
    organizationName: ${JSON.stringify(answers.organizationName || answers.siteName)},
    logoUrl: "/logo.svg",
  },
  seo: {
    defaultOgImage: "/og-default.jpg",
    locale: "en_AU",${answers.twitter ? `\n    twitterHandle: ${JSON.stringify(answers.twitter)},` : ""}
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
  },
}

export default config
`
  await writeFile(configPath, newConfig, "utf-8")

  // Rewrite package.json name
  const pkgPath = join(target, "package.json")
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"))
  pkg.name = `@shipwreck/blog-${slugify(answers.siteName)}`
  pkg.private = true
  delete pkg.dependencies["@shipwreck/blog-core"]
  delete pkg.dependencies["@shipwreck/blog-theme-default"]
  pkg.dependencies["@shipwreck/blog-core"] = "git+ssh://git@github.com:YOUR_ORG/shipwreck-blog-engine.git#workspace=@shipwreck/blog-core"
  pkg.dependencies["@shipwreck/blog-theme-default"] = "git+ssh://git@github.com:YOUR_ORG/shipwreck-blog-engine.git#workspace=@shipwreck/blog-theme-default"
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")

  console.log(`\n✓ Scaffolded ${target}\n`)
  console.log(`Next steps:`)
  console.log(`  1. cd ${target}`)
  console.log(`  2. Update package.json git URLs to point at your real engine repo`)
  console.log(`  3. npm install`)
  console.log(`  4. Theme the blog to match the host site (see INTEGRATION.md in the engine repo)`)
  console.log(`  5. npm run dev\n`)
}

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
