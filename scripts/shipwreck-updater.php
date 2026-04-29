<?php
/**
 * shipwreck-updater.php — Universal self-updater for Shipwreck static engines.
 *
 * Drop into any host that has PHP and cron. Reads its config from a sibling
 * file, polls a GitHub release endpoint daily (via cron), and atomically swaps
 * the installed dist when a newer version is available. Designed for cheapest-
 * tier shared cPanel — no SSH, no Node, no build tools required on the host.
 *
 * Usage:
 *   1. Place this file at /home/<domain>/public_html/shipwreck-updater.php
 *   2. Place its config at /home/<domain>/.shipwreck-updater.config.php
 *      (one level above the public path so it's never web-served)
 *   3. Add a cron line (the install-updater.sh helper script generates this for you):
 *        <RANDOM_MIN> <RANDOM_HOUR_23-02> * * * curl -s -m 60 https://<domain>/shipwreck-updater.php?token=<TOKEN> > /dev/null
 *
 * Endpoints:
 *   GET  ?token=<TOKEN>          run an update check (cron hits this)
 *   GET  ?token=<TOKEN>&action=status   return JSON status (for monitoring)
 *   GET  ?token=<TOKEN>&action=rollback rollback to previous version
 *
 * Response: JSON. Cron typically discards stdout; status endpoint is for humans.
 *
 * Security:
 *   - Auth via shared token in config (random 32+ chars, generated at install)
 *   - Token is required on EVERY request — there is no unauthed surface
 *   - HTTPS-only enforced (refuses http requests)
 *   - GitHub release tarball SHA256 verified against the release notes before extract
 *
 * Reliability:
 *   - Atomic dir swap: extract to <install>.new, swap with <install>, keep <install>.old.<ts>
 *   - Last 3 .old.* dirs retained for rollback; older pruned
 *   - All actions logged to <install>/.update-log
 */

// ---------- Boot ----------

declare(strict_types=1);
header('Content-Type: application/json');
http_response_code(200);

$configPath = __DIR__ . '/../.shipwreck-updater.config.php';
if (!is_file($configPath)) {
    respond(500, ['error' => 'config_missing', 'expected_at' => $configPath]);
}
$config = require $configPath;

if (!is_array($config) || empty($config['token'])) {
    respond(500, ['error' => 'config_invalid']);
}

// HTTPS enforcement (allow CLI / localhost for testing)
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
    || PHP_SAPI === 'cli'
    || ($_SERVER['REMOTE_ADDR'] ?? '') === '127.0.0.1';
if (!$isHttps) {
    respond(400, ['error' => 'https_required']);
}

// Token check (constant-time)
$provided = $_GET['token'] ?? '';
if (!hash_equals((string) $config['token'], (string) $provided)) {
    respond(403, ['error' => 'forbidden']);
}

// ---------- Dispatch ----------

$action = $_GET['action'] ?? 'update';
switch ($action) {
    case 'update':   respond(200, runUpdate($config));
    case 'status':   respond(200, getStatus($config));
    case 'rollback': respond(200, runRollback($config));
    default:         respond(400, ['error' => 'unknown_action']);
}

// ---------- Actions ----------

