#!/usr/bin/env bash
# install-updater.sh — One-shot installer for shipwreck-updater.php on a host.
#
# Usage (run on the consumer host, NOT locally):
#   curl -fsSL https://raw.githubusercontent.com/1tronic/shipwreck-blog-engine/main/scripts/install-updater.sh | bash -s -- \
#     --release-repo 1tronic/wollongong-weather-blog \
#     --install-path ~/public_html/blog \
#     --domain wollongongweather.com
#
# What it does:
#   1. Downloads shipwreck-updater.php into ~/public_html/
#   2. Generates a 32-char random token
#   3. Picks a random update minute (0–59) and hour (23–02 UTC offset = late local)
#   4. Writes ~/.shipwreck-updater.config.php with token + repo + install path
#   5. Adds a crontab line to poll the updater daily at the random time
#   6. Optionally captures Cloudflare zone + token if --cloudflare-* flags are passed
#   7. Prints the resulting cron line + the status URL for monitoring
#
# After install, do an initial run to seed /blog/:
#   curl "https://<domain>/shipwreck-updater.php?token=<TOKEN>"

set -euo pipefail

# --- Defaults ---
RELEASE_REPO=""
INSTALL_PATH=""
DOMAIN=""
CONFIG_DIR=""
PUBLIC_DIR=""
ENGINE_REPO="1tronic/shipwreck-blog-engine"
CF_ZONE_ID=""
CF_TOKEN=""
DRY_RUN=0

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-repo)        RELEASE_REPO="$2"; shift 2 ;;
    --install-path)        INSTALL_PATH="$2"; shift 2 ;;
    --domain)              DOMAIN="$2"; shift 2 ;;
    --public-dir)          PUBLIC_DIR="$2"; shift 2 ;;
    --config-dir)          CONFIG_DIR="$2"; shift 2 ;;
    --engine-repo)         ENGINE_REPO="$2"; shift 2 ;;
    --cloudflare-zone-id)  CF_ZONE_ID="$2"; shift 2 ;;
    --cloudflare-token)    CF_TOKEN="$2"; shift 2 ;;
    --dry-run)             DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$RELEASE_REPO" || -z "$INSTALL_PATH" || -z "$DOMAIN" ]]; then
  echo "Required: --release-repo OWNER/REPO --install-path /path/to/blog --domain example.com" >&2
  exit 1
fi

# Resolve paths
INSTALL_PATH="$(realpath -m "$INSTALL_PATH")"
if [[ -z "$PUBLIC_DIR" ]]; then PUBLIC_DIR="$(dirname "$INSTALL_PATH")"; fi
if [[ -z "$CONFIG_DIR" ]]; then CONFIG_DIR="$(dirname "$PUBLIC_DIR")"; fi  # one level above public

PHP_DEST="$PUBLIC_DIR/shipwreck-updater.php"
CONFIG_DEST="$CONFIG_DIR/.shipwreck-updater.config.php"

echo "==> Shipwreck updater installer"
echo "    Engine repo:    $ENGINE_REPO"
echo "    Release repo:   $RELEASE_REPO"
echo "    Install path:   $INSTALL_PATH"
echo "    Public dir:     $PUBLIC_DIR"
echo "    Config dir:     $CONFIG_DIR"
echo "    Domain:         $DOMAIN"
echo "    Cloudflare:     $([[ -n "$CF_ZONE_ID" ]] && echo "zone=$CF_ZONE_ID" || echo "(not configured)")"
echo

if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry-run — no changes will be made)"
  exit 0
fi

# Confirm
read -r -p "Proceed? [y/N] " yn
[[ "$yn" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

# --- Download updater PHP ---
echo "==> Downloading shipwreck-updater.php"
PHP_URL="https://raw.githubusercontent.com/$ENGINE_REPO/main/scripts/shipwreck-updater.php"
mkdir -p "$PUBLIC_DIR"
if ! curl -fsSL "$PHP_URL" -o "$PHP_DEST"; then
  echo "Failed to download $PHP_URL" >&2
  exit 1
fi
chmod 644 "$PHP_DEST"

# --- Generate token + random cron time ---
TOKEN="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
CRON_MIN=$((RANDOM % 60))
# Hour from {23, 0, 1, 2} — 4-slot low-traffic window, 240 distinct minute slots overall
HOUR_CHOICES=(23 0 1 2)
CRON_HOUR=${HOUR_CHOICES[RANDOM % 4]}

# --- Write config ---
echo "==> Writing config to $CONFIG_DEST"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DEST" <<PHP
<?php
return [
    'token'                => '$TOKEN',
    'release_repo'         => '$RELEASE_REPO',
    'install_path'         => '$INSTALL_PATH',
    'keep_old_versions'    => 3,
    'cloudflare_zone_id'   => '$CF_ZONE_ID',
    'cloudflare_api_token' => '$CF_TOKEN',
];
PHP
chmod 600 "$CONFIG_DEST"

# --- Add cron entry ---
CRON_LINE="$CRON_MIN $CRON_HOUR * * * curl -fsS -m 60 'https://$DOMAIN/shipwreck-updater.php?token=$TOKEN' > /dev/null 2>&1"
echo "==> Installing cron entry:"
echo "    $CRON_LINE"
( crontab -l 2>/dev/null | grep -v 'shipwreck-updater.php' ; echo "$CRON_LINE" ) | crontab -

# --- Final report ---
cat <<EOF

============================================================
  Shipwreck updater installed.
============================================================

  PHP:        $PHP_DEST
  Config:     $CONFIG_DEST
  Cron:       $CRON_MIN $CRON_HOUR * * * (random — keeps sites from hitting GitHub at the same minute)

  Token (keep secret — needed for status/rollback):
    $TOKEN

  Manual update now:
    curl "https://$DOMAIN/shipwreck-updater.php?token=$TOKEN"

  Status:
    curl "https://$DOMAIN/shipwreck-updater.php?token=$TOKEN&action=status"

  Rollback:
    curl "https://$DOMAIN/shipwreck-updater.php?token=$TOKEN&action=rollback"

  Add the status URL to Uptime Kuma (HTTP keyword: "is_current":true)
  to alert if the site falls behind on updates.

============================================================
EOF
