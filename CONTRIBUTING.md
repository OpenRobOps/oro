# Contributing to OpenRobOps

Thank you for your interest in contributing to OpenRobOps! This project is
open source under the [Apache License 2.0](LICENSE), and we welcome
contributions from the community.

For an overview of the project, see the [README](README.md).

## How to Contribute

There are several ways to contribute:

- **Report bugs** or **request features** by opening a
  [GitHub issue](https://github.com/OpenRobOps/oro/issues)
- **Submit pull requests** with bug fixes, improvements, or new features
- **Improve documentation** — typos, clarifications, and examples are always
  welcome
- **Join discussions** on existing issues and PRs

## Development Setup

Follow the instructions in [README-dev.md](README-dev.md) to set up your local
development environment. In short, you will need Node.js v22, Meteor 3.4,
Docker Compose, and Terraform.

## Coding Standards

- The project uses **ESLint with the Airbnb configuration**. Run the linter
  before submitting changes and ensure there are no new warnings or errors.
- Follow existing patterns and conventions in the codebase.
- Keep changes focused — avoid unrelated refactors in the same PR.

## Testing

Run tests before submitting a pull request:

```bash
# Web app tests
cd web/app && npm test

# Ingest service tests
cd ingest && npm test
```

Make sure all existing tests pass and add tests for new functionality when
applicable.

## Pull Request Process

1. **Fork the repository** and create a feature branch from `main`.
2. **Make your changes** with clear, descriptive commit messages.
3. **Run linting and tests** to verify nothing is broken.
4. **Open a pull request** against `main` with a description of what the change
   does and why.
5. A maintainer will review your PR. Please be responsive to feedback.

## Reporting Bugs

When filing a bug report, please include:

- Steps to reproduce the issue
- Expected vs. actual behavior
- Environment details (OS, Node.js version, browser and/or SDKs versions if applicable)
- Relevant logs or screenshots

## Requesting Features

Feature requests are welcome. Please open an issue describing:

- The problem you are trying to solve
- Your proposed solution or approach
- Any alternatives you have considered

## Code of Conduct

We expect all participants to behave professionally and respectfully. Be
constructive in discussions, welcoming to newcomers, and considerate of
differing viewpoints. Harassment, discrimination, and disruptive behavior will
not be tolerated.

## License

By contributing to OpenRobOps, you agree that your contributions will be
licensed under the [Apache License 2.0](LICENSE), consistent with the project's
licensing terms.
