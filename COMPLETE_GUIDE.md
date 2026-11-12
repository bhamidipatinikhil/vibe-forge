# The Complete Guide to vibe-forge

This guide explains, in plain words and with many examples, how to use this template to start projects, build features
with Claude Code, test them, ship them and keep them up to date. Read it from top to bottom once; after that, use the
table of contents and the cheat sheet at the end.

**How to read the examples**

- A line starting with `$` is something you type in a terminal. Do not type the `$` itself.
- `~/dev/my-app` is an example project folder. Use your own name.
- `<owner>` means your GitHub user or organisation name (for this repository: `bhamidipatinikhil`).
- Every code example in chapter 12 was built in a real generated project and passed `just check` and `just e2e`
  before it was copied here.

## Contents

1. [The big picture](#1-the-big-picture)
2. [Set up your computer (once)](#2-set-up-your-computer-once)
3. [Get the template ready (once)](#3-get-the-template-ready-once)
4. [Create a project](#4-create-a-project)
5. [Day 0: the first fifteen minutes in a new project](#5-day-0-the-first-fifteen-minutes-in-a-new-project)
6. [A tour of a generated project](#6-a-tour-of-a-generated-project)
7. [Everyday commands](#7-everyday-commands)
8. [Working with your AI agent](#8-working-with-your-ai-agent)
9. [The knowledge layer: what the project remembers](#9-the-knowledge-layer-what-the-project-remembers)
10. [Pipelines: how to brief a feature](#10-pipelines-how-to-brief-a-feature)
11. [The task graph: plans and their order](#11-the-task-graph-plans-and-their-order)
12. [Worked example: build a "notes" feature from start to finish](#12-worked-example-build-a-notes-feature-from-start-to-finish)
13. [Recipes for common tasks](#13-recipes-for-common-tasks)
14. [Testing: what to test, where, and how](#14-testing-what-to-test-where-and-how)
15. [Configuration and secrets](#15-configuration-and-secrets)
16. [Shipping: CI, releases and deployment](#16-shipping-ci-releases-and-deployment)
17. [When something goes wrong in production](#17-when-something-goes-wrong-in-production)
18. [Keeping projects up to date with the template](#18-keeping-projects-up-to-date-with-the-template)
19. [Changing the template itself](#19-changing-the-template-itself)
20. [Troubleshooting: what each failure means and how to fix it](#20-troubleshooting-what-each-failure-means-and-how-to-fix-it)
21. [Unattended runs and measuring the process](#21-unattended-runs-and-measuring-the-process)
22. [Glossary](#22-glossary)
23. [Cheat sheet](#23-cheat-sheet)

---

## 1. The big picture

### What this template is

vibe-forge is a **project generator**. You run one script, answer a few questions, and get a new project folder
that already contains:

- a complete, pinned toolchain (Node, pnpm, Postgres 18, Playwright's Chromium, Claude Code, security scanners), all
  provided by **Nix**, so every machine and every CI run uses exactly the same versions;
- a working app: either a **web** app (a React website and its API in one server process) or an API-only
  **service**, with accounts, a database, background jobs, email and feature flags already wired in;
- **one quality gate**, `just check`, that decides when work is done;
- **guard rails for Claude Code**: a sandbox, permission rules, and hooks that stop the agent from finishing while the
  gate is red;
- GitHub workflows for CI, security scans, deployment and weekly template updates.

The idea behind it: an AI agent writes most of the code, so the project must make mistakes either **impossible**
(types, schemas, architecture rules), **loud** (tests and scanners that fail the gate), or **small** (feature flags,
safe database migrations, immutable deploys).

### The two kinds of project

| Kind | What you get | Pick it when |
| --- | --- | --- |
| `web` (default) | TanStack Start (React 19, server-side rendering) **inside** a Hono API server: one process, one port, one Docker image | You are building a product people use in a browser |
| `service` | The Hono API only, documented with OpenAPI | You are building an API, a backend for a mobile app, or a webhook receiver |

Both kinds get the same backend: Postgres (Kysely + dbmate), accounts (better-auth), jobs (pg-boss), email (Resend,
Mailpit locally), feature flags (OpenFeature + flagd), error tracking (Sentry) and tracing (OpenTelemetry).

### How work flows

```text
 you ──brief──▶ Claude Code ──edits──▶ files
                    │
                    ▼  (when Claude wants to stop)
            Stop hook runs `just check` ──red──▶ Claude keeps fixing (at most 4 tries)
                    │ green
                    ▼
        you review the diff ──▶ commit ──▶ pull request ──▶ CI runs `just ci` + `just e2e`
                                                                │ green
                                                                ▼
                                                  merge to main ──▶ deploy.yml ships it
```

Three ideas carry the whole template:

1. **"Done" means the gate is green.** Not "the agent says it works". The agent cannot end its turn while
   `just check` fails (after four failed attempts it stops and prints an `UNVERIFIED` warning).
2. **Rules live in tools, not in sentences.** "Don't import the database from a route" is a dependency-cruiser rule;
   "every endpoint is documented" is a test; "no secrets in git" is a scanner. Prompts fade; gates don't.
3. **Small, reversible steps.** One feature per session and per pull request, risky features behind a flag, database
   changes that only ever add things.

### What lives where

| Place | What it is |
| --- | --- |
| This repository (`vibe-forge`) | The generator: `copier.yml` (the questions), `template/` (the files every project gets), `new-project.sh` |
| A generated project | Your app. It owns its code; the template only updates the shared tooling (see chapter 18) |
| `docs/PLAYBOOK.md` in each project | The short version of how to work with the agent |
| `docs/decisions/` in each project | ADRs: why the project is built the way it is |
| `AGENTS.md` / `CLAUDE.md` in each project | What the agent reads at the start of every session |

---

## 2. Set up your computer (once)

You need four things: **Nix with flakes**, **direnv with nix-direnv**, **git**, and a **GitHub account**. Everything
else (Node, pnpm, Postgres, Claude Code, the scanners) comes from each project's Nix shell.

### On NixOS

Add this to `/etc/nixos/configuration.nix`:

```nix
{
  nix.settings.experimental-features = [ "nix-command" "flakes" ];
  programs.direnv.enable = true;
  programs.direnv.nix-direnv.enable = true;
  programs.git.enable = true;
}
```

Then apply it:

```console
$ sudo nixos-rebuild switch
```

### On another Linux or macOS

1. Install Nix (multi-user) and enable flakes: add `experimental-features = nix-command flakes` to
   `~/.config/nix/nix.conf`.
2. Install `direnv` and `nix-direnv`, and hook direnv into your shell, for example in `~/.bashrc`:
   `eval "$(direnv hook bash)"`.
3. Install git.

### Check that it works

```console
$ nix --version
nix (Nix) 2.x.x
$ direnv --version
2.x.x
$ git config --global user.name "Your Name"
$ git config --global user.email "you@example.com"
```

### If your template repository is private

`git clone`, `new-project.sh` and Copier all read the template from GitHub over HTTPS, so give git a GitHub login once
per machine. That needs `gh` outside any project: on NixOS add `pkgs.gh` to `environment.systemPackages` in
`configuration.nix` (it then starts with `{ config, pkgs, ... }:`) and rebuild; elsewhere install it from
<https://cli.github.com>. Then:

```console
$ gh auth login        # GitHub.com, HTTPS, log in with the browser
$ gh auth setup-git    # git, and so Copier, now uses that login for github.com
```

Without it, `new-project.sh` prints `note: cannot list the branches of …; this checkout is not compared` and Copier asks
for a username and password, which GitHub refuses.

### Claude Code

You do **not** install Claude Code yourself: every project's flake pins a version and puts it on your `PATH` when the
project's shell is active. The first time you run `claude` inside a project, it asks you to sign in.

---

## 3. Get the template ready (once)

### Why this step matters

`new-project.sh` does **not** use your working copy. It asks Copier to render the template's **`main` branch**, as it
is on GitHub. Every project records the `main` commit it came from, and every later update (the weekly job, or by
hand) moves it to the newest `main` commit. So the rule is simple:

> **What is on GitHub's `main` is what new projects get, and what existing projects receive on their next update.**

There are no branches or versions to pick when you create or update a project. A branch is only where you prepare a
change before it goes to `main`.

At the time of writing, `main` has everything this guide describes: the `web` and `service` kinds, the backend
layers, feature modules, `requireSession`, the harness adapters (`harness: claude`, `opencode` or `both`), the
knowledge layer (`docs/glossary.md`, `docs/registry.md`, `docs/learnings.md`, `docs/metrics.md`), the
`pipelines/` directory and this guide (chapter 12 needs them). The first release is tagged `v0.1.0`.

### Put a template change on `main`

```console
$ cd ~/dev/vibe-forge                     # your clone of this repository
$ git switch main && git pull
$ git switch -c my-change                    # any branch name
$ # … edit, commit …
$ git push -u origin my-change
$ gh pr create --fill                        # or open the pull request on GitHub
```

Wait until the `template-test` workflow is green on the pull request (it renders all seven test answer sets and runs
their full gates), then merge it. Any merge button works (merge commit, squash or rebase), because projects only ever
record commits of `main`. Then update your clone (`git switch main && git pull`) before you create the next project.

What you must **never** do is rewrite `main` itself: no `git push --force`, no rebase or amend of commits that are
already on GitHub. Every update re-renders the exact commit a project records, and a rewritten `main` loses it
(chapter 20 has the repair). Protect `main` on GitHub with a ruleset that blocks force pushes, as chapter 5.3 does for
projects.

### Try a template change before merging it

To render your **working copy**, uncommitted changes included (only for testing the template):

```console
$ ./new-project.sh --local /tmp/try-it
```

A project made with `--local` records an absolute path to your clone, so its weekly update job on GitHub can never
find the template. Look at it, then throw it away; create real projects only after the change is on `main`.

### Version tags (optional milestones)

Projects do not follow tags, so you never *need* to tag. A tag such as `v0.2.0` marks a finished version, and it
matters in one case: when a change needs a hand upgrade in existing projects (a `_migrations` message in
`copier.yml`, "Manual upgrade from …" in `CHANGELOG.md`), because that message appears when a project's update
crosses the tag. Put the tag on the `main` commit that brings the change:

1. In `CHANGELOG.md`, rename `## 0.2.0 (unreleased)` to `## 0.2.0 (2026-11-05)` (use the real date), and get that
   onto `main` like any other change.
2. Tag that commit of `main` and push the tag:

```console
$ git switch main && git pull
$ git tag v0.2.0
$ git push origin v0.2.0
```

Use a new release number (`v0.2.0` after `v0.1.0`), not a post-release such as `v0.1.0.post1`: Copier reads a commit N
commits after `v0.1.0` as `0.1.0.postN.dev0`, so `v0.1.0.post1` would count as older than projects made later.

---

## 4. Create a project

### The one command

```console
$ cd ~/dev/vibe-forge
$ ./new-project.sh ~/dev/my-app
```

Copier asks the questions below. Press Enter to keep a default.

### The questions, one by one

| Question | Example answer | What it does |
| --- | --- | --- |
| `project_name` | `Recipe Box` | Human name: README, page titles, the OpenAPI title |
| `project_slug` | `recipe-box` (default: the name in lower case with dashes) | Package name, database name, service name in traces |
| `github_owner` | `bhamidipatinikhil` | Written into `.github/CODEOWNERS`, so you are asked to review agent changes |
| `npm_scope` | empty, or `acme` | Makes the package `@acme/recipe-box`; leave empty if unsure |
| `kind` | `web` | `web` = website + API; `service` = API only (see chapter 1) |
| `harness` | `both` (default) | Which agent adapters to render: `claude` = Claude Code (`.claude/`, `CLAUDE.md`), `opencode` = OpenCode V2 (`.opencode/`, `opencode.jsonc`), `both` = both. `AGENTS.md` is the shared brief either way; the gates are the same `just check` |
| `node_major` | `26` | `26` is the current LTS; choose `24` only if your host requires it |
| `with_playwright` | `yes` | Browser tests, accessibility checks, security specs; `web` requires it |
| `with_python` | `no` | Adds Python 3.12 + uv to the shell, for data scripts |
| `with_devcontainer` | `no` | Not built yet; only `no` is accepted |
| `payments` | `none` | `razorpay` or `polar` adds a payment SDK and a signed webhook route |
| `with_ai` | `no` | Adds the Anthropic SDK and a signed-in `POST /api/v1/ai/summarize` route |
| `with_charts` (web) | `no` | Adds chart libraries and a `/charts` example page |
| `with_rich_text` (web) | `no` | Adds the Tiptap editor and an `/editor` example page |

Your answers are saved in `.copier-answers.yml`. Do not edit that file by hand.

### Example answer sets

**A typical web product (most people):** `kind=web`, everything else default.

**A SaaS app that takes payments in India and summarizes text with Claude:**

```console
$ ./new-project.sh ~/dev/notes-pro --data kind=web --data payments=razorpay --data with_ai=true
```

**An API for a mobile app:**

```console
$ ./new-project.sh ~/dev/recipes-api --data kind=service
```

**Fully non-interactive** (good for scripts): `--defaults` accepts every default, `--data` sets the rest.

```console
$ ./new-project.sh ~/dev/my-app --defaults \
    --data project_name="My App" --data github_owner=bhamidipatinikhil
```

### What the script does (and how long it takes)

0. Compares the template's `main` on GitHub (what Copier renders) with what you have checked out, and warns when your
   checkout has commits or uncommitted template changes that `main` lacks (see the table below). It never asks.
1. Renders the template's `main` into the folder (`copier copy --vcs-ref main`).
2. `git init` and stages everything.
3. First `pnpm install` (downloads packages; the first project on a machine also downloads the Nix toolchain, which
   can take 10 to 20 minutes; later projects reuse it).
4. Generates `openapi.json` and `.env.example` from the code, then makes the first commit
   (`chore: scaffold from vibe-forge`).
5. `direnv allow`, a second, frozen install, `lefthook install`.
6. `just doctor` (are all versions consistent?) and `just check` (the full gate).

When it prints

```text
ready: cd /home/you/dev/my-app, then run claude there   (open /sandbox once and confirm the Dependencies tab is green)
```

the project is green and ready for your first prompt.

### If creation fails, or warns

| Message | Cause | Fix |
| --- | --- | --- |
| `error: ... has no 'origin' remote` | Your template clone has no GitHub remote | Push the template (README, one-time setup) or use `VIBE_FORGE=gh:<owner>/vibe-forge ./new-project.sh …` |
| `error: ... is inside the git repository ..., not the root of its own clone` | The template folder sits inside another repository (copied, not cloned) | Run the script from a `git clone` of the template, or use `VIBE_FORGE=gh:<owner>/vibe-forge` |
| `error: new-project.sh always renders the template's main branch, so it takes no --vcs-ref` | You passed `--vcs-ref` (or `-r`, `--prereleases`, `-g`) | Leave it out: projects are always made from `main` (chapter 3). To try unmerged changes, use `--local` |
| `error: … has no main branch` | The template repository on GitHub has no `main` | Push it: `git push -u origin main` |
| `warning: Copier renders origin's main (…), not this checkout (…)` | You are on another branch, or have commits that are not on GitHub's `main` yet | Those commits will not be in the project. Merge them into `main` and push (chapter 3), then delete the folder and run the script again. To try them first, use `--local` |
| `note: origin's main (…) is ahead of this checkout` | You have not pulled lately | Nothing: the project gets GitHub's newer `main`. Run `git pull` to see what it contains |
| `warning: copier.yml or template/ has uncommitted changes, and Copier does not render them` | Your template clone has changes you have not committed and pushed | Get them onto `main` (chapter 3), or try them with `--local` |
| `note: cannot list the branches of …; this checkout is not compared` | The script could not read the template's branches: you are offline, or git has no GitHub login for a private template (chapter 2) | Copier reads the template the same way, so it usually fails too: get back online, or log git in (chapter 2), then run the script again |
| `error: the project folder comes first` | You put a flag before the folder | `./new-project.sh ~/dev/my-app --defaults …` |
| `kind=web needs the Nix Chromium` | You answered `with_playwright=no` with `kind=web` | Answer `yes`, or choose `kind=service` |
| `not implemented in this version` | You chose `kind=library` or `with_devcontainer=yes` | Those are planned; choose something else |
| `ERR_PNPM_...` about release age | A pinned package is younger than 3 days | Wait a day, or see chapter 13.10 |
| Out of memory, or killed | The first install and `just check` are heavy | Close other heavy apps and run the script again in a fresh folder |

A `warning:` never stops the script: it goes on and creates the project from GitHub's `main`. To redo it, delete the
folder first (`rm -rf ~/dev/my-app`): run into the same folder, Copier asks to overwrite every template file and
keeps the old `src/` and `tests/`.

---

## 5. Day 0: the first fifteen minutes in a new project

Do these once per project. They make the agent safe to use and the main branch impossible to break silently.

### 5.1 Open the project and check the sandbox

```console
$ cd ~/dev/my-app          # direnv loads the Nix shell automatically (the first time takes a while)
$ claude
```

Inside Claude Code, type `/sandbox` and check that the **Dependencies** tab is green (bubblewrap and socat). The
sandbox keeps the agent's shell commands inside the project folder and off the network, except for package
registries.

### 5.2 Put the project on GitHub

Run this in **your own terminal** (inside the agent's sandbox, `gh` cannot see your login):

```console
$ gh auth login                                  # once per machine
$ gh repo create bhamidipatinikhil/my-app --private --source . --push
```

### 5.3 Protect the main branch

On GitHub, in the repository settings:

1. **Code security → CodeQL**: enable the default setup (query suite "extended").
2. **Rules → Rulesets → New branch ruleset** for `main`:
   - require a pull request before merging, with **one approval** and **review from Code Owners**;
   - require status checks: `ci / gates`, and the `secpass` and `supply-chain` checks;
   - block force pushes;
   - turn on the **merge queue**.

### 5.4 Weekly template updates and dependency updates

1. Create a personal access token with the `repo` and `workflow` scopes (fine-grained: Contents, Pull requests, Issues
   and Workflows read and write on the project, Contents read on the template) and add it as the repository secret
   `GH_TOKEN_FOR_UPDATES` (Settings → Secrets and variables → Actions). Template updates change
   `.github/workflows/*`, and GitHub refuses to push a workflow change with a token that lacks the workflow scope.
2. Install the [Renovate app](https://github.com/apps/renovate) on the repository.
3. If the first weekly update fails because a label is missing: `gh label create template-update`.

### 5.5 Accounts and secrets

`docs/services.md` lists the outside services (Neon for Postgres, Resend for email, Grafana Cloud, Sentry, Better Stack,
Umami) and which settings each needs. You do not need any of them to develop locally: every setting has a local
default. Chapter 12 shows how to store their secrets safely with sops + age.

### 5.6 Write down your project-level decisions

Read `docs/decisions/0002-stack.md` (the stack, and what is not used on purpose). Then copy
`docs/decisions/0001-record-architecture-decisions.md` to `docs/decisions/0004-deploy-target.md` and record the
choices only you can make: where you deploy, how backups work, which regulations apply (for example "EU consumers:
WCAG 2.2 AA and GDPR").

### 5.7 Give the agent its own GitHub identity (recommended)

So that everything the agent does arrives as a pull request **you** must approve:

1. Create a second GitHub account (a "machine user"), invite it to the repository with **Write** access.
2. Give it a fine-grained token for this repository only, with Contents and Pull requests read/write.
3. Log it in with its own config folder and start the agent with its identity, for example with a shell alias:

```bash
alias claude-agent='GH_CONFIG_DIR=~/.config/gh-agent \
  GIT_AUTHOR_NAME="my-agent" GIT_AUTHOR_EMAIL="my-agent@users.noreply.github.com" \
  GIT_COMMITTER_NAME="my-agent" GIT_COMMITTER_EMAIL="my-agent@users.noreply.github.com" claude'
```

Because the ruleset requires an approval from a code owner (you), the agent can never merge its own work.

### 5.8 Trim AGENTS.md

Every line of `AGENTS.md` is sent to the model on every request. Delete lines the repository already makes obvious,
keep it under 60 lines, and review changes to it like code.

---

## 6. A tour of a generated project

### The folders (a `web` project)

```text
my-app/
├── src/
│   ├── domain/        pure business rules: no database, no HTTP, no clock (example: slug.ts)
│   ├── schemas/       Zod schemas: the exact shape of data that crosses the API boundary
│   ├── app/           the HTTP layer: Hono routes, security headers, tracing, ports.ts
│   │   └── routes/    one file per route group (health, auth, slug, events, og, vitals)
│   ├── infra/         the real world: database, auth, email, jobs, flags, Sentry, the server itself
│   ├── modules/       product areas, one folder each (empty at first; see chapter 12)
│   ├── ui/            the website (TanStack Start): routes/, components/, lib/, styles/
│   ├── env.ts         every setting, validated at start-up
│   └── index.ts       starts the server
├── tests/             e2e, security, smoke, load and architecture tests (unit tests sit next to the code)
├── migrations/        database changes (SQL files, applied in order by dbmate)
├── db/schema.sql      the resulting schema (generated, committed)
├── flags/flags.json   feature flags and kill switches
├── messages/          UI text per language (en.json, de.json)
├── content/posts/     blog posts in MDX
├── docs/              PLAYBOOK, ADRs (decisions/), runbooks, services
├── .claude/           agent policy: settings, hooks, rules, skills, the reviewer subagent
├── justfile           all commands (`just check`, `just db-up`, …)
├── flake.nix          the toolchain
└── openapi.json       the API description (generated, committed)
```

A `service` project has the same layout without `src/ui` content, `messages/`, `content/` and the web-only configs.

### The layers, explained with a restaurant

| Layer | Restaurant | Rule (checked by dependency-cruiser) |
| --- | --- | --- |
| `src/domain` | The recipes | Imports nothing else from `src/`; pure functions you can test with plain values |
| `src/schemas` | The order forms | May use `src/domain` only |
| `src/app` | The waiters: take orders, return dishes | Reaches the database, mail and auth only through the interfaces in `src/app/ports.ts` |
| `src/infra` | The kitchen and the suppliers | Implements those interfaces with real Postgres, Resend, better-auth |
| `src/ui` | The dining room | Imports nothing from the rest of `src/`; talks to the server only through the HTTP API |
| `src/modules/<name>` | A whole station (the pizza oven) | Entered through its `index.ts` only; gets its database passed in |

If you or the agent break one of these rules, `just arch` (part of `just check`) fails and names the rule.

### Files that are generated (never edit them by hand)

| File | Made by | Checked by |
| --- | --- | --- |
| `openapi.json` | `pnpm openapi` (from the routes) | `just docs` |
| `.env.example` | `pnpm env:example` (from `src/env.ts`) | `just env-check` |
| `db/schema.sql`, `src/infra/db/schema.gen.ts` | `just db-generate` (from `migrations/`) | `just db-check` |
| `src/ui/routeTree.gen.ts`, `src/ui/paraglide/`, `.content-collections/` | `just gen` (git-ignored) | regenerated before every gate |

### Who owns which file

- **The template owns** the tooling: `flake.nix`, `justfile`, lint configs, `.github/workflows/`, `.claude/`. A template
  update rewrites these.
- **You own** your code and content: `src/**`, `tests/**`, `migrations/**`, `README.md`, `docs/decisions/*.md`,
  messages, content, flags, and the lock files. A template update never touches them.

---

## 7. Everyday commands

### A normal day

```console
$ cd ~/dev/my-app          # direnv loads the toolchain
$ just db-up               # start the local Postgres (127.0.0.1:54329, data in .data/pg)
$ pnpm dev                 # the app at http://127.0.0.1:3000 (UI hot-reloads; the server restarts on change)
$ just check               # before you commit: the whole gate
```

Stop the database when you are done: `just db-down` (the data stays in `.data/pg`).

### All the commands you will use

| Command | When to use it |
| --- | --- |
| `pnpm dev` | Develop. `pnpm dev:pretty` prints readable logs |
| `just check` | Before every commit. The agent's Stop hook and CI run exactly this |
| `just ci` | Before a release: `check` plus mutation testing, Semgrep, secret scanning, licences, bundle size, Lighthouse |
| `just e2e` | Builds the app and runs the Playwright browser tests |
| `pnpm exec vitest run path/to/file.test.ts` | Run one test file (it starts its own Postgres) |
| `pnpm format` | Fix formatting (Biome) |
| `just db-up` / `just db-down` | Start / stop the local database |
| `just db-new add_widgets` | Create a new migration file |
| `just db-generate` | After editing a migration: rewrite `db/schema.sql` and the TypeScript database types |
| `just db-migrate` | Apply new migrations to your local database (and regenerate) |
| `pnpm openapi` | After changing a route: rewrite `openapi.json` |
| `pnpm env:example` | After adding a setting to `src/env.ts`: rewrite `.env.example` |
| `just mail` | Start Mailpit; then run `MAILPIT_URL=http://127.0.0.1:8025 pnpm dev` and open http://127.0.0.1:8025 to read every email the app sends |
| `just load` | A k6 load test against a local production build |
| `just doctor` | Something feels off with versions: checks pnpm, Node, Playwright, Postgres, Claude Code |

### Running only part of the gate

`just check` runs these steps in order; each is also its own command, which is faster while you fix one thing:

| Step | Command | What it checks |
| --- | --- | --- |
| Generated sources | `just gen` | Route tree, translations, blog content |
| Types | `just typecheck` | TypeScript, for the whole app and for the server build alone |
| Lint | `just lint` | Biome (format + lint), ESLint (typed rules, accessibility, React hooks), ast-grep rules, shellcheck, Squawk |
| Tests | `just test` | Vitest in Node and in a real browser, with coverage, against a real Postgres |
| Dead code | `just deadcode` | knip: unused files, exports and dependencies |
| Architecture | `just arch` | dependency-cruiser: the layer and module rules |
| Duplicates | `just dup` | jscpd: copy-pasted blocks (new ones fail) |
| Docs | `just docs` | TypeDoc, `openapi.json` and `.env.example` up to date, no breaking API change, docs updated with code |
| Database | `just db-check` | `db/schema.sql` and the database types match the migrations |

---

## 8. Working with your AI agent

### Start it the right way

The template renders an adapter for the AI coding agent you chose at creation time (the `harness` answer:
`claude`, `opencode`, or `both`). Every project also has `AGENTS.md` — the short, harness-neutral brief every
agent reads first. Start the agent **from inside the project folder**, in two commands:

```console
$ cd ~/dev/my-app
$ claude            # Claude Code — or: opencode
```

Type them as two commands: bash's direnv hook loads the project's shell when the next prompt appears, so in one
line (`cd ~/dev/my-app && claude`) the agent would start outside the project's Nix shell.

Always start it **inside the project's shell** (direnv does this for you; without direnv use
`nix develop -c claude` or `nix develop -c opencode`).

- **Claude Code** runs the project's hooks: the guard (blocks dangerous commands), the install checker (blocks
  hallucinated packages) and the **Stop hook**, which runs `just check` when the agent wants to finish and holds
  its turn open until the gate is green (at most four tries, then it stops and says `UNVERIFIED`).
- **OpenCode** reads `AGENTS.md` natively and enforces the same permission posture through `opencode.jsonc`. It
  has no Stop hook, so nothing forces the gate for you: end every task by running `just check` yourself (the
  `/check` command shipped in `.opencode/command/` does exactly that).

### What the agent may and may not do

The same posture in both adapters:

| The agent… | Examples |
| --- | --- |
| **can do without asking** | Edit source files, run `just check`/`just test`/`just lint`, `pnpm exec vitest …`, `git add`, `git commit`, `git diff` |
| **must ask you first** | Add or update packages (`pnpm add`), edit `package.json`, `migrations/`, `flags/`, `scripts/`, lint and build configs, `.dependency-cruiser.cjs`, run `dbmate`/`psql`, `git push`, create or merge pull requests |
| **is never allowed** | Read `.env` files or `secrets/`, read your `~/.ssh`, edit `.github/workflows/`, lock files, `lefthook.yml` or its own adapter settings and hooks (`.claude/`, `opencode.jsonc`), `curl`/`wget` |

For Claude Code this lives in `.claude/settings.json` (plus the sandbox); for OpenCode in `opencode.jsonc`. The
`verify-install` hook (Claude) and the deny list (both) also refuse packages the project does not use on purpose
(Next.js, Prisma, Drizzle, Redis, Clerk, …) and say what to use instead (ADR 0002).

If you really want the agent to change its own settings or hooks, start Claude with
`ALLOW_CLAUDE_CONFIG_CHANGES=1 claude`, make the change, then restart normally.

### Pick the process by the size of the task

Not every change deserves a spec. The template's rule: **match the ceremony to the cost of being wrong.**

**Tier A: small (a typo, one function, under ~50 lines).** One precise prompt that names the file and the symptom.
No spec. The gate and a review still run.

```text
In src/modules/notes/domain.ts, cleanTitle accepts a title made only of emoji
variation selectors. Write a failing test in domain.test.ts that shows it, then fix it.
```

**Tier B: a feature (one session, under ~400 lines).** Let the agent interview you, write a plan, and implement
the plan in a **fresh** session:

```text
I want users to be able to pin a note so it stays at the top of the list, but I
haven't thought it through. Interview me (at most 5 questions) until you could
write the spec, then write it to plans/pin-notes.md with the acceptance tests and
the files you expect to touch. Don't write code yet.
```

Read and fix the plan. Then start a **fresh** session (`/clear` in Claude Code; a new session in OpenCode) and:

```text
Implement plans/pin-notes.md. Follow it exactly; if something in it is wrong,
stop and tell me instead of improvising.
```

**Tier C: risky or multi-session (database, auth, payments, public API).** Same as Tier B, plus: work in a
separate worktree or branch (`claude --worktree pin-notes`), use plan mode, and write an ADR before changing a
boundary. For the full pipeline view of Tier B and C, see chapter 10.

### The loop for every task

1. **Brief:** one complete message: what, which files, inputs and outputs, acceptance tests, and "ask at most 3
   questions if something is missing". Drip-feeding requirements over many messages costs much more.
2. **Implement:** watch the first minute. Press Esc as soon as it goes the wrong way. After two failed corrections,
   start a fresh session and rewrite the brief.
3. **Verify:** Claude Code's Stop hook runs `just check` for you; in OpenCode, run it yourself. Ask for evidence:
   "paste the last lines of `just check`".
4. **Review:** `/code-review low` (Claude Code), then the reviewer subagent:

   ```text
   Use the reviewer subagent to compare this diff with plans/pin-notes.md:
   <paste the output of git diff main>
   ```

   (OpenCode: start a fresh session and ask the agent to review the diff against the plan.) Fix only findings
   that affect correctness.
5. **Ship:** small conventional commits (`feat: pin notes`), a pull request whose body links the plan and shows the
   commands you ran.
6. **Record:** if you corrected the agent twice for the same thing, add one line to `AGENTS.md` or — better — a
   lint rule or a test (chapter 9.4 writes the learning down either way).

### Good and bad prompts

| Bad | Better |
| --- | --- |
| "Add notes" | "Add private notes per user: a `notes` table, `GET/POST /api/v1/notes`, `DELETE /api/v1/notes/{id}`, a `/notes` page. Follow `.claude/rules/modules.md` (a module in `src/modules/notes`). Acceptance: an e2e test signs up, adds and deletes a note." |
| "Fix the tests" | "`just test` fails in src/modules/notes/routes.test.ts with 'expected 404, got 500'. Find out why; don't change the test unless the test is wrong, and tell me which." |
| "Make it faster" | "`GET /api/v1/notes` takes 400 ms with 10 000 notes (see the k6 run below). Find the cause with EXPLAIN and fix it with a migration if an index is missing." |
| "Use Redux and Prisma" | (Don't. Prisma is refused by the install hook; TanStack Query already manages server state. Read ADR 0002 first.) |
| A long generic "architecture prompt" (a `/config` folder, an event bus, fallback defaults) | Nothing: the structure is already enforced. ADR 0002 "Patterns not used, on purpose" explains why those three would make things worse |

### The tools that ship with every project

| Tool | How to use it |
| --- | --- |
| pipelines (`pipelines/*.md`) | Brief a feature: intent-driven, reference-study, telemetry-driven (chapter 10) |
| `just sync-tasks` | Print the dependency-ordered task queue from `plans/**/*.md` (chapter 11) |
| `just distill` / `just prune-scratch` | End-of-feature ritual: update the registry, delete the scratchpad (chapter 9.5) |
| `just metrics` | Print commit counts for the monthly metrics row (chapter 9.6) |
| `/release` | Cuts a release on a clean, green `main` (chapter 16) |
| `/study-reference <dir> [feature]` | Studies another repository read-only and writes a spec (chapter 13.11) |
| reviewer subagent | "Use the reviewer subagent to compare the diff with plans/x.md" (read-only: give it the diff or the plan path) |
| `/code-review low` | A quick correctness review of the current diff |
| `scripts/agent-run.sh` | One unattended, budget-capped agent run with JSON validation (chapter 21) |
| `.claude/rules/*.md` | Loaded automatically when the agent touches matching files (API, migrations, tests, modules, UI) |

### When the agent fights a gate

- **It edits a test to make it pass:** reject. The test is the spec; ask why the behaviour changed.
- **It wants a new package:** ask why the existing ones are not enough; check `pnpm view <name> time.created`.
- **It wants `--no-frozen-lockfile`, `rm -rf`, `git push --force` or to edit its own adapter config:** the hooks
  refuse. If it is really needed, you do it by hand.
- **It says "all tests pass" without output:** run `just check` yourself.
- **It ends with "UNVERIFIED":** the gate was still red after four tries. Read the last failure yourself
  (chapter 20), then give it a precise brief.

### Keep sessions cheap

- One task per session; a fresh session between tasks is free.
- Keep MCP servers off unless the task needs one.
- Prefer path-scoped rules (`.claude/rules/`) and skills over adding lines to `AGENTS.md`.
- Pipe long command output through `scripts/offload-context.mjs` (`<command> 2>&1 | node scripts/offload-context.mjs build`):
  over 100 lines or 5 KiB it saves the full output to `.scratch/context-dumps/` and hands the agent a short summary
  plus the file path instead.

---

## 9. The knowledge layer: what the project remembers

An AI agent forgets everything between sessions. Close the window, and the next session starts from zero: it
re-reads `AGENTS.md`, greps around, and re-derives what you already told it last week. The knowledge layer is
four small files that carry what should survive, plus one ritual that keeps them clean. Think of them as the
project's notebook: short, dated, and read by both you and the agent.

### 9.1 The four files

| File | What it holds | When you write in it |
| --- | --- | --- |
| `docs/glossary.md` | The words that mean specific things here | When you invent or rename a term |
| `docs/registry.md` (web projects) | Reusable pieces you built, with an ID and a scope | At the end of a feature (the distill ritual, 9.5) |
| `docs/learnings.md` | What went wrong and what you learned | When something costs you more than a few minutes |
| `docs/metrics.md` | One row per month: commits, first-pass CI rate, review rework, cost | Monthly, with `just metrics` |

Everything in them is **data for the next session**. The agent greps them before inventing a new term or a new
component; you read them before planning the next feature.

### 9.2 `docs/glossary.md` — the project's dictionary

When your project calls a group of students a "Cohort" and a set of lessons a "Track", the agent must use those
words, not "UserGroup" or "LessonBundle". The glossary is the one place where those words are defined.

```markdown
| Term | Meaning |
|---|---|
| Cohort | A group of students that starts and finishes a Program together |
| Track | An ordered set of Modules inside a Program |
```

**When to add a word:** the moment a term appears in a spec, a migration, or a route name. **How:** one row, one
sentence, no implementation details. The agent is told (in `AGENTS.md`) to check the glossary before inventing a
term — but it only helps if the words are actually there.

### 9.3 `docs/registry.md` — the shelf of reusable pieces (web projects)

Every web project grows reusable pieces: a colour palette, a named animation, a standard page layout, a card
component. The registry gives each one an ID, a scope, and the file it lives in — so the next feature says "use
`PAL-01` and `LAYOUT-02`" instead of re-describing them, and the agent finds them in one grep.

Every entry gets one of four **scopes**, which answer "who is allowed to use this?":

| Scope | Meaning | Lives in |
| --- | --- | --- |
| `GLOBAL` | Every page may use it | `src/styles/`, `src/components/ui/`, `src/lib/` |
| `ARCHETYPE:<name>` | One *family* of pages (e.g. all marketing pages) | `src/components/archetypes/<name>/` |
| `FEATURE:<name>` | One feature only | `src/features/<name>/` or `src/modules/<name>/` |
| `ATOM` | A one-off inside a single file | next to the code that uses it |

```markdown
| ID | Name | Scope tier | Code seam | Notes |
|---|---|---|---|---|
| PAL-01 | Editorial Ink & Warm Paper | GLOBAL | src/styles/tokens.css | Accent emerald #0F766E |
| LAYOUT-02 | Sticky hero + proof grid | ARCHETYPE:marketing | src/components/archetypes/marketing/Hero.tsx | Scroll-scrubbed |
```

**The rule that keeps it honest:** when a piece is used by a second, unrelated feature, it moves up one scope and
the registry row changes. Nothing jumps straight to `GLOBAL` "just in case".

### 9.4 `docs/learnings.md` — the scar tissue file

When something costs you real time — a flaky test, a misleading error, a dependency that breaks the build — write
one dated line. If you caught yourself correcting the **agent twice for the same thing**, that is the signal to
write it here *and* consider promoting it into `AGENTS.md` (if every future session must know it) or into a lint
rule (if it can be checked mechanically — chapter 8.7).

```markdown
- 2026-11-12: the sandbox hides .env* from shell commands, so `cat .env` fails by design; read .env.example instead.
- 2026-11-19: Vitest browser tests need the Nix Chromium; a plain `npx playwright install` download is ignored.
```

Keep it short. A learning that applies to every future change does not belong here — it belongs in `AGENTS.md`
or in a rule that `just check` enforces.

### 9.5 The distill ritual (end of every feature)

When a feature is done and merged, its raw material should not linger. The ritual has three commands:

```console
$ just distill                 # shows the diff of docs/registry.md and docs/glossary.md — you review and approve
$ git add docs/ && git commit -m "docs: distill notes feature into the registry"
$ just prune-scratch notes     # deletes .scratch/pipelines/notes/ — the raw harvest is gone
```

`just distill` prints the diff and stops. **You** decide whether the new registry rows are right; the agent never
commits a distill on its own. After you approve, `just prune-scratch <slug>` garbage-collects the feature's
ephemeral workspace (chapter 10 explains what lives there). The result: the registry holds what you actually
built; the scratchpad holds nothing; nothing rotting, nothing bloating the next session's context.

### 9.6 `just metrics` — the monthly ritual

Once a month, run `just metrics` (it prints commits per month from git history) and fill one row of
`docs/metrics.md`: first-pass CI rate (how often a PR went green without fixes), review-rework ratio (how much of
a review was "change this back"), and cost per merged change (your harness shows the spend). Ten minutes a month.
The numbers tell you whether the process is getting cheaper or driftier — throughput alone hides a growing
review burden.

---

## 10. Pipelines: how to brief a feature

A **pipeline** is a recipe for turning one kind of input — an idea in your head, someone else's website, a
production error — into a **spec the agent can build from**. Three ship with every project, one file each in
`pipelines/`. You (or the agent, told to "follow `pipelines/<name>.md`") run the recipe.

### 10.1 The one rule: every pipeline ends in the same place

No matter which pipeline you use, it must end with the same three files for the feature:

```text
plans/<slug>/spec.md     what we are building and how we will know it works (acceptance tests)
plans/<slug>/plan.md     how it will be built: files, modules, seams
plans/<slug>/tasks.md    the ordered list of tasks ("- [ ] T001: …"), the smallest steps that can each be checked
```

That trio is the **mediator contract**. Pipelines differ only in how they *produce* it. This is what keeps ten
different ways of working from producing ten different kinds of mess: the repository only ever accepts work that
arrives as a spec, a plan, and a task list — then the normal loop of chapter 8.4 takes over.

**A note on spec tools.** The three files are plain markdown — you write them by hand, or ask the agent to. You
may also use a spec-driven CLI such as **GitHub Spec Kit** (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`,
…) or **OpenSpec** (`/opsx:propose`) if you have one installed: they are one *optional* way to produce the same
trio, and docs/PLAYBOOK.md mentions them for Tier C work. The template ships none of them and nothing here
requires them — no command in this guide assumes a spec CLI exists.

### 10.2 `intent-driven` — you know what you want

The default. You describe the feature; the agent interviews you, then writes the trio.

```text
I want users to pin a note so it stays at the top. Follow pipelines/intent-driven.md.
Interview me until you can write the spec, then write plans/pin-notes/spec.md with
acceptance tests, plan.md and tasks.md. Don't write code yet.
```

Use it for any feature you can describe in a paragraph. For a one-file fix, skip the pipeline entirely (Tier A,
chapter 8.3).

### 10.3 `reference-study` — borrow from somewhere else

Two very different inputs, one pipeline:

- **Borrowing a feature from another codebase** (an open-source app, your older project): the reference is
  studied **read-only**, its feature list and licence recorded, and the spec is written in *your* stack's terms.
  The reference is never installed, never merged, never copied wholesale.
- **Harvesting a look** (a website whose palette, typography, motion or 3D you admire): the raw material is
  collected into `.scratch/pipelines/<slug>/CATALOG.md` — a named menu of pieces (`PAL-*`, `FONT-*`, `LAYOUT-*`,
  `ANIM-*`, `3D-*`) — you pick which to use at which scope (chapter 9.3), and the spec records the *adaptation*,
  not a copy.

```console
$ git clone --depth 1 https://github.com/someone/inspiring-app ~/refs/inspiring
```

```text
Follow pipelines/reference-study.md. Study ~/refs/inspiring read-only and list its
features with licences. Then write plans/import-tags/spec.md for just the tag
editing feature, translated to our stack. Never install or run the reference.
```

The scratchpad (`.scratch/pipelines/<slug>/`) is git-ignored and temporary — after the feature's distill ritual,
`just prune-scratch <slug>` deletes it (chapter 9.5).

### 10.4 `telemetry-driven` — production tells you what to fix

A Sentry issue or a support ticket is a brief you didn't write. The pipeline turns it into the strictest possible
loop: reproduce it as a **failing test** at the module's seam, fix the root cause, then ask "can this *class* of
bug be made impossible?" — an ast-grep rule, a dependency-cruiser boundary, or a small ADR if the trade-off is
hard to reverse.

```text
Follow pipelines/telemetry-driven.md. Sentry issue #4821: TypeError in
src/modules/notes/store.ts when body is empty. Write the failing test first,
then the fix, then tell me what rule would have prevented this class of bug.
```

### 10.5 Writing your own pipeline

Copy `pipelines/_TEMPLATE.md` when you notice a repeated way of working (chapter 8.6: the third time you do
something by hand, make it a recipe). A pipeline is one markdown file: when to use it, the steps, the prompts,
and the note that it must end in `plans/<slug>/{spec,plan,tasks}.md`. Nothing in the template hard-codes the
three shipped pipelines — they are conventions, not code.

---

## 11. The task graph: plans and their order

A feature's `tasks.md` is more than a checklist — it is a small **dependency graph** that tells you (and the
agent, and a second agent working in parallel) what can start now and what must wait.

### 11.1 Writing tasks

One checkbox per task, an ID, and — when it depends on another task — a `dep:` note:

```markdown
## Tasks
- [ ] T001: migration for the notes table
- [ ] T002: domain module (pure rule: cleanTitle) — dep: T001
- [ ] T003: routes GET/POST/DELETE /api/v1/notes — dep: T002
- [ ] T004: /notes page — dep: T003
- [ ] T005: e2e: sign up, add, delete a note — dep: T004
```

Rules of thumb: every task is small enough to finish and verify in one session; every task names the files it
touches; the acceptance tests from the spec are attached to the task that proves them (here, T005).

### 11.2 `just sync-tasks` — see the queue

```console
$ just sync-tasks
sync-tasks: 5 open of 5 tasks (dependency order; the first with no open deps is ready)
  1. T001 (plans/pin-notes/tasks.md)
  2. T002, dep: T001 (plans/pin-notes/tasks.md)
  ...
```

The script reads every `plans/**/*.md`, orders the open tasks by their dependencies (a cycle is an error, not a
hang), and prints the queue. Work the tasks top to bottom: one task, one fresh agent session (chapter 8.5),
`just check` green, tick the box, next.

### 11.3 Optional: mirroring to Beads

If you install the Beads CLI (`pnpm add -g @beads/bd` — it will ask), `just sync-tasks --bd` also creates the
tasks and their dependencies in Beads' local task graph, which gives you `bd ready` (what is unblocked) and
easier book-keeping across many features. **Without Beads nothing changes**: markdown stays the source of truth,
and the script says so and exits cleanly. The template never requires Beads.

### 11.4 Working in parallel

When two open tasks touch **disjoint files** (say T001 the migration and, in another feature, a docs task), you
can run them in parallel lanes: one agent session per worktree (`claude --worktree <slug>`), each implementing
its own task, both ending in their own pull request. Keep it to two lanes until the merge pain teaches you
otherwise; the gate, not hope, resolves the race.

---

## 12. Worked example: build a "notes" feature from start to finish

This chapter builds a real feature, **private notes**: a signed-in user can add a note, see their notes, and delete
them, and nobody else can see them. It touches every layer: a database table, a module with domain logic, three API
routes, tests, the security matrix, a web page, translations and an end-to-end test.

Everything below was built in a freshly generated `web` project and passed `just check` (118 tests) and `just e2e`
(42 browser tests, including the new ones). You can type it yourself, or give the brief in 9.1 to Claude and use this
chapter to check its work.

### 9.1 The brief (if Claude builds it)

Start with Tier B (chapter 8): an interview, then a plan. A complete brief looks like this:

```text
Feature: private notes for signed-in users.
- Table `notes` (id uuid, user_id -> users, title, body, created_at), expand-only migration.
- A feature module in src/modules/notes (follow .claude/rules/modules.md): domain.ts
  (cleanTitle: trim, collapse whitespace, max 120 chars), schemas.ts, store.ts
  (every query scoped by user id), routes.ts, index.ts.
- Routes: GET /api/v1/notes, POST /api/v1/notes, DELETE /api/v1/notes/{id}; all use
  requireSession, so anonymous callers get 401. Rows in tests/security/access-matrix.ts.
- Page /notes (TanStack Start): list, add, delete; strings in messages/en.json and de.json;
  nav link; axe page check; an e2e test that signs up, adds and deletes a note.
- Tests: domain (incl. a fast-check property), routes against the real Postgres (incl.
  "Bob cannot delete Ada's note"), browser tests for new src/ui/lib and component code.
Write the plan to plans/notes.md first. Ask at most 3 questions.
```

### 9.2 The database table

Create the migration file (the agent will ask before running `dbmate`-based commands):

```console
$ just db-new notes
Creating migration: migrations/20261104041546_notes.sql
```

Your timestamp will be different. Fill the file in:

```sql
-- migrate:up
-- Private notes, one owner each (src/modules/notes). Expand-only: a new table, nothing existing changes.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_user_id_created_at_idx ON notes (user_id, created_at DESC);

-- migrate:down
-- Intentionally empty: rollbacks are forward fixes (docs/runbooks/rollback.md).
```

Why it looks like this:

- `-- migrate:up` / `-- migrate:down` is dbmate's format. The down part stays empty on purpose: in production you
  never roll a schema back; you fix forward (chapter 17).
- `lock_timeout` and `statement_timeout` stop a migration from blocking the live database for long.
- **Expand-only:** it only adds a table. Squawk (`just squawk`, part of `just lint`) checks every changed migration
  for unsafe operations.
- `ON DELETE CASCADE`: deleting a user deletes their notes.
- The index matches the query the app runs most (one user's notes, newest first).

Now regenerate the committed schema and the TypeScript types:

```console
$ just db-generate
wrote …/db/schema.sql
```

`src/infra/db/schema.gen.ts` now contains the new table, generated from the real database:

```ts
export interface Notes {
  body: Generated<string>;
  created_at: Generated<Timestamp>;
  id: Generated<string>;
  title: string;
  user_id: string;
}
```

`Generated<…>` means "the database fills it in if you leave it out", which is why the insert below can skip `id`,
`body` and `created_at`.

### 9.3 The module folder

A **module** is one product area in `src/modules/<name>/`. Everything the server needs for notes lives here:

```text
src/modules/notes/
├── domain.ts         pure rules (no database, no HTTP)
├── domain.test.ts
├── schemas.ts        the API's data shapes (Zod + OpenAPI)
├── store.ts          the Postgres queries
├── routes.ts         the three Hono routes
├── routes.test.ts
└── index.ts          the module's public face: the only file others may import
```

dependency-cruiser enforces four rules here (`just arch`):

- `modules-via-index-from-outside`: the rest of the app imports `index.ts` only.
- `no-cross-module-internals`: another module also imports `index.ts` only.
- `module-domain-pure`: `domain.ts` imports nothing that does IO.
- `module-not-infra`: the module imports `src/infra` only for types; the database is passed in.

### 9.4 The domain rule: `domain.ts`

A pure function with a `Result` instead of exceptions for expected failures:

```ts
import { err, ok, type Result } from "neverthrow";

/** Longest note title, in characters. */
export const TITLE_MAX = 120;

/** Why a title was rejected. */
export interface TitleError {
	/** `empty`: only whitespace; `too_long`: over {@link TITLE_MAX}. */
	readonly kind: "empty" | "too_long";
	/** Human-readable explanation, safe to return to clients. */
	readonly message: string;
}

const WHITESPACE_RUNS = /\s+/g;

/**
 * Cleans a note title: trims it and turns every run of whitespace into one
 * space. Idempotent: cleaning a clean title returns it unchanged.
 * @param raw - The title as the user typed it.
 * @returns `ok(title)`, or `err` when nothing is left or it is too long.
 */
export function cleanTitle(raw: string): Result<string, TitleError> {
	const title = raw.trim().replaceAll(WHITESPACE_RUNS, " ");
	if (title === "") {
		return err({ kind: "empty", message: "title is empty" });
	}
	if (title.length > TITLE_MAX) {
		return err({
			kind: "too_long",
			message: `title is longer than ${String(TITLE_MAX)} characters`,
		});
	}
	return ok(title);
}
```

And its tests. The last one is a **property test**: fast-check tries hundreds of random strings and, if one fails,
shrinks it to the smallest example.

```ts
import { test } from "@fast-check/vitest";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cleanTitle, TITLE_MAX } from "./domain.js";

describe("cleanTitle", () => {
	it("trims the title and collapses inner whitespace", () => {
		expect(cleanTitle("  Buy \t milk\n today ")._unsafeUnwrap()).toBe(
			"Buy milk today",
		);
	});

	it("rejects a title that is only whitespace", () => {
		expect(cleanTitle(" \n\t ")._unsafeUnwrapErr().kind).toBe("empty");
	});

	it("accepts exactly TITLE_MAX characters and rejects one more", () => {
		expect(cleanTitle("a".repeat(TITLE_MAX)).isOk()).toBe(true);
		expect(cleanTitle("a".repeat(TITLE_MAX + 1))._unsafeUnwrapErr()).toEqual({
			kind: "too_long",
			message: `title is longer than ${String(TITLE_MAX)} characters`,
		});
	});

	// A property returns a boolean; fast-check tries many strings and reports the smallest one that fails.
	test.prop([fc.string()])(
		"is idempotent: a clean title stays the same",
		(raw) => {
			const once = cleanTitle(raw);
			return (
				once.isErr() || cleanTitle(once.value)._unsafeUnwrap() === once.value
			);
		},
	);
});
```

### 9.5 The API shapes: `schemas.ts`

Zod schemas validate input and describe output; the `.openapi(...)` parts become `openapi.json`. The examples matter:
the telemetry test and the security specs call every route with them.

```ts
import { z } from "@hono/zod-openapi";
import { TITLE_MAX } from "./domain.js";

const EXAMPLE_ID = "3f0f8c2e-6c1a-4c7e-9a43-0d9a6f1b2c3d";

/** One note as the API returns it. */
export const NoteSchema = z
	.object({
		id: z.uuid().openapi({ example: EXAMPLE_ID }),
		title: z.string().openapi({ example: "Groceries" }),
		body: z.string().openapi({ example: "Milk, eggs, bread" }),
		createdAt: z.iso
			.datetime()
			.openapi({ example: "2026-11-04T09:00:00.000Z" }),
	})
	.openapi("Note");

/** Body of `GET /api/v1/notes`. */
export const NoteListSchema = z
	.object({ notes: z.array(NoteSchema) })
	.openapi("NoteList");

/** Body of `POST /api/v1/notes`. */
export const NewNoteSchema = z
	.object({
		title: z.string().min(1).max(TITLE_MAX).openapi({ example: "Groceries" }),
		body: z.string().max(10_000).default("").openapi({ example: "Milk" }),
	})
	.openapi("NewNote");

/** Path parameters of `DELETE /api/v1/notes/{id}`. */
export const NoteParamsSchema = z.object({
	id: z
		.uuid()
		.openapi({ param: { name: "id", in: "path" }, example: EXAMPLE_ID }),
});
```

### 9.6 The queries: `store.ts`

Every method takes the owner's `userId`, so no query can forget to filter by it. The store receives the database
as a parameter (`module-not-infra` allows the `import type`).

```ts
import type { Database } from "../../infra/db.js";

/** A note as the API returns it. */
export interface Note {
	/** UUID, generated by Postgres. */
	readonly id: string;
	/** Cleaned title (see `cleanTitle`). */
	readonly title: string;
	/** Free text; may be empty. */
	readonly body: string;
	/** ISO 8601 timestamp. */
	readonly createdAt: string;
}

/** What a new note needs. */
export interface NewNote {
	/** Already cleaned. */
	readonly title: string;
	/** Free text. */
	readonly body: string;
}

/** Where notes live. Every method takes the owner, so no query can forget it. */
export interface NotesStore {
	/**
	 * The owner's newest notes.
	 * @param userId - The owner.
	 */
	readonly list: (userId: string) => Promise<Note[]>;
	/**
	 * Saves a note for its owner.
	 * @param userId - The owner.
	 * @param note - Title and body.
	 */
	readonly create: (userId: string, note: NewNote) => Promise<Note>;
	/**
	 * Deletes one of the owner's notes.
	 * @param userId - The owner.
	 * @param id - The note.
	 * @returns `false` when the owner has no such note.
	 */
	readonly remove: (userId: string, id: string) => Promise<boolean>;
}

/** How many notes `list` returns at most. */
const LIST_LIMIT = 100;

function toNote(row: {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	readonly created_at: Date;
}): Note {
	return {
		id: row.id,
		title: row.title,
		body: row.body,
		createdAt: row.created_at.toISOString(),
	};
}

/**
 * Notes in Postgres (the `notes` table, `migrations/*_notes.sql`).
 * @param db - The shared query builder; `src/infra/server.ts` passes it in.
 * @returns The store.
 */
export function postgresNotesStore(db: Database): NotesStore {
	return {
		list: async (userId) => {
			const rows = await db
				.selectFrom("notes")
				.select(["id", "title", "body", "created_at"])
				.where("user_id", "=", userId)
				.orderBy("created_at", "desc")
				.limit(LIST_LIMIT)
				.execute();
			return rows.map(toNote);
		},
		create: async (userId, note) => {
			const row = await db
				.insertInto("notes")
				.values({ user_id: userId, title: note.title, body: note.body })
				.returning(["id", "title", "body", "created_at"])
				.executeTakeFirstOrThrow();
			return toNote(row);
		},
		remove: async (userId, id) => {
			const result = await db
				.deleteFrom("notes")
				.where("id", "=", id)
				.where("user_id", "=", userId)
				.executeTakeFirst();
			return result.numDeletedRows > 0n;
		},
	};
}

/** Used when no store is wired (the OpenAPI emitter, tests of other routes): every call fails loudly. */
export const unavailableNotes: NotesStore = {
	list: () => Promise.reject(new Error("notes store is not configured")),
	create: () => Promise.reject(new Error("notes store is not configured")),
	remove: () => Promise.reject(new Error("notes store is not configured")),
};
```

`unavailableNotes` follows the template's pattern for optional collaborators (compare `unavailableAuth`): the
OpenAPI generator and tests of other routes build the app without a database, and if a route ever reached this store
by mistake, it fails loudly instead of losing data silently.

### 9.7 The routes: `routes.ts`

Three things to notice:

1. `middleware: [requireSession(auth)] as const` runs **before** validation, so an anonymous caller always gets 401
   (never a 400 that hints at the body shape), and the handler gets the user as `c.var.session`, typed.
2. Path parameters are written `{id}`, as in OpenAPI.
3. Every response the route can give is documented, including errors.

```ts
import { createRoute } from "@hono/zod-openapi";
import type { App, AuthPort } from "../../app/ports.js";
import { requireSession } from "../../app/session.js";
import { ErrorResponseSchema } from "../../schemas/error.js";
import { cleanTitle } from "./domain.js";
import {
	NewNoteSchema,
	NoteListSchema,
	NoteParamsSchema,
	NoteSchema,
} from "./schemas.js";
import type { NotesStore } from "./store.js";

/** What the notes routes need. */
export interface NotesDeps {
	/** Session lookup: every notes route is for signed-in users only. */
	readonly auth: AuthPort;
	/** Where the notes live. */
	readonly store: NotesStore;
}

const error = (description: string) => ({
	description,
	content: { "application/json": { schema: ErrorResponseSchema } },
});

function notesRoutes(auth: AuthPort) {
	return {
		list: createRoute({
			method: "get",
			path: "/api/v1/notes",
			tags: ["notes"],
			summary: "Your notes, newest first",
			middleware: [requireSession(auth)] as const,
			responses: {
				200: {
					description: "Your notes",
					content: { "application/json": { schema: NoteListSchema } },
				},
				401: error("Not signed in"),
			},
		}),
		create: createRoute({
			method: "post",
			path: "/api/v1/notes",
			tags: ["notes"],
			summary: "Create a note",
			middleware: [requireSession(auth)] as const,
			request: {
				body: {
					content: { "application/json": { schema: NewNoteSchema } },
					required: true,
				},
			},
			responses: {
				201: {
					description: "The new note",
					content: { "application/json": { schema: NoteSchema } },
				},
				400: error("The title is missing, blank or too long"),
				401: error("Not signed in"),
			},
		}),
		remove: createRoute({
			method: "delete",
			path: "/api/v1/notes/{id}",
			tags: ["notes"],
			summary: "Delete one of your notes",
			middleware: [requireSession(auth)] as const,
			request: { params: NoteParamsSchema },
			responses: {
				204: { description: "Deleted" },
				400: error("`id` is not a UUID"),
				401: error("Not signed in"),
				404: error("You have no note with this id"),
			},
		}),
	};
}

/**
 * Registers `GET /api/v1/notes`, `POST /api/v1/notes` and
 * `DELETE /api/v1/notes/{id}`. Every query is scoped to the signed-in user.
 * @param app - The application.
 * @param deps - Session lookup and store.
 */
export function registerNotesRoutes(app: App, deps: NotesDeps): void {
	const route = notesRoutes(deps.auth);
	app.openapi(route.list, async (c) => {
		const notes = await deps.store.list(c.var.session.userId);
		return c.json({ notes }, 200);
	});
	app.openapi(route.create, async (c) => {
		const input = c.req.valid("json");
		const title = cleanTitle(input.title);
		if (title.isErr()) {
			return c.json(
				{ error: { code: title.error.kind, message: title.error.message } },
				400,
			);
		}
		const note = await deps.store.create(c.var.session.userId, {
			title: title.value,
			body: input.body,
		});
		return c.json(note, 201);
	});
	app.openapi(route.remove, async (c) => {
		const { id } = c.req.valid("param");
		if (await deps.store.remove(c.var.session.userId, id)) {
			return c.body(null, 204);
		}
		return c.json(
			{ error: { code: "not_found", message: "No such note" } },
			404,
		);
	});
}
```

### 9.8 The public face: `index.ts`

Export only what other files use. knip fails the gate on an unused export (this example first exported the
`NotesDeps` type too; knip reported `Unused exported types: NotesDeps`, so it was removed).

```ts
// src/modules/notes — private notes for signed-in users. The rest of the app imports this file only
// (dependency-cruiser: modules-via-index-from-outside), so export just what callers use (knip checks).
export { registerNotesRoutes } from "./routes.js";
export {
	type NotesStore,
	postgresNotesStore,
	unavailableNotes,
} from "./store.js";
```

### 9.9 Wire the module in

Two small edits outside the module.

**`src/app/app.ts`** builds the HTTP app. Import the module, add an option, register the routes:

```ts
import {
	type NotesStore,
	registerNotesRoutes,
	unavailableNotes,
} from "../modules/notes/index.js";

export interface AppOptions {
	// … the existing options …
	/** Where notes live (src/modules/notes); without it the notes routes fail with 500. */
	readonly notes?: NotesStore;
}

// inside createApp(), next to the other register… calls:
	registerNotesRoutes(app, {
		auth: options.auth ?? unavailableAuth,
		store: options.notes ?? unavailableNotes,
	});
```

**`src/infra/server.ts`** is the *composition root*: the one place where real things are created and connected.
Pass the Postgres store in:

```ts
import { postgresNotesStore } from "../modules/notes/index.js";

	const app = createApp({
		// … the existing options …
		notes: postgresNotesStore(db),
	});
```

### 9.10 The route tests: `routes.test.ts`

The tests use the **real** Postgres (each test file gets its own fresh, migrated database) and a small, real
`AuthPort` whose signed-in user is named by a test header. Nothing in the repository is mocked.

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../../app/app.js";
import type { AuthPort } from "../../app/ports.js";
import { env } from "../../env.js";
import { createDatabase } from "../../infra/db.js";
import { postgresNotesStore, unavailableNotes } from "./index.js";

vi.hoisted(() => {
	vi.stubEnv("LOG_LEVEL", "silent");
});

// A real store on this test file's own Postgres database (tests/setup.db.ts) and a small real AuthPort: the
// signed-in user is whoever the `x-test-user` header names. Nothing in the repository is mocked.
const db = createDatabase({ url: env.DATABASE_URL, poolMax: 2 });
const auth: AuthPort = {
	handler: () => Promise.resolve(new Response(null, { status: 404 })),
	getSession: (headers) => {
		const userId = headers.get("x-test-user");
		return Promise.resolve(
			userId === null
				? null
				: { userId, email: `${userId}@example.com`, name: userId },
		);
	},
};
const app = createApp({ auth, notes: postgresNotesStore(db) });

const NoteSchema = z.object({ id: z.uuid(), title: z.string() });
const ListSchema = z.object({ notes: z.array(NoteSchema) });
const ErrorSchema = z.object({ error: z.object({ code: z.string() }) });

/** Writes come from the app's own origin (the CSRF guard), as a browser sends them. */
function send(method: string, path: string, user?: string, body?: unknown) {
	return app.request(path, {
		method,
		headers: {
			origin: "http://127.0.0.1:3000",
			"content-type": "application/json",
			...(user === undefined ? {} : { "x-test-user": user }),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

beforeAll(async () => {
	await db
		.insertInto("users")
		.values([
			{ id: "ada", name: "Ada", email: "ada@example.com" },
			{ id: "bob", name: "Bob", email: "bob@example.com" },
		])
		.execute();
});

afterAll(async () => {
	await db.destroy();
});

describe("notes routes", () => {
	it("creates a note with a cleaned title and lists it", async () => {
		const created = await send("POST", "/api/v1/notes", "ada", {
			title: "  Buy   milk ",
			body: "2 litres",
		});
		expect(created.status).toBe(201);
		const note = NoteSchema.parse(await created.json());
		expect(note.title).toBe("Buy milk");
		const listed = await send("GET", "/api/v1/notes", "ada");
		expect(ListSchema.parse(await listed.json()).notes).toContainEqual(
			expect.objectContaining({ id: note.id, title: "Buy milk" }),
		);
	});

	it("answers 401 to anonymous callers before looking at the body", async () => {
		expect((await send("GET", "/api/v1/notes")).status).toBe(401);
		expect((await send("POST", "/api/v1/notes", undefined, {})).status).toBe(
			401,
		);
	});

	it("rejects a blank title with the domain's error code", async () => {
		const response = await send("POST", "/api/v1/notes", "ada", {
			title: "   ",
		});
		expect(response.status).toBe(400);
		expect(ErrorSchema.parse(await response.json()).error.code).toBe("empty");
	});

	it("never shows or deletes another user's note", async () => {
		const created = await send("POST", "/api/v1/notes", "ada", {
			title: "Private",
		});
		const { id } = NoteSchema.parse(await created.json());
		const bobs = ListSchema.parse(
			await (await send("GET", "/api/v1/notes", "bob")).json(),
		);
		expect(bobs.notes.map((note) => note.id)).not.toContain(id);
		expect((await send("DELETE", `/api/v1/notes/${id}`, "bob")).status).toBe(
			404,
		);
		expect((await send("DELETE", `/api/v1/notes/${id}`, "ada")).status).toBe(
			204,
		);
		expect((await send("DELETE", `/api/v1/notes/${id}`, "ada")).status).toBe(
			404,
		);
	});

	it("rejects an id that is not a UUID", async () => {
		expect((await send("DELETE", "/api/v1/notes/42", "ada")).status).toBe(400);
	});

	it("fails loudly when no store is wired", async () => {
		const bare = createApp({ auth });
		const response = await bare.request("/api/v1/notes", {
			headers: { "x-test-user": "ada" },
		});
		expect(response.status).toBe(500);
		await expect(
			unavailableNotes.create("ada", { title: "x", body: "" }),
		).rejects.toThrow("notes store is not configured");
		await expect(unavailableNotes.remove("ada", "x")).rejects.toThrow(
			"notes store is not configured",
		);
	});
});
```

Note the test "never shows or deletes another user's note": it is the most important one. Authorization bugs are
the most common serious bug in web apps.

Run just these tests while you work:

```console
$ pnpm exec vitest run src/modules/notes
```

### 9.11 The security matrix

`tests/security/access-matrix.ts` declares who may call every route. A test fails when `openapi.json` contains a route
that is missing here, and the Playwright security spec checks that anonymous callers really get the status you
declare. Add one row per route:

```ts
	{
		path: "/api/v1/notes",
		method: "GET",
		auth: "authenticated",
		expectedAnonymousStatus: 401,
	},
	{
		path: "/api/v1/notes",
		method: "POST",
		auth: "authenticated",
		expectedAnonymousStatus: 401,
	},
	{
		path: "/api/v1/notes/{id}",
		method: "DELETE",
		auth: "authenticated",
		expectedAnonymousStatus: 401,
		request: "/api/v1/notes/3f0f8c2e-6c1a-4c7e-9a43-0d9a6f1b2c3d",
	},
```

`request` gives a concrete URL when the path has a parameter.

### 9.12 Update `openapi.json`

```console
$ pnpm openapi
wrote …/openapi.json
```

`just check` compares it with `origin/main` using oasdiff. Adding routes is fine ("No breaking changes to report, but
the specs are different"); removing or renaming one would fail (chapter 13.12).

### 9.13 The web page

**The API calls**, in `src/ui/lib/notes.ts`. The browser never imports server code (`ui-not-server` rule); it calls the
documented HTTP API and validates the answers with Zod:

```ts
// The notes API as the browser sees it (src/modules/notes on the server, documented in openapi.json).
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const NoteSchema = z.object({
	id: z.string(),
	title: z.string(),
	body: z.string(),
	createdAt: z.string(),
});
const NoteListSchema = z.object({ notes: z.array(NoteSchema) });

/** One note. */
export type Note = z.infer<typeof NoteSchema>;

async function call(path: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(path, { credentials: "same-origin", ...init });
	if (!response.ok) {
		throw new Error(
			`${init.method ?? "GET"} ${path} failed with HTTP ${String(response.status)}`,
		);
	}
	return response;
}

/** `GET /api/v1/notes`: the signed-in user's notes, newest first. */
export async function fetchNotes(): Promise<Note[]> {
	const response = await call("/api/v1/notes");
	return NoteListSchema.parse(await response.json()).notes;
}

/** React Query options for the note list; invalidate `["notes"]` after a change. */
export const notesQuery = queryOptions({
	queryKey: ["notes"],
	queryFn: fetchNotes,
});

/**
 * `POST /api/v1/notes`.
 * @param note - Title and body.
 * @returns The saved note.
 */
export async function createNote(note: {
	readonly title: string;
	readonly body: string;
}): Promise<Note> {
	const response = await call("/api/v1/notes", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(note),
	});
	return NoteSchema.parse(await response.json());
}

/**
 * `DELETE /api/v1/notes/{id}`.
 * @param id - The note to delete.
 */
export async function deleteNote(id: string): Promise<void> {
	await call(`/api/v1/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}
```

Files in `src/ui/lib` and `src/ui/components` need browser tests (coverage is measured per file). `fetch` is the
browser's boundary, so spying on it is allowed:

```tsx
import { afterEach, expect, test, vi } from "vitest";
import { createNote, deleteNote, fetchNotes } from "./notes";

// fetch is the browser's HTTP boundary: spying on it mocks the process boundary, not an in-repo module.
afterEach(() => {
	vi.restoreAllMocks();
});

const note = {
	id: "n1",
	title: "Milk",
	body: "",
	createdAt: "2026-11-04T09:00:00.000Z",
};

test("fetchNotes returns the list and throws on an HTTP error", async () => {
	const fetchSpy = vi.spyOn(globalThis, "fetch");
	fetchSpy.mockResolvedValueOnce(Response.json({ notes: [note] }));
	expect(await fetchNotes()).toEqual([note]);
	fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
	await expect(fetchNotes()).rejects.toThrow(
		"GET /api/v1/notes failed with HTTP 401",
	);
});

test("createNote posts JSON and deleteNote sends a DELETE", async () => {
	const fetchSpy = vi.spyOn(globalThis, "fetch");
	fetchSpy.mockResolvedValueOnce(Response.json(note, { status: 201 }));
	expect(await createNote({ title: "Milk", body: "" })).toEqual(note);
	expect(fetchSpy).toHaveBeenLastCalledWith(
		"/api/v1/notes",
		expect.objectContaining({
			method: "POST",
			body: JSON.stringify({ title: "Milk", body: "" }),
		}),
	);
	fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
	await deleteNote("n1");
	expect(fetchSpy).toHaveBeenLastCalledWith(
		"/api/v1/notes/n1",
		expect.objectContaining({ method: "DELETE" }),
	);
});
```

**A small shared component.** The first version of the page copied the "loading / not signed in" block from
`account.tsx`, and jscpd failed the gate because new copy-pasted blocks are not allowed. The fix is a component.
It takes the sign-in link as a prop, so it needs no router and is easy to test:

```tsx
import type { ReactElement, ReactNode } from "react";
import { m } from "../paraglide/messages.js";

/** Props of {@link SignInGate}. */
export interface SignInGateProps {
	/** The session lookup is still running. */
	readonly pending: boolean;
	/** The visitor is signed in. */
	readonly signedIn: boolean;
	/** The sign-in link for anonymous visitors; the page passes a router `Link`, so this component needs no router. */
	readonly signInLink: ReactNode;
	/** What signed-in visitors see. */
	readonly children: ReactNode;
}

/** Shows `children` to signed-in visitors, a loading line while unsure, and a sign-in prompt otherwise. */
export function SignInGate(props: SignInGateProps): ReactElement {
	if (props.pending) {
		return <p aria-live="polite">{m.loading()}</p>;
	}
	if (!props.signedIn) {
		return (
			<p>
				{m.not_signed_in()} {props.signInLink}
			</p>
		);
	}
	return <>{props.children}</>;
}
```

```tsx
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SignInGate } from "./sign-in-gate";

const link = <a href="/sign-in">Sign in</a>;

test("shows loading, then a sign-in prompt, and the content once signed in", async () => {
	const screen = await render(
		<SignInGate pending signedIn={false} signInLink={link}>
			Secret notes
		</SignInGate>,
	);
	await expect.element(page.getByText("Loading…")).toBeVisible();

	await screen.rerender(
		<SignInGate pending={false} signedIn={false} signInLink={link}>
			Secret notes
		</SignInGate>,
	);
	await expect
		.element(page.getByRole("paragraph"))
		.toHaveTextContent("You are not signed in. Sign in");
	await expect
		.element(page.getByRole("link", { name: "Sign in" }))
		.toBeVisible();

	await screen.rerender(
		<SignInGate pending={false} signedIn signInLink={link}>
			Secret notes
		</SignInGate>,
	);
	await expect.element(page.getByText("Secret notes")).toBeVisible();
});
```

**The page**, `src/ui/routes/notes.tsx`. TanStack Start turns the file name into the URL `/notes`. Pages are
excluded from unit-test coverage because the e2e tests cover them.

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";
import { SignInGate } from "../components/sign-in-gate";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { TextField } from "../components/ui/field";
import { meQuery } from "../lib/api";
import { createNote, deleteNote, notesQuery } from "../lib/notes";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/notes")({
	head: () => ({
		meta: [{ title: `${m.notes_title()} · ${m.site_name()}` }],
	}),
	component: Notes,
});

function Notes(): ReactElement {
	const me = useQuery(meQuery);
	return (
		<Card className="mx-auto max-w-md">
			<h1 className="mb-4 text-2xl font-semibold">{m.notes_title()}</h1>
			<SignInGate
				pending={me.isPending}
				signedIn={me.data !== undefined && me.data !== null}
				signInLink={
					<Link to="/sign-in" className="underline">
						{m.sign_in_title()}
					</Link>
				}
			>
				<NoteBoard />
			</SignInGate>
		</Card>
	);
}

function NoteBoard(): ReactElement {
	const queryClient = useQueryClient();
	const notes = useQuery(notesQuery);
	const [title, setTitle] = useState("");
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["notes"] });
	const add = useMutation({
		mutationFn: createNote,
		onSuccess: async () => {
			setTitle("");
			await refresh();
		},
	});
	const remove = useMutation({ mutationFn: deleteNote, onSuccess: refresh });
	return (
		<>
			<form
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					add.mutate({ title, body: "" });
				}}
			>
				<TextField
					label={m.notes_new_label()}
					name="title"
					value={title}
					onChange={setTitle}
				/>
				<Button type="submit" disabled={add.isPending}>
					{m.notes_add()}
				</Button>
			</form>
			{add.isError ? (
				<p role="alert" className="mt-2 text-sm text-destructive">
					{m.notes_error()}
				</p>
			) : null}
			{notes.data?.length === 0 ? (
				<p className="mt-4">{m.notes_empty()}</p>
			) : null}
			<ul className="mt-4 grid gap-2">
				{notes.data?.map((note) => (
					<li key={note.id} className="flex items-center justify-between">
						<span>{note.title}</span>
						<Button
							variant="ghost"
							aria-label={m.notes_delete({ title: note.title })}
							onClick={() => {
								remove.mutate(note.id);
							}}
						>
							{m.notes_delete_short()}
						</Button>
					</li>
				))}
			</ul>
		</>
	);
}
```

**The text.** Every visible string is a message. Add these keys to `messages/en.json`:

```json
	"nav_notes": "Notes",
	"notes_title": "Your notes",
	"notes_new_label": "New note",
	"notes_add": "Add note",
	"notes_empty": "No notes yet.",
	"notes_error": "The note could not be saved.",
	"notes_delete_short": "Delete",
	"notes_delete": "Delete “{title}”"
```

and the same keys to `messages/de.json`:

```json
	"nav_notes": "Notizen",
	"notes_title": "Deine Notizen",
	"notes_new_label": "Neue Notiz",
	"notes_add": "Notiz hinzufügen",
	"notes_empty": "Noch keine Notizen.",
	"notes_error": "Die Notiz konnte nicht gespeichert werden.",
	"notes_delete_short": "Löschen",
	"notes_delete": "„{title}“ löschen"
```

In code you call them as functions: `m.notes_title()`, `m.notes_delete({ title: note.title })`.

**The navigation link**, in `src/ui/routes/__root.tsx`, next to the others:

```tsx
<NavLink to="/blog">{m.nav_blog()}</NavLink>
<NavLink to="/notes">{m.nav_notes()}</NavLink>
<NavLink to="/account">{m.nav_account()}</NavLink>
```

### 9.14 The end-to-end test

Add the page to the accessibility check: in `tests/e2e/a11y.spec.ts`, add `"/notes",` to the `PAGES` list. axe then
checks it for WCAG 2.2 AA problems in every run.

Then a test of the whole flow, as a user sees it, `tests/e2e/notes.spec.ts`:

```ts
// tests/e2e/notes.spec.ts — the notes feature as a user sees it: sign up, add a note, delete it.
import { expect, test } from "@playwright/test";

test("a signed-in user adds a note and deletes it", async ({ page }) => {
	const email = `notes-${String(Date.now())}@example.com`;
	await page.goto("/sign-up", { waitUntil: "networkidle" });
	await page.getByLabel("Name").fill("Ada Lovelace");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill("correct-horse-battery");
	await page.getByRole("button", { name: "Create an account" }).click();
	await expect(page).toHaveURL(/\/account$/);

	await page.getByRole("link", { name: "Notes", exact: true }).click();
	await expect(page.getByText("No notes yet.")).toBeVisible();
	await page.getByLabel("New note").fill("  Buy   milk ");
	await page.getByRole("button", { name: "Add note" }).click();
	await expect(page.getByText("Buy milk", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Delete “Buy milk”" }).click();
	await expect(page.getByText("No notes yet.")).toBeVisible();
});
```

### 9.15 Say what changed

`just check` refuses changes under `src/` that come without a docs change (`docs-drift`). For a feature, the usual
docs change is a **changeset**, which becomes the release notes. Run `pnpm changeset` and answer its questions, or
create the file yourself, `.changeset/private-notes.md`:

```md
---
"gate-test-web": minor
---

Notes: signed-in users keep private notes on `/notes` (`GET` and `POST /api/v1/notes`, `DELETE /api/v1/notes/{id}`).
```

Use your own package name from `package.json` (the example project was called `gate-test-web`). `minor` means
"a new feature"; use `patch` for a fix and `major` for a breaking change.

### 9.16 Run the gates

```console
$ just check
…
 Test Files  28 passed (28)
      Tests  118 passed (118)
✔ no dependency violations found (164 modules, 363 dependencies cruised)
No breaking changes to report, but the specs are different.
$ just e2e
…
  ✓ axe: /notes has no WCAG 2.x A/AA violations
  ✓ a signed-in user adds a note and deletes it
  ✓ V8: anonymous POST /api/v1/notes answers 401
  42 passed
```

### 9.17 What went wrong while building this example (and how each was fixed)

This is normal. Each failure points at the exact fix:

| Gate | Message | Fix |
| --- | --- | --- |
| `just typecheck` | `Type 'readonly [MiddlewareHandler<SessionEnv>]' is not assignable to type 'H \| H[]'` | The middleware list was stored in a shared variable. Write `middleware: [requireSession(auth)] as const` inline in each `createRoute` |
| `just lint` (Biome) | `File content differs from formatting output` | `pnpm format` |
| `just lint` (ESLint) | `Test has no assertions  vitest/expect-expect` | A property written as `fc.assert(...)` inside `it`. Use `test.prop([...])("name", (x) => boolean)` from `@fast-check/vitest`, like `src/domain/slug.test.ts` |
| `just deadcode` (knip) | `Unused exported types (1)  NotesDeps` | Don't re-export it from `index.ts` |
| `just dup` (jscpd) | A clone between `account.tsx` and `notes.tsx` | Extract the shared block into `SignInGate` |
| `just test` (browser) | `Cannot find element with locator: getByText('You are not signed in.')` | The text and the link share one paragraph; assert with `toHaveTextContent` on the paragraph |

### 9.18 Commit and open a pull request

```console
$ git switch -c feat/notes
$ git add -A
$ git commit -m "feat: private notes"
$ git push -u origin feat/notes
$ gh pr create --fill
```

CI runs `just ci` and `just e2e`; when it is green and you approve, the merge queue merges it.

---

## 13. Recipes for common tasks

Each recipe lists the files to touch in order. When you ask Claude to do one, name the recipe's steps in your brief.

### 10.1 A small public endpoint (no module needed)

The template's own example is `GET /api/v1/slug?text=Hello%2C%20World!` → `{"slug":"hello-world"}`. Copy its shape.

1. **Domain** (`src/domain/slug.ts`): the pure function, returning `Result`. Test it in `src/domain/slug.test.ts`
   (90% line coverage and 85% branch coverage are required for `src/domain`, plus a mutation score of 80).
2. **Schemas** (`src/schemas/slug.ts`):

   ```ts
   import { z } from "@hono/zod-openapi";
   import { SLUG_PATTERN } from "../domain/slug.js";

   /** Query parameters of `GET /api/v1/slug`. */
   export const SlugQuerySchema = z.object({
   	/** Free text to slugify; 1 to 200 characters. */
   	text: z
   		.string()
   		.min(1)
   		.max(200)
   		.openapi({
   			param: { name: "text", in: "query" },
   			example: "Hello, World!",
   		}),
   });

   /** Successful body of `GET /api/v1/slug`. */
   export const SlugResponseSchema = z
   	.object({
   		/** The slug; lowercase ASCII letters, digits and single hyphens. */
   		slug: z.string().regex(SLUG_PATTERN).openapi({ example: "hello-world" }),
   	})
   	.openapi("SlugResponse");
   ```

3. **Route** (`src/app/routes/slug.ts`):

   ```ts
   import { createRoute } from "@hono/zod-openapi";
   import { slugify } from "../../domain/slug.js";
   import { ErrorResponseSchema } from "../../schemas/error.js";
   import { SlugQuerySchema, SlugResponseSchema } from "../../schemas/slug.js";
   import type { App } from "../ports.js";

   const slugRoute = createRoute({
   	method: "get",
   	path: "/api/v1/slug",
   	tags: ["slug"],
   	summary: "Turn free text into a URL slug",
   	request: { query: SlugQuerySchema },
   	responses: {
   		200: {
   			description: "The slug derived from `text`",
   			content: { "application/json": { schema: SlugResponseSchema } },
   		},
   		400: {
   			description: "`text` is missing, too long, or has no letters or digits",
   			content: { "application/json": { schema: ErrorResponseSchema } },
   		},
   	},
   });

   /**
    * Registers `GET /api/v1/slug?text=...`.
    * @param app - The application to register the route on.
    */
   export function registerSlugRoutes(app: App): void {
   	app.openapi(slugRoute, (c) => {
   		const { text } = c.req.valid("query");
   		return slugify(text).match(
   			(slug) => c.json({ slug }, 200),
   			(error) =>
   				c.json({ error: { code: error.kind, message: error.message } }, 400),
   		);
   	});
   }
   ```

4. **Register it** in `createApp` (`src/app/app.ts`): `registerSlugRoutes(app);`.
5. **Test it** with `app.request(...)` next to `src/app/app.test.ts`.
6. **Access matrix** (`tests/security/access-matrix.ts`): `publicRoute("GET", "/api/v1/slug", 200, "/api/v1/slug?text=hello")`.
7. `pnpm openapi`, then `just check`.

**Signed-in only?** Add `middleware: [requireSession(auth)] as const` to `createRoute`, document a `401`, read the
user from `c.var.session`, and declare the row as `auth: "authenticated", expectedAnonymousStatus: 401` (see 9.7).

### 10.2 Add a setting (configuration value)

All server settings live in `src/env.ts` and are validated when the app starts. The rest of the code imports `env`;
reading `process.env` anywhere else fails the gate (ast-grep rule `no-process-env-outside-env`).

1. Add the key with a schema, a default (if it has a safe one) and `.meta()`:

   ```ts
   	SUPPORT_EMAIL: z.email().default("support@example.com").meta({
   		description: "Where the contact page sends people",
   		example: "support@example.com",
   	}),
   ```

   A **secret** has no default in production. Copy the shape of `BETTER_AUTH_SECRET`:

   ```ts
   	BETTER_AUTH_SECRET: (production
   		? z.string().min(32)
   		: z.string().min(32).default(LOCAL_AUTH_SECRET)
   	).meta({
   		description:
   			"Session signing secret, 32+ random characters (openssl rand -base64 32); required in production",
   		example: "",
   	}),
   ```

2. Regenerate the documented list: `pnpm env:example` (commit `.env.example`).
3. Use it: `import { env } from "../env.js";` then `env.SUPPORT_EMAIL`.

**Never** add "fallback defaults" for required secrets or the database URL: a missing secret must stop the boot (ADR
0002, "Patterns not used, on purpose").

**Browser settings** (web only) go in `src/ui/env.schema.ts` with a `VITE_` prefix and are read through `clientEnv`
from `src/ui/public-env.ts`. They end up inside the JavaScript bundle, so they are **never** secret.

### 10.3 Put a feature behind a flag

Ship anything risky behind a flag, so that turning it off is a one-line change instead of a rollback.

1. Add the flag to `flags/flags.json` (the agent asks before editing this file):

   ```json
   		"notes-pinning": {
   			"state": "ENABLED",
   			"variants": { "on": true, "off": false },
   			"defaultVariant": "off"
   		}
   ```

2. Give the route the `FlagsPort` (as `registerEventRoutes(app, flags)` does) and check the flag:

   ```ts
   if (!(await flags.isEnabled("notes-pinning", false))) {
   	return c.json({ error: { code: "not_found", message: "Pinning is off" } }, 404);
   }
   ```

   The second argument is the value used if the flag is missing or the flag provider fails. Choose the safe one.
3. In tests, pass a real tiny implementation: `createApp({ flags: { isEnabled: () => Promise.resolve(true) } })`.
4. Turn it on by setting `"defaultVariant": "on"`. If the flag file is mounted into the running container (at
   `FLAGS_FILE`), the change is live within seconds, with no restart.

There is also a built-in **kill switch**: setting `kill-switch-writes` to `"on"` makes every state-changing
`/api/v1/*` request answer 503, while reading and signing in keep working.

### 10.4 Send an email

Emails are sent by a background job, so a slow mail provider never slows a request and failures are retried.

1. Add a template function in `src/infra/email/templates.tsx`, next to `verifyEmailMessage` (React Email components:
   `Html`, `Heading`, `Text`, `Button`).
2. Add its name to `EmailJobSchema.template` in `src/infra/jobs.ts` and handle it in `sendEmailJob`.
3. Enqueue it where the event happens: `jobs.enqueueEmail({ template: "welcome", to, url })`.
4. Locally, run `just mail` and start the app with `MAILPIT_URL=http://127.0.0.1:8025 pnpm dev`; every email
   appears at http://127.0.0.1:8025. In production, set `RESEND_API_KEY` and `EMAIL_FROM` (a verified domain).

Never put a rendered body or personal data you do not need into the job payload; the job carries the template name,
the recipient and a link.

### 10.5 A background job or a scheduled task

pg-boss keeps jobs in Postgres, so there is no extra service to run. In `src/infra/jobs.ts`, follow the
`PURGE_EXPIRED_QUEUE` example:

```ts
export const WEEKLY_DIGEST_QUEUE = "weekly-digest";

// inside startJobs():
await boss.createQueue(WEEKLY_DIGEST_QUEUE);
if (options.runWorkers) {
	await boss.work(WEEKLY_DIGEST_QUEUE, async () => {
		await sendWeeklyDigests(options.db, new Date());
	});
	await boss.schedule(WEEKLY_DIGEST_QUEUE, "0 8 * * 1"); // Mondays 08:00 UTC
}
```

Rules of thumb:

- Pass the current time in as a parameter (`new Date()` at the edge) so tests can control it.
- Make jobs **idempotent**: running one twice must not send two emails or charge twice.
- One-off work goes through `boss.send(queue, data, { retryLimit: 5, retryBackoff: true })`.
- `JOBS_ENABLED=false` turns off workers in a process (for example a second web replica).

### 10.6 Live updates (Server-Sent Events)

`src/app/routes/events.ts` is the example: `streamSSE` writes `event`/`data` messages; the browser reads them with
`new EventSource("/api/v1/events")`. It is gated by the `events-stream` flag. Use SSE for notifications, progress bars
and live lists; for heavy two-way traffic you would need an ADR first (ADR 0002 keeps Redis out on purpose).

### 10.7 Translations and languages

- Every visible string is a key in `messages/en.json` **and** `messages/de.json`. Use it with `m.key()`; parameters
  look like `{name}` in the message and `m.key({ name })` in code.
- **Add a language:** add it to `locales` in `project.inlang/settings.json` (for example `["en", "de", "fr"]`) and
  create `messages/fr.json` with every key. `just gen` compiles the messages.

### 10.8 A blog post

Create `content/posts/<slug>.mdx`:

```mdx
---
title: Launch day
summary: What we built and why.
date: "2026-11-05"
---

The body is **MDX**: Markdown, plus React components if you need them.
```

It appears on `/blog` and at `/blog/<slug>`. The front matter is validated by `content-collections.ts`.

### 10.9 A new UI component

Start from the copied shadcn components in `src/ui/components/ui/` (on Base UI). To add one (the agent will ask):

```console
$ pnpm dlx shadcn@4.23.0 add dialog
```

Use `react-aria-components` only for hard widgets (comboboxes, date pickers, grids). Every new component file under
`src/ui/components` needs a browser test (`*.test.tsx`, rendered in real Chromium with `vitest-browser-react`, queried
by role and label); see `sign-in-gate.test.tsx` in chapter 12.

### 10.10 Add a dependency

```console
$ pnpm view zod-to-json-schema time.created version   # how old? which version?
$ pnpm add zod-to-json-schema                         # the agent must ask you first
```

What protects you:

- **Release age:** pnpm refuses versions younger than 3 days (`minimumReleaseAge: 4320` in `pnpm-workspace.yaml`),
  because most malicious releases are caught within days. For an urgent security release, add the **exact** version
  to `minimumReleaseAgeExclude` with a comment saying why and when to remove it.
- **Install scripts:** packages may not run install scripts unless listed in `allowBuilds` (`strictDepBuilds: true`).
- **Banned packages:** the install hook refuses Next.js, Prisma, Drizzle, Redis/Valkey, Meilisearch, Storybook,
  Turborepo/Nx, Inngest/Trigger.dev, Unleash and Clerk (ADR 0002 says what to use instead).
- **Licences:** `just licenses` (in `just ci`) fails on any production dependency outside the allowlist.
- **Dead dependencies:** knip fails on packages you no longer import.

### 10.11 Borrow a feature from another repository

Other repositories are **references, never sources to merge**. Merging cloned apps imports their stack (often Next.js,
Prisma, Clerk: all refused here), their licence problems and their unknown security.

```console
$ git clone --depth 1 https://github.com/someone/some-app ~/refs/some-app   # outside your project
$ cd ~/dev/my-app
$ claude --add-dir ~/refs/some-app
```

Inside Claude:

```text
/study-reference ~/refs/some-app
```

You get a list of the repository's features with the files behind each. Pick one:

```text
/study-reference ~/refs/some-app channel invitations
```

The skill reads only what implements that feature, records the licence and commit, translates their stack to this
one (their Redis pub/sub → `streamSSE`, their ORM → Kysely, their queue → pg-boss) and writes
`plans/channel-invitations.md`. It never copies code; implement the plan in a fresh session as Tier B or C, one
borrowed feature per pull request, behind a flag. Never install or run the reference repository.

### 10.12 Change the API without breaking clients

`just check` compares `openapi.json` with `origin/main` (oasdiff):

- **Fine:** new routes, new optional fields, new response codes for new situations.
- **Breaking:** removing or renaming a route, a field or a status code, making an optional field required.

If a break is truly intended, put `#api-break <reason>` in a commit message body; the check then only warns. Better
options: add the new field next to the old one and remove the old one in a later release, or add `/api/v2/...`.

### 10.13 Change the database without downtime

Migrations only **expand** in a release; **contract** steps come in a later release, once no running code needs the
old shape. Example: rename `notes.title` to `notes.heading`.

- **Release 1 (expand):** `ALTER TABLE notes ADD COLUMN heading text;`, then backfill (`UPDATE notes SET heading = title
  WHERE heading IS NULL;`, in batches on big tables). The code writes both columns and reads `heading`, falling back to
  `title`.
- **Release 2 (contract):** once release 1 is everywhere: stop writing `title`, then drop it in its own migration.

An index on a big existing table must not lock it:

```sql
-- migrate:up transaction:false
CREATE INDEX CONCURRENTLY IF NOT EXISTS notes_created_at_idx ON notes (created_at);

-- migrate:down
```

Squawk explains any rule it reports; follow its advice rather than silencing it.

### 10.14 The optional integrations

| Integration | Settings | What you get |
| --- | --- | --- |
| `with_ai` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5-5`) | `POST /api/v1/ai/summarize` `{ "text": "…" }` → `{ "summary": "…" }` for signed-in users; 422 if the model declines, 503 if not configured |
| `payments=razorpay` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | The SDK client and `POST /api/v1/webhooks/razorpay`, which verifies the signature before trusting anything |
| `payments=polar` | `POLAR_ACCESS_TOKEN`, `POLAR_SERVER` (`sandbox` or `production`), `POLAR_WEBHOOK_SECRET` | The SDK client and `POST /api/v1/webhooks/polar` (Standard Webhooks verification) |
| `with_charts` | none | lightweight-charts and recharts, with the `/charts` example page |
| `with_rich_text` | none | Tiptap, with the `/editor` example page; store the editor's JSON document, never user HTML |

From the browser, calling the AI route is one `fetch`:

```ts
const response = await fetch("/api/v1/ai/summarize", {
	method: "POST",
	credentials: "same-origin",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({ text }),
});
```

---

## 14. Testing: what to test, where, and how

### The kinds of tests

| Kind | Where | Runs in | Command |
| --- | --- | --- | --- |
| Unit and route tests | Next to the code: `src/**/*.test.ts` | Node, with a real Postgres | `just test`, or `pnpm exec vitest run <file>` |
| Property tests | Same files, `test.prop([...])` | Node | same |
| Component and browser-lib tests | `src/ui/**/*.test.tsx` | Real Chromium (Vitest browser mode) | same |
| Architecture tests | `tests/arch/`, `tests/lint/` | Node | same |
| End-to-end, accessibility, security | `tests/e2e/`, `tests/security/` | Playwright against the production build | `just e2e` |
| Smoke tests | `tests/smoke/` | Playwright; after every deploy against production | `BASE_URL=https://… pnpm exec playwright test tests/smoke` |
| Mutation testing | (uses the unit tests) | Stryker | `just mutation` |
| Load test | `tests/load/smoke.js` | k6 | `just load` |

### The rules

1. **Test behaviour, not implementation.** Call the route, check the response; call the function, check the result.
2. **The database is real.** Every test file gets its own freshly migrated Postgres database (`DATABASE_URL` is set
   for you by `tests/setup.db.ts`). Create rows with Kysely; never mock a query.
3. **Mock only the outside world:** HTTP to other services (MSW), time (fake timers), the browser's `fetch`.
   Never `vi.mock` a file of this repository (an ast-grep rule fails the gate). Pass small real implementations of
   the ports instead, like the `AuthPort` in 9.10.
4. **No `.only` and no `.skip`** in committed tests.
5. **Coverage:** at least 80% lines overall, 60% per file, and 90% lines for `src/domain`. Pages in
   `src/ui/routes/` are excluded because the e2e tests cover them.

### Example: an outbound HTTP call with MSW

Any request to the internet without a handler fails the test, so tests can never call a real API by accident.

```ts
import { HttpResponse, http } from "msw";
import { expect, it } from "vitest";
import { server } from "../../../tests/setup.msw.js";

it("converts with the live rate", async () => {
	server.use(
		http.get("https://api.example.com/rates", () =>
			HttpResponse.json({ eur: 1.1 }),
		),
	);
	expect(await convert(10)).toBe(11);
});
```

### Example: control the clock

```ts
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
	vi.useRealTimers();
});

it("expires a link after 24 hours", () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
	const link = createLink();
	vi.setSystemTime(new Date("2026-11-05T10:00:01Z"));
	expect(isExpired(link)).toBe(true);
});
```

Even better: pass `now: Date` as a parameter (as `purgeExpiredAuthRows(db, now)` does), then no fake timers are needed.

### Running one end-to-end test

```console
$ pnpm build
$ pnpm exec playwright test tests/e2e/notes.spec.ts
```

The Playwright config starts the production build on a throwaway, migrated Postgres for you. Reports land in
`reports/playwright/`.

### What mutation testing tells you

Stryker changes your code in small ways (`>` becomes `>=`, a condition becomes `true`) and checks that some test
fails each time. A surviving mutant means "no test notices if this line is wrong". The gate requires a score of 60
for `src/` and 80 for `src/domain`. It runs in `just ci` and every Monday in CI; locally it is slow.

---

## 15. Configuration and secrets

### Locally: nothing to set up

Every setting has a development default: the database is the one `just db-up` starts, the auth secret is a local
placeholder, email goes to Mailpit or the log. You can run `pnpm dev` right after creating a project.

### The list of settings

`.env.example` lists every key with a one-line explanation. It is **generated** from `src/env.ts`
(`pnpm env:example`), so it is always complete. It is documentation only: never copy it to a `.env` file.

### What production needs

| Setting | Why | Example |
| --- | --- | --- |
| `DATABASE_URL` | Required in production; the app refuses to start without it | Neon: the **pooled** URL with `sslmode=require` |
| `BETTER_AUTH_SECRET` | Required in production; signs sessions | `openssl rand -base64 32` |
| `APP_URL` | The public address. The CSRF check accepts browser writes only from this origin, and email links use it. Forget it and every form fails | `https://my-app.example.com` |
| `RESEND_API_KEY`, `EMAIL_FROM` | In production the app refuses to start with "log-only" email | A Resend key; a sender on a domain verified in Resend |
| `SENTRY_DSN`, `SENTRY_RELEASE` | Optional: error reports | from Sentry |
| `OTEL_EXPORTER_OTLP_ENDPOINT` (+ `OTEL_EXPORTER_OTLP_HEADERS`) | Optional: traces and metrics | Grafana Cloud's OTLP gateway |
| `CSP_CONNECT_SRC` | Extra origins the browser may call (Sentry ingest, Umami) | `https://o1.ingest.sentry.io` |
| `VITE_SENTRY_DSN`, `VITE_UMAMI_*` | Browser settings, baked in at **build** time | public values only |

The Docker image already sets `NODE_ENV=production`, `HOST=0.0.0.0` and `PORT=3000`.

### Keep secrets encrypted with sops + age

Plaintext secrets never live on disk. They are stored encrypted in `secrets/*.enc.env` (committed) and decrypted only
into the process that needs them.

1. Create your key once per machine:

   ```console
   $ age-keygen -o ~/.config/sops/age/keys.txt
   Public key: age1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqs3290gq
   ```

2. Put **your public key** into `.sops.yaml`, replacing the placeholder recipient. Add one line per person or CI
   identity that must be able to decrypt.
3. Create or edit a secrets file; sops opens your editor and saves it encrypted:

   ```console
   $ sops secrets/dev.enc.env
   ```

   Write ordinary `KEY=value` lines, for example `RESEND_API_KEY=re_123…`.
4. Run the app with those values (they exist only inside that one process):

   ```console
   $ sops exec-env secrets/dev.enc.env 'pnpm dev'
   ```

With 1Password instead: `op run --env-file=.env.op -- pnpm dev`, where `.env.op` contains `op://` references.

The agent can never read `.env*` files or `secrets/`, and lefthook refuses to commit `.env*`, `*.pem` and `*.key`
files. gitleaks and TruffleHog scan the history in `just ci`.

---

## 16. Shipping: CI, releases and deployment

### What runs on GitHub

| Workflow | When | What |
| --- | --- | --- |
| `ci.yml` | Every pull request, the merge queue, every push to `main`, Mondays | `just doctor`, `just ci`, `just e2e`; on Mondays also the full mutation run |
| `secpass.yml` | Pull requests, the merge queue, nightly | Starts the app in production mode on a throwaway database and attacks it: Schemathesis (fuzzes every documented route), ZAP baseline, nuclei |
| `supply-chain.yml` | Pull requests, the merge queue, pushes to `main`, Mondays | Vulnerability scans (OSV-Scanner, Grype), an SBOM, licence checks, dependency review |
| `migrations.yml` | Pull requests that touch `migrations/` | Squawk |
| `deploy.yml` | Every push to `main` | Gates, then (once switched on) image, migrations, deploy, smoke test |
| `template-update.yml` | Mondays 07:00 UTC | Opens a pull request that brings the template's newest `main` commit (chapter 18) |

### Switch on deployment

`deploy.yml` is deliberately off until you finish it:

1. Add the repository **variable** `PRODUCTION_URL` (Settings → Secrets and variables → Actions → Variables), for
   example `https://my-app.example.com`.
2. Add the repository **secret** `DATABASE_URL`: the production database's **direct** (unpooled) URL. The workflow
   uses it to run `dbmate up` **before** the new version takes traffic. That is safe because migrations only add things.
3. Find the step marked `TODO(project)` and replace it with your platform's deploy command. The image reference is in
   `$IMAGE`. For example, on Fly.io: `flyctl deploy --image "$IMAGE"`.
4. In the repository's `production` environment, add required reviewers if you want a human click before each deploy.

After the deploy, the workflow polls `$PRODUCTION_URL/readyz` and runs the Playwright smoke tests against production.

### Run the production image locally

Docker is not part of the Nix shell; install it on your machine. The agent must ask before running `docker`.

```console
$ docker build -t my-app .
$ dbmate --url "postgres://…/my_app" --migrations-dir migrations up     # once, on an empty database
$ docker run --rm -p 3000:3000 \
    -e DATABASE_URL="postgres://…/my_app" \
    -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
    -e APP_URL="http://localhost:3000" \
    -e RESEND_API_KEY="re_…" \
    my-app
$ curl http://localhost:3000/readyz
{"status":"ready","checks":{"accepting-connections":"ok","database":"ok","web":"ok"}}
```

`/healthz` answers as soon as the process runs (liveness); `/readyz` answers 200 only when the database is reachable
and the web bundle is loaded (readiness). Point your uptime monitor at both.

### Versions and release notes

- Every pull request that changes behaviour adds a **changeset** (`pnpm changeset`), a short Markdown file saying
  what changed for users (see 9.15).
- To cut a release, on a clean `main` whose CI is green, type `/release` in Claude Code. It runs
  `pnpm changeset version` (bumps the version and writes `CHANGELOG.md` from the changesets), commits, tags
  `v<version>` and pushes the tag (you confirm the push).
- Deployment does not wait for a release: every push to `main` deploys (once switched on). A release names a version
  and writes the notes.

---

## 17. When something goes wrong in production

The full runbook is `docs/runbooks/rollback.md`. The order is always **flag first, app second, data last**: each step
is faster and safer than the next, and most incidents end at step 2.

1. **Flag (seconds).** Turn the feature's flag off in `flags/flags.json`, or turn on the write kill switch:

   ```json
   		"kill-switch-writes": {
   			"state": "ENABLED",
   			"variants": { "on": true, "off": false },
   			"defaultVariant": "on"
   		}
   ```

   Every state-changing `/api/v1/*` request now answers 503; reading and signing in still work. If the flag file is
   mounted into the container, this takes effect within seconds; otherwise commit it and redeploy.
2. **App (minutes).** Redeploy the last good image **by digest**. Find the last green deploy with
   `gh run list --workflow deploy.yml`, then use your platform's rollback (`vercel rollback`, `wrangler rollback`, or
   redeploy `ghcr.io/<owner>/<image>@sha256:…`). Then rerun the smoke tests:
   `BASE_URL=https://my-app.example.com pnpm exec playwright test tests/smoke`.
3. **Configuration.** Revert the commit that changed settings, or restore the old values in the platform, then
   redeploy. A rotated secret is never "rolled back": issue a new one.
4. **Data (last).** Because migrations only add things, old code runs fine on the new schema, so rolling the app back
   never needs a schema rollback. Never run a destructive `down` migration during an incident. For corrupt data, restore
   to a point in time **into a new database or branch first** (Neon: within 6 hours on the free plan), check it, then
   switch over.

Afterwards, write the incident note (timeline, cause, the test that would have caught it) and add that test.
Every quarter, practise a restore and record it in the runbook's table: a backup you have never restored is not a
backup.

---

## 18. Keeping projects up to date with the template

### The automatic way

Every Monday, `template-update.yml` runs `copier update --vcs-ref main`, which moves the project to the template's
newest `main` commit, and opens a pull request labelled `template-update`. Its title says `CONFLICTS` when some files
could not be merged automatically. Review it like any other PR. When nothing changed on the template's `main`, it
opens nothing. Between runs, the project's `ci.yml` prints a (non-blocking) `template update available` warning
once the template's `main` has moved past the project's commit.

When the job fails, read the `::error::` line under Copier's output; it names the case:

| The log says | Do this |
| --- | --- |
| `The template repository has no main branch` | The template's `main` was renamed or deleted: push it again (or rename the default branch back to `main`), then run the job again |
| `The template commit this project records (...) is no longer in the template repository` | The template's `main` was rewritten (force-push, rebase, amend), or the project was made from a branch that is gone: push the commit back as `keep-<sha>` (the line gives the command; delete that branch once every project has updated past it), or run the `recopy` command the line prints, in a clean checkout (chapter 20) |
| `The template's main counts as older than this project's template commit ...` | `main` was reset behind the project's commit, or the project was made with the old script from a newer tag or another branch: push `main` forward, or run the `recopy` command the line prints |
| `Pushing the update branch failed ...` | Read git's message just above it. `refusing to allow ... to create or update workflow`: the `GH_TOKEN_FOR_UPDATES` token lacks the `workflow` scope (chapter 5.4). `[rejected] ... (non-fast-forward)`: the update branch of an earlier run that day still exists; merge or close its pull request, delete the branch, and run the job again |

A project made from a release tag or a branch (instead of from `main`, as `new-project.sh` always renders now) has an
older `template-update.yml`: update it once by hand (below).

### The manual way

```console
$ cd ~/dev/my-app
$ git status                                   # must be clean
$ nix run --inputs-from . nixpkgs#copier -- update --trust --defaults --conflict rej --vcs-ref main
$ git status                                   # review the diff
```

- Always keep `--vcs-ref main`. Without it Copier looks for the newest release tag instead, which is older than the
  project's commit, and stops with `Downgrades are not supported`.
- Files Copier could not merge get a `*.rej` file next to them: apply the change by hand, delete the `.rej`.
- If `package.json` changed, run `pnpm install` once to update the lock file (CI installs with
  `--frozen-lockfile` and fails until you do).
- Run `just check`, then commit.

### What an update can and cannot change

An update rewrites the **template-owned** files (flake, justfile, lint configs, workflows, `.claude/`, `.opencode/`).
It never changes a file of **yours** that already exists (`src/**`, `tests/**`, `migrations/**`, `README.md`, ADRs,
messages, content, flags, lock files), because it cannot know how you changed it; it only adds the template's new
files there. When a release changes code you own, its CHANGELOG entry says **"Manual upgrade from vX"** and a guide
in `docs/upgrading/` lists what to merge by hand; the update prints a `_migrations` message pointing at it, and
`template-test`'s update path runs `just doctor` (not `just check`) for that release. A project that was on a commit
between releases before the update (made from `main` after a tag: its `_commit` was like `v0.1.0-1-gc17a61b`; the
update's diff of `.copier-answers.yml` shows the old value) may already have part of the new version, and the update
prints a different message for it once the version is tagged: in that case, diff your whole `src/` and `tests/`
against a fresh project with the same answers instead of working through the file list.

---

## 19. Changing the template itself

You change the template in this repository; projects pick the change up through `copier update`.

### Where things are

| You want to change… | Edit |
| --- | --- |
| A question | `copier.yml` (and add or update an answer set in `tests/answers/`) |
| A file every project gets | `template/<path>` (add `.jinja` to the name if its content depends on an answer) |
| A file only some projects get | A conditional path segment, e.g. `template/src/{% if kind == 'web' %}ui{% endif %}/…` |
| What a project does after creation | `new-project.sh` and `template/scripts/bootstrap-generated.sh` |
| The docs of this repository | `README.md`, `CHANGELOG.md`, this guide, `TREE.txt` |

Jinja tips: `{{ project_slug }}` inserts an answer; `{% if with_ai %}…{% endif %}` adds a block; a literal `{#` in a
shell script (as in `${#array[@]}`) must be written `{{ "{#" }}`, or Jinja reads it as a comment.

### Test a change

Render the working copy and run the same steps CI runs:

```console
$ nix run github:NixOS/nixpkgs/nixos-26.05#copier -- copy --trust --defaults --vcs-ref HEAD \
    --data-file tests/answers/default-web.yml . /tmp/out
$ cd /tmp/out
$ git init -q -b main && git add -A
$ nix develop .#quiet -c pnpm install --no-frozen-lockfile
$ nix develop .#quiet -c bash scripts/bootstrap-generated.sh
$ git add -A && git commit -qm "chore: scaffold from vibe-forge"
$ nix develop .#quiet -c just check
```

Repeat for the other answer sets (`default-service`, `web-full`, `web-polar-node24`, `no-playwright-node24`,
`python-scoped`, `service-opencode`) when your change could affect them. Run them one at a time: each gate is heavy
on memory. The `template-test` workflow runs all seven, plus `just ci`, `just e2e`, a Docker build and an update from
the previous tag, on every pull request.

### Rules that keep updates safe

- Renaming or removing a template file needs an entry in `_migrations` in `copier.yml`.
- A change to a file projects own (`src/**`, `tests/**`, …) does not reach existing projects: write a
  `docs/upgrading/<version>.md` and mark the release "Manual upgrade from vX" in `CHANGELOG.md`.
- Changing `.dependency-cruiser.cjs.jinja` needs a new ADR in `template/docs/decisions/` in the same change.
- Every push to `main` reaches every project with its next update (chapter 3), so merge into `main` only when
  `template-test` is green. Tag a version when a change needs a hand upgrade, on the commit that brings it.
- Never rewrite `main` (no force-push, no rebase or amend of pushed commits): projects need the commit they record.
  How you merge a branch into `main` does not matter.

---

## 20. Troubleshooting: what each failure means and how to fix it

### Gate failures

| You see | It means | Fix |
| --- | --- | --- |
| `File content differs from formatting output` (Biome) | Formatting | `pnpm format` |
| `This file has too many lines (…). Maximum allowed is 300` | A file grew too big | Split it by responsibility |
| `Excessive complexity` (Biome) | A function is too complicated (cognitive complexity > 15) | Extract helper functions |
| ESLint `@typescript-eslint/...` errors | Unsafe or sloppy TypeScript (`any`, unhandled promises, non-exhaustive `switch`) | Fix the code. A suppression comment needs `reason:`; an ast-grep rule enforces it |
| `Test has no assertions  vitest/expect-expect` | A test without `expect` | Add assertions; for properties use `test.prop` |
| ast-grep `no-process-env-outside-env` | `process.env` read outside `src/env.ts` | Add the key to `src/env.ts`, import `env` |
| ast-grep `no-start-server-endpoints` | A TanStack Start server function or server route | Write a Hono route instead (chapter 13.1) |
| ast-grep `no-vi-mock-of-repo-module` | `vi.mock` of a file in this repository | Pass a small real implementation of the port |
| knip `Unused files / exports / dependencies` | Dead code | Delete it, or stop exporting it |
| dependency-cruiser `domain-independent`, `ui-not-server`, `app-not-infra-or-ui`… | An import breaks a layer rule | Move the code to the right layer, or go through a port |
| dependency-cruiser `no-cross-module-internals` / `modules-via-index-from-outside` | Something imports a module's internal file | Import from the module's `index.ts` (export it there if it should be public) |
| dependency-cruiser `not-on-purpose` | A banned package is imported | Use the replacement from ADR 0002 |
| jscpd `Found N clones` and the gate fails | New copy-pasted code | Extract a shared function or component |
| `openapi.json is out of date` | Routes changed | `pnpm openapi` |
| `.env.example … out of date` | Settings changed | `pnpm env:example` |
| `db/schema.sql … out of date` or `schema.gen.ts is out of date` | Migrations changed | `just db-generate` |
| `src/ changed without docs/README/CHANGELOG` | docs-drift | Add a changeset (`pnpm changeset`) or a docs change, or `#no-docs <reason>` in the commit body |
| `architecture boundary changed without an ADR` | `.dependency-cruiser.cjs` changed | Add `docs/decisions/NNNN-….md` in the same change |
| oasdiff lists breaking changes | You removed or renamed part of the API | Make it additive (chapter 13.12), or `#api-break <reason>` |
| Squawk reports a rule | An unsafe migration | Follow its advice (e.g. `CREATE INDEX CONCURRENTLY` with `transaction:false`) |
| Coverage threshold not met | A file has too few tests | Test the uncovered branches the report shows (`reports/coverage/`) |
| Telemetry test: a status is not in the documented list | A route answered a status its OpenAPI entry does not list | Document that response in `createRoute` |
| Access matrix: an operation is not declared | A new route without a matrix row | Add the row (chapter 12.11) |
| Mutation score below the break threshold (`just ci`) | Tests run the code but do not check it | Strengthen the assertions where mutants survived (`reports/mutation/`) |
| Lighthouse below 0.95 (`just ci`, web) | Accessibility, SEO or best-practice regression | Read the reports in `reports/lighthouse/` and fix the reported audits |
| size-limit over budget | The JavaScript or CSS bundle grew too much | Split code, drop a heavy dependency, or raise the budget in `.size-limit.json` deliberately |

### Environment problems

| You see | Fix |
| --- | --- |
| Every tool call blocked by `guard.sh` | Start Claude Code from the project shell (`cd` into the project with direnv, or `nix develop -c claude`) |
| `/sandbox` shows red dependencies | You are not in the project shell; bubblewrap and socat come from the flake |
| `just doctor` fails on a version | Do not change versions by hand. Leave and re-enter the folder (direnv reloads), or run `nix develop` |
| Port 54329 or 3000 already in use | `just db-down`, or stop the other `pnpm dev` |
| A test complains about Postgres right after you killed a run | Leftover throwaway clusters: `pgrep -fa "postgres -D"` shows them; stop the ones under `/tmp/nix-shell.*` |
| The machine runs out of memory during `just ci` | Close other heavy apps; run one gate or one project at a time |
| `copier update` says `Downgrades are not supported` | The update command lacks `--vcs-ref main` (without it Copier goes to the newest release tag, which is older than the project): add it. With it, `main` was reset behind the project's commit, or the project was made with the old script from a newer tag or another branch: see the `recopy` below |
| `copier update` ends with `error: pathspec 'v0.1.0-2-g1a2b3c4' did not match any file(s) known to git` | The template commit the project records is gone: the template's `main` was rewritten, or the project was made with the old script from a branch that was deleted. From a template clone that still has it, push it back as a branch: `git push origin 1a2b3c4:refs/heads/keep-1a2b3c4` (the part after `-g`), update again with `--vcs-ref main`, and delete that branch once every project whose `_commit` ends in `-g1a2b3c4` has updated past it. No clone has it? In a clean checkout (commit or stash first: `recopy` overwrites uncommitted changes without asking), run `nix run --inputs-from . nixpkgs#copier -- recopy --trust --defaults --overwrite --vcs-ref main` once in the project. Ignore its closing "new-project.sh now continues on its own" message. It re-renders every template-owned file and replaces your own edits in them: review the diff and put back what you need, run `pnpm install` if `package.json` changed, then `just check`, and commit |
| The agent's turn ends with `UNVERIFIED` | Run `just check` yourself, read the first failure, give the agent a precise brief |
| `pnpm add` fails because the version is too new | Wait until it is 3 days old, or (security fix) add an exact `minimumReleaseAgeExclude` entry with a removal date |
| A form in production always fails with 403 | `APP_URL` is not set to the public origin (CSRF check) |
| The app refuses to start in production | Read the first log line: a required setting (`DATABASE_URL`, `BETTER_AUTH_SECRET`, email) is missing |

---

## 21. Unattended runs and measuring the process

### 21.1 The idea

Some work should not need you watching: batch migrations overnight, a nightly refactor pass, the weekly
dependency bump. The template ships the pieces for running the agent **unattended** — with a budget, inside a
sandbox, in CI — and for measuring whether that is actually working.

### 21.2 `scripts/agent-run.sh` — one unattended run

```console
$ nix develop .#quiet -c bash scripts/agent-run.sh --max-budget-usd 5 \
    "Run just check on the current tree. Fix only what is red. Paste the last lines of the run as evidence."
```

What it does: runs `claude --bare -p` (no hooks, skills, plugins or `CLAUDE.md` — the repository's own settings
files still apply), validates that the output parses as JSON, and fails when it does not. `--schema` (optional)
hands Claude a JSON schema to constrain the answer. Run it inside the dev shell or a container — **never on your
host** (chapter 15.4): an unattended agent gets the same deny list and sandbox as any other run, plus a hard
budget.

### 21.3 `gate-flake-rate.yml` — is the gate trustworthy?

```yaml
# .github/workflows/gate-flake-rate.yml — Saturdays, before template-test.
# Renders a fresh default-web project and runs its full `just check` three times.
```

A gate that passes and fails on identical code is a flaky gate, and agents cannot work against one. The workflow
reports the flake rate in the job summary; any disagreement between the three runs fails the job.

### 21.4 `golden-prompt.yml` — the acceptance test for the vibe process

Weekly (when the `ANTHROPIC_API_KEY` secret exists; otherwise a `::notice::` and a clean skip): render a fresh
project, give the agent the documented worked-example brief (chapter 12) with a budget cap, and require the
project's full gate to be green afterwards. This is the template's own pass/fail signal that a from-scratch
agent run can actually work here.

### 21.5 `docs/metrics.md` — the monthly ledger

| Month | Commits | First-pass CI rate | Review-rework ratio | $ per merged change |
|---|---|---|---|---|
| | | | | |

`just metrics` prints the commit counts; the other columns come from your CI and review tools. Read the ratios
together: throughput alone rewards what inflates review burden.

---

## 22. Glossary

| Word | Meaning here |
| --- | --- |
| **ADR** | Architecture Decision Record: a short file in `docs/decisions/` saying what was decided and why |
| **age / sops** | Encryption tools: age holds your key, sops encrypts the values in `secrets/*.enc.env` |
| **ast-grep** | A code search tool; the `rules/` folder uses it to ban specific code patterns |
| **axe** | The accessibility checker the e2e tests run on every page |
| **better-auth** | The library behind sign-up, sign-in, sessions and password reset |
| **changeset** | A small file describing a change for the release notes (`.changeset/*.md`) |
| **composition root** | `src/infra/server.ts`: the one place real things (database, mailer, auth) are created and connected |
| **Copier** | The generator that renders this template and later updates projects |
| **CSP / nonce** | Content Security Policy: the browser runs only scripts that carry the per-request nonce |
| **CSRF** | Cross-site request forgery; the guard accepts browser writes only from `APP_URL` |
| **distill** | End-of-feature ritual: promote what you built into `docs/registry.md`/`docs/glossary.md` (you approve the diff), then delete the scratchpad |
| **dbmate** | Applies the SQL files in `migrations/` in order |
| **dependency-cruiser** | Checks who may import whom (the layer and module rules) |
| **direnv / nix-direnv** | Load the project's Nix shell automatically when you `cd` into the folder |
| **domain** | Pure business rules, without IO |
| **e2e** | End-to-end tests: a real browser against the real built app |
| **expand / contract** | Database changes in two releases: first add, later remove |
| **flag / kill switch** | A switch in `flags/flags.json` that turns a feature (or all writes) off without a deploy |
| **gate** | `just check`: the set of checks that decides when work is done |
| **harness** | The AI coding agent and its adapter: Claude Code (`.claude/`), OpenCode (`.opencode/`), or both |
| **Hono** | The web server framework for the API |
| **hook (Claude Code)** | A script Claude Code runs before or after tool calls; `gates.sh` runs the gate when the agent stops |
| **just** | The command runner; `justfile` lists the commands |
| **knowledge layer** | The four files that outlive a session: `docs/glossary.md`, `docs/registry.md`, `docs/learnings.md`, `docs/metrics.md` |
| **mediator contract** | The rule that every pipeline ends in `plans/<slug>/{spec,plan,tasks}.md` — the same three files whichever way you briefed it |
| **knip** | Finds unused files, exports and dependencies |
| **Kysely** | The typed SQL query builder |
| **lefthook** | Runs checks on `git commit` and `git push` |
| **migration** | One SQL file that changes the database schema |
| **module** | One product area in `src/modules/<name>/`, entered through its `index.ts` |
| **MSW** | Mock Service Worker: fakes outside HTTP services in tests |
| **mutation testing** | Changes your code on purpose to check that the tests notice (Stryker) |
| **Nix flake** | The file that pins the whole toolchain (`flake.nix` + `flake.lock`) |
| **offload** | Saving long command output to `.scratch/context-dumps/` and giving the agent a summary instead (`scripts/offload-context.mjs`) |
| **OpenAPI** | The machine-readable description of the API (`openapi.json`) |
| **Paraglide** | Compiles `messages/*.json` into typed `m.key()` functions |
| **pipeline** | A recipe in `pipelines/` for turning one kind of input (an idea, a reference, a bug report) into a spec |
| **pg-boss** | Background jobs and cron, stored in Postgres |
| **port / adapter** | An interface the app needs (port, in `src/app/ports.ts`) and its real implementation (adapter, in `src/infra`) |
| **registry** | `docs/registry.md`: the shelf of reusable pieces with an ID and a scope (web projects) |
| **Renovate** | A bot that opens pull requests to update dependencies |
| **Result** | A return value that is either `ok(value)` or `err(error)` (neverthrow), used for expected failures |
| **scratchpad** | `.scratch/pipelines/<slug>/`: the git-ignored, temporary workspace of a pipeline, deleted by `just prune-scratch` |
| **scope tier** | Who may use a registry piece: `GLOBAL` < `ARCHETYPE:<name>` < `FEATURE:<name>` < `ATOM` |
| **sandbox** | Claude Code's isolation of shell commands (bubblewrap on Linux) |
| **SSE** | Server-Sent Events: a one-way live stream from server to browser |
| **task graph** | The `dep:`-linked task list in `plans/<slug>/tasks.md`; `just sync-tasks` prints it in dependency order |
| **TanStack Start** | The React framework for the web pages (server-side rendering) |
| **Zod** | Schemas that validate data at runtime and give TypeScript types |

---

## 23. Cheat sheet

```text
NEW PROJECT          cd ~/dev/vibe-forge && ./new-project.sh ~/dev/my-app
TEMPLATE CHANGE      branch → PR → template-test green → merge into main   (projects always follow main)
TRY IT UNMERGED      ./new-project.sh --local /tmp/try-it                    (throw it away afterwards)
OPEN IT              cd ~/dev/my-app, then claude — or opencode   (two commands; first time: /sandbox)
DEVELOP              just db-up && pnpm dev               → http://127.0.0.1:3000
EMAIL LOCALLY        just mail  +  MAILPIT_URL=http://127.0.0.1:8025 pnpm dev
DONE?                just check                           (Claude's Stop hook runs it too; in OpenCode run it yourself)
BEFORE A RELEASE     just ci && just e2e
ONE TEST FILE        pnpm exec vitest run src/modules/notes/routes.test.ts
FORMAT               pnpm format
NEW MIGRATION        just db-new add_widgets  →  edit  →  just db-generate
AFTER ROUTE CHANGE   pnpm openapi
AFTER SETTING CHANGE pnpm env:example
NEW DEPENDENCY       pnpm view <pkg> time.created version  →  pnpm add <pkg>
BRIEF A FEATURE      follow pipelines/intent-driven.md   (or reference-study.md, telemetry-driven.md)
TASK QUEUE           just sync-tasks                      (+ --bd when the Beads CLI is installed)
END OF FEATURE       just distill → approve diff → commit → just prune-scratch <slug>
LONG OUTPUT          <cmd> 2>&1 | node scripts/offload-context.mjs <label>
METRICS (MONTHLY)    just metrics  →  fill one row of docs/metrics.md
UNATTENDED RUN       nix develop .#quiet -c bash scripts/agent-run.sh --max-budget-usd 5 "<task>"
BORROW A FEATURE     git clone --depth 1 <repo> ~/refs/<name>  →  /study-reference ~/refs/<name> [feature]
RELEASE NOTES        pnpm changeset          RELEASE   /release (in Claude, on green main)
UPDATE FROM TEMPLATE nix run --inputs-from . nixpkgs#copier -- update --trust --defaults --conflict rej --vcs-ref main
SECRETS              sops secrets/dev.enc.env   ·   sops exec-env secrets/dev.enc.env 'pnpm dev'
INCIDENT             flag off (flags/flags.json)  →  redeploy last good image by digest  →  data last

FEATURE CHECKLIST
  [ ] pipeline ran → plans/<slug>/{spec,plan,tasks}.md exist
  [ ] migration (expand-only) + just db-generate
  [ ] domain function + tests (incl. a property test)
  [ ] schemas with examples
  [ ] store: every query scoped by user id
  [ ] routes: requireSession, every response documented, path params as {id}
  [ ] register in src/app/app.ts, wire in src/infra/server.ts
  [ ] route tests against the real Postgres, incl. "another user cannot…"
  [ ] access-matrix rows   [ ] pnpm openapi
  [ ] UI: lib + browser test, page, messages (en + de), nav link
  [ ] e2e flow + page in the axe list
  [ ] behind a flag if risky   [ ] changeset
  [ ] just check  ·  just e2e  ·  reviewer subagent  ·  small PR
  [ ] distill ritual: registry/glossary updated, scratchpad pruned
```
