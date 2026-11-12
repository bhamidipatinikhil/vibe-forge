#!/usr/bin/env bash
# agent-run.sh — scripted unattended agent runs with validation and budget caps.
# Usage: agent-run.sh [--schema file.json] [--max-budget-usd N] <prompt>
# Runs `claude --bare -p` (hooks, skills, plugins all loaded), optionally constrains the answer with
# --json-schema (Claude validates against it), and fails when the output does not parse as JSON.
# Never on your host: run inside the dev shell or a container (`srt claude`).
set -euo pipefail
schema=""; budget="5"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --schema) schema="$2"; shift 2 ;;
    --max-budget-usd) budget="$2"; shift 2 ;;
    *) break ;;
  esac
done
prompt="$1"; shift || true
schema_args=()
if [ -n "$schema" ]; then
  schema_args=(--json-schema "$(cat "$schema")")   # Claude validates the answer against this schema
fi
out="$(claude --bare -p "$prompt" --max-budget-usd "$budget" --output-format json "${schema_args[@]}")"
node -e 'JSON.parse(process.argv[1])' "$out"   # the run is only usable when the output parses
printf '%s\n' "$out"
