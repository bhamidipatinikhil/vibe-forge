# Pipeline: telemetry-driven

Use when production signal (Sentry, support tickets, error telemetry) must become a fix.

1. Reproduce the signal as a minimal failing test at the module seam.
2. Fix the root cause so the test turns green.
3. Make the class of bug mechanically impossible: an ast-grep rule, a boundary rule, or a deeper module interface — an ADR when the trade-off is hard to reverse.
