# Pipelines

Pluggable interaction pipelines: how raw ideas, external references and telemetry become specs, plans and code.

| Pipeline | Use it when | Output |
|---|---|---|
| intent-driven | You already know what you want in prose | `plans/<slug>/spec.md` |
| reference-study | You are borrowing a feature or design from another codebase | `plans/<slug>/spec.md` + CATALOG |
| telemetry-driven | Production signal (Sentry, support) must become a fix | failing test at the seam → fix → ADR/rule |
| _TEMPLATE.md | (not a pipeline) Copy it to `pipelines/<name>.md` to write your own | — |

Every pipeline ends in the Mediator contract: `plans/<slug>/{spec.md,plan.md,tasks.md}` — the same artifact whichever pipeline produced it. Spec CLIs (GitHub Spec Kit, OpenSpec) are one optional way to produce the trio; nothing here requires them.
