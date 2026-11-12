# Pipeline: reference-study

Use when borrowing a feature or design from another codebase (a clone, an open-source app).

1. `git clone --depth 1` the reference outside the project (`~/refs/<name>`).
2. Study it read-only; record the feature list and the licence.
3. Write `plans/<slug>/spec.md` with their stack translated to this one; never install or run the reference.
