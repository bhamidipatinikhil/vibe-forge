# vibe-forge

A [Copier](https://copier.readthedocs.io/) template for "vibe coding" projects on NixOS: one `copier.yml`, a
`template/` tree and a short `new-project.sh`. Every generated project is a Nix flake (`template/flake.nix.jinja`
pins Node, pnpm, Postgres 18, dbmate, Squawk, oasdiff, sops/age, Mailpit, k6, Playwright's Chromium, Claude Code and
the security scanners in `flake.lock`), ships a single `just check` quality gate wired into lefthook, Claude Code
hooks and CI, and records `.copier-answers.yml` so that `copier update` can carry it forward when this template
changes.

Two kinds are implemented. **`web`** (the default) is a TanStack Start (React 19, SSR) app served by a Hono API in
one Node process; **`service`** is the Hono + Zod OpenAPI API alone. Both get Postgres (Kysely, dbmate), accounts
(better-auth), jobs and cron (pg-boss), email (Resend, Mailpit locally), feature flags (OpenFeature + flagd) and
Sentry next to OpenTelemetry. The full toolchain, the deliberate holds (TypeScript 7, pnpm 12) and what is not used
on purpose are in `template/docs/decisions/0002-stack.md.jinja`, which every project receives as its ADR 0002.

The design and the evidence behind it are in the report this repository was scaffolded from; this README covers
only how to use, test and release the template.

**New here?** Read [COMPLETE_GUIDE.md](COMPLETE_GUIDE.md). In plain words and with many examples, it walks through:
- setting up your machine, releasing the template and creating a project;
- working with Claude Code;
- a complete feature built from start to finish (verified with `just check` and `just e2e`);
- recipes, testing, secrets, deployment, incidents, updates and troubleshooting.

**Copier is the only supported bootstrap path.** GitHub's "Use this template" button, `degit`, `nix flake init`
and copying files by hand all lose the `.copier-answers.yml` (`_src_path`, `_commit`) link that makes updates
possible. Always go through `new-project.sh` (or `copier copy` directly).

## Requirements

- NixOS, or Nix with flakes enabled (`experimental-features = nix-command flakes`).
- `direnv` and `nix-direnv` (the generated `.envrc` uses `use flake`; `new-project.sh` runs `direnv allow`).
- `git` (Copier reads the template's tags and writes the first commit of every project).
- Network access on first use: `nix run github:NixOS/nixpkgs/nixos-26.05#copier`, the nixpkgs tarballs, the npm
  registry for the first `pnpm install`.
- Nothing else: pnpm, Node, just, lefthook, Playwright, Claude Code and the scanners come from the generated project's flake.

## One-time setup: make this repository a versioned, reachable template

The scaffold is delivered as plain files, not as a git repository. Copier needs (a) a git repository with a
PEP 440 tag, otherwise it records no `_commit` and `copier update` has nothing to diff against, and (b) a source
that resolves on every machine, otherwise a project's weekly `template-update.yml` cannot clone the template on a
GitHub runner. Run once:

```bash
cd vibe-forge
git init -b main
git add -A && git commit -m "chore: vibe-forge 0.1.0"
git tag v0.1.0
git remote add origin git@github.com:<owner>/vibe-forge.git
git push -u origin main --tags
```

From then on `.github/workflows/template-test.yml` guards every change, and `new-project.sh` records
`gh:<owner>/vibe-forge` as the template source. A private template repository works too: whatever runs
`copier copy` or `copier update` needs git credentials for it (for example `gh auth setup-git`).

## Quick start

```bash
git clone git@github.com:<owner>/vibe-forge.git ~/dev/vibe-forge
cd ~/dev/vibe-forge
./new-project.sh ~/dev/my-service
```

Copier asks the questions declared in `copier.yml`; every answer is recorded in the project's `.copier-answers.yml`:

| Question | Type | Default | Used for |
|---|---|---|---|
| `project_name` | str | (required) | Human-readable name (flake description, README, OpenAPI title) |
| `project_slug` | str | `project_name` lower-cased, spaces to `-` | Package name, `OTEL_SERVICE_NAME`, directory names |
| `github_owner` | str | (required) | GitHub user or org, written into `.github/CODEOWNERS` |
| `npm_scope` | str | `""` | npm scope without the `@`; empty for an unscoped package name |
| `kind` | choice | `web` | `web` (TanStack Start inside Hono) or `service` (Hono + Zod OpenAPI only); both carry the backend layers. `library` is listed but disabled, and rejected for `--data` too ("not implemented in this version") |
| `harness` | choice | `both` | Agent adapter(s) to render: `claude` (`.claude/`, `CLAUDE.md`), `opencode` (`.opencode/`, `opencode.jsonc`) or `both`. `AGENTS.md` is the shared brief; the gates are the same `just check` |
| `node_major` | int | `26` | `26` = Active LTS since 2026-10-28, `24` = Maintenance LTS (flake + `engines` + Docker base image) |
| `with_playwright` | bool | `true` | Playwright + axe e2e/security/smoke specs and the Nix-provided Chromium; `kind=web` requires it (Vitest browser mode, e2e and Lighthouse use that Chromium) |
| `with_python` | bool | `false` | `python312` + `uv` with `UV_PYTHON` pinned to the Nix interpreter |
| `with_devcontainer` | bool | `false` | Planned (`.devcontainer/` for collaborators without Nix / Codespaces); only `false` is accepted until it exists |
| `payments` | choice | `none` | `razorpay` (SDK + HMAC-verified webhook) or `polar` (SDK, API 2026-10 + Standard Webhooks), each with env keys, OpenAPI, access matrix and tests |
| `with_ai` | bool | `false` | `@anthropic-ai/sdk` (Claude Opus 5.5, low effort, server-side refusal fallbacks) behind an authenticated `POST /api/v1/ai/summarize` |
| `with_charts` | bool | `false` | `web` only: lightweight-charts + recharts with a `/charts` page (axe-checked) |
| `with_rich_text` | bool | `false` | `web` only: Tiptap with an `/editor` page |

Non-interactive: everything after the directory is passed to `copier copy`, so

```bash
./new-project.sh ~/dev/my-service --defaults --data project_name="My Service" --data github_owner=octocat
```

(the template version is not an argument: it is always `main`, see "Which template version is rendered").

`new-project.sh` then does, in order:

0. Compares GitHub's `main` (what Copier renders) with your checkout of this repository, and warns when your
   checkout has commits it lacks: see "Which template version is rendered" below.
1. `copier copy --trust --vcs-ref main <source> <dir>`, with the source resolved as described in the next section.
2. `git init -b main` and `git add -A` (staged first, so Nix's flake fetcher copies only tracked files).
3. `nix develop .#quiet -c pnpm install --no-frozen-lockfile`: the first install. The template ships
   `pnpm-lock.yaml` and `flake.lock` (`template/`), locked against the default answers
   (`tests/answers/default-web.yml`), so a default project installs exactly what the template was tested with;
   answers that change `package.json` (`kind: service`, the optional integrations, `node_major: 24`) are re-locked by
   this install. The flag is explicit because pnpm freezes an existing lockfile whenever `CI` is set in the environment.
4. `bash scripts/bootstrap-generated.sh`: writes the generated, committed artifacts that depend on the answers
   (`openapi.json` from the routes, `.env.example` from the env schemas; for `web` also the git-ignored route tree,
   messages and content), then the scaffold commit (`chore: scaffold from vibe-forge`) with both lock files.
5. `direnv allow` (nix-direnv caches the shell and registers a GC root).
6. `nix develop .#quiet -c pnpm install --frozen-lockfile`: from here on every install is frozen; this one proves
   that the committed lockfile matches `package.json`, exactly as the project's `ci.yml` will.
7. `lefthook install` (only after a successful install), `just doctor` (pnpm/node/playwright/claude version
   agreement) and `just check` (the full gate). The project must be green before you type the first prompt.

### Where the template source comes from

Copier records the source exactly as it was passed (`_src_path` in `.copier-answers.yml`) and clones it again for
every `copier update`, on your machine and on the GitHub runner of the project's weekly `template-update.yml`.
`new-project.sh` therefore resolves it as follows:

- `VIBE_FORGE` when set, e.g. `VIBE_FORGE=gh:<owner>/vibe-forge ./new-project.sh ~/dev/x`.
- Otherwise the `origin` remote of the clone the script lives in, converted to `gh:<owner>/<repo>` for github.com
  remotes (other git remotes are passed through unchanged). Without an `origin` remote the script stops with an
  error: push the template first (one-time setup above). It also stops when its folder is inside another git
  repository rather than the root of its own clone, because that repository's `origin` is not the template.
- `./new-project.sh --local <dir>`: this clone's directory and checkout (uncommitted changes included), for template
  development only. Copier records the
  absolute path, which exists nowhere else, so that project's `template-update.yml` cannot resolve it (a local
  `copier update` still works).

### Which template version is rendered

Always the template's **`main` branch**, as it is on GitHub: `new-project.sh` passes `--vcs-ref main` to Copier.
Not a release tag, not another branch and not the files in your checkout, so there is nothing to choose. Projects
keep following `main` afterwards (see "How a generated project updates"). The script refuses Copier's ref switches
(`--vcs-ref`/`-r`, `--prereleases`/`-g`) with an error, because they would put a project on something its updates
do not follow.

Before Copier runs, the script compares GitHub's `main` with your checkout (not when `VIBE_FORGE` is set; when it
cannot list the template's branches, for example offline or without a GitHub login for a private template, a `note:`
says so and it goes on):

- Your checkout has commits that GitHub's `main` lacks (another branch, or unpushed commits on `main`): a warning,
  because the project will not have them. Merge them into `main` and push, then run the script again.
- GitHub's `main` is ahead of your checkout (you have not pulled): a note; the project gets GitHub's `main`.
- Uncommitted changes in `copier.yml` or `template/` (untracked files too): a warning, because Copier does not render
  them.
- GitHub has no `main` branch: an error, before anything is written.

To try template changes before you push them to `main`, use `--local`, which renders your checkout, uncommitted
changes included (`--vcs-ref HEAD` on this clone's directory):

```bash
./new-project.sh --local /tmp/try-it
```

Such a project records your clone's absolute path, so it cannot be updated from GitHub: use it to look, then delete it.

A project records the `main` commit it was made from as `_commit`, for example `v0.1.0-2-g871465d`: 2 commits after
the tag `v0.1.0`, commit `871465d` (`git describe --tags`). When `main` is exactly on a tag, it records the tag.

## How a generated project updates

Inside a project:

```bash
git status                       # must be clean
nix run --inputs-from . nixpkgs#copier -- update --trust --defaults --conflict rej --vcs-ref main   # copier from the project's nixpkgs input
git status                       # review the diff and any *.rej files, re-lock if package.json changed, then commit
```

- `copier update --vcs-ref main` moves the project to the template's newest `main` commit, re-renders the old and the
  new template commit with the recorded answers, three-way-merges the result over your changes, and writes a `.rej`
  file next to every file it could not merge (`--conflict inline` leaves git-style markers instead).
- Always keep `--vcs-ref main`. Without it Copier goes to the newest release tag instead, which is older than the
  project's `main` commit, and stops with "You are downgrading from 0.1.0.post2.dev0+871465d to 0.1.0. Downgrades are
  not supported."
- Template-owned files (flake, justfile, lefthook, lint configs, `.github/workflows/*`, `.claude/*`) are synced.
  Project-owned files are listed in `_skip_if_exists` in `copier.yml` (`README.md`, `docs/decisions/*.md`, `src/**`,
  `tests/**`, `migrations/**`, `pnpm-lock.yaml`, `flake.lock`): they are created once and never touched by an
  update. The two lock files are shipped by the template but owned by the project from day one (Renovate and humans
  change them): when an update changes `package.json`, run `pnpm install` once to re-lock (the project's `ci.yml`
  installs with `--frozen-lockfile` and fails until you do).
- When a template file is renamed or removed, add an entry to `_migrations` in `copier.yml` so old projects
  migrate cleanly instead of keeping stale copies (it runs when a project's update crosses the entry's version tag;
  see "Releasing the template").
- Every generated project carries `.github/workflows/template-update.yml`, which runs the same command weekly
  (Monday 07:00 UTC) and opens a PR labelled `template-update`; the title flags `CONFLICTS` when `.rej` files exist.
  The project's `ci.yml` also warns (non-blocking) when the template's `main` has moved past the project's commit.
  Before the first run, add a
  `GH_TOKEN_FOR_UPDATES` secret: a PAT, so CI runs on the PR it opens, with the `repo` and `workflow` scopes
  (fine-grained: Contents, Pull requests, Issues and Workflows read and write on the project, Contents read on the
  template), because GitHub refuses a pushed change to `.github/workflows/*` from a token without the workflow scope,
  and template updates change those files. The workflow creates the `template-update`
  label itself; create it by hand (`gh label create template-update`) only if that step fails, for example with a
  fine-grained PAT that lacks Issues or Pull requests write.
- `--inputs-from .` takes `nixpkgs` from the project's `flake.lock` (the nixos-26.05 branch), so Copier is the version
  the flake pins. A bare `nixpkgs#copier` resolves through the flake registry, which is nixpkgs-unstable on a fresh
  machine or runner and drifts independently of every lock file; the template's own script and workflow name the
  branch explicitly (`github:NixOS/nixpkgs/nixos-26.05#copier`) because they run where no flake exists yet.

### Keep `main`'s history

Every update re-renders the commit in the project's `_commit`, and a clone from GitHub contains only commits that a
branch or tag still reaches. So never rewrite `main` (no amend, rebase or force-push of pushed commits; protect it
on GitHub). How you merge a feature branch into `main` does not matter (merge commit, squash or rebase), because
projects only ever record `main` commits. If `main` was rewritten anyway, every update of a project made from a lost
commit stops with `error: pathspec 'v0.1.0-2-g1a2b3c4' did not match any file(s) known to git`, and the weekly job's
`::error::` line gives two repairs:

- Push the lost commit back as a branch from a template clone that still has it
  (`git push origin 1a2b3c4:refs/heads/keep-1a2b3c4`; the sha is the part after `-g`), and keep that branch until
  every such project has updated past it.
- Or re-render the project from `main` once, inside the project, in a clean checkout (commit or stash first:
  `recopy` overwrites uncommitted changes without asking):
  `nix run --inputs-from . nixpkgs#copier -- recopy --trust --defaults --overwrite --vcs-ref main`.
  Recopy re-renders every template-owned file and replaces your own edits in them: review the diff, put back what
  you need, and ignore its "new-project.sh now continues on its own" message.

Other weekly-job failures with a line of their own: the template has no `main` branch; "Downgrades are not
supported" (`main` was reset behind the project's commit, or the project was made from a tag or a branch before
projects followed `main`); a failed push (usually the token lacks the `workflow` scope; `[rejected] …
(non-fast-forward)` means the update branch of an earlier run that day still exists: merge or close its pull
request and delete the branch, then run the job again). Other failures (network, a revoked token) have no hint.

### Projects made before projects followed `main`

A project made from the `v0.1.0` tag (what `new-project.sh` rendered before, without `--vcs-ref`) or from a branch
with `--vcs-ref` has an older `template-update.yml`. If the project is new, the simplest fix is to delete it and run
`./new-project.sh` again. To keep it: update it once by hand with `--vcs-ref main` (the command above); that update
brings the new `template-update.yml`, and from then on the weekly job follows `main`.

## Releasing the template

Every commit pushed to `main` reaches the projects with their next update, so `main` itself is the release channel:

1. Work on a branch, open a pull request, and merge it into `main` only when `template-test` is green (it includes
   the previous-tag -> HEAD update test). Never force-push `main` ("Keep `main`'s history").
2. Keep `## 0.x.y (unreleased)` in `CHANGELOG.md` up to date, user-facing lines only.
3. If `template/package.json.jinja`, `template/pnpm-workspace.yaml.jinja` or the flake inputs changed since the
   lock files were last refreshed, refresh them: render `tests/answers/default-web.yml` (the local commands
   under "How the template tests itself"), run the first install, and copy the project's `pnpm-lock.yaml` and
   `flake.lock` back into `template/`. The `default-web` job of `template-test` fails while they are stale. Check every pin
   against the 3-day `minimumReleaseAge` first (`npm view <pkg> time`): the install refuses younger versions.
4. Version tags are milestones, not what projects follow. Tag a commit on `main` when a version is complete (move the
   CHANGELOG entries under a dated heading), and always when a change needs a `_migrations` entry or a hand merge
   ("Manual upgrade from <tag>"): a migration runs when a project's update crosses its version tag, so the tag must
   be on the `main` commit that brings the change. Use a PEP 440 version prefixed by `v` and a new release number
   (`v0.2.0` after `v0.1.0`; Copier reads a commit N commits after `v0.1.0` as `0.1.0.postN.dev0`, so a
   post-release tag such as `v0.1.0.post1` would sort before projects made later): `git tag v0.2.0 && git push origin v0.2.0`.

## How the template tests itself

`.github/workflows/template-test.yml` runs on every PR, on pushes to `main` and `v*` tags, weekly (Monday 06:00 UTC,
catching nixpkgs/npm/Claude Code drift) and on demand:

- **generate-and-gate**, a matrix over `tests/answers/*.yml`: `default-web` (the lockfile-defining default),
  `default-service`, `web-full` (Razorpay, the Claude summarizer, charts, rich text, Python and a scoped package
  name), `web-polar-node24` (Polar on Node 24), `no-playwright-node24` and `python-scoped` (a service with Razorpay,
  the AI route, Python and a scoped name); no answer set exercises `with_devcontainer`, which does not exist yet: `copier copy --trust --defaults
  --vcs-ref HEAD --data-file <answers> . out`, then inside `out/`: actionlint (with shellcheck) and
  `zizmor --min-severity medium` over the rendered `.github/workflows/*.yml` (the Playwright and `PRODUCTION_URL`
  guards live there; explicit file arguments because `out/` is not a git repository yet; the linters come from the
  rendered flake's `nixpkgs` input via `nix shell --inputs-from .`), the same bootstrap as
  `new-project.sh` (`git init`, `nix flake check --no-build`, first `pnpm install --no-frozen-lockfile`, for
  `default-web` a `git diff --exit-code` proving that the shipped lock files came through the install unchanged,
  `scripts/bootstrap-generated.sh`, scaffold commit, `pnpm install --frozen-lockfile`), then `just doctor`, `just ci` (what the project's required
  `ci / gates` check runs: `just check` plus Stryker, Semgrep, gitleaks + TruffleHog, the licence allowlist and, for
  `web`, size-limit and Lighthouse CI) and, when `playwright.config.ts` was rendered, `just e2e`; `default-web` and
  `default-service` also `docker build` their production image. A generated project must pass its own full gate on
  day one.
- **update-path**: generates `default-service` from the previous `v*` tag, runs
  `copier update --trust --defaults --conflict rej --vcs-ref HEAD`, fails if any `.rej` file or `<<<<<<<` marker
  appears, then installs (unfrozen: the lockfile is project-owned), runs `just doctor` and the updated project's
  `just check`. Migration bugs surface here, not in downstream projects. Exception: a release whose CHANGELOG entry
  says `Manual upgrade from <previous tag>` changes code the project owns (`src/**` is `_skip_if_exists`), so its
  update path stops after `just doctor`.
- **lint-template**: shellcheck on `new-project.sh`, YAML sanity (`yq`) on `copier.yml` and the answer files,
  actionlint and zizmor on this workflow, all run from `github:NixOS/nixpkgs/nixos-26.05` because this repository has
  no flake of its own; `template-update.yml`'s script, run with stub `nix` and `gh`: it must call
  `copier update ... --vcs-ref main` and read no `TEMPLATE_REF`, stop quietly when nothing changed, and answer each
  of Copier's failure messages (no `main`, a lost commit, a downgrade) and a failed push with its `::error::` line,
  and an unknown failure with none; and `ci.yml`'s template drift step, run against a local template repository: a
  project on `main`'s head (as a describe string, a bare sha, or a lightweight or annotated tag) is current, and any
  other commit, or a tag the template lacks, gets the warning.

Nix is installed with a version-pinned `DeterminateSystems/determinate-nix-action` and `flakehub-cache-action`
(requires `id-token: write`); all actions are pinned to the same full commit SHAs as the generated workflows
(`actions/checkout` v7.0.1, `determinate-nix-action` and `flakehub-cache-action` v3.24.1), with the version in a
trailing comment, so Renovate bumps them together.

Nix tools never come from the flake registry's `nixpkgs` entry: on a GitHub runner that is nixpkgs-unstable and it
drifts independently of every `flake.lock` (measured 2026-10-31: zizmor 1.25.2 from the registry, 1.31.1 on
nixos-26.05). Steps that run inside a rendered project use `nix run|shell --inputs-from . nixpkgs#...`, the project's
own `nixpkgs` input (resolved even before `flake.lock` exists; nothing is written); steps that run where no flake
exists (Copier itself, `lint-template`) name the branch, `github:NixOS/nixpkgs/nixos-26.05#...`, where copier 9.15.1
matches `_min_copier_version`. `new-project.sh` does the same.

Locally, the same thing is:

```bash
nix run github:NixOS/nixpkgs/nixos-26.05#copier -- copy --trust --defaults --vcs-ref HEAD \
  --data-file tests/answers/default-web.yml . out
cd out
nix shell --inputs-from . nixpkgs#actionlint nixpkgs#shellcheck nixpkgs#zizmor -c bash -c \
  'actionlint -shellcheck=shellcheck .github/workflows/*.yml && zizmor --min-severity medium .github/workflows'
git init -q -b main && git add -A && nix flake check --no-build
nix develop .#quiet -c pnpm install --no-frozen-lockfile && nix develop .#quiet -c bash scripts/bootstrap-generated.sh
git add -A && git commit -qm "chore: scaffold from vibe-forge"
nix develop .#quiet -c pnpm install --frozen-lockfile
nix develop .#quiet -c just doctor && nix develop .#quiet -c just ci
[ ! -f playwright.config.ts ] || nix develop .#quiet -c just e2e
```

`out/` and `.copier-test/` are git-ignored for this purpose. Answers that `copier.yml` rejects fail loudly before
anything is written, e.g. `--data kind=library`, `--data kind=web --data with_playwright=false` or
`--data with_devcontainer=true`.

## Layout

```text
vibe-forge/                      # git repo, tagged v0.1.0, v0.2.0 … (PEP 440), CHANGELOG.md
├── copier.yml                      # questions + settings (_subdirectory: template, _skip_if_exists, _migrations)
├── new-project.sh                  # the whole per-project bootstrap
├── README.md  CHANGELOG.md  .gitignore  TREE.txt   # TREE.txt: every file of this repository, `find -type f | sort`
├── tests/answers/{default-web,default-service,web-full,web-polar-node24,no-playwright-node24,python-scoped,
│                  service-opencode}.yml
├── .github/workflows/{template-test,gate-flake-rate,golden-prompt}.yml
└── template/                       # rendered into every project; *.jinja files are templated, the rest copied verbatim
    ├── {{_copier_conf.answers_file}}.jinja        # becomes .copier-answers.yml
    ├── flake.nix.jinja  flake.lock  pnpm-lock.yaml   # lock files copied verbatim, locked against tests/answers/default-web.yml
    ├── .envrc  .gitignore  .worktreeinclude  .sops.yaml  .squawk.toml  .dockerignore  Dockerfile.jinja
    ├── justfile.jinja  lefthook.yml  package.json.jinja  pnpm-workspace.yaml.jinja  tsconfig.json.jinja  tsconfig.build.json.jinja
    ├── biome.json.jinja  eslint.config.js.jinja  knip.json.jinja  .dependency-cruiser.cjs.jinja  .jscpd.json  typedoc.json
    ├── vitest.config.ts.jinja  vitest.unit.config.ts  {% if kind == 'web' %}vitest.browser.config.ts{% endif %}  {% if with_playwright %}playwright.config.ts{% endif %}.jinja
    ├── stryker.config.json  stryker.domain.config.json  sgconfig.yml  rules/*.yml  rule-tests/*.yml  commitlint.config.js
    ├── web only ({% if kind == 'web' %}…{% endif %} names): vite.config.ts  components.json  content-collections.ts
    │   lighthouserc.json  .size-limit.json  project.inlang/settings.json  messages/{en,de}.json.jinja  content/posts/*.mdx  public/
    ├── renovate.json  .changeset/{config.json,README.md}  CHANGELOG.md  .zap/rules.tsv  flags/flags.json
    ├── db/schema.sql  migrations/20261103000000_auth.sql   # generated from / applied by dbmate; the auth tables
    ├── .github/{CODEOWNERS.jinja, workflows/{ci,secpass,supply-chain,deploy,migrations,template-update}.yml}
    ├── README.md.jinja  AGENTS.md.jinja  {% if harness in ['claude', 'both'] %}CLAUDE.md{% endif %}  REVIEW.md
    │   {% if harness in ['opencode', 'both'] %}.opencode/{opencode.jsonc, command/check.md}{% endif %}
    ├── {% if harness in ['claude', 'both'] %}.claude/{settings.json, ci-settings.json, hooks/{guard,guard-config,verify-install,gates,re-inject}.sh,
    │            hooks/tests/hooks.test.ts, rules/{api.md.jinja,tests.md,migrations.md,modules.md.jinja,ui.md (web)},
    │            agents/reviewer.md, skills/{release/SKILL.md,study-reference/SKILL.md.jinja},
    │            security-patterns.json, claude-security-guidance.md}{% endif %}
    ├── pipelines/{README.md, intent-driven.md, reference-study.md, telemetry-driven.md, _TEMPLATE.md}
    ├── docs/{PLAYBOOK.md.jinja, services.md.jinja, upgrading/ (.gitkeep), runbooks/rollback.md.jinja,
    │         glossary.md, learnings.md, metrics.md, registry.md (web),
    │         decisions/{0001-record-architecture-decisions.md, 0002-stack.md.jinja, 0003-feature-modules.md.jinja,
    │                      0004-knowledge-pipelines.md}}
    ├── scripts/{docs-drift.sh, bootstrap-generated.sh, emit-openapi.ts, env-example.ts.jinja, db.ts, with-pg.ts,
    │            agent-run.sh, offload-context.mjs, sync-tasks.mjs,
    │            lib/{ephemeral-pg,write-or-check}.ts, gen.ts + dev.ts (web)}
    ├── src/  domain/  schemas/{slug,error,auth}.ts  env.ts.jinja  logger.ts  instrumentation.ts  index.ts.jinja
    │         app/{app.ts.jinja, ports.ts.jinja, session.ts, security.ts.jinja, openapi.ts.jinja, tracing.ts,
    │              routes/{health,slug,auth,events}.ts + root (service) | og, vitals (web) | payments, ai (options)}
    │         infra/{server.ts.jinja, db.ts, db/schema.gen.ts, auth.ts, jobs.ts, flags.ts, errors.ts, email/{mailer.ts,templates.tsx},
    │                web.ts + og.tsx (web) | payments.ts, ai.ts (options)}
    │         ui/ (web: router.tsx, client.tsx, server.ts, routes/, components/{ui/,…}, lib/, seo/, styles/; service: .gitkeep)
    ├── tests/{global-setup.pg.ts, setup.db.ts, setup.msw.ts, lint/jsx-a11y.test.ts, unit/.gitkeep, load/smoke.js,
    │          arch/{modules.test.ts.jinja, __fixtures__/src/} (the dependency-cruiser rules on a fixture tree),
    │          {% if with_playwright %}e2e{% endif %}/{a11y.spec.ts.jinja, web.spec.ts (web)},
    │          {% if with_playwright %}security{% endif %}/{asvs-v8-authorization.spec.ts, access-matrix.ts.jinja},
    │          {% if with_playwright %}smoke{% endif %}/readyz.spec.ts}
    └── plans/.gitkeep   security-evidence/.gitkeep
```

Only files whose content depends on an answer carry the `.jinja` suffix (Copier renders them and strips the
suffix); everything else is copied byte-for-byte. A `{% if … %}…{% endif %}` path segment renders to nothing, and
so skips the file or directory, when the condition is false: `src/{% if kind == 'web' %}ui{% endif %}/` holds the web app and
`src/{% if kind == 'service' %}ui{% endif %}/.gitkeep` keeps the empty layer for services. GitHub workflow files are never
`.jinja` because `${{ }}` would collide with Jinja. Templated sources are written so that every variant renders
Biome-clean (the template's CI runs `biome ci` in all seven); project names live in one `PROJECT` object in
`src/env.ts` so their length never changes the formatting. `pnpm-lock.yaml` and `flake.lock` are copied
verbatim: locked against `tests/answers/default-web.yml`, re-locked by the first install in `new-project.sh` when the
answers change `package.json` (see Quick start), and listed in `_skip_if_exists`. `openapi.json` and
`.env.example` are not shipped: `scripts/bootstrap-generated.sh` generates them from the project's own code.

## What vibe-forge adds to the substrate

The enforced substrate (gates, security, CI/CD, updates) is vibe-template's; vibe-forge adds the layer it lacked,
plus the elements neither earlier approach shipped. ADR 0004 records the reasoning.

- **Harness adapters.** The `harness` answer renders `.claude/` (`claude`/`both`), `.opencode/` + `opencode.jsonc`
  (`opencode`/`both`), or both (the default). `AGENTS.md` is the shared, harness-neutral brief; the gates are `just`
  recipes, so "done" is identical for any harness. Claude Code keeps the deeper integration (the Stop-hook gate,
  the sandbox, the plugins); the OpenCode adapter mirrors the permission posture and documents that its enforcement
  is `just check` + lefthook (OpenCode has no Stop hook).
- **The knowledge layer.** `docs/glossary.md` (canonical terms), `docs/registry.md` (web only: the scoped component
  ledger, GLOBAL/ARCHETYPE/FEATURE/ATOM), `docs/learnings.md` (dated post-mortems; promote recurring lessons into
  AGENTS.md or a rule) and `docs/metrics.md` (the monthly process ledger, with `just metrics`). `docs-drift.sh`
  fails when AGENTS.md exceeds 60 lines.
- **Pipelines.** `pipelines/` holds pluggable interaction pipelines — `intent-driven`, `reference-study` (visual
  harvesting and read-only code study in one), `telemetry-driven` (production signal → failing test → fix → rule or
  ADR) — and a `_TEMPLATE.md` for new ones. Every pipeline ends in the mediator contract:
  `plans/<slug>/{spec,plan,tasks}.md`. Raw harvest material lives in the git-ignored `.scratch/pipelines/<slug>/`,
  with `just harvest-init`, `just distill` (human approval before committing) and `just prune-scratch`.
- **The optional task DAG.** `scripts/sync-tasks.mjs` reads `- [ ] T001 …` tasks and `dep:` links from
  `plans/**/*.md`, prints a dependency-ordered queue (cycles are errors) and mirrors to Beads with `--bd` only when
  the `bd` CLI is installed; markdown stays canonical either way.
- **Context hygiene.** `scripts/offload-context.mjs` keeps verbose command output out of the context window
  (`.scratch/context-dumps/` + a compact summary); the `re-inject.sh` SessionStart hook adds active plans, glossary
  size and the last gate status to the session context so task context survives `/clear` and compaction.
- **Unattended runs.** `scripts/agent-run.sh` wraps `claude --bare -p` with a budget cap and validates the JSON
  output parses.
- **The template tests its own process.** `template-test.yml` renders a seventh answer set (`service-opencode`);
  `gate-flake-rate.yml` (weekly) runs a fresh project's `just check` three times to catch gate flakiness;
  `golden-prompt.yml` (weekly, budget-capped, skipped without its secret) runs the documented worked-example brief
  unattended and requires the gate to be green afterwards.

## Implemented now vs roadmap

Implemented in this version, for `kind: web` and `kind: service`:

- **Server**: Hono + `@hono/zod-openapi` on `@hono/node-server` (`HOST`, loopback by default), Zod 4, neverthrow,
  Pino + OpenTelemetry, t3-env with a generated `.env.example`, Hono's secure-headers (enforcing CSP with a
  per-request nonce), body-limit, csrf, a write kill switch, and an SSE example route.
- **Data and backend**: Postgres 18 (Kysely + `pg`, kysely-codegen types, dbmate migrations and `db/schema.sql`, all
  `--check`ed), better-auth (email/password, verification, reset; every enabled endpoint in OpenAPI, the rest
  disabled, a parity test on upgrades), pg-boss (email queue, nightly purge), Resend + React Email (Mailpit locally),
  OpenFeature + flagd (in-process, `flags/flags.json`), Sentry for errors next to OTel. Tests run against a real,
  throwaway Postgres per file (TCP on 127.0.0.1, so they work inside the Claude sandbox).
- **web**: TanStack Start (React 19, SSR, Router) inside the same Hono process in production and in dev (Vite
  middleware mode), Tailwind v4, shadcn on Base UI, react-aria-components, TanStack Query/Form, Paraglide (en, de),
  content-collections + MDX, JSON-LD, satori OG images, web-vitals as OTel metrics, Sentry React; Vitest browser mode,
  jsx-a11y + react-hooks, size-limit, Lighthouse CI, axe on every page, a CSP and account-flow e2e suite.
- **Optional integrations**: Razorpay or Polar webhooks, the Anthropic SDK, charts, rich text (Copier questions).
- **Gates**: everything from 0.1 plus local Squawk, shellcheck, Claude hook tests, the TanStack server-function ban,
  oasdiff against `origin/main`, the `--check` generators, and the "not using, on purpose" list enforced by
  `verify-install.sh` and dependency-cruiser.
- **Feature work**:
  - Feature modules (`src/modules/<name>/`, entered through `index.ts`; ADR 0003). Their dependency-cruiser rules
    hold before the first module exists, and a fixture test proves the rules fire.
  - The domain, schemas and ui rules are default-deny, so a new directory is covered automatically.
  - A `/study-reference` skill and a PLAYBOOK section for borrowing a feature from another repository: it becomes a
    spec, never merged code.
  - ADR 0002 lists the architecture patterns left out on purpose.
- **CI/CD**: the workflows of 0.1 (`ci`, `secpass`, `supply-chain`, `deploy`, `migrations`, `template-update`), now with a
  root `Dockerfile` (digest-pinned base, non-root), migrations before deploy, and scanners that run the app in production
  mode on a throwaway database.

Roadmap (declared but not generated yet):

- `kind: library` (tsup + typedoc, trusted publishing): a disabled choice in `copier.yml` until it exists.
- `with_devcontainer`: `.devcontainer/` for collaborators without Nix / Codespaces (the question accepts only `false`).
- A Neon database branch per pull request for preview environments (described in `docs/services.md`), once a deploy
  target is chosen.
- A `migration` skill next to `release`; `@godaddy/terminus`, `dotenv-linter diff`, weekly k6 soak and scanoss workflows,
  Checkov SARIF; a committed `openapi-typescript` client.
- TypeScript 7 the week dependency-cruiser and typescript-eslint support it; pnpm 12 once it has a track record.

## Coverage and known gaps

Judged against the 40-row metric table and the mechanism tree of the design report, strictly on the files under
`template/` (every file was read; names were not trusted). **Implemented** means the enforced gate the report promised
exists as a file that runs in `just check`, `just ci`, a Claude Code hook or a workflow; **Partial** names what the
report promised and the template does not yet contain; **Not implemented** means no file in the template covers the
row. Where the report itself says the metric cannot be enforced (a model or process property), "Implemented" refers to
the scaffolding it asked for. Tally: 18 implemented, 19 partial, 3 not implemented.

Live test outcome (this machine):
- 2026-11-04: all six answer sets rendered, bootstrapped and passed `just check`, and `default-web` passed the full
  `just ci`. After the last changes (`requireSession`, `openApiPath`, the template-branch workflow), `default-web`
  rendered from the working tree passed the flake check, kept its lock files unchanged, and passed `just check`
  (105 tests) and `just e2e` (37 tests). A seventh answer set (`service-opencode`, exercising the OpenCode-only
  path) was added after this run; the other five have not run `just e2e` since.

| # | Metric | Status | Where it lives, and what is missing |
|---|---|---|---|
| 1 | Security vulnerabilities (app-level) | Partial | Semgrep CE on staged files (`lefthook.yml` job `sast`) and in `just ci` (`justfile.jinja` recipe `sast`); `security-guidance` plugin with `.claude/security-patterns.json`; Hono secure-headers with an enforcing nonce CSP, body-limit and csrf (`src/app/security.ts.jinja`, tested in `src/app/security.test.ts`); better-auth with its origin check pinned on in tests too (`src/infra/auth.ts`); the authz suite (`tests/security/*`, `secpass.yml`). Missing: CodeQL `security-extended` is a GitHub setting (PLAYBOOK Day 0); no Postgres row-level security yet (every query is scoped in code). |
| 2 | Security hardening / secpass@1 | Partial | `secpass.yml` runs the app in production mode on a throwaway migrated Postgres and defines secpass@1: `authz-e2e` (Playwright ASVS V8: every documented operation is in `access-matrix.ts`, every anonymous status is pinned, `GET /api/v1/me` proves an authenticated route rejects anonymous callers), `api-fuzz` (Schemathesis, `not_a_server_error`), `zap-baseline`, `nuclei-nightly`. Missing: role-matrix and IDOR cases need roles and per-user resources, which the scaffold does not have yet. |
| 3 | Secrets & credential exposure | Implemented | gitleaks on staged changes and a `no-secret-files` job (`lefthook.yml`); gitleaks + TruffleHog `--results=verified,unknown --fail` over the history (`justfile.jinja` recipe `secrets`, in `just ci`); `deny Read(.env)`, `Read(.env.*)`, `Read(secrets/**)`, key files and `~/.ssh` etc. (`.claude/settings.json`, `.claude/ci-settings.json`); `guard.sh` blocks `cat .env`, `sops -d` and inline interpreters over `secrets/`; sandbox `denyRead` + `credentials.files/envVars` scrub; t3-env schema (`src/env.ts.jinja`, server side only); sops/op injection documented in `.envrc`, the generated `.env.example` (`scripts/env-example.ts.jinja`, checked by `just env-check`), `README.md.jinja`. GitHub push protection is a repository setting (on by default for public repositories), not a file. |
| 4 | Dependency integrity & supply chain | Implemented | Frozen installs (`new-project.sh`, `ci.yml`, `secpass.yml`, `deploy.yml`, `supply-chain.yml`); `pnpm-workspace.yaml.jinja` (`minimumReleaseAge: 4320`, `strictDepBuilds` + reviewed `allowBuilds`, `blockExoticSubdeps`, `trustPolicy: no-downgrade`); `supply-chain.yml` (OSV-Scanner PR diff and full scan, `dependency-review-action` `fail-on-severity: moderate`, zizmor, Socket Firewall `sfw pnpm install`, `npm audit signatures`, cdxgen SBOM + Grype SARIF); every `uses:` SHA-pinned, zizmor on changed workflows in `lefthook.yml`; `renovate.json` `config:best-practices` + digest pinning; `guard.sh` blocks `--no-frozen-lockfile`, `nix flake update` and policy weakening. `harden-runner` is in `egress-policy: audit`, not block. |
| 5 | Dependency hallucination / slopsquatting | Implemented | `.claude/hooks/verify-install.sh` (npm and PyPI: 404 => deny, first publish < 7 days => deny, unreachable => deny, otherwise `ask` with the package age; 100 s budget, 120 s hook timeout); `ask` on `pnpm add`, `pnpm install`, `pnpm dlx`, `npx`, `uv`/`pip`/`poetry` installs and `Edit(package.json)`, `Edit(pnpm-workspace.yaml)` (`.claude/settings.json`); cooldown in `pnpm-workspace.yaml.jinja`; frozen CI install as the backstop. |
| 6 | Maintainability | Implemented | Biome `noExcessiveCognitiveComplexity` 15 and `noExcessiveLinesPerFile` 300 as errors (`biome.json`; the line limit counts JS/TS files, not JSON or YAML); jscpd `--baseline-from-ref origin/main --fail-on-new-clones` + `threshold: 3` (`justfile.jinja` recipe `dup`, `.jscpd.json`); knip default and `--production` with every rule an error (`knip.json`); dependency-cruiser layers (`.dependency-cruiser.cjs`); ast-grep rules (`rules/*.yml`, `sgconfig.yml`). `AGENTS.md` states the same limits as conventions. |
| 7 | Documentation drift | Partial | TypeDoc `notDocumented`/`notExported`/`invalidLink` with `treatValidationWarningsAsErrors` (`typedoc.json`, `justfile.jinja` recipe `docs`); `scripts/docs-drift.sh` (`src/` change needs `docs/`, README, CHANGELOG or `.changeset/`, or `#no-docs <reason>`; `.dependency-cruiser.cjs` change needs a new ADR); committed `openapi.json` diffed by `scripts/emit-openapi.ts --check`. Missing: generated client types and `llms.txt` diffs; the quarterly `/doctor prompt-audit` is a `docs/PLAYBOOK.md` ritual, not a job. |
| 8 | Functional correctness | Implemented | Vitest coverage floors (`vitest.config.ts`: 80/80/75/80 global, per-file 60/60/50/60, `src/domain/**` 90/85) and `typecheck: enabled` + `--typecheck` (`justfile.jinja` recipe `test`); `Stop` hook `.claude/hooks/gates.sh` runs `just check` on a dirty tree or unverified HEAD, keeps the turn open (at most `GATE_MAX_RED_STOPS=4`) and records `refs/vibe/gate-verified`; acceptance tests in the plan (`docs/PLAYBOOK.md`, `CLAUDE.md`). There is no `/verify` skill; the Stop hook is the verification step. |
| 9 | Logical correctness | Implemented | fast-check properties on the domain module (`src/domain/slug.test.ts` via `@fast-check/vitest`); reviewer against the spec (`.claude/agents/reviewer.md`, `CLAUDE.md`); mutation score (`stryker.config.json` `break: 60`, `justfile.jinja` recipe `mutation` in `just ci`, weekly `--force` run in `ci.yml` job `mutation-full`). |
| 10 | Error handling, edge cases, null safety | Partial | Strictest `tsconfig.json`; ts-reset (`src/reset.d.ts`); Biome `noFloatingPromises`, `noMisusedPromises`, `useExhaustiveSwitchCases` (`biome.json`); typescript-eslint `strictTypeChecked` (includes `only-throw-error`) plus `switch-exhaustiveness-check` and `strict-boolean-expressions` as errors (`eslint.config.js`); `rules/no-empty-catch.yml`, `rules/no-as-any.yml`; Zod at every boundary (`src/schemas/*`, `src/env.ts.jinja`, the `defaultHook` 400 in `src/app/app.ts`); neverthrow `Result` for expected failures (`src/domain/slug.ts`). Missing: Schemathesis runs `not_a_server_error` only (`secpass.yml`), so negative-data rejection is not fuzzed yet. |
| 11 | Production stability | Partial | OTel + Pino correlation; `/healthz` and `/readyz` with an accepting-connections and a database check (web: also a `web` check that holds traffic until the server bundle is loaded at startup); graceful drain that also stops pg-boss, the flag provider and the pool, even after an unclean close (`src/infra/server.ts.jinja`, `server.test.ts.jinja`); kill switches in `flags/flags.json` (`kill-switch-writes`) wired into runbook step 1; post-deploy `/readyz` poll and Playwright smoke; `just load` (k6 thresholds on a local build). Missing: `queue: max` (actionlint 1.7.12 rejects it), a scheduled k6 workflow. |
| 12 | Integration failures & compliance | Partial | MSW with `onUnhandledFrame: "error"` so unit tests fail on any unmocked outbound request (`tests/setup.msw.ts`, `vitest.config.ts` `setupFiles`). Missing: vendor types regenerated from the live spec + `git diff --exit-code`, Pact consumer tests + `openapi-pact-comparator`, Standard Webhooks verification, `opossum` circuit breaker; the scaffold has no outbound integration yet. |
| 13 | API contract & schema adherence | Implemented | Zod schemas are the single source (`src/schemas/*`, including the documented better-auth surface in `src/schemas/auth.ts`); `openapi.json` generated per project and `--check`ed in `just docs`; `just api-diff` runs `oasdiff breaking` against `origin/main:openapi.json` (oasdiff from the nixos-unstable input; `#api-break <reason>` downgrades it to a warning); Schemathesis conformance in `secpass.yml`; a parity test fails when a better-auth upgrade adds an undocumented endpoint (`src/infra/auth.test.ts`). |
| 14 | SEO & accessibility | Implemented (web) | axe WCAG 2.0–2.2 A/AA on every page (`tests/e2e/a11y.spec.ts.jinja`), jsx-a11y strict + react-hooks on all TSX with a fixture test proving the rules fire on ESLint 10 (`eslint.config.js.jinja`, `tests/lint/jsx-a11y.test.ts`), Lighthouse CI accessibility/SEO/best-practices ≥ 0.95 (`lighthouserc.json`, `just lighthouse` in `just ci`), titles and descriptions per route, JSON-LD (schema-dts), Open Graph images, `robots.txt`. `service`: axe on the status page only. Missing: a generated `sitemap.xml`. |
| 15 | Performance | Partial | `web`: size-limit budgets on the client bundle (`.size-limit.json`), Lighthouse performance and LCP/CLS/TBT budgets (warn; CLS errors), web-vitals RUM recorded as the `web_vitals` OTel histogram (`src/app/routes/vitals.ts`); k6 thresholds via `just load`. Missing: a k6 workflow; Lighthouse performance only warns (CI runners are noisy). |
| 16 | Runtime performance | Partial | `regexp/no-super-linear-backtracking: error` plus `eslint-plugin-regexp` recommended (`eslint.config.js`). Missing: `just bench` runs `vitest bench` (`justfile.jinja`) but the template ships no `*.bench.ts`, no stored baseline and no fail-over-20%-regression comparison. |
| 17 | Resource efficiency & memory stability | Not implemented | No weekly k6 soak workflow (the header of `tests/load/smoke.js` describes a manual `--vus 20 --duration 3h` run), no `process.memoryUsage()` gauge over OTel, no memlab job. The report itself notes no per-PR gate exists; the scheduled monitor is still missing. |
| 18 | Change localization accuracy | Implemented | `typescript-lsp` plugin (`.claude/settings.json`); dependency-cruiser boundaries (`.dependency-cruiser.cjs`: default-deny layer rules and `src/modules/<name>/` feature modules entered through `index.ts`, enforced before the first module exists and proven by `tests/arch/modules.test.ts.jinja`; ADR 0003); path-scoped `.claude/rules/{api.md.jinja,tests.md,migrations.md,modules.md.jinja}`; `Read` deny on `dist/`, `build/`, `*.generated.*` (`settings.json`, `CLAUDE.md`); failing-test-first and "name the file" briefs in `docs/PLAYBOOK.md`. A model property; the scaffolding is what the report asked for. |
| 19 | Token efficiency | Partial | `AGENTS.md.jinja` is 33 lines (< 60); path-scoped rules load on demand; the `release` skill has `disable-model-invocation: true`; no `.mcp.json` (MCP off); `/clear` per task and "one task per session" in `docs/PLAYBOOK.md`. Missing: Haiku subagents (`.claude/agents/reviewer.md` sets no `model`). |
| 20 | Repository-level generalization | Implemented | Plan mode for `src/domain/` and `migrations/` (`CLAUDE.md`), `plansDirectory: ./plans` (`.claude/settings.json`, `plans/.gitkeep`), test-gated steps (Stop hook), LSP plugin, boundary rules (`.dependency-cruiser.cjs`). A model property; not enforceable beyond this scaffolding. |
| 21 | Type & signature consistency | Implemented | `tsc --noEmit` in pre-commit (`lefthook.yml` job `typecheck`), in the Stop hook and CI through `just check` -> `typecheck` (`justfile.jinja`), `explicit-module-boundary-types` and `consistent-type-imports` as errors (`eslint.config.js`), LSP diagnostics after edits (`typescript-lsp` plugin). |
| 22 | Constraint compliance & output formatting | Partial | Biome format on `PostToolUse` for `Edit` and `Write` (`.claude/settings.json`). Missing: `--output-format json --json-schema` appears only as a command line in `docs/PLAYBOOK.md`; the template ships no scripted runner and no "Reply OK or FAIL" prompt. |
| 23 | Structured-output & parser compatibility | Not implemented | No script in the template runs `claude --bare -p` or validates agent JSON with Zod; `.claude/ci-settings.json` is the policy such a script would use, and `docs/PLAYBOOK.md` shows the command line. |
| 24 | Context-window efficiency | Partial | Plan files survive `/clear` and compaction (`plansDirectory`, `plans/`), fresh session per task (`docs/PLAYBOOK.md`), small on-demand rule and skill files. Missing: the `SessionStart`/`CwdChanged` hooks only append `direnv export bash` to `$CLAUDE_ENV_FILE` (`.claude/settings.json`); nothing re-injects task context after compaction. |
| 25 | Code extraction & reasoning efficiency | Not implemented | No two-step answer-then-format runner and no schema-validated output (same absent script as rows 22 and 23). The report says no benchmark or gate exists for this row; only parse-failure monitoring was planned. |
| 26 | Refactoring & contract preservation | Implemented | knip `exports: error`, TypeDoc validation, Vitest typecheck, `openapi.json` drift and the oasdiff breaking-change gate against `origin/main` (`just api-diff` in `just docs`), the database types and `db/schema.sql` checked against the migrations (`just db-check`), reviewer against the spec. |
| 27 | Test suite quality / mutation adequacy | Implemented | Stryker incremental, `coverageAnalysis: perTest`, `break: 60` for `src/` (`stryker.config.json`) and a second run with `break: 80` for `src/domain` (`stryker.domain.config.json`), both in `just mutation` (`just ci`) and in the weekly full run (`ci.yml`); `@vitest/eslint-plugin` recommended (verified in the generated project: `expect-expect`, `no-conditional-expect`, `no-focused-tests`, `no-mocks-import` are errors) with `no-disabled-tests` raised to error (`eslint.config.js`); no in-repo mocks (`rules/no-vi-mock-of-repo-module.yml`, `.claude/rules/tests.md`); MSW as the only HTTP boundary (`tests/setup.msw.ts`); Vitest 5. |
| 28 | Concurrency & async correctness | Partial | Promise rules (`biome.json` `noFloatingPromises`/`noMisusedPromises`; `strictTypeChecked` in `eslint.config.js`), Vitest file isolation (default), Node's throw-on-unhandled-rejection (runtime default), graceful drain with an unref'd deadline (`src/infra/server.ts`). Missing: Playwright `lock`s, an AbortSignal/timeout lint rule. |
| 29 | Observability & telemetry coverage | Implemented | OTel auto-instrumentation with exporters only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`src/instrumentation.ts`); Pino with `redact` and `trace_id`/`span_id` correlation (`src/logger.ts`); one SERVER span per route with semantic-convention attributes (`src/app/tracing.ts`); the span-per-route test walks `openapi.json` (`src/app/telemetry.test.ts`); `console.*` banned outside `src/logger.ts` (`rules/no-console-outside-logger.yml`, `eslint.config.js` `no-restricted-syntax`); `traceId` returned in 500 bodies (`src/app/app.ts`, `src/schemas/error.ts`). |
| 30 | Configuration & environment parity | Implemented | One flake for dev, agent and CI (now with Postgres, dbmate, Squawk, oasdiff, sops/age, Mailpit, k6); `.env.example` generated from the t3-env schemas and `--check`ed (`scripts/env-example.ts.jinja`, `just env-check`); `process.env` confined to `src/env.ts` and `import.meta.env` to `src/ui/public-env.ts` (ast-grep); `just doctor` checks pnpm, Node, Playwright and Postgres versions; the Dockerfile pins its base image by digest. Missing: conftest policies. |
| 31 | CI/CD integration & deployment gates | Partial | `merge_group` triggers on `ci.yml`, `secpass.yml`, `supply-chain.yml`; `CODEOWNERS.jinja` for `.github/`, hooks, migrations, `.dependency-cruiser.cjs`, ADRs, `src/domain/`; `deploy.yml`: `production` environment, image by digest, `provenance: mode=max`, `sbom: true`, `attest-build-provenance`, `/readyz` poll + smoke; `release` skill cannot run itself. Missing: `queue: max` (`cancel-in-progress: false`); rulesets, required checks and the merge queue are repository settings (Day 0 in `docs/PLAYBOOK.md`); `image`/`deploy` stay off until `PRODUCTION_URL` and the two `TODO(project)` markers are filled. |
| 32 | Reproducibility & determinism | Partial | `flake.lock` and `pnpm-lock.yaml` shipped by the template (locked against the default answers; `template-test` asserts they survive the first install unchanged), re-locked by the first install for other answers and committed (`new-project.sh`), `Edit` denied on both; Claude Code from the `nixpkgs-agents` input (`flake.nix.jinja`); `--bare` for scripted runs (`docs/PLAYBOOK.md`); `just doctor`. Missing: no `model` pinned in `.claude/settings.json` or `.claude/ci-settings.json`; no pass^k harness. |
| 33 | Intent alignment / prompt-task match | Implemented | Interview-to-plan tiers, "ask at most 3 questions", acceptance tests in the brief, Esc-and-rewrite rule (`docs/PLAYBOOK.md`); plan mode (`CLAUDE.md`); reviewer compares the diff with the plan (`.claude/agents/reviewer.md`). Not enforceable by design. |
| 34 | Code origin & license compatibility | Partial | SPDX allowlist over `pnpm licenses list --json --prod` on pre-push (`lefthook.yml` -> `just licenses`, `justfile.jinja`) and in `just ci`; `dependency-review-action` `allow-licenses` with the same list (`supply-chain.yml`). Missing: the weekly scanoss snippet scan (roadmap; triage-only in the design). |
| 35 | Regulatory compliance architecture | Partial | Pino redaction, SBOM + Grype SARIF, build attestations, `security-evidence/`, errors-only Sentry without default PII, self-hosted fonts and cookie-less Umami (no third-party requests by default). Missing: RLS baseline + advisors, pgaudit, PII `SECURITY LABEL`s, Checkov SARIF. |
| 36 | Rollback & recovery correctness | Partial | Expand-only dbmate migrations linted by Squawk locally and in CI, applied before the new image takes traffic (`deploy.yml`); immutable image deploys by digest; flag → app → data runbook with a real kill switch (`kill-switch-writes`, flag file watched in-process) and a quarterly restore-drill table; pg-boss jobs retried with backoff. Missing: `Idempotency-Key` middleware, PITR/backups (per project: Neon's 6 h on Free). |
| 37 | Review burden & human acceptance rate | Implemented | Reviewer subagent (`.claude/agents/reviewer.md`, read-only tools); `code-review` plugin enabled and `/code-review low` in the loop (`.claude/settings.json`, `docs/PLAYBOOK.md`); `REVIEW.md` (Important definition, five-nit cap, exclusion of what CI enforces, `file:line` evidence); evidence in the PR body and ~100-400 line commits (`AGENTS.md.jinja`, `docs/PLAYBOOK.md`). The PR-size budget is a convention, not a gate. |
| 38 | Agent debt / architectural drift | Partial | Visible dependency-cruiser layers (`.dependency-cruiser.cjs`); ADR required on a boundary change (`scripts/docs-drift.sh`, `docs/decisions/0001-record-architecture-decisions.md`); CODEOWNERS on `.dependency-cruiser.cjs` and `docs/decisions/`; monthly cleanup run and quarterly instruction pruning (`docs/PLAYBOOK.md`). Missing: the stricter hidden depcruise suite in CI; `/simplify` is not referenced anywhere. |
| 39 | Cost efficiency | Partial | Short context files; bounded fix-and-retry (`GATE_MAX_RED_STOPS=4` in `.claude/hooks/gates.sh`); `--max-turns 20 --max-budget-usd 5` and the monthly `--max-budget-usd 3` sweep as command lines in `docs/PLAYBOOK.md`. Missing: no Haiku `model` on the reviewer subagent, no script that carries the caps. |
| 40 | Sandbox isolation & state persistence | Implemented | `sandbox.enabled` + `failIfUnavailable` + `allowUnsandboxedCommands: false`, network `allowedDomains`, filesystem `denyRead`/`allowWrite`, `credentials` scrub, `excludedCommands` limited to `docker` and read-only `gh` (`.claude/settings.json`; identical in `.claude/ci-settings.json`); `blockReadsOutsideWorkingDirectories`, `disableBypassPermissionsMode`; `ConfigChange` -> `.claude/hooks/guard-config.sh` (`ALLOW_CLAUDE_CONFIG_CHANGES=1` escape hatch); `Edit` denied on settings, hooks, `.mcp.json`, `lefthook.yml`, workflows, lock files, `.copier-answers.yml`; `guard.sh` backstop (edits outside the worktree, recursive `rm` outside the project, force/delete pushes, history rewrites, lockfile weakening, `--dangerously-skip-permissions`); `worktree.baseRef` + `.worktreeinclude`; the flake supplies bubblewrap and socat. The holes the report documents (shell redirects into the main checkout, hooks and MCP outside the sandbox, TLS not inspected) remain. |

### Known caveats

- `TODO(vibe-forge)`: none. The only TODO marker is the `TODO(project)` in `template/.github/workflows/deploy.yml`
  (the `Deploy` step, which exits 1 with an `::error::` until you put your platform's command there) and the sentence
  in `template/README.md.jinja` that points at it; it is per-project by design and inert until the `PRODUCTION_URL`
  repository variable is set. The root `Dockerfile` exists now; `template-test` builds it for both kinds.
- Release-age exceptions with a date: `template/pnpm-workspace.yaml.jinja` lets better-auth 1.7.15 (a security release
  published 2026-11-01) through the 3-day `minimumReleaseAge` by exact version; remove those eight lines after
  2026-11-04T09:14Z. `semver@5.7.2` and `semver@6.3.1` are excluded from `trustPolicy: no-downgrade` (legacy lines
  published after 7.x gained provenance).
- Reviewed licence exception: the `sentry` package (FSL-1.1-Apache-2.0, the CLI `@sentry/node` 11 ships) is allowed by
  name in the `licenses` recipe and `supply-chain.yml`; everything else must match the SPDX allowlist.
- `eslint-plugin-jsx-a11y` 6.10.2 still declares ESLint ≤ 9: it runs on ESLint 10 through `@eslint/compat` and a pnpm
  `peerDependencyRules` override, and `tests/lint/jsx-a11y.test.ts` fails if its rules stop reporting.
- Instrumentation: OpenTelemetry's import-in-the-middle hook breaks ESM import cycles, so `src/instrumentation.ts`
  excludes `@tanstack/*` and `dist/server/` from it (TanStack has nothing OTel patches).
- `verify` note still present: `template/flake.nix.jinja`, `# verify on your lock: nix eval nixpkgs#<name>.version`,
  next to `semgrep trufflehog zizmor shellcheck`; those and the new Nix tools (postgresql_18 18.6, dbmate 2.33.0,
  squawk 2.40.1, sops 3.13.3, age 1.3.2, mailpit 1.32.0, k6 2.0.0; oasdiff 1.35.0 from nixos-unstable) were checked
  on 2026-11-03. `just doctor` and `new-project.sh` still ask you to open `/sandbox` once and confirm bubblewrap +
  socat are green; the test Postgres uses TCP on 127.0.0.1 (no unix socket), which works inside the sandbox's private
  network namespace.
- Per-project decisions the template cannot make (Day 0 of `docs/PLAYBOOK.md`; ADR 0002 records the template's own):
  the deploy target (`deploy.yml` builds, attests and migrates but names no platform), backups/PITR and the restore
  drill (Neon's 6 h on Free), the regulatory scope (EU B2C ⇒ EAA/WCAG 2.2 AA + GDPR), Postgres row-level security.
- Repository settings the template cannot write: rulesets requiring `ci / gates`, `secpass / *` and
  `supply-chain / *` plus the merge queue and a required review (so the agent's machine user cannot merge its own
  PRs); CodeQL default setup (`security-extended`); secret-scanning push protection; `production` environment
  protection (GitHub Pro/Team on private repositories); the `GH_TOKEN_FOR_UPDATES` and `DATABASE_URL` secrets; the
  Renovate app; the accounts in `docs/services.md`.
- Gates weaker than the design states: Schemathesis runs `not_a_server_error` only; Lighthouse performance only warns;
  `deploy.yml` uses `cancel-in-progress: false` because actionlint 1.7.12 rejects `queue: max`; `harden-runner` is in
  `egress-policy: audit`; `.zap/rules.tsv` ignores the Secure-cookie rule (plain HTTP on the runner).
- Gates that disappear with an answer: `with_playwright=false` (service only) renders no `tests/e2e`, `tests/security`
  or `tests/smoke`, and the Playwright steps in `ci.yml`, `secpass.yml` and `deploy.yml` become `::notice::` lines.
- Declared but rejected answers: `kind: library`, `with_devcontainer: true`, and `with_playwright: false` with
  `kind: web` fail validation in `copier.yml`.
- Known gaps tracked in the metric table below: when a future release changes code projects own (`src/env.ts`,
  `src/index.ts`, `src/infra/server.ts`, `src/app/app.ts` and some tests are project-owned, so `copier update`
  cannot rewrite them), its CHANGELOG entry says "Manual upgrade from vX" with the steps in
  `template/docs/upgrading/<version>.md` and a `_migrations` message.
- Still on the roadmap (see above): a committed `openapi-typescript` client (row 13's last step), `Idempotency-Key`
  (row 36), `dotenv-linter diff`, any k6 workflow with a memory gauge (rows 15, 17), scanoss (row 34), Checkov SARIF
  (row 35), `@godaddy/terminus`, a `migration` skill, the hidden stricter depcruise suite (row 38), a Haiku `model` on
  the reviewer subagent (rows 19, 39), a scripted `claude --bare -p ... --json-schema` runner (rows 22, 23, 25, 39), a
  pinned `model` in the settings (row 32), a generated `sitemap.xml` (row 14).
- Assumptions in the agent layer: `.claude/settings.json` needs Claude Code >= 2.1.295 (`onFailure: "block"`,
  `blockReadsOutsideWorkingDirectories`), which the flake's `nixpkgs-agents` input provides; older builds ignore both
  keys silently. The `security-guidance` plugin needs Python >= 3.10 on PATH (the flake adds `python3`) and reads the
  JSON pattern file only (`.claude/security-patterns.json`, because the flake's Python has no PyYAML).

<!-- coverage-section -->
