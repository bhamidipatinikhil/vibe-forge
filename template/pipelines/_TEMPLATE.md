# Pipeline Strategy: [PIPELINE_NAME]

Copy this file to `pipelines/<name>.md` and fill in every bracket. A pipeline is a recipe for turning one kind of
input into the mediator contract — it never writes application code itself.

## 1. When to Use This Pipeline
- **Trigger scenario**: [when should you choose this pipeline instead of intent-driven?]
- **Input sources**: [e.g. live URLs, PDFs, research papers, production logs, a throwaway prototype]
- **Ephemeral scratchpad**: `.scratch/pipelines/<feature>/` (git-ignored; deleted after distillation)

## 2. Stage A — Exploration & Decomposition (human ↔ AI loop)
1. Initialize the scratchpad: `just harvest-init <feature>`
2. [Define how the raw inputs are parsed into structured, named artifacts inside the scratchpad — e.g. a
   `CATALOG.md` of named, selectable pieces]
3. Present the structured choices to the human for selection and modification.

## 3. Stage B — Mediator Handoff (pipeline → `plans/<slug>/`)
Translate the human's selections into the mediator contract (the same three files every pipeline produces):
1. Check `docs/glossary.md` and `docs/registry.md` (web) for existing terms and components before inventing new ones.
2. Write `plans/<slug>/spec.md` (user stories, acceptance tests), `plan.md` (files, modules, seams) and
   `tasks.md` (`- [ ] T001 …` with `dep:` links) — by hand, or by asking the agent; an installed spec tool
   (GitHub Spec Kit, OpenSpec) is one optional way to produce them, never a requirement.
3. Run `just sync-tasks` to see the dependency-ordered queue.

## 4. Stage C — Distillation & Garbage Collection (mediator → knowledge layer)
After the feature ships and the gate is green:
1. Promote any reusable new components into `docs/registry.md` with their scope tier
   (`GLOBAL`, `ARCHETYPE:<name>`, `FEATURE:<name>`, `ATOM`) and code seam path.
2. Update `docs/glossary.md` for new domain terms; write an ADR in `docs/decisions/` for hard-to-reverse trade-offs.
3. `just distill` (human approval of the diff) → commit → `just prune-scratch <feature>` to delete the scratchpad.
