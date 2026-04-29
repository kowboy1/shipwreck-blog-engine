# Engine Scripts

Helper scripts that support theming and integration. None are required at runtime — they assist agents and humans during onboarding new sites and verifying themes.

## One-time setup

```bash
npm install --save-dev playwright pixelmatch pngjs
npx playwright install chromium
```

## Scripts

### `extract-theme.mjs`

Visit a host site and emit a draft `tokens.css` with values sampled from computed styles.

```bash
node scripts/extract-theme.mjs https://<host-domain> > tokens.draft.css
```

Heuristics are best-effort — every value should be reviewed before use. The output marks unreliable tokens with `/* TODO: confirm ... */` comments.

See [TOKEN-CONTRACT.md](../packages/blog-theme-default/TOKEN-CONTRACT.md) for the full token list.

### `visual-diff.mjs`

Compare a host page to a freshly-themed blog page and report per-region pixel diff.

```bash
# Start the blog preview first
cd _blog && npm run build && npx astro preview --host 0.0.0.0 --port 4322 &

# Then diff
node scripts/visual-diff.mjs https://<host-domain> http://localhost:4322/blog/<slug>/
```

Output is one line per run plus a region breakdown on failure:

```
PASS: header 1.2%, body 0.8%, cta 3.4%, footer 0.9%
```

```
FAIL: header 0.4%, body 12.7%, cta 8.1%, footer 1.1%

Regions exceeding 5%: body, cta

Likely causes:
  body  → font-family / line-height / size
  cta   → button bg / radius / padding
  ...
```

### `bump-version.sh`

Bumps the engine package versions in lockstep. Existing helper, unrelated to integration.
