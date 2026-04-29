#!/usr/bin/env node
/**
 * deploy-blog.mjs — Push-style deploy for SSH-capable hosts (Prem3, Prem4, ops).
 *
 * Usage:
 *   node scripts/deploy-blog.mjs --site wollongong-weather
 *   node scripts/deploy-blog.mjs --site wollongong-weather --dry-run
 *   node scripts/deploy-blog.mjs --all
 *
 * Reads from .shipwreck/sites.json. For each site with deploy.method === "rsync"
 * (or sftp/ftp), runs:
 *   1. Build the blog locally  (cd <localPath>/<blogSourcePath> && npm install && npm run build)
 *   2. Optional: scripts/visual-diff.mjs against pinned goldens
 *   3. Push dist/ to remote host via rsync over SSH
 *   4. Optional: Cloudflare cache purge for the zone
 *   5. Update site's engineVersion in sites.json
 *
 * NOTE: this is the "push-style" deploy used for hosts where we control SSH
 * (Prem3/Prem4). For cheap shared cPanel and any host where we DON'T have
 * SSH credentials, sites pull updates themselves via shipwreck-updater.php
 * (see scripts/shipwreck-updater.php). The pull model is the universal default;
 * this script is for the faster push path on our own servers.
 *
 * Requires: node 20+, ssh, rsync (or lftp for sftp/ftp method).
 *
 * Cloudflare API token is read from $CLOUDFLARE_API_TOKEN env var
 * (or the path in $CLOUDFLARE_API_TOKEN_PATH if that env var is a file path).
 */
import { readFile, writeFile, stat } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import process from "node:process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, "..")
const SITES_FILE = join(REPO_ROOT, ".shipwreck", "sites.json")
const ENGINE_VERSION = JSON.parse(
  await readFile(join(REPO_ROOT, "packages", "blog-core", "package.json"), "utf8"),
).version

// ---------- args ----------

const args = parseArgs(process.argv.slice(2))
const sites = JSON.parse(await readFile(SITES_FILE, "utf8"))

const targets = args.all
  ? sites
  : args.site
    ? sites.filter((s) => s.name === args.site)
    : []

if (targets.length === 0) {
  console.error("Usage: node scripts/deploy-blog.mjs --site <name> | --all")
  console.error("Available sites:")
  for (const s of sites) console.error(`  - ${s.name} (${s.domain}, ${s.deploy.method})`)
  process.exit(1)
}

const failures = []
for (const site of targets) {
  console.log(`\n=== ${site.name} (${site.domain}) ===`)
  try {
    await deploySite(site, args)
  } catch (e) {
    console.error(`  ✗ FAIL: ${e.message}`)
    failures.push({ site: site.name, error: e.message })
  }
}

console.log(`\nDone. ${targets.length - failures.length}/${targets.length} succeeded.`)
if (failures.length > 0) {
  for (const f of failures) console.log(`  ✗ ${f.site}: ${f.error}`)
  process.exit(1)
}

// ---------- per-site deploy ----------

async function deploySite(site, opts) {
  const { name, domain, deploy, source, cloudflare } = site

  // 1. Resolve the local blog source dir
  const localRoot = source.localPath || `/home/rick/projects/${name}`
  const blogDir = join(localRoot, source.blogSourcePath || "_blog")
  await assertDir(blogDir, `blog source missing at ${blogDir}`)

  // 2. Build
  console.log(`  Building ${blogDir} ...`)
  run("npm", ["install", "--prefer-offline", "--no-audit", "--no-fund"], { cwd: blogDir })
  run("npm", ["run", "build"], { cwd: blogDir })
  const distDir = join(blogDir, "dist")
  await assertDir(distDir, "build did not produce a dist/ dir")

  // 3. Optional visual diff against host
  if (opts.diff) {
    console.log(`  Visual diff against https://${domain}/ ...`)
    run("node", [
      join(REPO_ROOT, "scripts", "visual-diff.mjs"),
      `https://${domain}/`,
      `https://${domain}${site.blogPath}/`,
    ])
  }

  // 4. Dry-run stops here
  if (opts.dryRun) {
    console.log(`  --dry-run set; not pushing to ${deploy.server}`)
    return
  }

  // 5. Push dist/ to remote
  switch (deploy.method) {
    case "rsync": await deployRsync(distDir, deploy); break
    case "sftp":  await deploySftp(distDir, deploy);  break
    case "manual":
      console.log(`  deploy.method === "manual" — built locally; push step skipped`)
      console.log(`  Built dist: ${distDir}`)
      return
    default:
      throw new Error(`Unsupported deploy.method: ${deploy.method}`)
  }

  // 6. Cloudflare cache purge
  if (cloudflare?.purgeOnDeploy && cloudflare.zoneId && cloudflare.zoneId !== "TODO_FILL_ON_DEPLOY") {
    await purgeCloudflare(cloudflare.zoneId, domain)
  } else {
    console.log(`  Skipping Cloudflare purge (zoneId not configured)`)
  }

  // 7. Update registry
  site.engineVersion = ENGINE_VERSION
  site.lastDeployed = new Date().toISOString()
  await writeFile(SITES_FILE, JSON.stringify(sites, null, 2) + "\n")
  console.log(`  ✓ Deployed engine ${ENGINE_VERSION} to ${domain}${site.blogPath}/`)
}

// ---------- transport methods ----------

async function deployRsync(distDir, deploy) {
  const { sshHost, sshUser, remotePath } = deploy
  const target = `${sshUser}@${sshHost}:${remotePath}`
  console.log(`  rsync -avz --delete ${distDir}/ ${target}`)
  run("rsync", ["-avz", "--delete", `${distDir}/`, target])
}

async function deploySftp(distDir, deploy) {
  // lftp mirror — works on any SSH/SFTP host
  const { sshHost, sshUser, sshPort = 22, remotePath } = deploy
  console.log(`  lftp mirror -R ${distDir} -> sftp://${sshUser}@${sshHost}:${sshPort}${remotePath}`)
  run("lftp", [
    "-c",
    `open -u ${sshUser},x sftp://${sshHost}:${sshPort}; mirror --reverse --delete --verbose ${distDir} ${remotePath}`,
  ])
}

async function purgeCloudflare(zoneId, domain) {
  const token = await readCloudflareToken()
  if (!token) {
    console.log("  Skipping Cloudflare purge (no API token in env)")
    return
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ purge_everything: true }),
  })
  if (!res.ok) {
    throw new Error(`Cloudflare purge failed: ${res.status} ${await res.text()}`)
  }
  console.log(`  ✓ Cloudflare cache purged for ${domain}`)
}

async function readCloudflareToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN.trim()
  const tokenPath = process.env.CLOUDFLARE_API_TOKEN_PATH
    ?? "/mnt/d/NyXi's Vault/Secrets/cloudflare-api-token.txt"
  try {
    return (await readFile(tokenPath, "utf8")).trim()
  } catch {
    return null
  }
}

// ---------- utils ----------

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}`)
}

async function assertDir(p, msg) {
  try { const s = await stat(p); if (!s.isDirectory()) throw new Error() }
  catch { throw new Error(msg) }
}

function parseArgs(argv) {
  const out = { all: false, dryRun: false, diff: false, site: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--all") out.all = true
    else if (a === "--dry-run") out.dryRun = true
    else if (a === "--diff") out.diff = true
    else if (a === "--site") out.site = argv[++i]
  }
  return out
}
