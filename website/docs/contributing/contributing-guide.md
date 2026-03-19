---
sidebar_position: 1
---

# Contributing Guide

Thank you for your interest in contributing to OpenRobOps! This project is open source under the [Apache License 2.0](https://github.com/OpenRobOps/oro/blob/main/LICENSE).

## Ways to Contribute

- **Report bugs** or **request features** by opening a [GitHub issue](https://github.com/OpenRobOps/oro/issues)
- **Submit pull requests** with bug fixes, improvements, or new features
- **Improve documentation** — typos, clarifications, and examples are always welcome
- **Join discussions** on existing issues and PRs

## Development Setup

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | v22 | Via [nvm](https://github.com/nvm-sh/nvm) |
| Meteor | 3.4 | `npx meteor` |
| Docker | With Compose plugin | `docker compose` |
| Terraform | Latest | [hashicorp.com](https://developer.hashicorp.com/terraform) |
| tmux | Any | Package manager |

### Quick Setup

```bash
# Clone the repo
git clone https://github.com/OpenRobOps/oro.git
cd oro

# Generate settings
./scripts/generate-settings.sh --apply

# Install dependencies
cd web/app && npm install
cd ../../ingest && npm install
cd ..

# Start all services
./scripts/start-local-env.sh
```

See the [Quick Start](../getting-started/quick-start.md) for detailed instructions.

## Coding Standards

- **ESLint with Airbnb configuration** — run the linter before submitting changes
- Follow existing patterns and conventions in the codebase
- Keep changes focused — avoid unrelated refactors in the same PR

## Testing

Run tests before submitting a pull request:

```bash
# Web app tests
cd web/app && npm test

# Ingest service tests
cd ingest && npm test
```

The web app uses **Mocha** with **Chai** assertions and **Sinon** for mocking. The ingest service uses the same stack with **mongo-unit** for database testing.

## Pull Request Process

1. **Fork the repository** and create a feature branch from `main`
2. **Make your changes** with clear, descriptive commit messages
3. **Run linting and tests** to verify nothing is broken
4. **Open a pull request** against `main` with a description of what the change does and why
5. A maintainer will review your PR — please be responsive to feedback

## Reporting Bugs

When filing a bug report, include:

- Steps to reproduce the issue
- Expected vs. actual behavior
- Environment details (OS, Node.js version, browser)
- Relevant logs or screenshots

## Requesting Features

Feature requests are welcome. Open an issue describing:

- The problem you are trying to solve
- Your proposed solution or approach
- Any alternatives you have considered

## Code of Conduct

We expect all participants to behave professionally and respectfully. Be constructive in discussions, welcoming to newcomers, and considerate of differing viewpoints.

## License

By contributing to OpenRobOps, you agree that your contributions will be licensed under the [Apache License 2.0](https://github.com/OpenRobOps/oro/blob/main/LICENSE).
