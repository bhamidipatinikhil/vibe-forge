#!/usr/bin/env bash
# .claude/hooks/guard.sh — PreToolUse backstop for the deny rules. Exit 2 = block; stderr is shown to Claude as the reason.
# shellcheck disable=SC2016  # the EREs below contain a literal \$HOME on purpose: it is command text, not a shell variable
set -euo pipefail
command -v jq >/dev/null 2>&1 || { echo "guard.sh: jq not on PATH; start claude from 'nix develop' or direnv" >&2; exit 2; }
input=$(cat)
tool=$(jq -r '.tool_name' <<<"$input"); cwd=$(jq -r '.cwd // empty' <<<"$input")
block() { echo "guard.sh blocked: $1" >&2; exit 2; }
norm() { realpath -m -- "$1" 2>/dev/null || printf '%s' "$1"; }
[[ -z "$cwd" ]] && cwd="${CLAUDE_PROJECT_DIR:-$PWD}"                      # an empty cwd would turn "$cwd"/* into /* (matches everything)
pd="${CLAUDE_PROJECT_DIR:-$cwd}"; cwd=$(norm "$cwd"); pd=$(norm "$pd")     # CLAUDE_PROJECT_DIR may be unset; it stays at the main checkout in worktree sessions
root=$(norm "$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || echo "$cwd")")   # the worktree/repo root that cwd belongs to
inside() { case "$1" in "$root"/*|"$cwd"/*|"$pd"/*|/tmp/*) return 0;; *) return 1;; esac; }
abs_path() { local p="${1/#\~/$HOME}"; [[ "$p" != /* ]] && p="$cwd/$p"; norm "$p"; }   # literal ~, relative paths and ../ traversal are compared normalised
# secret_path <normalised path or glob>: true when it names a secret file or directory. The basename is compared as text, so a glob
# such as *.pem or .env* is caught too while generic globs (*, **/*.ts) are not. Scope: settings.json's Read(secrets/**)/Edit(secrets/**)
# deny a directory named secrets at ANY depth for the file tools (permissions docs, "How deep a pattern matches"); this hook guards only
# the project-root secrets/ (cwd, CLAUDE_PROJECT_DIR, worktree root) so src/secrets/ stays usable from Bash. The policy rule is the
# stricter layer; this one is the backstop.
secret_path() {
  local f=$1 b d; b=$(basename -- "$f")
  case "$b" in .env.example|*.example|*.sample|*.template) return 1;; esac   # documented key lists
  case "$b" in .env|.env.*|.env[*?[]*|*.pem|*.key|credentials.json|id_rsa*|id_ed25519*|id_ecdsa*|id_dsa*) return 0;; esac
  for d in "$cwd/secrets" "$pd/secrets" "$root/secrets" "$HOME/.ssh" "$HOME/.aws" "$HOME/.config/sops" "$HOME/.gnupg" "$HOME/.config/gh"; do
    [[ "$f" == "$d" || "$f" == "$d/"* ]] && return 0
  done
  [[ "$f" == "$HOME/.npmrc" || "$f" == "$HOME/.netrc" || "$f" == "$HOME/.git-credentials" ]]
}
secret_msg="looks like a secret; run the app via sops exec-env / op run and never print secrets (.env.example is the documented key list)"
case "$tool" in
  Read|Edit|Write|NotebookEdit)
    f=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input"); [[ -z "$f" ]] && exit 0
    f=$(abs_path "$f")
    if secret_path "$f"; then block "'$f' $secret_msg"; fi
    if [[ "$tool" != "Read" ]]; then inside "$f" || block "edit outside the project/worktree: $f"; fi ;;
  Grep|Glob)
    # Read rules reach Grep and Glob only best-effort (permissions docs, "What Read and Edit rules cover"): the search path (a file
    # or a directory) gets the Read checks and the file glob (Glob's pattern, Grep's glob filter) is checked as text
    p=$(jq -r '.tool_input.path // empty' <<<"$input"); base="$cwd"
    if [[ -n "$p" ]]; then base=$(abs_path "$p"); if secret_path "$base"; then block "'$base' $secret_msg"; fi; fi
    if [[ "$tool" == Glob ]]; then g=$(jq -r '.tool_input.pattern // empty' <<<"$input"); else g=$(jq -r '.tool_input.glob // empty' <<<"$input"); fi
    if [[ -n "$g" && "$g" != "!"* ]]; then                                   # a !-negated glob excludes files, it cannot target them
      if [[ "$g" == /* || "$g" == "~"* ]]; then gf=$(abs_path "$g"); else gf=$(norm "$base/$g"); fi
      if secret_path "$gf" || [[ "$gf" == *"/secrets/"* ]]; then block "glob '$g' targets secret files; .env.example is the documented key list"; fi
    fi ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // empty' <<<"$input"); [[ -z "$cmd" ]] && exit 0
    # $noq: space-free quoted tokens unquoted ("+main" -> +main), quoted prose removed ("git push --force is forbidden" -> ""), for the command-shape rules
    noq=$(sed -E 's/"([^"[:space:]]*)"/\1/g; s/'"'"'([^'"'"'[:space:]]*)'"'"'/\1/g; s/"[^"]*"//g; s/'"'"'[^'"'"']*'"'"'//g' <<<"$cmd")
    sep='(^|[;&|(`[:space:]])'
    cpre='(/[^[:space:]]*/)?\\?'                                   # /usr/bin/git, \git: a path or a backslash before the command word
    shells='(ba|z|da|k)?sh'; interps='(python[0-9.]*|node|perl|ruby|php|deno|bun)'
    # shells take stdin as code with any args; interpreters only with no args or "-" (curl u | python3 -m json.tool is data). Any number of
    # pipes may sit between the download and the shell (curl u | base64 -d | sh); the pipe must not be the second bar of "||" (curl u || sh fallback.sh)
    grep -Eq '(curl|wget)[^;&]*[^|;&]\|[[:space:]]*(sudo[[:space:]]+)?((/[^[:space:]]*/)?env[[:space:]]+)?(/[^[:space:]]*/)?('"$shells"'([[:space:]]|$)|'"$interps"'([[:space:]]+-)?[[:space:]]*($|[;&|)]))' <<<"$cmd" && block "piping a download into a shell"
    grep -Eq "$sep"'('"$shells"'|'"$interps"'|eval|source|\.)[[:space:]]+[^;&|]*(<\(|\$\(|`)[[:space:]]*(curl|wget)[[:space:]]' <<<"$cmd" && block "executing a download via substitution"
    grep -Eq "$sep$cpre"'(sudo|doas|pkexec|run0)([[:space:]]|$)' <<<"$noq" && block "privilege escalation"
    grep -Eq '(^|[;&|(`][[:space:]]*)'"$cpre"'su([[:space:]]|$)' <<<"$noq" && block "privilege escalation"      # su only in command position: "echo su" is prose
    # rm: every target of a recursive rm (any option order, quotes honoured, ~ / $HOME / relative paths resolved against the directory
    # a preceding cd moved to) must stay inside the project or /tmp. Segments split on ; & | ( ) ` and newlines, so the words of an
    # inner $(...) command are not rm targets. "rm"/'rm' as a word is unquoted first; a quote that is not closed right after rm is prose.
    cmdr=$(sed -E 's/(^|[;&|(`[:space:]])["'"'"']rm["'"'"']([[:space:]]|$)/\1rm\2/g' <<<"$cmd")
    if grep -Eq "$sep$cpre"'rm([[:space:]]|$)' <<<"$noq"; then            # detect on the prose-free copy: a commit message quoting "rm -rf /" is not an rm
      base="$cwd"
      while IFS= read -r seg; do
        seg=$(sed -E 's/^[[:space:]]+//' <<<"$seg"); [[ -z "$seg" ]] && continue
        if grep -Eq '^(pushd|cd)([[:space:]]|$)' <<<"$seg"; then
          raw=$(sed -E 's/^(pushd|cd)[[:space:]]*//; s/^(-[A-Za-z]+[[:space:]]+)*//' <<<"$seg")
          d=$(xargs -r -n1 printf '%s\n' <<<"$raw" 2>/dev/null | head -1) || d=$(awk '{print $1}' <<<"$raw")
          [[ "$d" == - ]] && continue; [[ -z "$d" ]] && d="$HOME"
          d="${d//\$\{HOME\}/$HOME}"; d="${d//\$HOME/$HOME}"; d="${d/#\~/$HOME}"; [[ "$d" != /* ]] && d="$base/$d"; base=$(norm "$d"); continue
        fi
        seg=$(grep -oE '(^|[[:space:]])'"$cpre"'rm([[:space:]].*)?$' <<<"$seg" | head -1 | sed -E 's#^[[:space:]]*(/[^[:space:]]*/)?\\?rm#rm#') || true
        [[ -z "$seg" ]] && continue
        grep -Eq '(^|[[:space:]])(-[A-Za-z]*[rR][A-Za-z]*|--recursive)([[:space:]]|$)' <<<"$seg" || continue      # this rm is not recursive
        while IFS= read -r t; do
          [[ -z "$t" || "$t" == -* ]] && continue
          t="${t//\$\{HOME\}/$HOME}"; t="${t//\$HOME/$HOME}"; t="${t/#\~/$HOME}"; [[ "$t" != /* ]] && t="$base/$t"
          inside "$(norm "$t")" || block "recursive delete outside the project: $t"
        done < <(xargs -r -n1 printf '%s\n' <<<"${seg#rm}" 2>/dev/null || tr ' ' '\n' <<<"${seg#rm}")
      done < <(tr ';&|()`' '\n' <<<"$cmdr")
    fi
    term='([[:space:];&|)]|$)'
    gitp="$sep$cpre"'git([[:space:]]+(-[cC][[:space:]]*[^[:space:]]+|--[a-z-]+(=[^[:space:]]*)?|-p))*[[:space:]]+'    # global options: -c k=v, -C dir, --no-pager, --git-dir=x, -p
    grep -Eq "$gitp"'push([[:space:]]+[^;&|]*)?[[:space:]](--force|--mirror|-[a-zA-Z]*[fd][a-zA-Z]*'"$term"'|--force-with-lease|--delete|\+[^[:space:]]+|:[^[:space:]]+)' <<<"$noq" && block "force/delete push"
    # clean: options may carry a value (-e <pattern>, --exclude=<pattern>) before the -f
    grep -Eq "$gitp"'(reset([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+--hard'"$term"'|clean([[:space:]]+(-[a-zA-Z]+([[:space:]]+[^-[:space:]][^[:space:]]*)?|--[a-z-]+(=[^[:space:]]*)?))*[[:space:]]+(-[a-zA-Z]*f[a-zA-Z]*|--force)'"$term"'|branch([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+(-[a-zA-Z]*[fD][a-zA-Z]*|--force)'"$term"'|filter-branch)' <<<"$noq" && block "history-destroying git command"
    # command shapes (pnpm ... --no-frozen-lockfile, nix flake update) on the quote-stripped copy; policy tokens on the raw command,
    # because an edit of the policy file itself is quoted: echo "minimumReleaseAge: 0" >> pnpm-workspace.yaml
    grep -Eq '((pnpm|npm|yarn|bun|corepack)[^;&|]*(--no-frozen-lockfile|--frozen-lockfile=false)|'"$sep$cpre"'nix([[:space:]]+--?[a-z-]+([[:space:]]+[^-[:space:]][^[:space:]]*){0,2})*[[:space:]]+flake[[:space:]]+(update|lock))' <<<"$noq" && block "lock files and supply-chain policy are changed by bots/humans, not agents"
    grep -Eq '(frozen[-_]lockfile[[:space:]]*=[[:space:]]*false|dangerouslyAllowAllBuilds|minimum[-_]?[rR]elease[-_]?[aA]ge[[:space:]]*[:=]?[[:space:]]*0([^0-9]|$))' <<<"$cmd" && block "lock files and supply-chain policy are changed by bots/humans, not agents"
    grep -Eq '(--dangerously-skip-permissions|bypassPermissions)' <<<"$cmd" && block "permission escalation"
    # readers: tee only writes its operands and the source builtin "." gets its own rule ($dot), so "biome check . && ls .env" is not a read
    readers='(cat|less|more|head|tail|bat|sed|grep|rg|awk|xxd|od|hexdump|strings|base64|cut|tac|nl|sort|rev|dd|diff|cmp|paste|read|mapfile|readarray|source|python[0-9.]*|node|perl|ruby|php|jq|yq|vim?|nvim|nano|emacs)'
    plain='(cat|less|more|head|tail|bat|xxd|od|hexdump|strings|base64|cut|tac|nl|sort|rev|dd|diff|cmp|paste|source)'    # take file operands, never patterns
    patt='(grep|rg|awk|sed|jq|yq)'                                                                                    # take a pattern/program first
    plainx='(cat|less|more|head|tail|bat|xxd|od|hexdump|strings|base64|cut|tac|nl|sort|rev|dd|diff|cmp|paste|read|mapfile|readarray|source|python[0-9.]*|node|perl|ruby|php|vim?|nvim|nano|emacs)'
    pre="$sep"'(/[^[:space:]]*/)?["'"'"'\\]?'                      # /bin/cat, "cat", \cat
    post='["'"'"']?([[:space:]]|<)'                                # cat .env, "cat" .env, cat<.env
    dot="$sep"'\.[[:space:]]+[^[:space:]]*'                        # the source builtin with its file: ". ./.env"
    # .env / .env.<anything> (globs included) as a whole path token (process.env, import.meta.env and .envrc do not match); .env.example/.sample/.template
    # exempt; redirection targets excluded (cat .env.example > .env writes, it does not read)
    cmdn=$(sed -E 's/>>?[[:space:]]*[^[:space:];&|]+//g' <<<"$cmd")
    env_toks=$(tr ' \t\\"'\''=();&|`<' '\n' <<<"$cmdn" | sed 's#.*/##' | grep -E '^\.env(\.[A-Za-z0-9_*?-]*)?[*?]?$' | grep -vxE '\.env\.(example|sample|template)' || true)
    [[ -n "$env_toks" ]] && { grep -Eq "$pre$readers$post" <<<"$cmd" || grep -Eq '\$\(<' <<<"$cmd" || grep -Eq "$dot"'\.env' <<<"$cmd"; } && block "printing secret files into the transcript"
    # secrets/ as a token anywhere (inside quotes or parentheses too) when an interpreter runs inline code: python3 -c "open('secrets/x')"
    sec_toks=$(tr ' \t\\"'\''=();&|`<>' '\n' <<<"$cmd" | grep -E '^(\./)?secrets/.' || true)
    [[ -n "$sec_toks" ]] && grep -Eq "$pre$interps$post"'([^;&|]*[[:space:]])?-[a-zA-Z]*[cep]([[:space:]]|$)' <<<"$cmd" && block "printing secret files into the transcript"
    # unambiguous secret paths, quoted or not: the token starts right after the reader or after a later space/=
    home_secret='(~|\$HOME|\$\{HOME\})/\.(ssh|aws|gnupg|config/sops|config/gh|npmrc|netrc|git-credentials|docker/config\.json|kube/)|/[^[:space:]"'"'"']*/\.(ssh|aws|gnupg|config/sops|config/gh|npmrc|netrc|git-credentials)'
    grep -Eq "$pre$readers$post"'([^;&|]*[[:space:]=])?["'"'"']?(\./)?(secrets/|[^[:space:]"'"'"']*(id_rsa|id_ed25519|id_ecdsa|id_dsa|credentials\.json)|'"$home_secret"')' <<<"$cmd" && block "printing secret files into the transcript"
    grep -Eq "$dot"'(secrets/|\.(pem|key)([[:space:]]|$))' <<<"$cmd" && block "printing secret files into the transcript"
    # *.pem / *.key: unquoted after a file-taking reader; after a pattern-taking reader only when it is a path (has a /) or the last operand,
    # so `grep -rn item.key src` is a pattern while `grep KEY server.key` and `sed -n 1p secrets/prod.key` are files; quoted too after a reader that only takes files
    grep -Eq "$pre$plainx$post"'([^;&|]*[[:space:]=])?(\./)?[^[:space:]"'"'"']*\.(pem|key)([[:space:]]|$)' <<<"$cmd" && block "printing secret files into the transcript"
    grep -Eq "$pre$patt$post"'([^;&|]*[[:space:]=])?(\./)?([^[:space:]"'"'"']*/[^[:space:]"'"'"']*\.(pem|key)([[:space:]]|$)|[^[:space:]"'"'"']*\.(pem|key)[[:space:]]*($|[;&|)]))' <<<"$cmd" && block "printing secret files into the transcript"
    grep -Eq "$pre$plain$post"'([^;&|]*[[:space:]=])?["'"'"']?(\./)?[^[:space:]"'"'"']*\.(pem|key)["'"'"']?([[:space:]]|$)' <<<"$cmd" && block "printing secret files into the transcript"
    { grep -Fq -- "$cwd/secrets/" <<<"$cmd" || grep -Fq -- "$pd/secrets/" <<<"$cmd" || grep -Fq -- "$root/secrets/" <<<"$cmd"; } && grep -Eq "$pre$readers$post" <<<"$cmd" && block "printing secret files into the transcript"
    # sops: decrypting to stdout; exec-env with a command that prints the environment or runs inline code (sh -c, node -e, python -c)
    grep -Eq "$sep"'sops[[:space:]]+((-d|--decrypt|d|decrypt)([[:space:]]|$)|exec-env[[:space:]]+[^;&|]*[[:space:]"'"'"'](env|printenv|export|set|declare|echo|printf)(["'"'"']|[[:space:]]|$)|exec-env[[:space:]]+[^;&|]*[[:space:]"'"'"']('"$shells"'|'"$interps"')[[:space:]]+([^;&|]*[[:space:]])?-[a-zA-Z]*[cep]([[:space:]]|$)|exec-file[[:space:]]+[^;&|]*[[:space:]"'"'"']'"$plain"'[[:space:]])' <<<"$cmd" && block "decrypting secrets into the transcript; use sops exec-env <file> <your command>" ;;
esac
exit 0
