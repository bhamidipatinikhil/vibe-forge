#!/usr/bin/env bash
# new-project.sh [--local] <dir> [copier args, e.g. --defaults --data key=value]   — one project per run, as many runs as you like.
# This is the whole per-project bootstrap and the only supported way to instantiate the template:
# Copier records .copier-answers.yml (_src_path, _commit), which is what makes `copier update` work later.
#
# Template source (recorded verbatim as _src_path, so it must resolve on every machine, GitHub runners included):
#   VIBE_FORGE=<source>   explicit Copier source, e.g. gh:<owner>/vibe-forge
#   (unset)                  the `origin` remote of the clone this script lives in (the root of that clone), as
#                            gh:<owner>/<repo> for github.com remotes (other remotes are passed through unchanged);
#                            fails without a remote
#   --local                  this clone's directory, for template development only: the recorded absolute path
#                            exists nowhere else, so that project's weekly template-update.yml cannot resolve it
# Template version: always the source's `main` branch as it is on the source (pushed commits only), never a tag or
#   another branch, and never this working tree. Every later `copier update`, by hand or from the project's weekly
#   template-update.yml, follows `main` too (`--vcs-ref main`), so there is nothing to choose and nothing to switch.
#   With --local it renders this checkout instead, uncommitted changes included (`--vcs-ref HEAD`): that is how you
#   try a template change before you push it to main. Unless VIBE_FORGE or --local is set, the script first says
#   when the origin's main differs from this checkout (non-blocking).
# Copier itself comes from github:NixOS/nixpkgs/nixos-26.05, the branch the generated flake pins (copier 9.15.1 matches
# copier.yml's _min_copier_version): a bare `nixpkgs#copier` would resolve through the flake registry (nixpkgs-unstable
# on a fresh machine) and drift independently of every flake.lock. Inside the project, `nix develop` uses its own lock.
set -euo pipefail
usage="usage: new-project.sh [--local] <dir> [copier args, e.g. --defaults --data key=value]"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
use_local=0
if [ "${1:-}" = "--local" ]; then use_local=1; shift; fi
case "${1:-}" in
  -h|--help) echo "$usage"; exit 0 ;;
  "") echo "$usage" >&2; exit 2 ;;
  -*) echo "error: the project folder comes first: new-project.sh [--local] <dir> [--data key=value ...]" >&2
      exit 2 ;;
esac
dir="$1"; shift

# The template version is not a choice: refuse Copier's ref switches (-r/--vcs-ref, -g/--prereleases), also inside a
# cluster such as -lr. Values of the switches that take one (--data x, -d x) are skipped, not read as switches.
refuse() {
  echo "error: new-project.sh always renders the template's main branch, so it takes no $1" >&2
  echo "       (to try unpushed template changes: new-project.sh --local <dir>)." >&2
  exit 2
}
skip=0
for arg in "$@"; do
  if [ "$skip" = 1 ]; then skip=0; continue; fi
  case "$arg" in
    --) break ;;
    --local) echo "error: --local goes before the project folder: new-project.sh --local <dir> ..." >&2; exit 2 ;;
    --vcs-ref|--vcs-ref=*|--prereleases) refuse "${arg%%=*}" ;;
    --data|--data-file|--answers-file|--exclude|--skip) skip=1 ;;
    --*) ;;
    -?*)
      s="${arg#-}"
      while [ -n "$s" ]; do
        c="${s:0:1}"; s="${s:1}"
        case "$c" in
          r|g) refuse "-$c" ;;
          a|d|s|x) if [ -z "$s" ]; then skip=1; fi; break ;;
        esac
      done ;;
  esac
done

# Copier treats this folder as a git template only when it is the root of its own repository.
toplevel="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || true)"
is_root=0
if [ -n "$toplevel" ] && [ "$toplevel" = "$(cd "$script_dir" && pwd -P)" ]; then is_root=1; fi
if [ -n "${VIBE_FORGE:-}" ]; then
  TEMPLATE="$VIBE_FORGE"
elif [ "$use_local" = 1 ]; then
  TEMPLATE="$script_dir"
  if [ "$is_root" = 0 ]; then
    echo "warning: $TEMPLATE is not the root of its own git repository: Copier renders it as a plain directory and" >&2
    echo "         records no _commit, so 'copier update' will not work for this project (see README.md)" >&2
  fi
elif [ -n "$toplevel" ] && [ "$is_root" = 0 ]; then
  echo "error: $script_dir is inside the git repository $toplevel, not the root of its own clone," >&2
  echo "       so that repository's origin is not the template. Run the script from a clone of the template," >&2
  echo "       set VIBE_FORGE=gh:<owner>/vibe-forge, or pass --local for template development." >&2
  exit 1
else
  origin="$(git -C "$script_dir" remote get-url origin 2>/dev/null || true)"
  if [ -z "$origin" ]; then
    echo "error: $script_dir has no 'origin' remote, so the template source cannot be recorded portably." >&2
    echo "       Push the template first (README.md, one-time setup), set VIBE_FORGE=gh:<owner>/vibe-forge," >&2
    echo "       or pass --local for template development." >&2
    exit 1
  fi
  case "$origin" in
    git@github.com:*|ssh://git@github.com/*|https://github.com/*)
      repo="${origin#git@github.com:}"; repo="${repo#ssh://git@github.com/}"; repo="${repo#https://github.com/}"
      repo="${repo%/}"; repo="${repo%.git}"
      TEMPLATE="gh:$repo" ;;
    *) TEMPLATE="$origin" ;;
  esac
