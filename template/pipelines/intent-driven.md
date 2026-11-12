# Pipeline: intent-driven

Use when you already know what you want in prose and don't need to harvest external websites or files first.

1. Write the brief (target users, core flows, constraints, non-goals) into `plans/<slug>/spec.md`.
2. Interview until the spec has acceptance tests.
3. Write `plans/<slug>/plan.md` (files, modules, seams) and `plans/<slug>/tasks.md` (the `- [ ] T001 …` list, with `dep:` links) — by hand, or by asking the agent. If you have GitHub Spec Kit installed, its `/speckit.plan` and `/speckit.tasks` commands are one way to produce the same two files; the template never requires it.

Then run the normal loop (docs/PLAYBOOK.md §2): one task per session, `just check` green, tick the box.
