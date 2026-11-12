#!/usr/bin/env bash
# SessionStart re-inject: compact plan + glossary-delta + gate status into context.
set -euo pipefail
{
  echo "## Active plans"
  for f in plans/*.md; do [ -e "$f" ] && echo "- $f"; done
  echo "## Glossary terms"
  grep -c '^| ' docs/glossary.md 2>/dev/null || echo "0"
  echo "## Gate status"
  if [ -f .scratch/context-dumps/check-latest.log ]; then tail -n 5 .scratch/context-dumps/check-latest.log; else echo "no gate log yet"; fi
}
