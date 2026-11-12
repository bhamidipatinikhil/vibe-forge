#!/usr/bin/env bash
# .claude/hooks/verify-install.sh — deny installs of packages that do not exist or are younger than MIN_AGE_DAYS; ask otherwise.
set -euo pipefail
MIN_AGE_DAYS="${MIN_AGE_DAYS:-7}"; CURL_MAX_TIME="${CURL_MAX_TIME:-30}"; BUDGET_SECS="${VERIFY_BUDGET_SECS:-100}"   # settings.json gives this hook 120 s
input=$(cat); cmd=$(jq -r '.tool_input.command // empty' <<<"$input"); [[ -z "$cmd" ]] && exit 0
cmd=$(sed -E 's/(^|[[:space:]])#.*$//' <<<"$cmd")                                                   # a shell comment is not a package name
# $noq: space-free quoted specs unquoted ("zod" -> zod, 'requests>=2' -> requests>=2) and quoted prose removed, so that
# git commit -m "chore: pnpm add zod" is not an install (the same transform as guard.sh)
noq=$(sed -E 's/"([^"[:space:]]*)"/\1/g; s/'"'"'([^'"'"'[:space:]]*)'"'"'/\1/g; s/"[^"]*"//g; s/'"'"'[^'"'"']*'"'"'//g' <<<"$cmd")
is_js=0; is_py=0
# global options may precede the subcommand (pnpm --filter api add zod, pnpm -w add zod); bun install, yarn workspace <x> add
JS_RE='(^|[;&|[:space:]])(npm[[:space:]]+(i|install|add)|pnpm([[:space:]]+(-[A-Za-z]+|--[a-z-]+(=[^[:space:]]*)?)([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+(add|i|install)|yarn([[:space:]]+workspace[[:space:]]+[^[:space:]]+)?[[:space:]]+add|bun[[:space:]]+(add|install|i))([[:space:]]|$)'
PY_RE='(^|[;&|[:space:]])((python[0-9.]*[[:space:]]+-m[[:space:]]+)?pip[0-9]*[[:space:]]+install|uv[[:space:]]+(add|pip[[:space:]]+install)|poetry[[:space:]]+add|pipx[[:space:]]+install)([[:space:]]|$)'
grep -Eq "$JS_RE" <<<"$noq" && is_js=1
grep -Eq "$PY_RE" <<<"$noq" && is_py=1
(( is_js == 0 && is_py == 0 )) && exit 0
out() { jq -n --arg d "$1" --arg r "$2" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'; exit 0; }
# Package specs are the words AFTER the install verb of each installing segment: wrappers (nix develop -c, timeout 60, CI=1) and
# other segments (&& pnpm exec tsc) are not package names. Option VALUES (--filter @app/api, -r requirements.txt) are stripped too.
if (( is_js )); then re="$JS_RE"; strip='(--filter|-F|-C|--dir|--registry|--prefix|--config|workspace)'; else re="$PY_RE"; strip='(-r|--requirement|-c|--constraint|-i|--index-url|--extra-index-url|-t|--target|-m|--python|-p)'; fi
specs=$(tr ';&|' '\n' <<<"$noq" | grep -E "$re" | sed -E "s/^.*$re//" \
        | sed -E "s/(^|[[:space:]])${strip}[[:space:]]+[^[:space:]]+//g; s/(^|[[:space:]])--[a-z-]+=[^[:space:]]*//g" \
        | tr ' \t' '\n' | sed -E "s/^[\"']//; s/[\"']\$//" | grep -vE '^(-.*|)$' || true)
[[ -z "$specs" ]] && out ask "Bare install (lockfile sync). Approve only if the package.json change was reviewed."
# Deliberately not used (docs/decisions/0002-stack.md): denied before any registry lookup, with the approved alternative.
not_on_purpose() {
  case "$1" in
    next) echo "Next.js App Router/RSC (repeated critical security advisories); the web kind is TanStack Start" ;;
    prisma|@prisma/*) echo "Prisma (an unpinned install pulls a breaking release candidate); use Kysely (src/infra/db.ts)" ;;
    drizzle-orm|drizzle-kit|drizzle-*) echo "Drizzle (waiting for 1.0); use Kysely (src/infra/db.ts)" ;;
    redis|ioredis|iovalkey|@valkey/*|meilisearch) echo "$1 (Postgres covers caching, queues and search for now: pg-boss, full-text search)" ;;
    storybook|@storybook/*) echo "Storybook (only needed for a documented design system); component tests use Vitest browser mode" ;;
    turbo|nx|@nx/*) echo "$1 (only needed in a monorepo)" ;;
    inngest|@trigger.dev/*) echo "$1 (pg-boss covers jobs and cron: src/infra/jobs.ts)" ;;
    unleash-client|@unleash/*) echo "Unleash (now AGPL); flags are OpenFeature + flagd (src/infra/flags.ts)" ;;
    @clerk/*) echo "Clerk (passkeys are not on its free plan); auth is better-auth (src/infra/auth.ts)" ;;
    *) return 1 ;;
  esac
}
for spec in $specs; do
  name="$spec"; if [[ "$name" == @*/*@* ]]; then name="${name%@*}"; elif [[ "$name" != @* && "$name" == *@* ]]; then name="${name%@*}"; fi
  if (( is_js )) && reason=$(not_on_purpose "$name"); then
    out deny "Not using, on purpose: $reason. See docs/decisions/0002-stack.md; changing that decision is a human call (new ADR, then install by hand)."
  fi
