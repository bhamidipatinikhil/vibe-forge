# Changelog

Versions follow PEP 440 and are git tags prefixed with `v` (Copier sorts template tags with PEP 440).
Generated projects move between versions with `copier update`; entries that rename or remove template files
must come with a `_migrations` entry in `copier.yml`.

## 0.1.0 (2026-11-12)

First release of vibe-forge: the enforced substrate of vibe-template (approach-2) combined with the knowledge
layer, pipelines and harness adapters of approach-1, plus the elements neither approach shipped.

- **Substrate (from vibe-template)**: Copier generator (`copier.yml`, `template/`, `new-project.sh`), the verified
  web/service scaffold (TanStack Start inside Hono, or Hono API only; Postgres, better-auth, pg-boss, email,
  feature flags, Sentry, OTel), the single `just check` quality gate wired into lefthook, the Claude Code Stop
  hook and CI, the security layer (sandbox, allow/ask/deny permissions, guard hooks, sops + age, SAST, the ASVS
  authorization suite, supply-chain workflows), CI/CD (ci, secpass, supply-chain, deploy, migrations,
  template-update), expand-only migrations with Squawk and the oasdiff breaking-change gate, and `copier update`
  following the template's `main`.
- **Harness adapters (new)**: the `harness` question (`claude`, `opencode` or `both`, default `both`). `.claude/`
  and `CLAUDE.md` render only for `claude`/`both`; `.opencode/` (an `opencode.jsonc` permission posture mirroring
  the Claude deny/ask lists, plus a `/check` command running the gate) renders only for `opencode`/`both`.
  `AGENTS.md` is the shared, harness-neutral brief; `justfile`'s `shellcheck` and `doctor` recipes adapt to the
  rendered adapters. Gates stay in `just` recipes, so every harness (and a human) runs the identical gate.
- **Knowledge layer (new)**: `docs/glossary.md` (canonical terms), `docs/registry.md` (web only: the scoped
  component ledger with GLOBAL/ARCHETYPE/FEATURE/ATOM tiers), `docs/learnings.md` (dated post-mortems; promote
  recurring lessons into AGENTS.md or a rule), and `docs/metrics.md` (the monthly ledger: commits, first-pass CI
  rate, review-rework ratio, $ per merged change; `just metrics` prints the commit counts). `scripts/docs-drift.sh`
  fails when AGENTS.md exceeds 60 lines.
- **Pipelines (new)**: `pipelines/` holds pluggable interaction pipelines — `intent-driven`, `reference-study`
  (visual/asset harvesting and read-only code study merged into one pipeline) and `telemetry-driven` (a production
  signal becomes a failing test at the seam, then a fix, then a rule or ADR that makes the bug class impossible) —
  plus `_TEMPLATE.md` for new ones. Every pipeline ends in the mediator contract: `plans/<slug>/{spec,plan,tasks}.md`.
  Raw harvest material lives in the ephemeral `.scratch/pipelines/<slug>/` (git-ignored), with `just harvest-init`,
  `just prune-scratch` and `just distill` (show the glossary/registry diff; human approval before committing).
- **Task graph (new, optional)**: `scripts/sync-tasks.mjs` reads the `- [ ] T001 …` tasks and `dep:` links from
  `plans/**/*.md`, prints a dependency-ordered queue (cycles are errors), and with `--bd` mirrors them to the Beads
  CLI when it is installed; without `bd` it skips cleanly — markdown stays the canonical store either way.
- **Context hygiene (new)**: `scripts/offload-context.mjs` pipes verbose command output to
  `.scratch/context-dumps/` and returns a compact summary plus the path (outputs over 100 lines or 5 KiB); the
  `re-inject.sh` SessionStart hook adds the active plans, glossary size and last gate status to the session context
  so task context survives `/clear` and compaction.
- **Unattended runs (new)**: `scripts/agent-run.sh` wraps `claude --bare -p` with a budget cap and validates the
  JSON output parses (schema validation stays with Claude's own `--json-schema`).
- **Template CI (new)**: `template-test.yml` renders a seventh answer set (`service-opencode`, exercising the
  OpenCode-only path); `gate-flake-rate.yml` (weekly) renders a fresh default-web project and runs `just check`
  three times to catch gate flakiness; `golden-prompt.yml` (weekly, budget-capped, skipped without its secret) runs
  the documented worked-example brief unattended and asserts the gate goes green — an acceptance test for the vibe
  process itself.
- **Docs**: `COMPLETE_GUIDE.md` (the full walkthrough, rebranded), `README.md`, `docs/PLAYBOOK.md` (harness-neutral,
  with the tier table and the distill ritual), ADRs 0001–0003 from the substrate plus ADR 0004 (the knowledge layer
  and pipelines decision).
