# CLAUDE.md

This file is a pointer for the Claude Code runtime. Claude Code auto-reads `CLAUDE.md` when working in a project; this exists so Claude doesn't miss the canonical entry point.

**The canonical agent entry point for this repository is [README.md](README.md), in the section titled "🤖 For agents starting a job in this repo".**

Read that section first. It contains the job-to-runbook router, universal rules every agent must follow (hosting-agnostic, two-repos-per-integration, patch-only versioning), where to look up site / server / access info, the end-of-job protocol, and what NOT to do without asking.

The same routing applies regardless of which agent runtime is reading. There is one source of truth — README.md — and this file just makes sure Claude lands there.

For other agent runtimes, see [AGENTS.md](AGENTS.md) (same pointer).