done
now=$(date +%s); deadline=$(( now + BUDGET_SECS )); summary=""; unverified=""
# --compressed: the registry gzips packuments (next: 31 MB -> 2 MB); HTTP 404 is "does not exist", anything else is "could not verify"
fetch() { local tmp code left; left=$(( deadline - $(date +%s) )); (( left < 5 )) && { FETCH_CODE=budget; return 2; }
  (( left < CURL_MAX_TIME )) || left=$CURL_MAX_TIME
  tmp=$(mktemp); code=$(curl -sS --compressed --max-time "$left" -o "$tmp" -w '%{http_code}' "$1" 2>/dev/null) || code=000
  META=$(cat "$tmp"); rm -f "$tmp"; case "$code" in 200) return 0;; 404) return 1;; *) FETCH_CODE=$code; return 2;; esac; }
for spec in $specs; do
  name="$spec"
  if (( is_js )); then
    if [[ "$name" == @*/*@* ]]; then name="${name%@*}"; elif [[ "$name" != @* && "$name" == *@* ]]; then name="${name%@*}"; fi
    [[ "$name" =~ ^(@[a-z0-9._-]+/)?[a-z0-9][a-z0-9._-]*$ ]] || { unverified+="$spec "; continue; }    # git:, file:, npm: aliases, tarball URLs, local paths (./x, .): not registry names
    url="https://registry.npmjs.org/$(jq -rn --arg n "$name" '$n|@uri')"; what="npm package '$name'"
  else
    name="${name%%[@=<>!~\[]*}"; [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { unverified+="$spec "; continue; }    # PEP 508 names start alphanumeric: "." and "./x" are local paths; poetry uses pkg@^1
    url="https://pypi.org/pypi/$name/json"; what="PyPI package '$name'"
  fi
  rc=0; fetch "$url" || rc=$?
  (( rc == 1 )) && out deny "$what NOT FOUND on the registry: likely a hallucinated name (slopsquatting risk)."
  if (( rc == 2 )); then
    [[ "${FETCH_CODE:-}" == budget ]] && out deny "$what was not verified: the hook's ${BUDGET_SECS}s budget ran out; install fewer packages per command."
    out deny "$what could not be verified (registry HTTP ${FETCH_CODE:-000} / network error / timeout); retry when the registry is reachable."
  fi
  if (( is_js )); then created=$(jq -r '.time.created // empty' <<<"$META"); else created=$(jq -r '[.releases[][]?.upload_time_iso_8601] | sort | first // empty' <<<"$META"); fi
  [[ -z "$created" ]] && out deny "'$name' has no creation metadata; refusing."
  # jq parses the registry's ISO-8601 timestamps on every platform; GNU `date -d` is only a fallback (it does not exist on macOS)
  created_s=$(jq -rn --arg t "$created" '$t | sub("\\.[0-9]+"; "") | sub("\\+00:00$"; "Z") | fromdateiso8601' 2>/dev/null) \
    || created_s=$(date -d "$created" +%s 2>/dev/null) || out deny "'$name': cannot parse its creation date '$created'; refusing."
  age=$(( ( now - created_s ) / 86400 ))
  (( age < MIN_AGE_DAYS )) && out deny "'$name' was first published ${age}d ago (< ${MIN_AGE_DAYS}d cooldown): newly registered names are the slopsquatting pattern."
  summary+="$name (first published ${age}d ago); "
done
[[ -n "$unverified" ]] && unverified="NOT VERIFIED (git/alias/URL/local spec, cannot be checked on the registry; inspect the source yourself): ${unverified}; "
out ask "New dependency: ${summary}${unverified}Check downloads/maintainers on the registry page, then approve."
