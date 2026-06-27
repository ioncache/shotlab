# Contributing

Bug reports and pull requests are welcome.

## Getting started

```bash
yarn install --immutable
yarn test:all
```

See [README.md](README.md) and [docs/architecture.md](docs/architecture.md)
for the current project direction.

## Before you start work

- Check [docs/ROADMAP.md](docs/ROADMAP.md) to see what is planned.
- For non-trivial changes, write a plan document in `docs/plans/` before
  touching code. See [docs/plans/README.md](docs/plans/README.md) for the
  convention.

## Pull requests

- PR titles use conventional commit format:
  `<type>(<issue-number>): <description>`
  (e.g. `feat(42): add protocol probe`).
- Run `yarn format:check:all`, `yarn lint:ci:all`, `yarn build:all`, and
  `yarn test:all` before opening a PR.
- Update README and TSDoc if the public API changes.
