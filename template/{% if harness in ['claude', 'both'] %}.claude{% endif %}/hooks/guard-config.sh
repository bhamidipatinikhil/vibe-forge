#!/usr/bin/env bash
# .claude/hooks/guard-config.sh — ConfigChange: settings/skills edits mid-session are rejected unless deliberately enabled.
# A blocked ConfigChange shows no message anywhere (Claude Code only writes the debug log), so the escape hatch is documented in AGENTS.md.
set -euo pipefail
input=$(cat); src=$(jq -r '.source // empty' <<<"$input" 2>/dev/null) || exit 2; fp=$(jq -r '.file_path // empty' <<<"$input" 2>/dev/null) || exit 2
if [[ -z "${ALLOW_CLAUDE_CONFIG_CHANGES:-}" && "$src" != "policy_settings" ]]; then
  echo "Settings change rejected ($src $fp). Export ALLOW_CLAUDE_CONFIG_CHANGES=1 and restart to edit agent policy on purpose." >&2; exit 2
fi
exit 0
