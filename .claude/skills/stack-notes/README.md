# Stack-Specific Notes

The [integrate-shipwreck-blog](../integrate-shipwreck-blog.md) skill is **universal** — it works on any stack that can serve static files. But every stack has its own quirks (where `.htaccess` lives, whether SSH is enabled at which tier, how cron is scheduled in the control panel, what the docroot path looks like, etc.).

As we integrate the blog into real-world hosts, we capture stack-specific quirks here so future integrations on the same stack benefit immediately instead of rediscovering the same gotchas.

## When to consult this directory

After picking your deploy mode in the integration skill, check whether a `<stack>.md` file exists for the host you're integrating into. If yes, read it before Phase 6. If no, follow the universal procedure.

## When to write a new stack-notes file

While running an integration on a stack we haven't seen before, **log gotchas as you hit them.** When the integration completes and the user is satisfied with the result, write a feedback log following the template below. The dev agent (Claude) graduates that log into a permanent `.md` file in this directory after a few real integrations on the same stack confirm the patterns are stable.

## Feedback log template

When you finish an integration on a new stack, save a session log at:

```
D:/NyXi's Vault/Sessions/YYYY-MM-DD-<your-name>-shipwreck-blog-integration-<stack-name>.md
```

Following this shape:

```markdown
---
date: YYYY-MM-DD
project: shipwreck-blog-engine
tags: [session-log, shipwreck-blog-engine, integration, stack-<stack-name>]
source: claude-code
---

# Session: Shipwreck Blog Integration on <stack-name> — <YYYY-MM-DD>

## Stack identity
- Control panel / OS / webserver / PHP version / SSH availability
- DNS provider / CDN provider
- Anything else that distinguishes this stack from a generic install

## Gotchas hit (the meat — what was different from the universal skill)
- Each gotcha as a numbered item: what failed, root cause, fix applied
- Be specific — paths, command outputs, error messages
- The goal is the next agent on this stack reads this and avoids the same trap

## Things that worked unmodified
- Phases / steps that ran exactly as the universal skill described
- These confirm the universal pattern holds; no need to add stack-specific notes for them

## Recommended additions to the universal skill
- Anything that wasn't a stack quirk but a genuine universal gap
- (Goes back to the dev agent for the next engine release, NOT into stack-notes)

## Stack-notes patch (proposal)
- A draft of what should go in `.claude/skills/stack-notes/<stack-name>.md` after this integration
- Concrete: the template below, filled in
```

## Stack-notes file template

When the dev agent graduates a feedback log into a permanent stack-notes entry:

```markdown
# Stack Notes — <stack-name>

**What this is:** <one-line stack identity>
**First documented after:** <link to the feedback log session>

## Quirks vs the universal skill

### Phase X — <quirk title>
- What's different
- The fix specific to this stack
- Why (root cause, if known)

### Phase Y — <quirk title>
- ...

## Known-working configurations
- PHP version: ...
- Webserver: ...
- Control panel: ...
- Anything else load-bearing
```

## Current stack-notes files

(empty — no real integrations yet have produced enough confirmed gotchas to graduate into permanent notes)

When the first one lands, update this list.