function runUpdate(array $config): array
{
    $installPath = rtrim($config['install_path'], '/');
    $repo = $config['release_repo'];
    $log  = "$installPath/.update-log";

    $current = readVersion($installPath);
    $release = fetchLatestRelease($repo);
    if (!$release) {
        appendLog($log, 'check_failed', ['reason' => 'github_unreachable']);
        return ['ok' => false, 'reason' => 'github_unreachable'];
    }

    $latestVersion = ltrim($release['tag_name'] ?? '', 'v');
    if (!$latestVersion) {
        return ['ok' => false, 'reason' => 'release_has_no_tag'];
    }

    if ($current === $latestVersion) {
        return ['ok' => true, 'noop' => true, 'version' => $current];
    }

    // Find the dist tarball asset
    $asset = null;
    foreach (($release['assets'] ?? []) as $a) {
        if (preg_match('/^blog-dist.*\.tar\.gz$/', $a['name'])) { $asset = $a; break; }
    }
    if (!$asset) {
        appendLog($log, 'no_asset', ['version' => $latestVersion]);
        return ['ok' => false, 'reason' => 'no_dist_asset_in_release'];
    }

    // Download
    $tmpDir  = sys_get_temp_dir() . '/shipwreck-' . bin2hex(random_bytes(6));
    @mkdir($tmpDir);
    $tarPath = "$tmpDir/dist.tar.gz";
    if (!downloadFile($asset['browser_download_url'], $tarPath)) {
        cleanup($tmpDir);
        appendLog($log, 'download_failed', ['url' => $asset['browser_download_url']]);
        return ['ok' => false, 'reason' => 'download_failed'];
    }

    // Verify SHA256 (release body should contain a line like: SHA256: <hash>)
    if (!empty($release['body']) && preg_match('/SHA256:\s*([0-9a-f]{64})/i', $release['body'], $m)) {
        $actual = hash_file('sha256', $tarPath);
        if ($actual !== strtolower($m[1])) {
            cleanup($tmpDir);
            appendLog($log, 'sha_mismatch', ['expected' => $m[1], 'got' => $actual]);
            return ['ok' => false, 'reason' => 'sha256_mismatch'];
        }
    }

    // Extract
    $extractDir = "$tmpDir/extracted";
    @mkdir($extractDir);
    $tarCmd = "tar -xzf " . escapeshellarg($tarPath) . " -C " . escapeshellarg($extractDir) . " 2>&1";
    exec($tarCmd, $out, $code);
    if ($code !== 0) {
        cleanup($tmpDir);
        appendLog($log, 'extract_failed', ['code' => $code, 'output' => $out]);
        return ['ok' => false, 'reason' => 'extract_failed'];
    }

    // The tarball typically contains a top-level dist/ dir; resolve actual content dir.
    $contentDir = $extractDir;
    $entries = array_diff(scandir($extractDir) ?: [], ['.', '..']);
    if (count($entries) === 1) {
        $only = $extractDir . '/' . reset($entries);
        if (is_dir($only)) { $contentDir = $only; }
    }

    // Atomic swap
    $newPath = $installPath . '.new';
    $oldPath = $installPath . '.old.' . date('YmdHis');

    @removeDir($newPath);
    if (!@rename($contentDir, $newPath)) {
        // Fall back to copy if rename across filesystems fails
        @mkdir($newPath, 0755, true);
        copyDirRecursive($contentDir, $newPath);
    }

    if (is_dir($installPath) && !@rename($installPath, $oldPath)) {
        cleanup($tmpDir);
        @removeDir($newPath);
        appendLog($log, 'swap_failed', ['stage' => 'archive_old']);
        return ['ok' => false, 'reason' => 'swap_failed_archive_old'];
    }
    if (!@rename($newPath, $installPath)) {
        // Critical — try to restore old
        @rename($oldPath, $installPath);
        cleanup($tmpDir);
        appendLog($log, 'swap_failed', ['stage' => 'install_new', 'rolled_back' => true]);
        return ['ok' => false, 'reason' => 'swap_failed_install_new_rolled_back'];
    }

    writeVersion($installPath, $latestVersion);
    appendLog($installPath . '/.update-log', 'updated', [
        'from' => $current,
        'to' => $latestVersion,
        'old_dir' => basename($oldPath),
    ]);

    pruneOldVersions($installPath, (int) ($config['keep_old_versions'] ?? 3));
    cleanup($tmpDir);

    // Cloudflare cache purge (optional)
    if (!empty($config['cloudflare_zone_id']) && !empty($config['cloudflare_api_token'])) {
        $purgeOk = purgeCloudflare($config['cloudflare_zone_id'], $config['cloudflare_api_token']);
        appendLog($installPath . '/.update-log', $purgeOk ? 'cf_purged' : 'cf_purge_failed', []);
    }

    return [
        'ok' => true,
        'updated' => true,
        'from' => $current,
        'to' => $latestVersion,
    ];
}

function getStatus(array $config): array
{
    $installPath = rtrim($config['install_path'], '/');
    $current = readVersion($installPath);
    $release = fetchLatestRelease($config['release_repo']);
    $latest = $release ? ltrim($release['tag_name'] ?? '', 'v') : null;
    $log = is_file("$installPath/.update-log")
        ? array_slice(file("$installPath/.update-log", FILE_IGNORE_NEW_LINES) ?: [], -10)
        : [];
    return [
        'ok' => true,
        'installed_version' => $current,
        'latest_version' => $latest,
        'is_current' => $current && $latest && $current === $latest,
        'recent_log' => $log,
    ];
}

