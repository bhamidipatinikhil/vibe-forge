---
status: accepted
date: 2026-10-31
decision-makers: project maintainers
---

# Record architecture decisions

## Context and Problem Statement

Agents and humans change this codebase in small, fast increments. The reasons
behind structural choices (layering, data flow, external dependencies, security
boundaries) disappear from chat sessions and PR threads within weeks, after which
the next change re-litigates or silently erodes them. Where should those
decisions live, and in what format, so that they are cheap to write, easy to
find from the repository alone and mechanically enforceable?

## Decision Drivers

* Readable by humans and agents from the repository alone, with no tool to install.
* Writing one costs minutes; the required sections force a stated problem and considered alternatives.
* A change to an architectural boundary must be impossible to merge unnoticed.

## Considered Options

* Architecture Decision Records in MADR 4 format under `docs/decisions/`
* An "Architecture" section in README or AGENTS.md
* ADR tooling (adr-tools, log4brains)

## Decision Outcome

Chosen option: "ADRs in MADR 4 format under `docs/decisions/`", because the
format is a plain Markdown template whose required spine (Context and Problem
Statement, Considered Options, Decision Outcome) needs no tooling, and a
one-line shell check can enforce it.

Files are named `NNNN-title-with-dashes.md`, numbered sequentially, and never
deleted: a superseded ADR gets `status: superseded by ADR-NNNN` and a link to
its successor. Copy this file to start a new one.

The first architectural rule this repository records is its layering, whose
executable form is `.dependency-cruiser.cjs` (run by `just arch`, part of
`just check`):

* `src/domain` is pure: it never imports from `src/app`, `src/infra` or `src/ui`.
* `src/app` (routes, the OpenAPI app) never imports from `src/ui`.
* No circular dependencies; non-test code under `src/` never imports a devDependency.
* Modules under `src/modules/*` are entered through their `index.ts` only; ADR 0003 has the module rules, which hold before the first module exists.

The layers are the directories `src/domain`, `src/app`, `src/schemas`,
`src/infra` and `src/ui`, enforced by `.dependency-cruiser.cjs`; changing that
file requires a new ADR in the same change: `scripts/docs-drift.sh` (run by
`just check`, hence by the pre-push hook, the agent's Stop hook and CI) fails
when it changes without a new `docs/decisions/NNNN-*.md`.

### Consequences

* Good, because the reason for every boundary is one `ls docs/decisions` away for the next agent session or reviewer.
* Good, because `copier update` never overwrites ADRs (`docs/decisions/*.md` is in the template's `_skip_if_exists`).
* Bad, because ADRs can go stale; superseding one is a deliberate act, not an edit in place.

### Confirmation

`bash scripts/docs-drift.sh` exits non-zero when `.dependency-cruiser.cjs`
changes without a new ADR (a `docs/decisions/NNNN-*.md` in the same commit
range), and `CODEOWNERS` routes `/docs/decisions/` and `/.dependency-cruiser.cjs`
to a human reviewer.

## Pros and Cons of the Options

### ADRs in MADR 4 format

* Good, because plain Markdown: no tooling, diffable and reviewable in PRs.
* Good, because the required sections record the rejected options, not only the winner.
* Bad, because nothing generates the file for you.

### An "Architecture" section in README or AGENTS.md

* Good, because it is already read.
* Bad, because one evolving section loses the history and the rejected options.
* Bad, because every line of AGENTS.md is paid for on every agent request.

### ADR tooling (adr-tools, log4brains)

* Good, because `adr new` scaffolds and links records.
* Bad, because both show weak maintenance signals (adr-tools: dozens of open issues and PRs, no visible releases; log4brains: last updated 2024) and add an install step.

## More Information

* MADR 4.0.0 (2024-09-17): <https://adr.github.io/madr/>
* Day 0 of `docs/PLAYBOOK.md` asks for `0002-stack.md`: framework, database and backups, feature-flag provider, deploy target, regulatory scope.
