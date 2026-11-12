Run `just check` in the project shell, then report the honest PASS/FAIL/SKIP table from the
output. If the gate fails, diagnose the first failing gate (read its log under .scratch/context-dumps/ when the
output points to one) and propose the minimal fix — do not weaken a gate to make it pass.
