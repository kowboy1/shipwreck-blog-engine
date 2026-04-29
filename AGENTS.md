# AGENTS.md

This file is a pointer for agent runtimes that follow the [agents.md convention](https://agents.md) (Codex, Aider, Cursor, OpenAI agents, OpenClaw, custom agents).

**The canonical agent entry point for this repository is [README.md](README.md), in the section titled "🤖 For agents starting a job in this repo".**

Read that section first. It contains:
- The job-to-runbook router (which `.md` to follow for which task)
- Universal rules every agent must follow (hosting-agnostic, two-repos-per-integration, patch-only versioning)
- Where to look up site / server / access info if it's not in the prompt
- End-of-job protocol (registry update, feedback log, session log)
- What NOT to do without asking

The same routing applies regardless of which agent runtime you are. There is one source of truth — README.md — and this file just exists so agents that look here first don't miss it.

If you're Claude Code specifically, [CLAUDE.md](CLAUDE.md) is also a pointer to the same content.
