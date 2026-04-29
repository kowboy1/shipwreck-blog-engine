# FEEDBACK FOR CLAUDE — Final-Gate Governance (OpenClaw + Shipwreck)

## Context
We added two enforcement layers on the OpenClaw side:
1. Workspace hard rule in `~/.openclaw/workspace/AGENTS.md`
2. Runtime skill at `~/.openclaw/skills/shipwreck-final-gate/SKILL.md`

Goal: prevent mode drift and force doctor/audit-trail completion behavior.

---

## Recommendation (short version)
Keep these rules, but split responsibilities clearly:

- **Global runtime layer (OpenClaw AGENTS/skill):** enforce completion behavior contract only
- **Project layer (shipwreck repo skill/docs):** define workflow details and command specifics

Do **not** let runtime files become a frequently-changing mirror of project internals.

---

## Why
If runtime files track project implementation details too closely, they become a maintenance trap:
- drift between repo skill and runtime skill
- duplicated change surface
- hard-to-debug contradictions when one updates before the other

Best practice is:
- runtime = stable policy (what must happen before “done”)
- project runbook = evolving implementation (how to do it this release)

---

## Should Claude auto-update runtime files on every engine update?
**No, not blindly/automatically on every version bump.**

Better:
- only update runtime layer when the **completion contract** changes
- update project skill/docs whenever workflow details change

If desired, add a release checklist item:
- “Did completion contract semantics change?”
  - if yes: patch OpenClaw runtime skill + AGENTS rule
  - if no: leave runtime untouched

---

## Agnostic vs project-specific
Project-specific is valid here because failure mode is specific and costly.

But keep project-specific runtime text minimal and interface-oriented:
- require doctor pass
- require print-completion verbatim block
- require attestations for phase9/feedback/nav

Avoid embedding volatile details (phase prose, cosmetic steps, long rationale).

---

## Suggested architecture going forward

1. **Single source of truth for command contract**
   - Prefer defining canonical gate commands in `shipwreck-blog-doctor` help/output.
   - Runtime skill references those commands, not internal phase narrative.

2. **Versioned contract marker**
   - Add optional doctor output like: `completion_contract_version: X.Y`
   - Runtime skill can mention expected major contract shape.

3. **Compatibility guard**
   - If doctor lacks required subcommands (`print-completion`, `attest-*`), fail loudly and ask user how to proceed.

4. **Hard completion formatter**
   - Treat `print-completion` stdout as only accepted completion payload.
   - No freeform “done” summary.

5. **Release hygiene**
   - Include “runtime final-gate alignment” in engine release checklist.
   - Manual confirmation > auto-mutation.

---

## Practical answer to “is this a silly idea?”
No — this is a good idea.

The mistake would be making runtime rules a second full copy of the project runbook.
Keep runtime enforcement thin and strict; keep project logic in the repo skill.
That gives durability without ongoing mess.

---

## Concrete next tweak for Claude (optional)
In project skills, add a single explicit line near top and near “done”:

> “Completion output must be exactly `npx shipwreck-blog-doctor print-completion` stdout. Any other completion format is invalid.”

This keeps repo and runtime aligned with minimal duplication.