function runRollback(array $config): array
{
    $installPath = rtrim($config['install_path'], '/');
    $parentDir = dirname($installPath);
    $base = basename($installPath);
    $candidates = [];
    foreach (scandir($parentDir) ?: [] as $entry) {
        if (preg_match('/^' . preg_quote($base, '/') . '\.old\.(\d+)$/', $entry, $m)) {
            $candidates[] = ['name' => $entry, 'ts' => (int) $m[1]];
        }
    }
    if (empty($candidates)) {
        return ['ok' => false, 'reason' => 'no_previous_version'];
    }
    usort($candidates, fn($a, $b) => $b['ts'] - $a['ts']);
    $previous = $parentDir . '/' . $candidates[0]['name'];
    $rollbackBackup = $installPath . '.failed.' . date('YmdHis');
    if (!@rename($installPath, $rollbackBackup)) {
        return ['ok' => false, 'reason' => 'rollback_failed_archive_current'];
    }
    if (!@rename($previous, $installPath)) {
        @rename($rollbackBackup, $installPath);
        return ['ok' => false, 'reason' => 'rollback_failed_restore_previous'];
    }
    appendLog($installPath . '/.update-log', 'rolled_back', [
        'from' => readVersion($rollbackBackup),
        'to' => readVersion($installPath),
    ]);
    return ['ok' => true, 'rolled_back_to' => readVersion($installPath)];
}

// ---------- Helpers ----------

function fetchLatestRelease(string $repo): ?array
{
    $url = "https://api.github.com/repos/$repo/releases/latest";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERAGENT => 'shipwreck-updater/1.0',
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Accept: application/vnd.github+json'],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code !== 200 || !$body) return null;
    $json = json_decode($body, true);
    return is_array($json) ? $json : null;
}

function downloadFile(string $url, string $dest): bool
{
    $fp = fopen($dest, 'wb');
    if (!$fp) return false;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FILE => $fp,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'shipwreck-updater/1.0',
        CURLOPT_TIMEOUT => 120,
    ]);
    $ok = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    fclose($fp);
    return $ok && $code === 200 && filesize($dest) > 0;
}

function purgeCloudflare(string $zoneId, string $apiToken): bool
{
    $ch = curl_init("https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['purge_everything' => true]),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $apiToken",
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 20,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $code === 200 && str_contains((string) $body, '"success":true');
}

function readVersion(string $installPath): ?string
{
    $f = "$installPath/.version";
    return is_file($f) ? trim((string) file_get_contents($f)) : null;
}
function writeVersion(string $installPath, string $version): void
{
    @file_put_contents("$installPath/.version", $version . "\n");
}

function appendLog(string $path, string $event, array $extra): void
{
    $line = json_encode(['ts' => date('c'), 'event' => $event] + $extra) . "\n";
    @file_put_contents($path, $line, FILE_APPEND);
}

function pruneOldVersions(string $installPath, int $keep): void
{
    $parent = dirname($installPath);
    $base = basename($installPath);
    $olds = [];
    foreach (scandir($parent) ?: [] as $entry) {
        if (preg_match('/^' . preg_quote($base, '/') . '\.old\.(\d+)$/', $entry, $m)) {
            $olds[] = ['path' => "$parent/$entry", 'ts' => (int) $m[1]];
        }
    }
    usort($olds, fn($a, $b) => $b['ts'] - $a['ts']);
    foreach (array_slice($olds, $keep) as $stale) {
        @removeDir($stale['path']);
    }
}

function removeDir(string $dir): void
{
    if (!is_dir($dir)) return;
    foreach (scandir($dir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $p = "$dir/$entry";
        is_dir($p) ? removeDir($p) : @unlink($p);
    }
    @rmdir($dir);
}

function copyDirRecursive(string $src, string $dst): void
{
    @mkdir($dst, 0755, true);
    foreach (scandir($src) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $s = "$src/$entry";
        $d = "$dst/$entry";
        is_dir($s) ? copyDirRecursive($s, $d) : @copy($s, $d);
    }
}

function cleanup(string $tmpDir): void { removeDir($tmpDir); }

function respond(int $code, array $payload): never
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
