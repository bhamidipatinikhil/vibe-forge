#!/usr/bin/env bash
# .claude/hooks/gates.sh — Stop hook: the turn cannot end until the same gate CI runs is green. Exit 2 = keep working.
# Runs when the tree is dirty or HEAD is not refs/vibe/gate-verified (the last commit that passed here), so a turn that ends
# with `git commit` is gated too and the first Stop of a session on a HEAD nobody verified runs the gate once; only a green run
# moves the ref. stop_hook_active (Claude Code is continuing because this hook blocked) does not skip the gate: the tree is
# re-checked, and after GATE_MAX_RED_STOPS (default 4) red Stops in one turn the turn ends with a systemMessage, so the
# fix-and-retry loop is bounded here (Claude Code's own 8-continuation cap resets on every tool call and cannot bound it).
# No `set -e` on purpose: every failure path reports and exits itself.
max_red="${GATE_MAX_RED_STOPS:-4}"
input=$(cat)
active=$(jq -r '.stop_hook_active // false' <<<"$input" 2>/dev/null)
sid=$(jq -r '.session_id // empty' <<<"$input" 2>/dev/null | tr -cd 'A-Za-z0-9_.-'); sid="${sid:0:64}"; sid="${sid:-nosession}"
set_counter() { counter="$1/vibe-gate-red-$sid"; if [[ "$active" != true ]]; then rm -f "$counter"; fi; }   # a new turn starts with a fresh budget
set_counter "${TMPDIR:-/tmp}"                                                                                 # until the git dir is known
red() {   # keep the turn open with $1 as the reason, at most $max_red times per turn
  local n first; n=$(( $(cat "$counter" 2>/dev/null || echo 0) + 1 )); echo "$n" >"$counter" 2>/dev/null
  if (( n > max_red )); then
    rm -f "$counter"; first="${1%%$'\n'*}"
    jq -n --arg m "gates.sh: the gate stayed red after $max_red attempts in this turn; the turn ends UNVERIFIED. Run 'just check' and fix it before the next task. ($first)" '{systemMessage:$m}'
    exit 0
  fi
  printf '%s\n' "$1" >&2; exit 2
}
d=$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)
{ [[ -n "$d" ]] && cd "$d" 2>/dev/null; } || { [[ -n "${CLAUDE_PROJECT_DIR:-}" ]] && cd "$CLAUDE_PROJECT_DIR" 2>/dev/null; } \
  || red "gates.sh: cannot cd to the project (cwd/CLAUDE_PROJECT_DIR unusable)"
st=$(git status --porcelain) || red "gates.sh: git status failed in $PWD"
set_counter "$(git rev-parse --git-dir)"                                                                      # per session and worktree, survives the turn
head=$(git rev-parse -q --verify HEAD 2>/dev/null || echo none)
verified=$(git rev-parse -q --verify refs/vibe/gate-verified 2>/dev/null || echo unset)
[[ -z "$st" && "$head" == "$verified" ]] && { rm -f "$counter"; exit 0; }                                    # nothing changed since the last green gate
command -v nix >/dev/null 2>&1 || red "gates.sh: nix not on PATH; start claude from 'nix develop' or direnv (see AGENTS.md)"
log=$(mktemp); trap 'rm -f "$log"' EXIT
if CI=1 nix develop .#quiet -c just check >"$log" 2>&1; then
  [[ "$head" != none ]] && git update-ref refs/vibe/gate-verified "$head"
  rm -f "$counter"; exit 0
fi
red "just check FAILED. Fix before finishing. Last 60 lines:
$(tail -n 60 "$log")"
