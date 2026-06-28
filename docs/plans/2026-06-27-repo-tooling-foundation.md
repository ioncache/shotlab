# Repo Tooling Foundation Implementation Plan

**Goal:** Establish ShotLab's repo-level JavaScript/TypeScript tooling and workspace skeleton before protocol implementation begins.

**Architecture:** Use Node 24 with Yarn 4 workspaces and ~~Plug'n'Play~~ `node_modules`. The original plan copied the recent `data-sanitization` Plug'n'Play setup, but ShotLab now uses `nodeLinker: node-modules` because Vitest runs through Vite, and Vite warns that Yarn PnP support is no longer actively maintained. Keep this pass limited to repo hygiene, config, and skeleton directories; no protocol, UI, API, database, or service implementation.

**Tech Stack:** Node 24, Yarn 4, TypeScript, Vitest, Oxc formatter/linter, markdownlint, yamllint.

---

## Task 1: Add Root Package And Yarn Configuration

**Files:**

- Create: `package.json`
- Create: `.yarnrc.yml`
- Copy: `/home/ioncache/projects/personal/data-sanitization/.gitignore` to `.gitignore`
- Create: `.editorconfig`

- [ ] Add root `package.json` with Yarn 4, Node 24, workspace globs for `apps/*`, `packages/*`, and `services/*`, and root scripts for format, lint, build, test, and clean.
- [ ] Add `.yarnrc.yml` using ~~`nodeLinker: pnp`~~ `nodeLinker: node-modules`, `enableScripts: true`, and `npmMinimalAgeGate: 10`.
- [ ] Copy `.gitignore` directly from `data-sanitization`.
- [ ] Keep `.gitignore` coverage for Node/Yarn artifacts, build output, coverage, logs, temp files, editor files, `.env`, `.env.*`, and `.envrc`.
- [ ] Add `.editorconfig` with UTF-8, LF, two-space indentation, trimmed trailing whitespace, and final newlines.
- [ ] Run `yarn set version 4.15.0`.
- [ ] Run `yarn install`.

## Task 2: Add Shared TypeScript And Test Tooling

**Files:**

- Copy: `/home/ioncache/projects/personal/data-sanitization/tsconfig.json` to `tsconfig.json`
- Copy: `/home/ioncache/projects/personal/data-sanitization/vitest.config.base.ts` to `vitest.config.base.ts`
- Copy: `/home/ioncache/projects/personal/data-sanitization/.oxfmtrc.json` to `.oxfmtrc.json`
- Copy: `/home/ioncache/projects/personal/data-sanitization/.oxlintrc.json` to `.oxlintrc.json`
- Copy: `/home/ioncache/projects/personal/data-sanitization/.markdownlint.json` to `.markdownlint.json`
- Copy: `/home/ioncache/projects/personal/data-sanitization/.markdownlintignore` to `.markdownlintignore`

- [ ] Copy each listed config file directly from `data-sanitization`.
- [ ] Keep the root `tsconfig.json` extending `@tsconfig/node24/tsconfig.json`, with strict TypeScript settings and declaration output enabled.
- [ ] Keep the shared Vitest base config with Node-oriented defaults, `test/**/*.test.ts` includes, `dist/**` and `node_modules/**` excludes, and V8 coverage.
- [ ] Keep Oxc format/lint behavior matching `data-sanitization`.
- [ ] Keep markdownlint behavior matching `data-sanitization`.
- [ ] Adjust only paths that are wrong for ShotLab, such as project-specific ignore entries.

## Task 3: Add Repo Skeleton

**Files:**

- Create: `apps/api/README.md`
- Create: `apps/web/README.md`
- Create: `packages/meticulous-client/package.json`
- Create: `packages/meticulous-client/tsconfig.json`
- Create: `packages/meticulous-client/tsconfig.build.json`
- Create: `packages/meticulous-client/vitest.config.ts`
- Create: `packages/types/README.md`
- Create: `packages/ui/README.md`
- Create: `services/analytics/README.md`
- Create: `services/collector/README.md`
- Create: `services/mcp/README.md`
- Create: `docs/plans/README.md`

- [ ] Add README placeholders for future app/service/package areas.
- [ ] Add `packages/meticulous-client` as the first real package target, but do not implement protocol code yet.
- [ ] Configure `packages/meticulous-client` build scripts using `tsc`, test scripts using Vitest, and lint/format scripts using Oxc.

## Task 4: Verify Tooling

- [ ] Run `yarn format:check`.
- [ ] Run `yarn lint:ci`.
- [ ] Run `yarn build:all`.
- [ ] Run `yarn test:all`.
- [ ] Fix only tooling/skeleton issues found by those commands. Do not add protocol behavior in this task.

## Explicit Non-Goals

- Do not implement REST calls.
- Do not implement Socket.IO.
- Do not build the web app.
- Do not add database/storage.
- Do not add GitHub Actions yet.
- Do not add Bun or Deno support yet.

## Notes

- `.envrc` currently contains an OpenAI-looking key. Ensure `.envrc` is ignored and remove it from any commit. If that key was real, rotate it.
- CI is deferred until there is at least one package with meaningful code and tests.
