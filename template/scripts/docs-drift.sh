#!/usr/bin/env bash
# scripts/docs-drift.sh — src changed ⇒ docs/README/CHANGELOG changed, or the commit carries "#no-docs <reason>"
set -euo pipefail
# Base: the merge base with origin/main, else the parent commit. `rev-parse --verify -q` prints nothing for an
# unknown revision (plain `rev-parse` echoes the literal "HEAD~1"), so a first commit or a depth-1 clone yields "".
base=$(git merge-base origin/main HEAD 2>/dev/null || git rev-parse --verify -q 'HEAD~1^{commit}' 2>/dev/null || true)
[[ -n "$base" ]] || echo "docs-drift: no base commit (first commit or shallow clone); checking uncommitted work only" >&2
# Files to judge: the commits since the base (when there is one) plus staged, unstaged and untracked work, because the
# Stop hook runs this gate on a dirty tree. Before the first commit HEAD is unborn, so `git diff HEAD` falls back to the index.
committed=""
[[ -z "$base" ]] || committed=$(git diff --name-only "$base"...HEAD)
tracked=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only --cached)
untracked=$(git ls-files --others --exclude-standard)
files=$(printf '%s\n' "$committed" "$tracked" "$untracked" | sort -u)
# "#no-docs <reason>" lives in a commit body, so it exempts src/ work once that work is committed.
log=""
[[ -z "$base" ]] || log=$(git log --format=%B "$base"..HEAD)
# Here-strings, not `echo | grep -q`: grep -q closes the pipe on the first match and, under pipefail, the SIGPIPE
# on a long file list would turn the check into a silent pass. (`grep -v` below reads its whole input, so that pipe is safe.)
# Test files under src/ change no behaviour, so they need no docs; otherwise every red step of TDD would trip the Stop hook.
src_changed=$(grep -E '^src/' <<<"$files" | grep -vE '\.(test|spec)\.ts$' || true)
if [[ -n "$src_changed" ]] && ! grep -qE '^(docs/|README\.md|CHANGELOG\.md|\.changeset/)' <<<"$files" \
   && ! grep -q '#no-docs' <<<"$log"; then
  echo "src/ changed without docs/README/CHANGELOG; update them or add '#no-docs <reason>' to the commit body" >&2; exit 1
fi
# .dependency-cruiser.cjs is the executable form of the architecture ADR: changing it needs a new ADR in the same change.
if grep -qE '^\.dependency-cruiser\.cjs$' <<<"$files" && ! grep -qE '^docs/decisions/[0-9]{4}-' <<<"$files"; then
  echo "architecture boundary changed without an ADR in docs/decisions/" >&2; exit 1
fi

# AGENTS.md is sent to the model on every request: keep it under 60 lines (docs/PLAYBOOK.md, Day 0).
agents_lines=$(wc -l < AGENTS.md)
if [ "$agents_lines" -gt 60 ]; then
  echo "AGENTS.md is $agents_lines lines (limit 60); delete lines the repo already makes obvious" >&2; exit 1
fi
