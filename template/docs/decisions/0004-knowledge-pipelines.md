# 0004 — Knowledge layer, pipelines and harness adapters

Date: 2026-11-12

## Context

vibe-forge combines two earlier approaches. The first (approach-1) had strong process design — pluggable
interaction pipelines, a five-layer knowledge model, a task DAG, context hygiene — but no enforced substrate: its
ideas lived in prompts the agent could ignore, on an empty repository, with several hosted dependencies (a
Dolt-backed task CLI, a hosted vector memory, a tree-sitter MCP server) that all had to work. The second
(approach-2) had the opposite profile: a verified, enforced substrate (gates, sandbox, security, CI/CD, template
updates) but no answer for intent communication, knowledge persistence between sessions, or dependent tasks.

## Decision

1. **The substrate wins; the process layer is ported onto it.** All gates, security, CI/CD and update machinery of
   approach-2 are kept unchanged. The knowledge/process ideas of approach-1 are added as files and recipes that the
   existing gates check.
2. **The knowledge model is slimmed from five layers to three durable + one ephemeral.** Law lives in
   `docs/decisions/` (ADRs); language in `docs/glossary.md`; the component ledger in `docs/registry.md` (web only,
   with an optional `ARCHETYPE` tier documented rather than enforced by default). The episodic vector memory
   (opencode-mem + Turso) and the AST MCP server are dropped as defaults: they are hosted or binary dependencies
   whose failure modes outweigh their benefit when `docs/learnings.md`, path-scoped rules and the LSP plugin cover
   most of the need at zero infra. Both are documented as opt-ins, not shipped.
3. **The mediator is a convention, not a CLI.** Every pipeline ends in `plans/<slug>/{spec,plan,tasks}.md` — the
   same markdown artifact whichever pipeline produced it. Spec Kit's ceremony ("the spec kit tax" its own playbook
   named) is avoided; the tier table (A/B/C) right-sizes process instead. The task DAG is optional: markdown tasks
   are canonical, `scripts/sync-tasks.mjs --bd` mirrors to Beads only when installed.
4. **Harness neutrality.** Neither source approach may lock the template to one agent CLI. `AGENTS.md` is the
   canonical brief; `.claude/` and `.opencode/` are thin adapters rendered by the `harness` answer; every gate is a
   `just` recipe so the definition of "done" is identical for any harness and for humans. Claude Code keeps the
   deeper integration (Stop-hook gate enforcement, sandbox, plugins); the OpenCode adapter ships the permission
   posture and documents that its gate enforcement is `just check` plus lefthook, not a Stop hook.
5. **The process itself is measured.** `docs/metrics.md` ships with the template (commits, first-pass CI rate,
   review-rework ratio, $ per merged change), `scripts/agent-run.sh` makes unattended runs parse-safe, and the
   template's CI gains a gate-flake-rate check and a budget-capped golden-prompt smoke — an acceptance test for the
   vibe process itself.

## Consequences

- Two adapter surfaces must be maintained; mitigated by keeping them thin and by the render matrix (the
  `service-opencode` answer set exercises the OpenCode-only path in CI).
- Knowledge files can drift; mitigated by `docs-drift.sh` (AGENTS.md ≤ 60 lines is enforced), the `just distill`
  approval gate and the quarterly audit ritual.
- The golden-prompt smoke costs real tokens; it is weekly, manual-trigger by default, budget-capped, and skipped
  cleanly when its secret is absent.
- Dropping the vector memory and AST MCP means genuinely cross-session semantic search and whole-graph queries are
  not available by default; the opt-in path is documented in `docs/PLAYBOOK.md`.
