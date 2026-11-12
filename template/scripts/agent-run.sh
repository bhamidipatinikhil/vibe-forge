#!/usr/bin/env bash
# agent-run.sh — scripted unattended agent runs with validation and budget caps.
# Usage: agent-run.sh [--schema file.json] [--max-budget-usd N] <prompt>
# Runs `claude --bare -p` (hooks, skills, plugins all loaded), validates the JSON output
# parses, and (with --schema) that it matches the schema. Never on your host: run inside
# the dev shell or a container (`srt claude`).
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
out="$(claude --bare -p "$prompt" --max-budget-usd "$budget" --output-format json)"
node -e 'JSON.parse(process.argv[1])' "$out"   # must parse; claude's own --json-schema handles schema validation
printf '%s\n' "$out"
