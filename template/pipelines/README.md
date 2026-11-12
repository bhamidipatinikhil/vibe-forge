# Pipelines

Pluggable interaction pipelines: how raw ideas, external references and telemetry become specs, plans and code.

| Pipeline | Use it when | Output |
|---|---|---|
| intent-driven | You already know what you want in prose | `plans/<slug>/spec.md` |
| reference-study | You are borrowing a feature or design from another codebase | `plans/<slug>/spec.md` + CATALOG |
| telemetry-driven | Production signal (Sentry, support) must become a fix | failing test at the seam → fix → ADR/rule |

Every pipeline ends in the Mediator contract: `plans/<slug>/{spec.md,plan.md,tasks.md}` — the same artifact whichever pipeline produced it.
