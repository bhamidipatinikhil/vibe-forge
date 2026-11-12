---
name: release
description: Cut a release. Bumps the version, writes the changelog entry, tags it and pushes the tag; deploy.yml ships main.
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git log *) Bash(git tag *) Bash(git add *) Bash(git commit *) Bash(pnpm changeset *) Bash(gh run list *)
---
1. Confirm a clean tree on `main` and that `just ci` passed on the HEAD commit (check `gh run list`); otherwise stop and say why.
2. `pnpm changeset version`, commit. 3. Summarise merged PRs since the last tag into CHANGELOG.md, user-facing lines only.
4. Tag `v<version>` and push the tag (`git push` prompts). `deploy.yml` builds, attests and deploys the image from `main`; nothing is published to npm (the package is private) and never from a laptop.
