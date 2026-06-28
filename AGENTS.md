# AGENTS.md

## Workflow Rules

- Default to a git worktree for feature implementation when feasible.
- Keep roadmap and implementation-plan steps branch-sized: approximately one PR or one worktree worth of work.
- Do not stage files, create commits, or push branches unless the user explicitly asks.

## Dependency Rules

- Do not add a new package without user approval.
- Before proposing a new package, research existing options, including maintenance and recent activity,
  then present the options, tradeoffs, and a recommendation.

## Configuration Rules

- Do not access `process.env` throughout the codebase.
- Read environment variables through a dedicated config module with schema validation.
- Reuse the established config pattern instead of introducing a second one.

## Testing Rules

- Keep integration tests separate from unit tests and do not run them by default.
- For machine-facing integration tests, never start brewing.
- If a test changes machine state, return the machine to a neutral state before the test exits.
- Before claiming work is complete, run the relevant verification commands. For repo-wide verification,
  use `yarn format:check:all`, `yarn lint:ci:all`, `yarn build:all`, and `yarn test:all`.

## Pull Request Rules

- Before creating or editing any pull request, read and follow `.github/PULL_REQUEST_TEMPLATE.md`.
- Do not bypass the template by writing a generic PR body with `gh pr create --body`, `gh pr edit --body`,
  or any other manual PR body unless the body is composed from the template structure.
- Use the PR title format documented in `.github/PULL_REQUEST_TEMPLATE.md`: `<type>(<issue-number>): <description>`.
- Keep any existing auto-generated sections already present in the PR body unless the user explicitly asks to remove them.
