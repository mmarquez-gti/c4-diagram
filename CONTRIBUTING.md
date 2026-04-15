# Contributing to C4 Diagram Creator

Thank you for your interest in contributing! This document describes the process for reporting bugs, requesting features, and submitting pull requests.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it. Please report unacceptable behaviour to the project maintainers.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/c4-diagram.git
   cd c4-diagram
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feat/my-feature
   ```

---

## Reporting Bugs

Before opening a bug report, please search [existing issues](https://github.com/mmarquez-gti/c4-diagram/issues) to avoid duplicates.

When filing a bug, use the **Bug report** issue template and include:

- A clear, descriptive title.
- Steps to reproduce the problem.
- Expected vs. actual behaviour.
- Browser and OS version.
- Any relevant screenshots or console errors.

---

## Requesting Features

Feature requests are welcome! Use the **Feature request** issue template. Explain the use case clearly and why it would benefit other users.

---

## Submitting Pull Requests

1. Ensure your branch is up to date with `main`.
2. Run tests and linting before pushing:
   ```bash
   npm test
   npm run lint
   ```
3. Open a pull request against `main` using the provided PR template.
4. Link any related issues in the PR description.
5. Keep PRs focused — one logical change per PR.
6. Be responsive to review feedback.

All contributions must pass the existing test suite. New behaviour should include corresponding tests where appropriate.

---

## Development Setup

| Command | Description |
|---|---|
| `npm run dev` | Start the Astro development server at `http://localhost:4321` |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | Run ESLint on TypeScript, TSX, and Astro files |
| `npm run format` | Format code with Prettier |

---

## Coding Guidelines

- **TypeScript** — all source files must be strictly typed; avoid `any`.
- **React components** — use functional components and hooks only.
- **Nano Stores** — state mutations go through store actions in `src/stores/`; components read via `useStore`.
- **Immutability** — never mutate store state directly; always return new objects/arrays.
- **Tests** — unit tests live alongside source files (`*.test.ts`); use Vitest.
- **Formatting** — Prettier enforces consistent style; run `npm run format` before committing.
- **No unnecessary dependencies** — prefer the existing stack before adding new libraries.

---

## Commit Messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`.

Examples:
```
feat(canvas): add snap-to-grid support
fix(export): handle empty diagrams in PDF export
docs: update README with keyboard shortcuts
```