fi
ref=main; what="its main branch"
if [ "$use_local" = 1 ]; then ref=HEAD; what="this checkout, uncommitted changes included"; fi
echo "template source: $TEMPLATE ($what)" >&2

# Does Copier render what is checked out here? Only a note: Copier reads the source's main, not this clone. Not
# compared for VIBE_FORGE, which may name any repository.
if [ -z "${VIBE_FORGE:-}" ] && [ "$use_local" = 0 ] && git -C "$script_dir" rev-parse -q --verify HEAD >/dev/null 2>&1; then
  # gh:<owner>/<repo> is cloned over HTTPS, whatever origin's transport; no credential prompt: a source that cannot
  # be listed (offline, private without credentials) only skips the comparison.
  case "$TEMPLATE" in gh:*) src_url="https://github.com/${TEMPLATE#gh:}.git" ;; *) src_url="$TEMPLATE" ;; esac
  head="$(git -C "$script_dir" rev-parse HEAD)"
  here="$(git -C "$script_dir" symbolic-ref -q --short HEAD || echo "detached HEAD")"
  if out="$(GIT_TERMINAL_PROMPT=0 git -C "$script_dir" ls-remote "$src_url" refs/heads/main 2>/dev/null)"; then
    main="$(cut -f1 <<<"$out")"
    if [ -z "$main" ]; then
      echo "error: $TEMPLATE has no main branch, and projects are always made from main: push it first" >&2
      echo "       (git -C $(printf %q "$script_dir") push -u origin main)." >&2
      exit 1
    elif [ "$main" != "$head" ]; then
      if git -C "$script_dir" merge-base --is-ancestor HEAD "$main" 2>/dev/null; then
        echo "note: origin's main ($(git -C "$script_dir" rev-parse --short "$main")) is ahead of this checkout ($here): the project gets origin's main." >&2
      else
        echo "warning: Copier renders origin's main ($(printf '%.7s' "$main")), not this checkout ($here at $(git -C "$script_dir" rev-parse --short HEAD))," >&2
        echo "         so commits that are only here are not in the project. Merge them into main and push it first, or" >&2
        echo "         try them with --local. (If this clone has not fetched lately, git fetch tells you more.)" >&2
      fi
    fi
  else
    echo "note: cannot list the branches of $TEMPLATE (offline, or no login for a private template); this checkout is not compared" >&2
  fi
  if [ -n "$(git -C "$script_dir" status --porcelain --untracked-files=all -- copier.yml template)" ]; then
    echo "warning: copier.yml or template/ has uncommitted changes, and Copier does not render them (it reads $TEMPLATE):" >&2
    echo "         commit and push them to main first, or try them with --local." >&2
  fi
fi

nix run github:NixOS/nixpkgs/nixos-26.05#copier -- copy --trust --vcs-ref "$ref" "$TEMPLATE" "$dir" "$@"
cd "$dir"
git init -q -b main && git add -A                              # staged before the first `nix develop`: the flake fetcher then copies only tracked files
nix develop .#quiet -c pnpm install --no-frozen-lockfile       # first install: pnpm-lock.yaml and flake.lock are shipped, locked against the default answers; other answers (kind=service, options, node_major=24) re-lock here. The flag is explicit because pnpm freezes an existing lockfile whenever CI is set
nix develop .#quiet -c bash scripts/bootstrap-generated.sh      # openapi.json and .env.example follow from the project's own routes and env schemas (both are --checked by just check)
git add -A && git -c commit.gpgsign=false commit -qm "chore: scaffold from vibe-forge"   # one commit: scaffold, lock files, generated artifacts
direnv allow                                                   # nix-direnv caches the shell and registers a GC root
nix develop .#quiet -c pnpm install --frozen-lockfile           # from here on every install is frozen; this one proves the committed lockfile matches package.json
nix develop .#quiet -c lefthook install                         # hooks only after a successful install
nix develop .#quiet -c just doctor                              # version agreement: pnpm/node/playwright/agent CLI
nix develop .#quiet -c just check                               # the generated project must be green before you type a prompt
# Two commands, not `cd x && <agent>`: bash's direnv hook loads the project's shell only at the next prompt.
# The hint names the agent(s) this project actually renders (the harness answer), so it is right for
# opencode-only and both as well.
harness="$(sed -n 's/^harness: *//p' .copier-answers.yml 2>/dev/null || echo both)"
case "$harness" in
  claude)   hint="then run claude there   (open /sandbox once and confirm the Dependencies tab is green)" ;;
  opencode) hint="then run opencode there (start it from the dev shell so direnv sees the Nix toolchain)" ;;
  *)        hint="then run claude — or opencode — there   (open /sandbox once in Claude Code; confirm the Dependencies tab is green)" ;;
esac
printf 'ready: cd %q, %s\n' "$dir" "$hint"
