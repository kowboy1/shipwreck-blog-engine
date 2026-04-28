#!/usr/bin/env bash
#
# bump-version.sh — Bump the engine's version across all workspace packages and
# insert a new section in CHANGELOG.md.
#
# Usage:
#   ./scripts/bump-version.sh patch    # 0.1.0 → 0.1.1
#   ./scripts/bump-version.sh minor    # 0.1.0 → 0.2.0
#   ./scripts/bump-version.sh major    # 0.1.0 → 1.0.0
#   ./scripts/bump-version.sh X.Y.Z    # explicit version
#
# After running:
#   1. Edit CHANGELOG.md to fill in the new section (Added / Changed / Fixed)
#   2. Update any docs affected by the change
#   3. git add -A && git commit -m "feat(scope): summary"
#   4. git tag vX.Y.Z
#   5. git push origin main --tags

set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: $0 <patch|minor|major|X.Y.Z>" >&2
  exit 1
fi

# Read current version from root package.json
CURRENT=$(node -p "require('./package.json').version")

# Compute new version
case "$1" in
  patch|minor|major)
    NEW=$(node -e "
      const v = '$CURRENT'.split('.').map(Number);
      const kind = '$1';
      if (kind === 'major') { v[0]++; v[1]=0; v[2]=0; }
      else if (kind === 'minor') { v[1]++; v[2]=0; }
      else { v[2]++; }
      console.log(v.join('.'));
    ")
    ;;
  *)
    if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      NEW="$1"
    else
      echo "Invalid version: $1" >&2
      exit 1
    fi
    ;;
esac

echo "Bumping $CURRENT → $NEW"

# Update all workspace package.json files
PKGS=(
  "package.json"
  "packages/blog-core/package.json"
  "packages/blog-theme-default/package.json"
  "packages/create-shipwreck-blog/package.json"
  "examples/demo-site/package.json"
)

for pkg in "${PKGS[@]}"; do
  if [ -f "$pkg" ]; then
    node -e "
      const fs = require('fs');
      const path = '$pkg';
      const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
      data.version = '$NEW';
      fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    "
    echo "  updated $pkg"
  fi
done

# Insert new section in CHANGELOG.md
TODAY=$(date -u +%Y-%m-%d)

if [ -f CHANGELOG.md ]; then
  node -e "
    const fs = require('fs');
    const path = 'CHANGELOG.md';
    let text = fs.readFileSync(path, 'utf-8');

    const newSection = \`## [$NEW] - $TODAY\n\n### Added\n- (describe additions)\n\n### Changed\n- (describe changes)\n\n### Fixed\n- (describe fixes)\n\n\`;

    // Insert after the [Unreleased] header (and any content under it), before the next ## section
    if (text.includes('## [Unreleased]')) {
      // Move any [Unreleased] content into the new section, leave [Unreleased] empty
      const lines = text.split('\n');
      let i = 0;
      while (i < lines.length && !lines[i].startsWith('## [Unreleased]')) i++;
      i++; // past [Unreleased] header
      let unreleasedContent = [];
      while (i < lines.length && !lines[i].startsWith('## [')) {
        unreleasedContent.push(lines[i]);
        i++;
      }
      // i now points to the next ## section, or end of file
      const before = lines.slice(0, i).join('\n');
      const after = lines.slice(i).join('\n');
      // Build new section using accumulated unreleased content if non-empty
      const accumulated = unreleasedContent.join('\n').trim();
      const sectionToInsert = accumulated
        ? \`## [$NEW] - $TODAY\n\n\${accumulated}\n\n\`
        : newSection;
      // Reset [Unreleased] to empty
      const beforeLines = before.split('\n');
      let j = beforeLines.length - 1;
      while (j >= 0 && !beforeLines[j].startsWith('## [Unreleased]')) j--;
      const beforeUnreleased = beforeLines.slice(0, j + 1).join('\n');
      text = beforeUnreleased + '\n\n' + sectionToInsert + after;
    } else {
      // No [Unreleased] section — prepend new section after the title
      text = text.replace(/^(# [^\n]+\n+)/, '\$1## [Unreleased]\n\n' + newSection);
    }

    fs.writeFileSync(path, text);
  "
  echo "  inserted [$NEW] section in CHANGELOG.md"
else
  echo "  WARN: CHANGELOG.md not found"
fi

echo
echo "Done. Next steps:"
echo "  1. Edit CHANGELOG.md and fill in the [$NEW] section"
echo "  2. Update any docs affected by the change"
echo "  3. git add -A && git commit -m \"<type>(<scope>): <subject>\""
echo "  4. git tag v$NEW"
echo "  5. git push origin main --tags"
