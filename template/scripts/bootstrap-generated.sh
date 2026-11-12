#!/usr/bin/env bash
# scripts/bootstrap-generated.sh — writes the generated, committed artifacts of a fresh project: the web sources
# (route tree, messages, content; git-ignored), openapi.json (from the routes) and .env.example (from the env
# schemas). new-project.sh runs it once before the scaffold commit; afterwards `just check` keeps them in sync.
set -euo pipefail
if [ -f scripts/gen.ts ]; then pnpm exec tsx scripts/gen.ts; fi
pnpm exec tsx scripts/emit-openapi.ts
pnpm exec tsx scripts/env-example.ts
